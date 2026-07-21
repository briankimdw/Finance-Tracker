import type { PredictionActivity } from "@/lib/types";

// ────────────────────────────── CSV parsing ──────────────────────────────
// Robinhood's activity exports ("Futures & Event Contracts" statement, or the
// full account CSV) share a shape: Activity Date, Process Date, Settle Date,
// Instrument, Description, Trans Code, Quantity, Price, Amount. Column order
// varies between exports, so headers are matched by name, not position.

/** RFC-4180-ish tokenizer: quoted fields, embedded commas/newlines, "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** "$1,234.56" → 1234.56 · "($47.88)" → -47.88 · "" → null */
function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const s = raw.replace(/[$,\s]/g, "");
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s);
  const num = parseFloat(s.replace(/[()]/g, ""));
  if (!Number.isFinite(num)) return null;
  return neg ? -num : num;
}

/** Accepts M/D/YYYY or YYYY-MM-DD; returns YYYY-MM-DD or null. */
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

function findCol(headers: string[], ...names: string[]): number {
  for (const n of names) {
    const idx = headers.findIndex((h) => h === n);
    if (idx !== -1) return idx;
  }
  for (const n of names) {
    const idx = headers.findIndex((h) => h.includes(n));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Segments that are pure noise in a "A - B - C" style description. The
// remaining segments form the market title, so buys, sells and settlement
// rows of the same market all normalize to one identical name.
const NOISE_SEGMENT = /^(yes|no|settlement|settled|expiration|expired|buy|sell|bought|sold|event contracts?)$/i;

/** Pulls a clean market title + Yes/No side out of a raw activity description. */
export function extractMarket(description: string): { market: string; side: string | null } {
  const clean = description.replace(/\s+/g, " ").trim();
  let side: string | null = null;
  const m = clean.match(/\b(yes|no)\b/i);
  if (m) side = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();

  // Split only on separators with surrounding spaces so hyphenated names
  // ("T-Mobile") survive intact.
  const segments = clean
    .split(/\s[-–—|]\s/)
    .map((s) => s.trim())
    .filter((s) => s !== "" && !NOISE_SEGMENT.test(s));
  let market = segments.join(" - ").replace(/\s+/g, " ").trim();
  if (!market) market = clean;
  return { market, side };
}

export interface ParsedActivityRow {
  activity_date: string;
  process_date: string | null;
  settle_date: string | null;
  instrument: string | null;
  description: string;
  trans_code: string;
  quantity: number | null;
  price: number | null;
  amount: number;
  market: string | null;
  outcome_side: string | null;
}

// Pure cash movements that are never trades, whatever file they came from.
const CASHFLOW_CODES = new Set([
  "ACH", "ACHR", "RTP", "WIRE", "CDIV", "MDIV", "INT", "GOLD", "DFEE",
  "DTAX", "FEE", "MINT", "SLIP", "GDBP", "ACATI", "ACATO", "DCF",
]);

/**
 * Heuristic filter so a full-account CSV can be dropped in and only the
 * prediction/event-contract rows are kept. Dedicated event-contract exports
 * pass almost everything through.
 */
export function looksLikeEventRow(row: { description: string; trans_code: string; price: number | null }): boolean {
  const code = row.trans_code.toUpperCase();
  if (CASHFLOW_CODES.has(code)) return false;
  const desc = row.description.toLowerCase();
  // Options rows reuse the same trans codes — rule them out first.
  if ((desc.includes("option") || /\b(call|put)\b/.test(desc)) && !desc.includes("event")) return false;
  if (desc.includes("event")) return true;
  if (["SETL", "SETTLEMENT"].includes(code)) return true;
  if (/settle|expir/.test(desc)) return true;
  // Event contracts price between $0 and $1 per contract.
  if (row.price !== null && row.price >= 0 && row.price <= 1.001 &&
      ["BTO", "STC", "BTC", "STO", "TRADE", "BUY", "SELL", "OEXP"].includes(code)) return true;
  return false;
}

export interface CsvParseResult {
  headerFound: boolean;
  rows: ParsedActivityRow[];       // every valid data row
  eventRows: ParsedActivityRow[];  // rows passing the event-contract filter
  skippedNonEvent: number;
  invalidRows: number;
}

export function parseRobinhoodCsv(text: string): CsvParseResult {
  const grid = parseCsv(text);

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const cells = grid[i].map((c) => c.trim().toLowerCase());
    if (cells.some((c) => c.includes("description")) &&
        (cells.some((c) => c.includes("amount")) || cells.some((c) => c.includes("trans")))) {
      headerIdx = i;
      headers = cells;
      break;
    }
  }
  if (headerIdx === -1) {
    return { headerFound: false, rows: [], eventRows: [], skippedNonEvent: 0, invalidRows: 0 };
  }

  const cActivity = findCol(headers, "activity date", "date");
  const cProcess = findCol(headers, "process date");
  const cSettle = findCol(headers, "settle date");
  const cInstrument = findCol(headers, "instrument", "symbol");
  const cDesc = findCol(headers, "description");
  const cCode = findCol(headers, "trans code", "trans_code", "type");
  const cQty = findCol(headers, "quantity", "qty");
  const cPrice = findCol(headers, "price");
  const cAmount = findCol(headers, "amount");

  const rows: ParsedActivityRow[] = [];
  let invalid = 0;
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    if (r.every((c) => !c.trim())) continue;
    const activityDate = cActivity !== -1 ? parseDate(r[cActivity] || "") : null;
    const description = (cDesc !== -1 ? r[cDesc] || "" : "").replace(/\s+/g, " ").trim();
    const amount = cAmount !== -1 ? parseMoney(r[cAmount] || "") : null;
    if (!activityDate || !description || amount === null) { invalid++; continue; }
    const transCode = ((cCode !== -1 ? r[cCode] : "") || "").trim().toUpperCase() || "TRADE";
    const { market, side } = extractMarket(description);
    rows.push({
      activity_date: activityDate,
      process_date: cProcess !== -1 ? parseDate(r[cProcess] || "") : null,
      settle_date: cSettle !== -1 ? parseDate(r[cSettle] || "") : null,
      instrument: cInstrument !== -1 ? (r[cInstrument] || "").trim() || null : null,
      description,
      trans_code: transCode,
      quantity: cQty !== -1 ? parseMoney(r[cQty] || "") : null,
      price: cPrice !== -1 ? parseMoney(r[cPrice] || "") : null,
      amount,
      market,
      outcome_side: side,
    });
  }

  const eventRows = rows.filter(looksLikeEventRow);
  return { headerFound: true, rows, eventRows, skippedNonEvent: rows.length - eventRows.length, invalidRows: invalid };
}

/**
 * Stable dedupe hashes for a batch of parsed rows. Identical fills within one
 * file get an occurrence ordinal so they survive, while re-importing the same
 * (or an overlapping) file still dedupes cleanly.
 */
export async function hashActivityRows(rows: ParsedActivityRow[]): Promise<string[]> {
  const counts = new Map<string, number>();
  const out: string[] = [];
  for (const r of rows) {
    const base = [r.activity_date, r.trans_code, r.description, r.quantity ?? "", r.price ?? "", r.amount].join("|");
    const n = counts.get(base) || 0;
    counts.set(base, n + 1);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${base}#${n}`));
    out.push(Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

// ────────────────────────────── Stats engine ──────────────────────────────

export interface PredictionMarketStats {
  key: string;
  market: string;
  side: string | null;
  firstDate: string;
  lastDate: string;
  buyCount: number;
  sellCount: number;
  contracts: number;   // total contracts bought
  amountIn: number;    // total cash spent
  amountOut: number;   // total cash received (sells + settlements)
  netPnl: number;      // amountOut - amountIn (realized once settled)
  settled: boolean;
  rows: PredictionActivity[];
}

export function groupIntoMarkets(activities: PredictionActivity[]): PredictionMarketStats[] {
  const map = new Map<string, PredictionMarketStats>();
  for (const a of activities) {
    const marketName = (a.market || a.description).trim() || "Unknown market";
    const key = marketName.toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = {
        key, market: marketName, side: a.outcome_side,
        firstDate: a.activity_date, lastDate: a.activity_date,
        buyCount: 0, sellCount: 0, contracts: 0,
        amountIn: 0, amountOut: 0, netPnl: 0, settled: false, rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(a);
    if (a.activity_date < g.firstDate) g.firstDate = a.activity_date;
    if (a.activity_date > g.lastDate) g.lastDate = a.activity_date;
    if (!g.side && a.outcome_side) g.side = a.outcome_side;
    const amt = Number(a.amount);
    if (amt < 0) { g.buyCount++; g.amountIn += -amt; g.contracts += Number(a.quantity || 0); }
    else if (amt > 0) { g.sellCount++; g.amountOut += amt; }
    g.netPnl = g.amountOut - g.amountIn;
    const code = (a.trans_code || "").toUpperCase();
    if (a.settle_date || ["OEXP", "SETL", "SETTLEMENT"].includes(code) || /settle|expir/i.test(a.description)) {
      g.settled = true;
    }
  }
  for (const g of map.values()) {
    // A flat position (everything bought was sold back) also counts as settled.
    if (!g.settled) {
      const bought = g.rows.filter((r) => Number(r.amount) < 0).reduce((s, r) => s + Number(r.quantity || 0), 0);
      const sold = g.rows.filter((r) => Number(r.amount) > 0).reduce((s, r) => s + Number(r.quantity || 0), 0);
      if (bought > 0 && Math.abs(bought - sold) < 0.01) g.settled = true;
    }
    g.rows.sort((x, y) => (x.activity_date < y.activity_date ? -1 : 1));
  }
  return [...map.values()].sort((a, b) => (a.lastDate > b.lastDate ? -1 : 1));
}

export interface PredictionOverallStats {
  totalPnl: number;      // realized, over settled markets
  openNet: number;       // net cash currently tied up in open markets (negative = at risk)
  openCount: number;
  settledCount: number;
  totalMarkets: number;
  totalFills: number;
  totalVolume: number;   // total cash put in
  winCount: number;
  lossCount: number;
  pushCount: number;
  winRate: number;       // 0-100, over settled markets
  avgWin: number;
  avgLoss: number;
  profitFactor: number;  // gross wins / gross losses
  best: PredictionMarketStats | null;
  worst: PredictionMarketStats | null;
  cumulative: { date: string; pnl: number }[];
  monthly: { month: string; label: string; pnl: number }[];
}

export function computeOverallStats(markets: PredictionMarketStats[]): PredictionOverallStats {
  const settled = markets.filter((m) => m.settled);
  const open = markets.filter((m) => !m.settled);
  const wins = settled.filter((m) => m.netPnl > 0.005);
  const losses = settled.filter((m) => m.netPnl < -0.005);
  const grossWin = wins.reduce((s, m) => s + m.netPnl, 0);
  const grossLoss = losses.reduce((s, m) => s + -m.netPnl, 0);

  const byDate = new Map<string, number>();
  for (const m of settled) byDate.set(m.lastDate, (byDate.get(m.lastDate) || 0) + m.netPnl);
  const dates = [...byDate.keys()].sort();
  let run = 0;
  const cumulative = dates.map((d) => {
    run += byDate.get(d)!;
    return { date: d, pnl: Math.round(run * 100) / 100 };
  });

  const byMonth = new Map<string, number>();
  for (const m of settled) {
    const month = m.lastDate.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + m.netPnl);
  }
  const monthly = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, pnl]) => ({
      month,
      label: new Date(month + "-15T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      pnl: Math.round(pnl * 100) / 100,
    }));

  return {
    totalPnl: settled.reduce((s, m) => s + m.netPnl, 0),
    openNet: open.reduce((s, m) => s + m.netPnl, 0),
    openCount: open.length,
    settledCount: settled.length,
    totalMarkets: markets.length,
    totalFills: markets.reduce((s, m) => s + m.rows.length, 0),
    totalVolume: markets.reduce((s, m) => s + m.amountIn, 0),
    winCount: wins.length,
    lossCount: losses.length,
    pushCount: settled.length - wins.length - losses.length,
    winRate: settled.length > 0 ? (wins.length / settled.length) * 100 : 0,
    avgWin: wins.length > 0 ? grossWin / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    best: settled.length ? settled.reduce((a, b) => (a.netPnl >= b.netPnl ? a : b)) : null,
    worst: settled.length ? settled.reduce((a, b) => (a.netPnl <= b.netPnl ? a : b)) : null,
    cumulative,
    monthly,
  };
}

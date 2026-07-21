import { NextResponse } from "next/server";

// Best-effort keyless quotes via Stooq's public CSV endpoint. The client
// falls back to stored last_price values whenever this returns nothing,
// mirroring how metal prices degrade to cached/fallback values.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("symbols") || "").trim();
  if (!raw) return NextResponse.json({ prices: {}, source: "none" });

  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z.]{1,10}$/.test(s))
    .slice(0, 40);
  if (symbols.length === 0) return NextResponse.json({ prices: {}, source: "none" });

  try {
    const list = symbols.map((s) => `${s.toLowerCase()}.us`).join("+");
    const res = await fetch(`https://stooq.com/q/l/?s=${list}&f=sd2t2ohlcv&h&e=csv`, { cache: "no-store" });
    const text = await res.text();
    const prices: Record<string, number> = {};
    // CSV: Symbol,Date,Time,Open,High,Low,Close,Volume — "N/D" for unknowns
    for (const line of text.trim().split("\n").slice(1)) {
      const cols = line.split(",");
      const sym = (cols[0] || "").replace(/\.us$/i, "").toUpperCase();
      const close = parseFloat(cols[6]);
      if (sym && Number.isFinite(close) && close > 0) prices[sym] = close;
    }
    return NextResponse.json({ prices, source: "stooq", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ prices: {}, source: "error" });
  }
}

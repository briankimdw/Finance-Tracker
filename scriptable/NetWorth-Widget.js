// ============================================================
// NetWorth Tracker — Scriptable Widget
// ============================================================
// Shows your net worth and key stats on the iOS home screen.
//
// SETUP (one time):
//  1. Install Scriptable from the App Store (free)
//  2. Open Scriptable, tap + to create a new script
//  3. Paste this entire file
//  4. Tap the "play" button to run once — you'll be asked for
//     your NetWorth Tracker email and password. They're stored
//     securely in iOS Keychain (never leaves your phone)
//  5. Long-press your home screen → + → Scriptable → pick size
//     → add widget → long-press widget → Edit Widget → Script:
//     "NetWorth Tracker" → Done
//
// SIZES:
//  - Small: Net Worth + monthly net
//  - Medium: adds cash, debt, inventory, metals
//  - Large: adds budget & goals progress
// ============================================================

const CONFIG = {
  supabaseUrl: "https://bpvogbyxuiteqrrdwdee.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdm9nYnl4dWl0ZXFycmR3ZGVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTkyOTEsImV4cCI6MjA5MTU3NTI5MX0.C6O_9O67OBYtheBNlhHWHbtnlpOVvEIi9zBYlbUxOPM",
  appUrl: "https://finance-tracker-three-alpha-43.vercel.app",
  cacheMinutes: 10, // data cached this long
};

// ============================================================
// AUTH: stores email/password in iOS Keychain, refreshes token
// ============================================================

async function getAccessToken() {
  const cachedToken = Keychain.contains("nwt_access_token") ? Keychain.get("nwt_access_token") : null;
  const cachedExpiry = Keychain.contains("nwt_token_expiry") ? parseInt(Keychain.get("nwt_token_expiry")) : 0;

  // Valid cached token
  if (cachedToken && Date.now() < cachedExpiry - 60_000) return cachedToken;

  // Need fresh login
  let email, password;

  if (Keychain.contains("nwt_email") && Keychain.contains("nwt_password")) {
    email = Keychain.get("nwt_email");
    password = Keychain.get("nwt_password");
  } else {
    const a = new Alert();
    a.title = "NetWorth Tracker Login";
    a.message = "Stored securely in iOS Keychain on this device only.";
    a.addTextField("Email", "");
    a.addSecureTextField("Password", "");
    a.addAction("Sign In");
    a.addCancelAction("Cancel");
    const idx = await a.presentAlert();
    if (idx === -1) throw new Error("Sign in cancelled");
    email = a.textFieldValue(0);
    password = a.textFieldValue(1);
  }

  const req = new Request(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`);
  req.method = "POST";
  req.headers = { apikey: CONFIG.anonKey, "Content-Type": "application/json" };
  req.body = JSON.stringify({ email, password });
  const res = await req.loadJSON();

  if (!res.access_token) {
    // Clear bad creds
    if (Keychain.contains("nwt_email")) Keychain.remove("nwt_email");
    if (Keychain.contains("nwt_password")) Keychain.remove("nwt_password");
    throw new Error(res.error_description || res.msg || "Login failed");
  }

  // Store for next time (keeps password so we can refresh silently)
  Keychain.set("nwt_email", email);
  Keychain.set("nwt_password", password);
  Keychain.set("nwt_access_token", res.access_token);
  Keychain.set("nwt_token_expiry", String(Date.now() + res.expires_in * 1000));
  if (res.user?.id) Keychain.set("nwt_user_id", res.user.id);
  return res.access_token;
}

async function supabaseQuery(token, path) {
  const req = new Request(`${CONFIG.supabaseUrl}/rest/v1/${path}`);
  req.headers = {
    apikey: CONFIG.anonKey,
    Authorization: `Bearer ${token}`,
  };
  return req.loadJSON();
}

// ============================================================
// DATA FETCH: pulls everything needed for net worth & stats
// ============================================================

async function fetchData() {
  // Try cache first
  const cachePath = FileManager.local().joinPath(FileManager.local().temporaryDirectory(), "nwt_cache.json");
  const fm = FileManager.local();
  if (fm.fileExists(cachePath)) {
    try {
      const cached = JSON.parse(fm.readString(cachePath));
      if (Date.now() - cached.ts < CONFIG.cacheMinutes * 60_000) return cached.data;
    } catch {}
  }

  const token = await getAccessToken();
  const userId = Keychain.get("nwt_user_id");
  const userFilter = `user_id=eq.${userId}`;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = now.getMonth() + 2;
  const endYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const endMonth = nextMonth > 12 ? 1 : nextMonth;
  const monthEnd = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const [
    accounts, cards, expenses, income, debts, holdings, items, budgets, goals, monthExpenses, monthIncome
  ] = await Promise.all([
    supabaseQuery(token, `cash_accounts?${userFilter}&select=id,name,type,balance,color`),
    supabaseQuery(token, `credit_cards?${userFilter}&select=id,name,credit_limit,color`),
    supabaseQuery(token, `expenses?${userFilter}&select=amount,credit_card_id,is_card_payment,category`),
    supabaseQuery(token, `income?${userFilter}&select=amount,type`),
    supabaseQuery(token, `debts?${userFilter}&select=direction,original_amount,settled`),
    supabaseQuery(token, `holdings?${userFilter}&select=metal,quantity,cost_per_oz,status`),
    supabaseQuery(token, `items?${userFilter}&select=purchase_price,status`),
    supabaseQuery(token, `budgets?${userFilter}&select=category,monthly_amount,color`),
    supabaseQuery(token, `goals?${userFilter}&select=id,name,target_amount,color,icon,completed`),
    supabaseQuery(token, `expenses?${userFilter}&select=amount,is_card_payment,category&is_card_payment=eq.false&date=gte.${monthStart}&date=lt.${monthEnd}`),
    supabaseQuery(token, `income?${userFilter}&select=amount,type&date=gte.${monthStart}&date=lt.${monthEnd}`),
  ]);

  // Default metal prices (live prices would require an additional API call)
  const metalPrices = { gold: 2935, silver: 32.8, platinum: 985, palladium: 955 };

  // Calculate
  const totalCash = accounts.reduce((s, a) => s + Number(a.balance), 0);

  // Debt per card
  const cardDebt = cards.reduce((sum, c) => {
    const cardExp = expenses.filter((e) => e.credit_card_id === c.id);
    const charges = cardExp.filter((e) => !e.is_card_payment).reduce((s, e) => s + Number(e.amount), 0);
    const payments = cardExp.filter((e) => e.is_card_payment).reduce((s, e) => s + Number(e.amount), 0);
    return sum + Math.max(0, charges - payments);
  }, 0);

  const metalValue = holdings
    .filter((h) => h.status === "active")
    .reduce((s, h) => s + Number(h.quantity) * (metalPrices[h.metal] || 0), 0);

  const inventoryValue = items
    .filter((i) => i.status === "active")
    .reduce((s, i) => s + Number(i.purchase_price), 0);

  const activeDebts = debts.filter((d) => !d.settled);
  const iOwe = activeDebts.filter((d) => d.direction === "i_owe").reduce((s, d) => s + Number(d.original_amount), 0);
  const theyOwe = activeDebts.filter((d) => d.direction === "they_owe").reduce((s, d) => s + Number(d.original_amount), 0);

  const netWorth = totalCash + metalValue + inventoryValue + theyOwe - cardDebt - iOwe;

  const monthlyIncomeAmt = monthIncome.reduce((s, i) => s + Number(i.amount), 0);
  const monthlyExpensesAmt = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthlyNet = monthlyIncomeAmt - monthlyExpensesAmt;

  // Budget: top 3 most-used
  const budgetList = budgets.map((b) => {
    const spent = monthExpenses.filter((e) => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0);
    return {
      category: b.category,
      spent,
      limit: Number(b.monthly_amount),
      color: b.color,
      pct: Number(b.monthly_amount) > 0 ? spent / Number(b.monthly_amount) : 0,
    };
  }).sort((a, b) => b.pct - a.pct).slice(0, 3);

  // Goals: top 3 by progress (not completed)
  const activeGoals = goals.filter((g) => !g.completed);

  const data = {
    netWorth,
    totalCash,
    cardDebt,
    metalValue,
    inventoryValue,
    monthlyIncomeAmt,
    monthlyExpensesAmt,
    monthlyNet,
    budgets: budgetList,
    goals: activeGoals.slice(0, 3),
    updatedAt: now.toISOString(),
  };

  fm.writeString(cachePath, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

// ============================================================
// UI HELPERS
// ============================================================

const COLORS = {
  bg: new Color("#FFFFFF"),
  bgAlt: new Color("#FAFAFA"),
  border: new Color("#E5E7EB"),
  text: new Color("#111827"),
  textMuted: new Color("#6B7280"),
  textFaint: new Color("#9CA3AF"),
  green: new Color("#10B981"),
  red: new Color("#EF4444"),
  blue: new Color("#3B82F6"),
  amber: new Color("#F59E0B"),
  purple: new Color("#8B5CF6"),
};

function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(2)}`;
}

function fmtShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}k`;
  return `${n < 0 ? "-" : ""}$${Math.round(abs)}`;
}

function addSeparator(stack, height = 8) {
  const s = stack.addSpacer(height);
  return s;
}

// ============================================================
// WIDGETS
// ============================================================

function smallWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(14, 14, 14, 14);
  w.url = CONFIG.appUrl;

  const header = w.addStack();
  header.layoutHorizontally();
  const title = header.addText("NET WORTH");
  title.font = Font.mediumSystemFont(10);
  title.textColor = COLORS.textFaint;
  header.addSpacer();

  w.addSpacer(6);

  const value = w.addText(fmt(data.netWorth));
  value.font = Font.boldSystemFont(22);
  value.textColor = data.netWorth >= 0 ? COLORS.text : COLORS.red;
  value.minimumScaleFactor = 0.6;
  value.lineLimit = 1;

  w.addSpacer();

  const monthName = new Date().toLocaleDateString("en-US", { month: "short" });
  const net = data.monthlyNet;
  const netStack = w.addStack();
  netStack.layoutHorizontally();
  netStack.centerAlignContent();
  const arrow = netStack.addText(net >= 0 ? "▲" : "▼");
  arrow.font = Font.systemFont(10);
  arrow.textColor = net >= 0 ? COLORS.green : COLORS.red;
  netStack.addSpacer(4);
  const netLabel = netStack.addText(`${monthName}: ${fmt(net)}`);
  netLabel.font = Font.mediumSystemFont(11);
  netLabel.textColor = net >= 0 ? COLORS.green : COLORS.red;

  const updated = w.addText(`Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
  updated.font = Font.systemFont(8);
  updated.textColor = COLORS.textFaint;

  return w;
}

function mediumWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(14, 14, 14, 14);
  w.url = CONFIG.appUrl;

  // Header row
  const header = w.addStack();
  header.layoutHorizontally();
  const leftHeader = header.addStack();
  leftHeader.layoutVertically();
  const title = leftHeader.addText("NET WORTH");
  title.font = Font.mediumSystemFont(10);
  title.textColor = COLORS.textFaint;
  leftHeader.addSpacer(2);
  const value = leftHeader.addText(fmt(data.netWorth));
  value.font = Font.boldSystemFont(24);
  value.textColor = data.netWorth >= 0 ? COLORS.text : COLORS.red;

  header.addSpacer();

  // Monthly net on the right
  const rightHeader = header.addStack();
  rightHeader.layoutVertically();
  rightHeader.setPadding(4, 8, 4, 8);
  rightHeader.backgroundColor = data.monthlyNet >= 0 ? new Color("#10B981", 0.1) : new Color("#EF4444", 0.1);
  rightHeader.cornerRadius = 8;
  const monthName = new Date().toLocaleDateString("en-US", { month: "short" });
  const monthLabel = rightHeader.addText(monthName.toUpperCase());
  monthLabel.font = Font.mediumSystemFont(9);
  monthLabel.textColor = data.monthlyNet >= 0 ? COLORS.green : COLORS.red;
  const netText = rightHeader.addText(fmtShort(data.monthlyNet));
  netText.font = Font.boldSystemFont(14);
  netText.textColor = data.monthlyNet >= 0 ? COLORS.green : COLORS.red;

  w.addSpacer(10);

  // 4 stat pills
  const stats = w.addStack();
  stats.layoutHorizontally();
  stats.spacing = 6;

  const addStat = (label, amount, color) => {
    const s = stats.addStack();
    s.layoutVertically();
    s.setPadding(8, 10, 8, 10);
    s.backgroundColor = COLORS.bgAlt;
    s.cornerRadius = 10;
    s.size = new Size(0, 0);
    const l = s.addText(label);
    l.font = Font.mediumSystemFont(8);
    l.textColor = COLORS.textFaint;
    s.addSpacer(2);
    const v = s.addText(fmtShort(amount));
    v.font = Font.boldSystemFont(13);
    v.textColor = color;
    v.minimumScaleFactor = 0.7;
    v.lineLimit = 1;
  };
  addStat("CASH", data.totalCash, COLORS.green);
  addStat("DEBT", -data.cardDebt, COLORS.red);
  addStat("METALS", data.metalValue, COLORS.amber);
  addStat("INVENTORY", data.inventoryValue, COLORS.blue);

  w.addSpacer();

  const updated = w.addText(`Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
  updated.font = Font.systemFont(8);
  updated.textColor = COLORS.textFaint;

  return w;
}

function largeWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(14, 14, 14, 14);
  w.url = CONFIG.appUrl;

  // Top: Net worth + monthly
  const header = w.addStack();
  header.layoutHorizontally();
  const leftHeader = header.addStack();
  leftHeader.layoutVertically();
  const title = leftHeader.addText("NET WORTH");
  title.font = Font.mediumSystemFont(10);
  title.textColor = COLORS.textFaint;
  leftHeader.addSpacer(2);
  const value = leftHeader.addText(fmt(data.netWorth));
  value.font = Font.boldSystemFont(26);
  value.textColor = data.netWorth >= 0 ? COLORS.text : COLORS.red;

  header.addSpacer();

  const rightHeader = header.addStack();
  rightHeader.layoutVertically();
  rightHeader.setPadding(4, 10, 4, 10);
  rightHeader.backgroundColor = data.monthlyNet >= 0 ? new Color("#10B981", 0.1) : new Color("#EF4444", 0.1);
  rightHeader.cornerRadius = 8;
  const monthName = new Date().toLocaleDateString("en-US", { month: "short" });
  const ml = rightHeader.addText(monthName.toUpperCase());
  ml.font = Font.mediumSystemFont(9);
  ml.textColor = data.monthlyNet >= 0 ? COLORS.green : COLORS.red;
  const netText = rightHeader.addText(fmtShort(data.monthlyNet));
  netText.font = Font.boldSystemFont(14);
  netText.textColor = data.monthlyNet >= 0 ? COLORS.green : COLORS.red;

  w.addSpacer(12);

  // 4 stats grid
  const statsRow = w.addStack();
  statsRow.layoutHorizontally();
  statsRow.spacing = 6;
  const addStat = (label, amount, color) => {
    const s = statsRow.addStack();
    s.layoutVertically();
    s.setPadding(8, 10, 8, 10);
    s.backgroundColor = COLORS.bgAlt;
    s.cornerRadius = 10;
    const l = s.addText(label);
    l.font = Font.mediumSystemFont(8);
    l.textColor = COLORS.textFaint;
    s.addSpacer(2);
    const v = s.addText(fmtShort(amount));
    v.font = Font.boldSystemFont(13);
    v.textColor = color;
    v.lineLimit = 1;
    v.minimumScaleFactor = 0.7;
  };
  addStat("CASH", data.totalCash, COLORS.green);
  addStat("DEBT", -data.cardDebt, COLORS.red);
  addStat("METALS", data.metalValue, COLORS.amber);
  addStat("INVENTORY", data.inventoryValue, COLORS.blue);

  w.addSpacer(14);

  // Budgets section
  if (data.budgets.length > 0) {
    const bh = w.addText("BUDGETS");
    bh.font = Font.mediumSystemFont(9);
    bh.textColor = COLORS.textFaint;
    w.addSpacer(6);
    for (const b of data.budgets) {
      const row = w.addStack();
      row.layoutVertically();
      const top = row.addStack();
      top.layoutHorizontally();
      const cat = top.addText(b.category);
      cat.font = Font.mediumSystemFont(11);
      cat.textColor = COLORS.text;
      top.addSpacer();
      const amt = top.addText(`${fmtShort(b.spent)} / ${fmtShort(b.limit)}`);
      amt.font = Font.systemFont(10);
      amt.textColor = b.pct > 1 ? COLORS.red : COLORS.textMuted;
      row.addSpacer(3);
      // Progress bar (faux — draw two stacks)
      const bar = row.addStack();
      bar.layoutHorizontally();
      bar.backgroundColor = new Color("#F3F4F6");
      bar.cornerRadius = 2;
      bar.size = new Size(0, 4);
      const fill = bar.addStack();
      fill.backgroundColor = b.pct > 1 ? COLORS.red : new Color(b.color);
      fill.cornerRadius = 2;
      fill.size = new Size(Math.max(4, Math.min(1, b.pct) * 280), 4);
      w.addSpacer(6);
    }
  }

  // Goals: just names + progress (if no budgets)
  if (data.budgets.length === 0 && data.goals.length > 0) {
    const gh = w.addText("GOALS");
    gh.font = Font.mediumSystemFont(9);
    gh.textColor = COLORS.textFaint;
    w.addSpacer(4);
    for (const g of data.goals) {
      const row = w.addStack();
      row.layoutHorizontally();
      const name = row.addText(g.name);
      name.font = Font.mediumSystemFont(11);
      name.textColor = COLORS.text;
      row.addSpacer();
      const target = row.addText(fmtShort(g.target_amount));
      target.font = Font.systemFont(10);
      target.textColor = COLORS.textMuted;
      w.addSpacer(4);
    }
  }

  w.addSpacer();
  const updated = w.addText(`Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
  updated.font = Font.systemFont(8);
  updated.textColor = COLORS.textFaint;

  return w;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  let data;
  try {
    data = await fetchData();
  } catch (e) {
    // Show error widget
    const w = new ListWidget();
    w.backgroundColor = COLORS.bg;
    w.setPadding(14, 14, 14, 14);
    const t = w.addText("NetWorth Widget");
    t.font = Font.boldSystemFont(14);
    t.textColor = COLORS.text;
    w.addSpacer(6);
    const err = w.addText(String(e.message || e));
    err.font = Font.systemFont(10);
    err.textColor = COLORS.red;
    err.lineLimit = 4;
    w.addSpacer();
    const hint = w.addText("Run in Scriptable to re-login");
    hint.font = Font.systemFont(9);
    hint.textColor = COLORS.textFaint;
    return w;
  }

  const size = config.widgetFamily || "medium";
  if (size === "small") return smallWidget(data);
  if (size === "large") return largeWidget(data);
  return mediumWidget(data);
}

const widget = await main();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Preview in-app
  const size = args.widgetParameter || "medium";
  if (size === "small") widget.presentSmall();
  else if (size === "large") widget.presentLarge();
  else widget.presentMedium();
}

Script.complete();

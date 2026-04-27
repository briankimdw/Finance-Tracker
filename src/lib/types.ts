// ---- Profiles & friends ----

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  color: string | null;
  // Per-user nav visibility map. Missing key = visible. `{ "/metals": false }` hides Metals.
  nav_preferences: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface FriendRequest {
  id: string;
  from_user: string;
  to_user: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
}

// Enriched: a friend relationship with the other person's profile
export interface Friend {
  requestId: string;      // friend_requests.id
  userId: string;         // the other person's user id
  profile: Profile | null;
  since: string;          // friend_requests.updated_at when accepted
  direction: "incoming" | "outgoing"; // who originally sent the request
}

export type ItemStatus = "active" | "sold";

export type ItemCondition =
  | "New"
  | "Like New"
  | "Very Good"
  | "Good"
  | "Acceptable"
  | "For Parts";

export type BuyPlatform =
  | "eBay"
  | "Facebook Marketplace"
  | "Thrift Store"
  | "Garage Sale"
  | "Goodwill"
  | "Craigslist"
  | "OfferUp"
  | "Mercari"
  | "Wholesale"
  | "Free / Already Owned"
  | "Other";

export type SellPlatform =
  | "eBay"
  | "StockX"
  | "Mercari"
  | "Poshmark"
  | "Facebook Marketplace"
  | "OfferUp"
  | "Craigslist"
  | "Amazon"
  | "Depop"
  | "Grailed"
  | "Other";

export type ItemCategory =
  | "Sneakers"
  | "Clothing"
  | "Electronics"
  | "Toys & Collectibles"
  | "Books"
  | "Home & Garden"
  | "Sports"
  | "Accessories"
  | "Vintage"
  | "Other";

export interface Item {
  id: string;
  user_id: string;
  name: string;
  category: ItemCategory;
  purchase_price: number;
  purchase_date: string;
  platform_bought: BuyPlatform;
  condition: ItemCondition;
  notes: string | null;
  status: ItemStatus;
  sale_price: number | null;
  sale_date: string | null;
  platform_sold: SellPlatform | null;
  fees: number | null;
  shipping_costs: number | null;
  created_at: string;
}

export interface DashboardStats {
  totalInvested: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  activeItems: number;
  soldItems: number;
  inventoryValue: number;
}

// Income types

export type IncomeType = "main" | "side";

export type IncomeCategory =
  | "Salary"
  | "Wages"
  | "Commission"
  | "Bonus"
  | "Freelance"
  | "Gig Work"
  | "Tutoring"
  | "Content Creation"
  | "Rental"
  | "Investments"
  | "Dividends"
  | "Tips"
  | "Other";

export type IncomeFrequency = "Weekly" | "Biweekly" | "Monthly" | "One-time";

export interface Income {
  id: string;
  user_id: string | null;
  type: IncomeType;
  source: string;
  category: IncomeCategory;
  amount: number;
  date: string;
  recurring: boolean;
  frequency: IncomeFrequency | null;
  notes: string | null;
  created_at: string;
}

export interface SavedIncome {
  id: string;
  user_id: string | null;
  type: IncomeType;
  source: string;
  category: string;
  amount: number;
  frequency: IncomeFrequency | null;
  created_at: string;
}

export type ExpenseCategory =
  | "Rent / Mortgage"
  | "Utilities"
  | "Groceries"
  | "Dining Out"
  | "Transportation"
  | "Gas"
  | "Insurance"
  | "Subscriptions"
  | "Entertainment"
  | "Shopping"
  | "Health"
  | "Education"
  | "Phone / Internet"
  | "Personal Care"
  | "Gifts"
  | "Travel"
  | "Debt Payment"
  | "Savings"
  | "Taxes"
  | "Other";

export type ExpenseFrequency = "Weekly" | "Biweekly" | "Monthly" | "Yearly" | "One-time";

export type PaymentMethod = "cash" | "debit" | "credit" | "bank_transfer" | "other";

export interface Expense {
  id: string;
  user_id: string | null;
  name: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  recurring: boolean;
  frequency: ExpenseFrequency | null;
  notes: string | null;
  payment_method: PaymentMethod;
  credit_card_id: string | null;
  // Cash account this expense was paid from (when not paid with credit card),
  // or the funding account for a card payment. Nullable for older rows.
  cash_account_id: string | null;
  is_card_payment: boolean;
  // Shared by multiple expense rows that represent one purchase paid via
  // multiple methods (e.g. $40 cash + $60 card). UI groups rows with the
  // same split_group_id into a single line item. Null = single-method.
  split_group_id: string | null;
  created_at: string;
}

export interface CreditCard {
  id: string;
  user_id: string | null;
  name: string;
  last_four: string | null;
  color: string;
  credit_limit: number | null;
  display_order: number;
  due_day: number | null;       // Day of month payment is due (1-28)
  statement_day: number | null; // Day of month statement closes (1-28)
  created_at: string;
}

export interface CreditCardWithStats extends CreditCard {
  balance: number;
  totalCharges: number;
  totalPayments: number;
  utilization: number;
  nextDueDate: string | null;   // ISO date of next payment
  daysUntilDue: number | null;  // Days from today
}

// ---- Goals / Wishlist ----

export type GoalCategory = "savings" | "purchase" | "travel" | "emergency" | "investment" | "other";

export interface Goal {
  id: string;
  user_id: string | null;
  owner_id: string | null;
  is_shared: boolean;
  name: string;
  target_amount: number;
  category: GoalCategory;
  color: string;
  icon: string;          // Lucide icon name
  notes: string | null;
  target_date: string | null;
  display_order: number;
  completed: boolean;
  url: string | null;
  image_url: string | null;
  created_at: string;
}

export interface GoalMember {
  id: string;
  goal_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  email?: string;
}

export interface GoalInvite {
  id: string;
  goal_id: string;
  token: string;
  email: string | null;
  target_user_id: string | null;
  invited_by: string | null;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  user_id: string | null;
  source_cash_account_id: string | null;  // which account funded this
  amount: number;       // Positive = deposit, negative = withdrawal
  date: string;
  notes: string | null;
  created_at: string;
}

export interface GoalWithStats extends Goal {
  saved: number;          // Sum of all contributions
  remaining: number;      // target_amount - saved
  progress: number;       // 0-100 percentage
  daysUntilTarget: number | null;
  contributions: GoalContribution[];
  members: GoalMember[];
  isOwner: boolean;
  myRole: "owner" | "member" | null;
}

// ---- Trips (travel planning with itinerary budgets) ----

export type TripStatus = "planning" | "active" | "completed" | "cancelled";
export type TripItemCategory = "lodging" | "transport" | "food" | "activity" | "shopping" | "other";
export type TripItemStatus = "planned" | "done" | "skipped";

export interface Trip {
  id: string;
  user_id: string | null;
  goal_id: string | null;
  is_shared: boolean;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number;
  color: string;
  icon: string;
  image_url: string | null;
  notes: string | null;
  status: TripStatus;
  display_order: number;
  created_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  email?: string;
}

export interface TripInvite {
  id: string;
  trip_id: string;
  token: string;
  email: string | null;
  target_user_id: string | null;   // direct invite to a specific user (no email needed)
  invited_by: string | null;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface TripItemSplit {
  id: string;
  trip_item_id: string;
  user_id: string;
  amount: number;       // how much this user owes for this item
  created_at: string;
}

export interface TripItem {
  id: string;
  trip_id: string;
  user_id: string | null;
  paid_by: string | null;      // who actually paid (may differ from creator)
  name: string;
  category: TripItemCategory;
  planned_amount: number;
  actual_amount: number;
  item_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  confirmation_code: string | null;
  status: TripItemStatus;
  notes: string | null;
  url: string | null;
  display_order: number;
  created_at: string;
  splits: TripItemSplit[];     // enriched by the hook
}

// Simpler input shape used from the UI — the hook normalizes to split rows
export interface SplitInput {
  user_id: string;
  amount: number;
}

// Balance entry per member on a shared trip
export interface TripMemberBalance {
  userId: string;
  paid: number;        // total actual_amount they paid for done items
  share: number;       // their fair share (totalActual / memberCount)
  balance: number;     // paid - share: positive = owed money, negative = owes money
}

// A concrete settlement suggestion: `from` owes `to` `amount`
export interface TripSettlementEntry {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface TripWithStats extends Trip {
  items: TripItem[];
  members: TripMember[];
  isOwner: boolean;
  myRole: "owner" | "member" | null;
  // totals computed over items
  totalPlanned: number;    // sum of planned_amount on all items
  totalActual: number;     // sum of actual_amount for items with status='done'
  plannedUpcoming: number; // sum of planned_amount for items with status='planned'
  skippedSavings: number;  // sum of planned_amount for items with status='skipped'
  remaining: number;       // total_budget - totalActual - plannedUpcoming
  available: number;       // total_budget - totalActual (what's left of the pool right now)
  progress: number;        // (totalActual / total_budget) * 100
  overBudget: boolean;     // totalActual + plannedUpcoming > total_budget
  daysUntilStart: number | null;
  daysUntilEnd: number | null;
  // Per-member spending balances (only meaningful on shared trips with ≥2 members)
  balances: TripMemberBalance[];
  settlements: TripSettlementEntry[];
}

// ---- Debts / IOUs ----

export type DebtDirection = "i_owe" | "they_owe";

export interface Debt {
  id: string;
  user_id: string | null;
  person: string;
  direction: DebtDirection;
  description: string | null;
  original_amount: number;
  date: string;
  settled: boolean;
  settled_date: string | null;
  color: string;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string | null;
  amount: number;
  date: string;
  notes: string | null;
  // Account that received the money (they_owe) or funded the payment (i_owe).
  // Nullable for older rows recorded before this column existed.
  cash_account_id: string | null;
  created_at: string;
}

export interface DebtWithStats extends Debt {
  totalPaid: number;
  remaining: number;
  progress: number;
  payments: DebtPayment[];
}

export type CashAccountType = "checking" | "savings" | "cash" | "other";

export interface Transfer {
  id: string;
  user_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string | null;
  date: string;
  cash: number;
  metals: number;
  inventory: number;
  owed_to_me: number;
  card_debt: number;
  i_owe: number;
  net_worth: number;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string | null;
  category: string;
  monthly_amount: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithSpend extends Budget {
  spent: number;       // This month's spending in category
  remaining: number;
  progress: number;    // 0-100+ (can exceed 100 if over budget)
  overBudget: boolean;
}

export interface CashAccount {
  id: string;
  user_id: string | null;
  name: string;
  type: CashAccountType;
  balance: number;
  color: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Computed client-side by useCashAccounts: amount of the balance earmarked
  // for active goal contributions. `balance - reserved` = free to spend.
  reserved?: number;
}

export interface OverallStats {
  reselling: DashboardStats;
  mainIncome: number;
  sideIncome: number;
  totalExpenses: number;
  totalEarned: number;
  incomeCount: number;
}

// ---- Metals Portfolio ----

export type MetalType = "gold" | "silver" | "platinum" | "palladium";
export type HoldingForm = "coin" | "bar" | "round" | "other";
export type HoldingStatus = "active" | "sold" | "traded";

export interface Holding {
  id: string;
  user_id: string | null;
  metal: MetalType;
  type: HoldingForm;
  description: string;
  quantity: number;
  cost_per_oz: number;
  purchase_date: string | null;
  notes: string;
  status: HoldingStatus;
  sale_price_per_oz: number | null;
  sale_date: string | null;
  fees: number;
  created_at: string;
}

export interface MetalTransaction {
  id: string;
  user_id: string | null;
  type: "buy" | "sell" | "trade";
  notes: string;
  cash_amount: number;
  created_at: string;
  items?: MetalTransactionItem[];
}

export interface MetalTransactionItem {
  id: string;
  transaction_id: string;
  holding_id: string | null;
  direction: "in" | "out";
  holding?: Holding;
}

export interface MetalPrices {
  gold: number;
  silver: number;
  platinum: number;
  palladium: number;
  timestamp: string;
  source: "live" | "cache" | "fallback";
}

export interface MetalMetrics {
  totalOz: number;
  totalCost: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  count: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  pnlPercent: number;
  metalBreakdown: Record<MetalType, MetalMetrics>;
}

// ---- PC Deals (flip evaluator) ----

export type PCPartCategory =
  | "cpu"
  | "gpu"
  | "ram"
  | "storage"
  | "motherboard"
  | "psu"
  | "case"
  | "cooler"
  | "monitor"
  | "peripheral"
  | "other";

export type PCDealStatus = "evaluating" | "purchased" | "rejected" | "sold";

export interface PCDealPart {
  id: string;
  deal_id: string;
  category: PCPartCategory;
  name: string;
  condition: string | null;
  estimated_value: number;
  notes: string | null;
  display_order: number;
  created_at: string;
}

export interface PCDeal {
  id: string;
  user_id: string | null;
  name: string;
  source: string | null;
  listing_url: string | null;
  asking_price: number;
  seller_notes: string | null;
  condition: string | null;
  status: PCDealStatus;
  purchased_price: number | null;
  purchased_date: string | null;
  sold_for: number | null;
  sold_date: string | null;
  selling_fees: number;
  notes: string | null;
  inventory_item_id: string | null;  // when purchased, points to the auto-created items row
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type PCDealVerdict = "great" | "good" | "fair" | "skip";

export interface PCDealWithParts extends PCDeal {
  parts: PCDealPart[];
  totalPartsValue: number;    // sum of estimated_value
  potentialProfit: number;    // totalPartsValue - asking_price
  profitMargin: number;       // 0-100
  verdict: PCDealVerdict;
  actualProfit: number | null; // if status=sold: sold_for - purchased_price - selling_fees
}

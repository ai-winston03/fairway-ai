export type OperationsArea = "golf" | "pro-shop" | "clubhouse" | "members" | "automations" | "platform";
export type ReportRange = "mtd" | "last-month" | "this-quarter" | "last-quarter" | "ytd" | "custom";

export type Segment = { rounds: number; bookings: number; carts: number; greenFeeRevenue: number };
export type HoldCoverage = { status: "complete" | "partial" | "missing"; expectedDays: string[]; heldDays: string[]; missingDays: string[]; lastSyncedAt: string | null };
export type GolfSnapshot = {
  today: { date: string; bookings: number; occupancy: number; playersCheckedIn: number; playerNoShows: number; potentialSlots: number; slotsAvailable: number; revenue: number };
  period: { start: string; end: string; label: string };
  coverage?: HoldCoverage;
  member: Segment;
  nonMember: Segment;
  unclassifiedRounds: number;
  priceClasses: string[];
  sourceBookings: number;
  daily?: Array<{ date: string; rounds: number; bookings: number; occupancy: number; potentialSlots: number; slotsAvailable: number; revenue: number; greenFeeRevenue: number }>;
};
export type CommerceReport = {
  period: { start: string; end: string; label: string };
  coverage?: HoldCoverage;
  proShop: { transactions: number; unitsSold: number; revenue: number };
  clubhouse: { transactions: number; unitsSold: number; revenue: number };
  snackShack: { transactions: number; unitsSold: number; revenue: number };
  bar: { transactions: number; unitsSold: number; revenue: number };
  fnbUnassigned: { transactions: number; unitsSold: number; revenue: number };
  daily: Array<{ date: string; department: "pro_shop" | "snack_shack" | "bar" | "fnb_unassigned"; transactions: number; unitsSold: number; revenue: number }>;
};

export function percent(value: number) { return `${Math.round(Math.max(0, value) * 100)}%`; }
export function number(value: number, maximumFractionDigits = 0) { return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value); }
export function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
export function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
export function formatShortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }); }
export function formatRange(period: GolfSnapshot["period"]) { return `${formatDate(period.start)} – ${formatDate(period.end)}`; }

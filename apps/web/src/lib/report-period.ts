export type ReportPeriod = { start: string; end: string; label: string };

export function yubaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function reportPeriod(params: URLSearchParams, today: string): ReportPeriod {
  const range = params.get("range") ?? "mtd";
  const date = new Date(`${today}T12:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const monthStart = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;
  const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1;
  if (range === "last-month") {
    const end = new Date(Date.UTC(year, month - 1, 0));
    return { start: monthStart(end.getUTCFullYear(), end.getUTCMonth() + 1), end: iso(end), label: "Last month" };
  }
  // Encoded club YTD is calendar year, not a July 1 season start.
  if (range === "ytd") return { start: `${year}-01-01`, end: today, label: "Year to date" };
  if (range === "this-quarter" || range === "last-quarter") {
    let quarter = Math.floor((month - 1) / 3), targetYear = year;
    if (range === "last-quarter" && quarter-- === 0) { quarter = 3; targetYear--; }
    const startMonth = quarter * 3 + 1;
    const end = range === "this-quarter" ? today : iso(new Date(Date.UTC(targetYear, startMonth + 2, 0)));
    return { start: monthStart(targetYear, startMonth), end, label: range === "this-quarter" ? "This quarter to date" : "Last quarter" };
  }
  if (range === "custom") {
    const start = params.get("start") ?? "", end = params.get("end") ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end) return { start, end, label: "Custom range" };
  }
  return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: today, label: "Month to date" };
}

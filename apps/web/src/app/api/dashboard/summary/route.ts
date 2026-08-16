import { NextRequest, NextResponse } from "next/server";
import { verifiedStaff } from "@/lib/staff-access";
import { readCommerceReport, readGolfReport } from "@/lib/golf-reporting-store";

type Period = { start: string; end: string; label: string };

function yubaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function reportPeriod(params: URLSearchParams, today: string): Period {
  const range = params.get("range") ?? "mtd";
  const date = new Date(`${today}T12:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const monthStart = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;
  const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1;
  if (range === "last-month") { const end = new Date(Date.UTC(year, month - 1, 0)); return { start: monthStart(end.getUTCFullYear(), end.getUTCMonth() + 1), end: iso(end), label: "Last month" }; }
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

export async function GET(request: NextRequest) {
  if (!await verifiedStaff(request)) return NextResponse.json({ foreupLive: { connected: false, error: "Sign in is required." } }, { status: 401 });
  const courseId = process.env.FOREUP_COURSE_ID, teeSheetId = process.env.FOREUP_TEESHEET_ID;
  if (!courseId || !teeSheetId) return NextResponse.json({ foreupLive: { connected: false, error: "ForeUp course configuration is missing." } }, { status: 503 });
  const today = yubaToday(), period = reportPeriod(request.nextUrl.searchParams, today);
  try {
    const [golf, commerce] = await Promise.all([
      readGolfReport(courseId, teeSheetId, period, today),
      readCommerceReport(courseId, teeSheetId, period)
    ]);
    if (!golf && !commerce) return NextResponse.json({ foreupLive: { connected: false, error: "Reporting data is not synced yet. Run the protected ForeUp reporting sync to load this range." } }, { status: 503 });
    return NextResponse.json({ foreupLive: { connected: true, golf, commerce, source: "postgres" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ foreupLive: { connected: false, error: error instanceof Error ? error.message : "Reporting database unavailable" } }, { status: 502 });
  }
}

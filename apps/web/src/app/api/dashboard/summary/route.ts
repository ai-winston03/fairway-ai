import { NextRequest, NextResponse } from "next/server";
import { combineHoldStatus, latestSyncedAt } from "@/lib/foreup-hold";
import { readCommerceReport, readGolfReport } from "@/lib/golf-reporting-store";
import { reportPeriod, yubaToday } from "@/lib/report-period";
import { verifiedStaff } from "@/lib/staff-access";

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
    if (!golf && !commerce) {
      return NextResponse.json({
        foreupLive: {
          connected: false,
          code: "hold_unavailable",
          error: "Reporting hold is unavailable. Interactive dashboards do not live-pull ForeUp."
        }
      }, { status: 503 });
    }
    const golfCoverage = golf?.coverage;
    const commerceCoverage = commerce?.coverage;
    const holdStatus = combineHoldStatus(golfCoverage?.status ?? "missing", commerceCoverage?.status ?? "missing");
    return NextResponse.json({
      foreupLive: {
        connected: true,
        golf,
        commerce,
        source: "postgres",
        hold: {
          status: holdStatus,
          lastSyncedAt: latestSyncedAt([golfCoverage?.lastSyncedAt, commerceCoverage?.lastSyncedAt]),
          golf: golfCoverage ?? null,
          commerce: commerceCoverage ?? null
        }
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ foreupLive: { connected: false, error: error instanceof Error ? error.message : "Reporting database unavailable" } }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { syncForeupReportingRange } from "@/lib/foreup-reporting-sync";

export const maxDuration = 300;

function isAllowed(request: NextRequest) {
  const secret = process.env.FOREUP_SYNC_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAllowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const courseId = process.env.FOREUP_COURSE_ID, teeSheetId = process.env.FOREUP_TEESHEET_ID;
  if (!courseId || !teeSheetId) return NextResponse.json({ error: "ForeUp course configuration is missing." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { start?: string; end?: string };
  const end = body.end ?? new Date().toISOString().slice(0, 10);
  const start = body.start ?? end;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return NextResponse.json({ error: "start and end must be valid ISO dates." }, { status: 400 });
  }
  try {
    return NextResponse.json({ summary: await syncForeupReportingRange(courseId, teeSheetId, start, end) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reporting sync failed." }, { status: 502 });
  }
}

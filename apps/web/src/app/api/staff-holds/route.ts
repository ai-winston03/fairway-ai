import { NextRequest, NextResponse } from "next/server";
import { listStaffHolds } from "@/lib/staff-holds";
import { staffGuard } from "@/lib/staff-access";

export async function GET(request: NextRequest) {
  const access = await staffGuard(request, "member:lookup");
  if (access.error) return access.error;
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) {
    return NextResponse.json({ connected: false, error: "ForeUp course configuration is missing.", holds: [] }, { status: 503 });
  }
  const holds = await listStaffHolds(courseId);
  return NextResponse.json({
    connected: true,
    holds,
    note: "Holds stay queued for staff. This path does not send SMS or write a live booking."
  }, { headers: { "Cache-Control": "no-store" } });
}

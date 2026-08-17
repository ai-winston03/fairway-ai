import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/authz";
import { memberHoldMissingPayload, readHeldMember } from "@/lib/foreup-hold";
import { verifiedStaff } from "@/lib/staff-access";

type RouteContext = { params: Promise<{ memberId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const staff = await verifiedStaff(request);
  if (!staff) return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  if (!can(staff, "member:lookup")) return NextResponse.json({ connected: false, error: "Member lookup is not allowed for this role." }, { status: 403 });
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) {
    return NextResponse.json({ connected: false, error: "ForeUp course configuration is missing." }, { status: 503 });
  }

  const { memberId } = await context.params;
  const profile = await readHeldMember(courseId, memberId);
  if ("missing" in profile) {
    const payload = memberHoldMissingPayload(profile.missing);
    return NextResponse.json(payload, { status: profile.missing === "directory" ? 503 : 404 });
  }
  return NextResponse.json({ connected: true, source: "hold", ...profile }, { headers: { "Cache-Control": "no-store" } });
}

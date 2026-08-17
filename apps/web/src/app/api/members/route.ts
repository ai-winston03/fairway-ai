import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import { memberHoldMissingPayload, readHeldMemberDirectory } from "@/lib/foreup-hold";
import { verifiedStaff } from "@/lib/staff-access";

export async function GET(request: Request) {
  const staff = await verifiedStaff(request);
  if (!staff) return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  if (!can(staff, "member:lookup")) return NextResponse.json({ connected: false, error: "Member lookup is not allowed for this role." }, { status: 403 });
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) return NextResponse.json({ connected: false, error: "ForeUp course configuration is missing." }, { status: 503 });
  const hold = await readHeldMemberDirectory(courseId);
  if (!hold) return NextResponse.json(memberHoldMissingPayload("directory"), { status: 503 });
  const members = hold.customers.filter((customer) => customer.member);
  const smsOptedInFromSignupSheet = members.filter((member) => member.phone && !member.optOutText).length;
  return NextResponse.json({
    connected: true,
    source: "hold",
    syncedAt: hold.syncedAt,
    members,
    summary: {
      customers: hold.customers.length,
      members: members.length,
      smsOptedInFromSignupSheet,
      smsOptedOutInForeup: members.filter((member) => member.optOutText).length
    }
  }, { headers: { "Cache-Control": "no-store" } });
}

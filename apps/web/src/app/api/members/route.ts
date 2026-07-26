import { NextResponse } from "next/server";
import { foreup } from "@/lib/foreup-adapter";
import { cachedForeup } from "@/lib/foreup-cache";
import { verifiedStaff } from "@/lib/staff-access";

export async function GET(request: Request) {
  if (!await verifiedStaff(request)) return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) return NextResponse.json({ connected: false, error: "ForeUp course configuration is missing." }, { status: 503 });
  try {
    const customers = await cachedForeup(`members:${courseId}`, 120_000, () => foreup.listCustomers(courseId));
    const members = customers.filter((customer) => customer.member);
    // Club policy: membership enrollment paperwork is the documented SMS opt-in.
    // ForeUp remains the live opt-out authority and therefore always suppresses sending.
    const smsOptedInFromSignupSheet = members.filter((member) => member.phone && !member.optOutText).length;
    return NextResponse.json({ connected: true, members, summary: { customers: customers.length, members: members.length, smsOptedInFromSignupSheet, smsOptedOutInForeup: members.filter((member) => member.optOutText).length } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "ForeUp unavailable" }, { status: 502 });
  }
}

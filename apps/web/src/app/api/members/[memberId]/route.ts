import { NextRequest, NextResponse } from "next/server";
import { cachedForeup } from "@/lib/foreup-cache";
import { foreup } from "@/lib/foreup-adapter";
import { verifiedStaff } from "@/lib/staff-access";

type RouteContext = { params: Promise<{ memberId: string }> };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!await verifiedStaff(request)) return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  const courseId = process.env.FOREUP_COURSE_ID;
  const teeSheetId = process.env.FOREUP_TEESHEET_ID;
  if (!courseId || !teeSheetId) {
    return NextResponse.json({ connected: false, error: "ForeUp course configuration is missing." }, { status: 503 });
  }

  const { memberId } = await context.params;
  try {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 90);
    const profile = await cachedForeup(`member-profile:${memberId}:${isoDate(today)}`, 60_000, async () => {
      const customers = await foreup.listCustomers(courseId);
      const member = customers.find((customer) => customer.id === memberId && customer.member);
      if (!member) throw new Error("Member was not found in ForeUp.");
      const teeTimes = await foreup.listUpcomingBookingsForCustomer(courseId, teeSheetId, memberId, isoDate(today), isoDate(end));
      return { member, teeTimes, syncedAt: new Date().toISOString() };
    });
    return NextResponse.json({ connected: true, ...profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "ForeUp unavailable" }, { status: 502 });
  }
}

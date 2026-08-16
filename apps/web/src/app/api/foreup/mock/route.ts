import { NextRequest, NextResponse } from "next/server";
import { foreup } from "@/lib/foreup-adapter";
import { staffGuard } from "@/lib/staff-access";

export async function POST(request: NextRequest) {
  const access = await staffGuard(request, "settings:manage");
  if (access.error) return access.error;
  const body = await request.json();

  const booking = await foreup.createBooking({
    courseId: body.courseId ?? "9039",
    teeSheetId: body.teeSheetId ?? "mock_teesheet",
    customerId: body.customerId ?? "3612897",
    playerCount: body.playerCount ?? 4,
    guestCount: body.guestCount ?? 1,
    requestedDate: body.requestedDate ?? "2026-07-11",
    requestedWindow: body.requestedWindow ?? "morning",
    carts: body.carts ?? 2
  });

  return NextResponse.json({
    booking,
    note: "Mock foreUP call. Set FOREUP_API_TOKEN to switch adapter into live-call mode."
  });
}

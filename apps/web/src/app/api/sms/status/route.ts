import { NextResponse } from "next/server";
import { verifiedStaff } from "@/lib/staff-access";
import { getSmsProviderStatus } from "@/lib/sms-provider";

export async function GET(request: Request) {
  if (!await verifiedStaff(request)) {
    return NextResponse.json({ connected: false, sendingEnabled: false, error: "Sign in is required." }, { status: 401 });
  }
  return NextResponse.json(getSmsProviderStatus(), { headers: { "Cache-Control": "no-store" } });
}

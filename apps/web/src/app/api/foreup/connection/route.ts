import { NextResponse } from "next/server";
import { foreup } from "@/lib/foreup-adapter";
import { staffGuard } from "@/lib/staff-access";

export async function GET(request: Request) {
  const access = await staffGuard(request, "settings:manage");
  if (access.error) return access.error;
  try {
    await foreup.createToken();
    return NextResponse.json({ connected: true, provider: "ForeUp" });
  } catch (error) {
    return NextResponse.json(
      { connected: false, provider: "ForeUp", error: error instanceof Error ? error.message : "Connection failed." },
      { status: 502 }
    );
  }
}

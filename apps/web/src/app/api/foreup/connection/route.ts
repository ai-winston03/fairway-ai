import { NextResponse } from "next/server";
import { foreup } from "@/lib/foreup-adapter";

export async function GET() {
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

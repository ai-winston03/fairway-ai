import { NextResponse } from "next/server";
import { directoryMembers, importForeupMembers } from "@/lib/member-directory";

export async function POST() {
  const summary = importForeupMembers();

  return NextResponse.json({
    summary,
    members: directoryMembers,
    note:
      "Mock import path. Wire FOREUP_API_TOKEN and persist rows into Member/ForeupImportBatch for live sync."
  });
}

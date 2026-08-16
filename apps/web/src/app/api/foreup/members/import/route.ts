import { NextResponse } from "next/server";
import { directoryMembers, importForeupMembers } from "@/lib/member-directory";
import { staffGuard } from "@/lib/staff-access";

export async function POST(request: Request) {
  const access = await staffGuard(request, "settings:manage");
  if (access.error) return access.error;
  const summary = importForeupMembers();

  return NextResponse.json({
    summary,
    members: directoryMembers,
    note:
      "Mock import path. Wire FOREUP_API_TOKEN and persist rows into Member/ForeupImportBatch for live sync."
  });
}

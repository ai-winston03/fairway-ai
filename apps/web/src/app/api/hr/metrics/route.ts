import { NextResponse } from "next/server";
import { getHrManagementSnapshot, integrationAccounts } from "@/lib/integrations";
import { staffGuard } from "@/lib/staff-access";

export async function GET(request: Request) {
  const access = await staffGuard(request, "kpi:view:labor");
  if (access.error) return access.error;
  const account = integrationAccounts.find((item) => item.provider === "gusto");

  return NextResponse.json({
    provider: "gusto",
    source: "gusto_mcp",
    status: account?.status ?? "not_connected",
    snapshot: getHrManagementSnapshot()
  });
}

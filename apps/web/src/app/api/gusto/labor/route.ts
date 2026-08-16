import { NextResponse } from "next/server";
import { getHrManagementSnapshot, hrLaborReports, integrationAccounts } from "@/lib/integrations";
import { staffGuard } from "@/lib/staff-access";

export async function GET(request: Request) {
  const access = await staffGuard(request, "kpi:view:labor");
  if (access.error) return access.error;
  const account = integrationAccounts.find((item) => item.provider === "gusto");
  const snapshot = getHrManagementSnapshot();

  return NextResponse.json({
    provider: "gusto",
    mode: snapshot.mode,
    status: account?.status ?? "not_connected",
    reports: hrLaborReports,
    snapshot,
    note: "Use this surface for daily read-only HR metrics from Gusto MCP once OAuth is authorized."
  });
}

import { NextResponse } from "next/server";
import { getHrManagementSnapshot, integrationAccounts } from "@/lib/integrations";

export async function GET() {
  const account = integrationAccounts.find((item) => item.provider === "gusto");

  return NextResponse.json({
    provider: "gusto",
    source: "gusto_mcp",
    status: account?.status ?? "not_connected",
    snapshot: getHrManagementSnapshot()
  });
}

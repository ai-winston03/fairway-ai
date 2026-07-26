import { kpiGroupCatalog } from "@/lib/authz";

export type IntegrationStatus = "connected" | "ready" | "not_connected" | "needs_review";

export type IntegrationAccount = {
  id: string;
  provider: "foreup" | "gusto" | "sms" | "vercel" | "supabase" | "worker";
  label: string;
  status: IntegrationStatus;
  owner: string;
  lastSyncedAt?: string;
  nextAction: string;
  health: string;
};

export type HrLaborReport = {
  department: string;
  period: string;
  laborHours: number;
  overtimeHours: number;
  grossPayCents: number;
  headcount: number;
};

export type HrDepartmentMetric = HrLaborReport & {
  averageHourlyCostCents: number;
  laborCostPerHeadCents: number;
  overtimeRate: number;
};

export type HrMetricCard = {
  label: string;
  value: string;
  trend: string;
  tone: "good" | "watch" | "neutral";
};

export type HrManagementSnapshot = {
  source: "gusto_mcp";
  mode: "mock-mcp-shape" | "gusto-mcp";
  mcpServerUrl: string;
  lastUpdatedAt: string;
  payPeriod: string;
  summaryCards: HrMetricCard[];
  departmentMetrics: HrDepartmentMetric[];
  attentionItems: string[];
  nextActions: string[];
};

export type WorkerRun = {
  id: string;
  kind: "foreup.member_import" | "scheduler.messages" | "gusto.hr_snapshot";
  status: "succeeded" | "needs_review" | "queued";
  aiUsed: boolean;
  lastRunAt: string;
  summary: string;
};

export type GustoImportMode = "csv" | "api" | "connector";

export type GustoImportSummary = {
  mode: GustoImportMode;
  source: string;
  importedEmployees: number;
  importedPayrollRuns: number;
  importedDepartmentMetrics: number;
  aiUsed: false;
  nextRunHint: string;
};

export const integrationAccounts: IntegrationAccount[] = [
  {
    id: "int_foreup",
    provider: "foreup",
    label: "ForeUp data",
    status: process.env.FOREUP_API_TOKEN ? "ready" : "not_connected",
    owner: "Scheduled import",
    lastSyncedAt: "2026-07-09T08:15:00.000Z",
    nextAction: "Add course credentials, then schedule the member/menu import.",
    health: "Member import, menu payload, tee sheet adapter"
  },
  {
    id: "int_gusto",
    provider: "gusto",
    label: "Gusto MCP",
    status: process.env.GUSTO_MCP_ENABLED === "true" ? "ready" : "not_connected",
    owner: "Read-only MCP",
    nextAction: "Authorize Gusto MCP, then schedule a daily HR snapshot for managers.",
    health: "Headcount, departments, payroll runs, timesheets, overtime"
  },
  {
    id: "int_sms",
    provider: "sms",
    label: "SMS/VoIP",
    status: process.env.SMS_PROVIDER ? "ready" : "not_connected",
    owner: "Provider webhook",
    nextAction: "Choose GoTo, AT&T, Twilio, Bandwidth, or hosted SMS before production sends.",
    health: "Inbound webhook, opt-out checks, staff pause gate"
  },
  {
    id: "int_supabase",
    provider: "supabase",
    label: "Supabase Postgres",
    status: process.env.DATABASE_URL ? "ready" : "not_connected",
    owner: "Vercel app",
    nextAction: "Set DATABASE_URL in Vercel and worker environment.",
    health: "Prisma schema prepared for Postgres"
  },
  {
    id: "int_worker",
    provider: "worker",
    label: "Daily automations",
    status: "ready",
    owner: "Managed cron",
    nextAction: "Run scheduled messages, imports, and HR snapshots without adding a VPS unless needed.",
    health: "Script-first automation with AI disabled by default"
  }
];

export const hrLaborReports: HrLaborReport[] = [
  {
    department: "Pro shop",
    period: "Current pay period",
    laborHours: 312,
    overtimeHours: 8,
    grossPayCents: 684200,
    headcount: 12
  },
  {
    department: "Food & beverage",
    period: "Current pay period",
    laborHours: 428,
    overtimeHours: 19,
    grossPayCents: 913800,
    headcount: 18
  },
  {
    department: "Grounds",
    period: "Current pay period",
    laborHours: 366,
    overtimeHours: 11,
    grossPayCents: 824400,
    headcount: 14
  }
];

export const workerRuns: WorkerRun[] = [
  {
    id: "run_foreup_import",
    kind: "foreup.member_import",
    status: "succeeded",
    aiUsed: false,
    lastRunAt: "2026-07-09T08:15:00.000Z",
    summary: "4 mock members normalized; no AI used."
  },
  {
    id: "run_scheduler",
    kind: "scheduler.messages",
    status: "succeeded",
    aiUsed: false,
    lastRunAt: "2026-07-09T10:20:00.000Z",
    summary: "Due scripted messages rendered with deterministic templates."
  },
  {
    id: "run_gusto",
    kind: "gusto.hr_snapshot",
    status: "succeeded",
    aiUsed: false,
    lastRunAt: "2026-07-09T07:05:00.000Z",
    summary: "Daily HR snapshot shaped for Gusto MCP; live auth not connected."
  }
];

export function getIntegrationSummary() {
  const readyCount = integrationAccounts.filter((account) => account.status === "ready" || account.status === "connected").length;
  const kpiGroupCount = kpiGroupCatalog.length;

  return {
    readyCount,
    totalCount: integrationAccounts.length,
    kpiGroupCount,
    aiUsedByWorkers: workerRuns.some((run) => run.aiUsed)
  };
}

export function runGustoImport(mode: GustoImportMode = "csv"): GustoImportSummary {
  return {
    mode,
    source: mode === "csv" ? "gusto-payroll-journal.csv" : mode === "api" ? "gusto-embedded-api" : "unified-hris-connector",
    importedEmployees: hrLaborReports.reduce((total, report) => total + report.headcount, 0),
    importedPayrollRuns: 1,
    importedDepartmentMetrics: hrLaborReports.length,
    aiUsed: false,
    nextRunHint: "Run after payroll closes or nightly at 2:20 AM from the VPS worker."
  };
}

export function getHrManagementSnapshot(): HrManagementSnapshot {
  const departmentMetrics = hrLaborReports.map((report) => {
    const averageHourlyCostCents = report.laborHours > 0 ? Math.round(report.grossPayCents / report.laborHours) : 0;
    const laborCostPerHeadCents = report.headcount > 0 ? Math.round(report.grossPayCents / report.headcount) : 0;
    const overtimeRate = report.laborHours > 0 ? report.overtimeHours / report.laborHours : 0;

    return {
      ...report,
      averageHourlyCostCents,
      laborCostPerHeadCents,
      overtimeRate
    };
  });

  const totalHeadcount = departmentMetrics.reduce((total, report) => total + report.headcount, 0);
  const totalHours = departmentMetrics.reduce((total, report) => total + report.laborHours, 0);
  const totalOvertime = departmentMetrics.reduce((total, report) => total + report.overtimeHours, 0);
  const totalGrossPayCents = departmentMetrics.reduce((total, report) => total + report.grossPayCents, 0);
  const highestOvertime = [...departmentMetrics].sort((a, b) => b.overtimeRate - a.overtimeRate)[0];
  const highestCost = [...departmentMetrics].sort((a, b) => b.grossPayCents - a.grossPayCents)[0];
  const overtimeRate = totalHours > 0 ? totalOvertime / totalHours : 0;

  return {
    source: "gusto_mcp",
    mode: process.env.GUSTO_MCP_ENABLED === "true" ? "gusto-mcp" : "mock-mcp-shape",
    mcpServerUrl: "https://mcp.api.gusto.com",
    lastUpdatedAt: "2026-07-09T07:05:00.000Z",
    payPeriod: "Current pay period",
    summaryCards: [
      {
        label: "Active headcount",
        value: String(totalHeadcount),
        trend: `${departmentMetrics.length} departments from Gusto`,
        tone: "neutral"
      },
      {
        label: "Gross payroll",
        value: formatMoney(totalGrossPayCents),
        trend: `${Math.round(totalHours).toLocaleString()} labor hours`,
        tone: "neutral"
      },
      {
        label: "Overtime rate",
        value: formatPercent(overtimeRate),
        trend: `${totalOvertime} OT hours this period`,
        tone: overtimeRate > 0.04 ? "watch" : "good"
      },
      {
        label: "Avg labor cost/hr",
        value: formatMoney(totalHours > 0 ? Math.round(totalGrossPayCents / totalHours) : 0),
        trend: "Gross pay divided by hours",
        tone: "neutral"
      }
    ],
    departmentMetrics,
    attentionItems: [
      `${highestOvertime.department} has the highest overtime rate at ${formatPercent(highestOvertime.overtimeRate)}.`,
      `${highestCost.department} is the largest labor cost center at ${formatMoney(highestCost.grossPayCents)}.`,
      "Use MCP for read-only daily snapshots; keep staff changes inside Gusto."
    ],
    nextActions: [
      "Authorize Gusto MCP with payroll and time tracking read scopes.",
      "Schedule a daily morning HR snapshot for managers.",
      "Map Gusto departments to the dashboard labels used by the club."
    ]
  };
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(cents / 100);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent"
  }).format(value);
}

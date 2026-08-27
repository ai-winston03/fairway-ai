import { kpiGroupCatalog } from "@/lib/authz";
import { smsSendingEnabled, twilioConfigured } from "@/lib/sms-provider";

export type IntegrationStatus = "connected" | "ready" | "not_connected" | "needs_review";

export type IntegrationAccount = {
  id: string;
  provider: "firebase" | "foreup" | "gusto" | "sms" | "vercel" | "worker";
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
    status: twilioConfigured() && smsSendingEnabled() ? "connected" : twilioConfigured() ? "needs_review" : "not_connected",
    owner: "Twilio webhook",
    nextAction: !smsSendingEnabled()
      ? "Sending is off."
      : twilioConfigured()
        ? "Point the Twilio number webhook at /api/sms/inbound."
        : "Add Twilio account credentials and a from-number. Threads and drafts work now; sends queue until then.",
    health: "Inbox store, inbound webhook, staff pause gate, queued send"
  },
  {
    id: "int_firebase_postgres",
    provider: "firebase",
    label: "Firebase Data Connect Postgres",
    status: "ready",
    owner: "Firebase App Hosting",
    nextAction: "Schedule the protected ForeUp daily reporting sync.",
    health: "Managed Cloud SQL Postgres; dashboard reports read durable daily facts"
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

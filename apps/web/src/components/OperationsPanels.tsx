"use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, Cloud, Flag, MessageSquareText, ReceiptText, Users } from "lucide-react";
import { CommerceTrend, DailyLedger, FoodAndBeveragePanel } from "@/components/CommerceDetails";
import { MemberWorkspace } from "@/components/MemberWorkspace";
import { StaffHoldsQueue } from "@/components/StaffHoldsQueue";
import { MetricCard } from "@/components/MetricCard";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";
import { formatRange, formatShortDate, money, number, type CommerceReport, type GolfSnapshot, type HoldCoverage } from "@/lib/golf-reporting-ui";

export function MembersPanel({ tab }: { tab: string }) {
  if (tab === "Holds") return <StaffHoldsQueue />;
  return <MemberWorkspace />;
}

export function AutomationsPanel({ tab }: { tab: string }) {
  const active = workflowLibrary.filter((workflow) => workflow.status === "active");
  const scheduled = active.filter((workflow) => workflow.cronExpression);
  const reviewRequired = active.filter((workflow) => !evaluateWorkflowSafety(workflow).safeForAutopilot);
  const aiEnabled = active.filter((workflow) => workflow.aiAllowed);
  const label = tab === "Rules" ? "Rules" : tab === "Schedule" ? "Schedule" : "History";
  if (tab === "History") return <section className="empty-area"><CalendarDays size={24} /><strong>Execution history is not retained yet</strong><span>Configured-rule health is shown here today. Delivery, hold, and failure events will appear only after durable run logging is added—no invented performance metrics.</span></section>;
  return <><div className="period-bar"><span>{label}</span><strong>Configured operating controls</strong><small>These are live rule definitions, not claimed delivery outcomes.</small></div><div className="live-grid"><MetricCard label="Active workflows" value={active.length} note="Configured operating workflows" Icon={Flag} /><MetricCard label="Scheduled jobs" value={scheduled.length} note="Rules with a defined cron schedule" Icon={CalendarDays} /><MetricCard label="Approval gates" value={reviewRequired.length} note="Workflows requiring staff review" Icon={ClipboardList} /><MetricCard label="AI-enabled jobs" value={aiEnabled.length} note="Scheduled workflows default to deterministic rules" Icon={MessageSquareText} /></div><article className="detail-card daily-ledger"><div><div className="eyebrow">Operational coverage</div><h3>Configured workflow controls</h3><p>Each workflow stays visible with its trigger, safety posture, and handoff expectation.</p></div><dl className="detail-list">{active.map((workflow) => { const safety = evaluateWorkflowSafety(workflow); return <div key={workflow.id}><dt>{workflow.name} · {workflow.cronExpression ?? workflow.trigger}</dt><dd>{safety.safeForAutopilot ? "Autopilot eligible" : "Staff review"}</dd></div>; })}</dl></article></>;
}

function coverageLabel(coverage?: HoldCoverage) {
  if (!coverage) return "Unavailable";
  if (coverage.status === "complete") return "Complete";
  if (coverage.status === "partial") return "Partial";
  return "Not synced";
}

function coverageNote(coverage?: HoldCoverage, completeNote = "", missingNote = "") {
  if (!coverage) return "Reporting hold is unavailable";
  if (coverage.status === "complete") return completeNote;
  if (coverage.status === "partial") return `${coverage.heldDays.length} held day${coverage.heldDays.length === 1 ? "" : "s"}, ${coverage.missingDays.length} missing`;
  return missingNote || `${coverage.missingDays.length} day${coverage.missingDays.length === 1 ? "" : "s"} missing from the hold`;
}

export function PlatformPanel({ golf, commerce, error, tab }: { golf: GolfSnapshot | null; commerce: CommerceReport | null; error: string | null; tab: string }) {
  const ready = Boolean(golf || commerce) && !error;
  const period = golf?.period ?? commerce?.period;
  if (tab === "Access") return <section className="empty-area"><Users size={24} /><strong>Access management</strong><span>Staff invitations and role permissions are managed from the account menu. Reporting access remains staff-only.</span></section>;
  return <><div className="period-bar"><span>{tab === "Data sync" ? "Data sync" : "Connections"}</span><strong>{period ? formatRange(period) : "Current reporting status"}</strong><small>Held days stay visible when a range has gaps.</small></div><div className="live-grid"><MetricCard label="Reporting hold" value={ready ? coverageLabel(golf?.coverage?.status === "missing" && commerce?.coverage?.status === "missing" ? golf?.coverage : golf?.coverage?.status === "complete" && commerce?.coverage?.status === "complete" ? golf?.coverage : { status: "partial", expectedDays: [], heldDays: [], missingDays: [], lastSyncedAt: null }) : "Needs attention"} note={ready ? "Interactive dashboards read the held copy only" : error ?? "Reporting hold is unavailable"} Icon={CircleGauge} /><MetricCard label="Golf coverage" value={coverageLabel(golf?.coverage)} note={coverageNote(golf?.coverage, `${golf?.period.label} has every expected daily fact`, "Run the daily ForeUp hold for this range")} Icon={Flag} /><MetricCard label="POS coverage" value={coverageLabel(commerce?.coverage)} note={coverageNote(commerce?.coverage, `${commerce?.period.label} includes every outlet/day row`, "Outlet days are missing from the hold")} Icon={ReceiptText} /><MetricCard label="Data source" value="Held copy" note="Interactive dashboards never query ForeUp directly" Icon={Cloud} /></div><article className="detail-card metric-explainer"><div><div className="eyebrow">Integrity guardrail</div><h3>What coverage means</h3><p>Golf shows every held day and lists missing dates. POS only totals days with all four outlet rows. Gaps never masquerade as slow days, and missing ranges never trigger a live ForeUp pull.</p></div><dl className="detail-list"><div><dt>Selected period</dt><dd>{period ? formatRange(period) : "—"}</dd></div><div><dt>Golf feed</dt><dd>{coverageLabel(golf?.coverage)}</dd></div><div><dt>POS feed</dt><dd>{coverageLabel(commerce?.coverage)}</dd></div><div><dt>Live ForeUp fallback</dt><dd>Disabled</dd></div></dl></article></>;
}

export function CommercePanel({ area, commerce, error, tab, loading }: { area: "pro-shop" | "clubhouse"; commerce: CommerceReport | null; error: string | null; tab: string; loading: boolean }) {
  const department = area === "pro-shop" ? "proShop" : "clubhouse";
  const label = area === "pro-shop" ? "Pro shop" : "Clubhouse";
  if (error) return <section className="empty-area"><ReceiptText size={24} /><strong>{label} reporting needs attention</strong><span>{error}</span></section>;
  if (loading && !commerce) return <section className="empty-area"><ReceiptText size={24} /><strong>Loading {label.toLowerCase()} reporting</strong><span>No placeholder figures are displayed while the reporting hold responds.</span></section>;
  if (!commerce || commerce.coverage?.status === "missing") return null;
  if (area === "pro-shop" && tab === "Inventory") return <section className="empty-area"><ReceiptText size={24} /><strong>Inventory catalog is next</strong><span>ForeUp’s Items endpoint is mapped, but on-hand quantity and reorder level have not been imported yet. This remains explicit until the catalog sync is live.</span></section>;
  if (area === "clubhouse" && tab === "Events") return <section className="empty-area"><CalendarDays size={24} /><strong>Events feed is not connected</strong><span>POS revenue is live here. Event bookings and covers need their own verified ForeUp source before they appear.</span></section>;
  if (area === "clubhouse") return <FoodAndBeveragePanel commerce={commerce} tab={tab} />;
  const totals = commerce[department];
  const daily = commerce.daily.filter((day) => area === "pro-shop" ? day.department === "pro_shop" : day.department !== "pro_shop").reduce<Array<{ date: string; department: "pro_shop" | "snack_shack" | "bar" | "fnb_unassigned"; transactions: number; unitsSold: number; revenue: number }>>((days, day) => {
    const existing = days.find((candidate) => candidate.date === day.date);
    if (existing) { existing.transactions += day.transactions; existing.unitsSold += day.unitsSold; existing.revenue += day.revenue; }
    else days.push({ ...day, department: area === "pro-shop" ? "pro_shop" : "fnb_unassigned" });
    return days;
  }, []);
  const sellingDays = daily.filter((day) => day.transactions > 0).length;
  const averageTicket = totals.transactions ? totals.revenue / totals.transactions : 0;
  const sectionLabel = tab === "Sales" ? "Sales" : tab === "Food & beverage" ? "Food & beverage" : label;
  const bestDay = daily.reduce<typeof daily[number] | null>((best, day) => !best || day.revenue > best.revenue ? day : best, null);
  return <><div className="period-bar"><span>{sectionLabel}</span><strong>{formatRange(commerce.period)}</strong><small>Synced from the full ForeUp POS sales ledger, including standalone counter sales.</small></div><div className="live-grid"><MetricCard label="Revenue" value={money(totals.revenue)} note="Recorded sales in selected period" Icon={ReceiptText} /><MetricCard label="Transactions" value={totals.transactions} note="Completed POS sales with this department" Icon={ClipboardList} /><MetricCard label="Units / transaction" value={totals.transactions ? number(totals.unitsSold / totals.transactions, 1) : "—"} note={`${totals.unitsSold} line-item units sold`} Icon={CalendarDays} /><MetricCard label="Average ticket" value={totals.transactions ? money(averageTicket) : "—"} note={`${sellingDays} selling day${sellingDays === 1 ? "" : "s"} in range`} Icon={ChartNoAxesCombined} /></div><div className="operations-grid"><article className="detail-card metric-explainer"><div><div className="eyebrow">Sales quality</div><h3>Volume and peak day</h3><p>These are ledger-based measures, not inventory or event estimates.</p></div><dl className="detail-list"><div><dt>Revenue / unit</dt><dd>{totals.unitsSold ? money(totals.revenue / totals.unitsSold) : "—"}</dd></div><div><dt>Revenue / selling day</dt><dd>{sellingDays ? money(totals.revenue / sellingDays) : "—"}</dd></div><div><dt>Best sales day</dt><dd>{bestDay?.revenue ? formatShortDate(bestDay.date) : "—"}</dd></div><div><dt>Best-day revenue</dt><dd>{bestDay ? money(bestDay.revenue) : "—"}</dd></div></dl></article><CommerceTrend daily={daily} label={sectionLabel} /></div>{tab === "Sales" ? <DailyLedger daily={daily} label={sectionLabel} /> : null}</>;
}

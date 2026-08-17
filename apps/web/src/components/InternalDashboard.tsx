"use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, Cloud, Flag, MessageSquareText, ReceiptText, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MemberWorkspace } from "@/components/MemberWorkspace";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";

export type OperationsArea = "golf" | "pro-shop" | "clubhouse" | "members" | "automations" | "platform";
type ReportRange = "mtd" | "last-month" | "this-quarter" | "last-quarter" | "ytd" | "custom";

type Segment = { rounds: number; bookings: number; carts: number; greenFeeRevenue: number };
type HoldCoverage = { status: "complete" | "partial" | "missing"; expectedDays: string[]; heldDays: string[]; missingDays: string[]; lastSyncedAt: string | null };
type GolfSnapshot = {
  today: { date: string; bookings: number; occupancy: number; playersCheckedIn: number; playerNoShows: number; potentialSlots: number; slotsAvailable: number; revenue: number };
  period: { start: string; end: string; label: string };
  coverage?: HoldCoverage;
  member: Segment;
  nonMember: Segment;
  unclassifiedRounds: number;
  priceClasses: string[];
  sourceBookings: number;
  daily?: Array<{ date: string; rounds: number; bookings: number; occupancy: number; potentialSlots: number; slotsAvailable: number; revenue: number; greenFeeRevenue: number }>;
};
type CommerceReport = {
  period: { start: string; end: string; label: string };
  coverage?: HoldCoverage;
  proShop: { transactions: number; unitsSold: number; revenue: number };
  clubhouse: { transactions: number; unitsSold: number; revenue: number };
  snackShack: { transactions: number; unitsSold: number; revenue: number };
  bar: { transactions: number; unitsSold: number; revenue: number };
  fnbUnassigned: { transactions: number; unitsSold: number; revenue: number };
  daily: Array<{ date: string; department: "pro_shop" | "snack_shack" | "bar" | "fnb_unassigned"; transactions: number; unitsSold: number; revenue: number }>;
};

const areas: Record<OperationsArea, { label: string; eyebrow: string; title: string; description: string; tabs: string[] }> = {
  golf: { label: "Golf", eyebrow: "Held reporting copy", title: "Golf operations", description: "Synced tee-sheet performance, member mix, and operating health.", tabs: ["Overview", "Member play", "Non-member play", "Tee sheet"] },
  "pro-shop": { label: "Pro Shop", eyebrow: "Held reporting copy", title: "Pro shop", description: "Sales, carts, and inventory come from the scheduled ForeUp hold.", tabs: ["Overview", "Sales", "Inventory"] },
  clubhouse: { label: "Clubhouse", eyebrow: "Held reporting copy", title: "Clubhouse", description: "Food, beverage, and event operations from the scheduled ForeUp hold.", tabs: ["Overview", "Food & beverage", "Events"] },
  members: { label: "Members", eyebrow: "Held directory", title: "Members", description: "Directory and threads read the scheduled ForeUp hold. Missing holds stay visible.", tabs: ["Directory", "Activity", "Accounts"] },
  automations: { label: "Automations", eyebrow: "Control room", title: "Automations", description: "Review approved messages and scheduled jobs before they run.", tabs: ["Rules", "Schedule", "History"] },
  platform: { label: "Platform", eyebrow: "System", title: "Connections", description: "Service health and data-source status.", tabs: ["Connections", "Data sync", "Access"] }
};

export function InternalDashboard({ area, requestedTab }: { area: OperationsArea; requestedTab?: string }) {
  const [activeTab, setActiveTab] = useState(requestedTab ?? areas[area].tabs[0]);
  const [golf, setGolf] = useState<GolfSnapshot | null>(null);
  const [commerce, setCommerce] = useState<CommerceReport | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [rangeSelection, setRangeSelection] = useState<ReportRange>("mtd");
  const [customStart, setCustomStart] = useState(isoToday());
  const [customEnd, setCustomEnd] = useState(isoToday());
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoadingGolf, setIsLoadingGolf] = useState(false);
  const [golfUpdatedAt, setGolfUpdatedAt] = useState<Date | null>(null);
  const config = areas[area];
  const reportQuery = useMemo(() => {
    if (rangeSelection === "custom") {
      return customStart && customEnd && customStart <= customEnd
        ? { range: "custom", start: customStart, end: customEnd }
        : null;
    }
    return { range: rangeSelection };
  }, [rangeSelection, customStart, customEnd]);

  useEffect(() => setActiveTab(requestedTab && areas[area].tabs.includes(requestedTab) ? requestedTab : areas[area].tabs[0]), [area, requestedTab]);
  useEffect(() => {
    const controller = new AbortController();
    if (!reportQuery) return () => controller.abort();
    const query = new URLSearchParams({ range: reportQuery.range });
    if (reportQuery.range === "custom") { query.set("start", reportQuery.start); query.set("end", reportQuery.end); }
    query.set("_", String(reloadKey));
    setIsLoadingGolf(true);
    setConnectionError(null);
    fetch(`${apiBasePath()}/api/dashboard/summary?${query}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.foreupLive?.connected) {
          setGolf(payload.foreupLive.golf ?? null);
          setCommerce(payload.foreupLive.commerce ?? null);
          const syncedAt = payload.foreupLive.hold?.lastSyncedAt ?? payload.foreupLive.golf?.coverage?.lastSyncedAt ?? payload.foreupLive.commerce?.coverage?.lastSyncedAt;
          setGolfUpdatedAt(syncedAt ? new Date(syncedAt) : new Date());
        } else setConnectionError(payload.foreupLive?.error ?? "Reporting hold is unavailable.");
      })
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setConnectionError("Unable to load the reporting hold."); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingGolf(false); });
    return () => controller.abort();
  }, [reportQuery, reloadKey]);

  const holdStatus = golf?.coverage?.status === "missing" && commerce?.coverage?.status === "missing"
    ? "missing"
    : golf?.coverage?.status === "partial" || commerce?.coverage?.status === "partial" || golf?.coverage?.status === "missing" || commerce?.coverage?.status === "missing"
      ? "partial"
      : golf || commerce ? "complete" : null;
  const golfStatus = connectionError ? "Needs attention" : holdStatus === "missing" ? "Range not in hold" : holdStatus === "partial" ? "Held copy has gaps" : golf || commerce ? "Reporting data synced" : "Loading reporting data";
  return <section className="operations-dashboard" aria-label={`${config.label} workspace`}>
    <header className="operations-hero"><div><div className="eyebrow">{config.eyebrow}</div><h2>{config.title}</h2><p>{config.description}</p></div><div className={`connection-badge ${connectionError || holdStatus === "missing" || holdStatus === "partial" ? "warning" : ""}`}><span />{area === "golf" || area === "pro-shop" || area === "clubhouse" || area === "platform" ? golfStatus : "Held directory"}</div></header>
    <nav className="operations-tabs" aria-label={`${config.label} submenu`}>{config.tabs.map((tab) => <button aria-pressed={activeTab === tab} className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</nav>
    {(area === "golf" || area === "pro-shop" || area === "clubhouse") && <ReportRangeControl range={rangeSelection} onRangeChange={setRangeSelection} customStart={customStart} customEnd={customEnd} setCustomStart={setCustomStart} setCustomEnd={setCustomEnd} onRefresh={() => setReloadKey((value) => value + 1)} isLoading={isLoadingGolf} updatedAt={golfUpdatedAt} />}
    {(area === "golf" || area === "pro-shop" || area === "clubhouse") && !connectionError && <HoldGapBanner coverage={area === "golf" ? golf?.coverage : commerce?.coverage} label={area === "golf" ? "Golf" : area === "pro-shop" ? "Pro shop" : "Clubhouse"} />}
    {area === "golf" ? <GolfPanel golf={golf} error={connectionError} tab={activeTab} /> : area === "members" ? <MembersPanel /> : area === "pro-shop" || area === "clubhouse" ? <CommercePanel area={area} commerce={commerce} error={connectionError} tab={activeTab} /> : area === "automations" ? <AutomationsPanel tab={activeTab} /> : area === "platform" ? <PlatformPanel golf={golf} commerce={commerce} error={connectionError} tab={activeTab} /> : <EmptyArea area={area} tab={activeTab} />}
  </section>;
}

function ReportRangeControl({ range, onRangeChange, customStart, customEnd, setCustomStart, setCustomEnd, onRefresh, isLoading, updatedAt }: { range: ReportRange; onRangeChange: (value: ReportRange) => void; customStart: string; customEnd: string; setCustomStart: (value: string) => void; setCustomEnd: (value: string) => void; onRefresh: () => void; isLoading: boolean; updatedAt: Date | null }) {
  const presets: Array<[ReportRange, string]> = [["mtd", "Month to date"], ["last-month", "Last month"], ["this-quarter", "This quarter"], ["last-quarter", "Last quarter"], ["ytd", "Year to date"]];
  return <div className="report-range" aria-label="Report date range"><label className="report-period-select"><span>Report period</span><select aria-label="Report period" onChange={(event) => onRangeChange(event.target.value as ReportRange)} value={range}>{presets.map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="custom">Custom range</option></select></label>{range === "custom" && <div className="custom-date-fields"><label><span>From</span><input max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} /></label><label><span>To</span><input min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} /></label><small>{customStart > customEnd ? "End date must be on or after the start date." : "Updates automatically when both dates are valid."}</small></div>}<div className="report-range-meta">{isLoading ? <span className="range-loading">Updating report…</span> : updatedAt ? <span>Held copy · last synced {updatedAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> : <span>Held copy</span>}<button aria-label="Refresh report" className="refresh-report" disabled={isLoading} onClick={onRefresh} title="Refresh report" type="button"><RefreshCw aria-hidden="true" size={14} /></button></div></div>;
}

function formatMissingDays(days: string[]) {
  if (!days.length) return "none";
  const ranges: string[] = [];
  let start = days[0], previous = days[0];
  const flush = () => ranges.push(start === previous ? start : `${start}–${previous}`);
  for (const day of days.slice(1)) {
    const next = new Date(`${previous}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    if (day === next.toISOString().slice(0, 10)) { previous = day; continue; }
    flush();
    start = previous = day;
  }
  flush();
  return ranges.join(", ");
}

function HoldGapBanner({ coverage, label }: { coverage?: HoldCoverage; label: string }) {
  if (!coverage || coverage.status === "complete") return null;
  if (coverage.status === "missing") {
    return <section className="hold-gap missing"><strong>{label} is not synced for this range</strong><span>Missing {formatMissingDays(coverage.missingDays)}. Totals below use held days only — none yet. This is not a live ForeUp pull.</span></section>;
  }
  return <section className="hold-gap"><strong>{coverage.missingDays.length} day{coverage.missingDays.length === 1 ? "" : "s"} missing from the held copy</strong><span>Showing {coverage.heldDays.length} held day{coverage.heldDays.length === 1 ? "" : "s"}. Missing {formatMissingDays(coverage.missingDays)}.</span></section>;
}

function GolfPanel({ golf, error, tab }: { golf: GolfSnapshot | null; error: string | null; tab: string }) {
  if (error) return <section className="empty-area"><CircleGauge size={24} /><strong>Golf reporting needs attention</strong><span>{error}</span></section>;
  if (!golf) return <section className="empty-area"><CircleGauge size={24} /><strong>Loading golf reporting</strong><span>No placeholder figures are displayed while the reporting database responds.</span></section>;
  const totalRounds = golf.member.rounds + golf.nonMember.rounds;
  const allRounds = totalRounds + golf.unclassifiedRounds;
  const memberShare = totalRounds ? golf.member.rounds / totalRounds : 0;

  if (tab === "Member play") return <SegmentPanel label="Member play" segment={golf.member} totalRounds={totalRounds} period={golf.period.label} variant="member" />;
  if (tab === "Non-member play") return <SegmentPanel label="Non-member play" segment={golf.nonMember} totalRounds={totalRounds} period={golf.period.label} variant="guest" />;
  if (tab === "Tee sheet") return <TeeSheetPanel golf={golf} />;

  const classifiedPlayNote = totalRounds ? `${percent(memberShare)} of classified play` : "No classified play in this range";
  const nonMemberPlayNote = totalRounds ? `${percent(1 - memberShare)} of classified play` : "No classified play in this range";
  const daily = golf.daily ?? [];
  const totalRevenue = daily.reduce((total, day) => total + day.revenue, 0);
  const totalGreenFees = daily.reduce((total, day) => total + day.greenFeeRevenue, 0);
  const totalCapacity = daily.reduce((total, day) => total + day.potentialSlots, 0);
  const totalOpen = daily.reduce((total, day) => total + day.slotsAvailable, 0);
  const capacityFilled = totalCapacity ? (totalCapacity - totalOpen) / totalCapacity : 0;
  const checkedIn = golf.today.playersCheckedIn;
  const noShows = golf.today.playerNoShows;
  const cards = [
    ["Total rounds", allRounds, `${golf.unclassifiedRounds} not classified by price class`, Users],
    ["Tee-sheet revenue", money(totalRevenue), "All golf revenue recorded in the selected period", ReceiptText],
    ["Green-fee revenue", money(totalGreenFees), allRounds ? `${money(totalGreenFees / allRounds)} per round` : "No rounds recorded", CircleGauge],
    ["Capacity filled", percent(capacityFilled), `${totalOpen} open positions across the period`, ChartNoAxesCombined]
  ] as const;
  return <>
    <div className="period-bar"><span>{golf.period.label}</span><strong>{formatRange(golf.period)}</strong><small>Classified from ForeUp price classes: {golf.priceClasses.join(" · ") || "none"}</small></div>
    <div className="live-grid">{cards.map(([label, value, note, Icon]) => <article className="live-card" key={label}><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="operations-grid">
      <article className="detail-card operating-pulse"><div><div className="eyebrow">Operating pulse</div><h3>Attendance and booking quality</h3><p>Current-day attendance is kept separate from period totals so it cannot be mistaken for historical performance.</p></div><dl className="detail-list"><div><dt>Source bookings</dt><dd>{golf.sourceBookings}</dd></div><div><dt>Checked in today</dt><dd>{checkedIn}</dd></div><div><dt>No-shows today</dt><dd>{noShows}</dd></div><div><dt>Cart attachment</dt><dd>{allRounds ? percent((golf.member.carts + golf.nonMember.carts) / allRounds) : "—"}</dd></div></dl></article>
      <DailyPerformance daily={daily} />
    </div>
    <div className="segment-grid">
      <SegmentSummary label="Member" segment={golf.member} share={memberShare} />
      <SegmentSummary label="Non-member" segment={golf.nonMember} share={1 - memberShare} />
    </div>
    {golf.unclassifiedRounds > 0 && <p className="data-note">{golf.unclassifiedRounds} rounds have no price class and are excluded from the member split.</p>}
  </>;
}

function SegmentPanel({ label, segment, totalRounds, period, variant }: { label: string; segment: Segment; totalRounds: number; period: string; variant: "member" | "guest" }) {
  const share = totalRounds ? segment.rounds / totalRounds : 0;
  const cards = [
    { label: "Tee times", value: segment.bookings, note: "Reservations containing this segment", Icon: CalendarDays },
    { label: "Carts", value: segment.carts, note: "Carts allocated proportionally", Icon: CircleGauge },
    { label: "Green fee / round", value: segment.rounds ? money(segment.greenFeeRevenue / segment.rounds) : "—", note: `${money(segment.greenFeeRevenue)} in recorded green fees`, Icon: ReceiptText },
    { label: "Cart attachment", value: segment.rounds ? percent(segment.carts / segment.rounds) : "—", note: `${percent(share)} of classified play`, Icon: Users }
  ];
  return <><div className={`segment-hero ${variant}`}><span>{period}</span><strong>{segment.rounds}</strong><p>{label.toLowerCase()} rounds · {percent(share)} of classified play</p></div><div className="live-grid">{cards.map(({ label: cardLabel, value, note, Icon }) => <article className="live-card" key={cardLabel}><Icon size={18} /><span>{cardLabel}</span><strong>{value}</strong><small>{note}</small></article>)}</div><article className="detail-card metric-explainer"><div><div className="eyebrow">Booking quality</div><h3>Group size and spend</h3><p>Derived only from the selected, fully synced reporting period.</p></div><dl className="detail-list"><div><dt>Average group size</dt><dd>{segment.bookings ? number(segment.rounds / segment.bookings, 1) : "—"}</dd></div><div><dt>Green fees / booking</dt><dd>{segment.bookings ? money(segment.greenFeeRevenue / segment.bookings) : "—"}</dd></div><div><dt>Classified play share</dt><dd>{percent(share)}</dd></div><div><dt>Unclassified adjustment</dt><dd>Excluded</dd></div></dl></article></>;
}

function TeeSheetPanel({ golf }: { golf: GolfSnapshot }) {
  const stats = golf.today;
  const todayInPeriod = golf.period.start <= stats.date && stats.date <= golf.period.end;
  if (!todayInPeriod) return <article className="detail-card"><div><div className="eyebrow">Current day</div><h3>Today’s tee sheet</h3><p>Today is outside the selected range; choose a range including today for a tee-sheet snapshot.</p></div></article>;
  const filled = Math.max(0, stats.potentialSlots - stats.slotsAvailable);
  const cards = [
    { label: "Bookings", value: stats.bookings, note: `${number(stats.bookings ? filled / stats.bookings : 0, 1)} players per booking`, Icon: CalendarDays },
    { label: "Slot utilization", value: stats.potentialSlots ? percent(filled / stats.potentialSlots) : "—", note: `${stats.slotsAvailable} positions still open`, Icon: CircleGauge },
    { label: "Revenue / booking", value: stats.bookings ? money(stats.revenue / stats.bookings) : "—", note: `${money(stats.revenue)} golf revenue today`, Icon: ReceiptText },
    { label: "No-shows", value: stats.playerNoShows, note: `${stats.playersCheckedIn} players checked in`, Icon: ClipboardList }
  ];
  return <><div className="period-bar"><span>Current day</span><strong>{formatDate(stats.date)}</strong><small>Reporting database snapshot; attendance values are not projected to the full period.</small></div><div className="live-grid">{cards.map(({ label, value, note, Icon }) => <MetricCard key={label} label={label} value={value} note={note} Icon={Icon} />)}</div></>;
}

function DailyPerformance({ daily }: { daily: NonNullable<GolfSnapshot["daily"]> }) {
  const recent = daily.slice(-14);
  const maxRounds = Math.max(1, ...recent.map((day) => day.rounds));
  if (!recent.length) return null;
  return <article className="daily-performance"><div className="daily-performance-heading"><div><div className="eyebrow">Recent pace</div><h3>Daily rounds</h3></div><span>Last {recent.length} days in range</span></div><div className="daily-bars" aria-label="Daily rounds performance">{recent.map((day) => <div className="daily-bar" key={day.date} title={`${formatDate(day.date)}: ${day.rounds} rounds, ${money(day.greenFeeRevenue)} green fees`}><i style={{ height: `${Math.max(5, Math.round(day.rounds / maxRounds * 100))}%` }} /><span>{formatShortDate(day.date)}</span></div>)}</div><p>Bars show rounds; hover or press a bar for the date and green-fee revenue.</p></article>;
}

function SegmentSummary({ label, segment, share }: { label: string; segment: Segment; share: number }) {
  return <article className="segment-summary"><div><span>{label}</span><strong>{segment.rounds} rounds</strong></div><div className="share-track"><i style={{ width: `${Math.round(share * 100)}%` }} /></div><dl><div><dt>Tee times</dt><dd>{segment.bookings}</dd></div><div><dt>Carts</dt><dd>{segment.carts}</dd></div><div><dt>Green fees</dt><dd>{money(segment.greenFeeRevenue)}</dd></div></dl></article>;
}

function MembersPanel() { return <MemberWorkspace />; }

function AutomationsPanel({ tab }: { tab: string }) {
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

function PlatformPanel({ golf, commerce, error, tab }: { golf: GolfSnapshot | null; commerce: CommerceReport | null; error: string | null; tab: string }) {
  const ready = Boolean(golf || commerce) && !error;
  const period = golf?.period ?? commerce?.period;
  if (tab === "Access") return <section className="empty-area"><Users size={24} /><strong>Access management</strong><span>Staff invitations and role permissions are managed from the account menu. Reporting access remains staff-only.</span></section>;
  return <><div className="period-bar"><span>{tab === "Data sync" ? "Data sync" : "Connections"}</span><strong>{period ? formatRange(period) : "Current reporting status"}</strong><small>Held days stay visible when a range has gaps.</small></div><div className="live-grid"><MetricCard label="Reporting hold" value={ready ? coverageLabel(golf?.coverage?.status === "missing" && commerce?.coverage?.status === "missing" ? golf?.coverage : golf?.coverage?.status === "complete" && commerce?.coverage?.status === "complete" ? golf?.coverage : { status: "partial", expectedDays: [], heldDays: [], missingDays: [], lastSyncedAt: null }) : "Needs attention"} note={ready ? "Interactive dashboards read the held copy only" : error ?? "Reporting hold is unavailable"} Icon={CircleGauge} /><MetricCard label="Golf coverage" value={coverageLabel(golf?.coverage)} note={coverageNote(golf?.coverage, `${golf?.period.label} has every expected daily fact`, "Run the daily ForeUp hold for this range")} Icon={Flag} /><MetricCard label="POS coverage" value={coverageLabel(commerce?.coverage)} note={coverageNote(commerce?.coverage, `${commerce?.period.label} includes every outlet/day row`, "Outlet days are missing from the hold")} Icon={ReceiptText} /><MetricCard label="Data source" value="Held copy" note="Interactive dashboards never query ForeUp directly" Icon={Cloud} /></div><article className="detail-card metric-explainer"><div><div className="eyebrow">Integrity guardrail</div><h3>What coverage means</h3><p>Golf shows every held day and lists missing dates. POS only totals days with all four outlet rows. Gaps never masquerade as slow days, and missing ranges never trigger a live ForeUp pull.</p></div><dl className="detail-list"><div><dt>Selected period</dt><dd>{period ? formatRange(period) : "—"}</dd></div><div><dt>Golf feed</dt><dd>{coverageLabel(golf?.coverage)}</dd></div><div><dt>POS feed</dt><dd>{coverageLabel(commerce?.coverage)}</dd></div><div><dt>Live ForeUp fallback</dt><dd>Disabled</dd></div></dl></article></>;
}

function CommercePanel({ area, commerce, error, tab }: { area: "pro-shop" | "clubhouse"; commerce: CommerceReport | null; error: string | null; tab: string }) {
  const department = area === "pro-shop" ? "proShop" : "clubhouse";
  const label = area === "pro-shop" ? "Pro shop" : "Clubhouse";
  if (error) return <section className="empty-area"><ReceiptText size={24} /><strong>{label} reporting needs attention</strong><span>{error}</span></section>;
  if (!commerce) return <section className="empty-area"><ReceiptText size={24} /><strong>Loading {label.toLowerCase()} reporting</strong><span>No placeholder figures are displayed while the reporting hold responds.</span></section>;
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

function FoodAndBeveragePanel({ commerce, tab }: { commerce: CommerceReport; tab: string }) {
  const [outlet, setOutlet] = useState<"all" | "snack_shack" | "bar" | "fnb_unassigned">("all");
  const outletName = outlet === "all" ? "All F&B" : outlet === "snack_shack" ? "Snack Shack" : outlet === "bar" ? "Bar" : "Needs Mapping";
  const outletMetric = outlet === "all" ? commerce.clubhouse : outlet === "snack_shack" ? commerce.snackShack : outlet === "bar" ? commerce.bar : commerce.fnbUnassigned;
  const daily = commerce.daily.filter((day) => outlet === "all" ? day.department !== "pro_shop" : day.department === outlet).reduce<Array<{ date: string; transactions: number; unitsSold: number }>>((days, day) => {
    const existing = days.find((candidate) => candidate.date === day.date);
    if (existing) { existing.transactions += day.transactions; existing.unitsSold += day.unitsSold; }
    else days.push({ date: day.date, transactions: day.transactions, unitsSold: day.unitsSold });
    return days;
  }, []);
  const totalUnits = outletMetric.unitsSold;
  const mappedUnits = commerce.snackShack.unitsSold + commerce.bar.unitsSold;
  const activeDays = daily.filter((day) => day.transactions > 0).length;
  const busiestDay = daily.reduce<typeof daily[number] | null>((best, day) => !best || day.unitsSold > best.unitsSold ? day : best, null);
  const sectionLabel = tab === "Food & beverage" ? "Food & beverage" : "Clubhouse operations";
  return <><div className="period-bar"><span>{sectionLabel}</span><strong>{formatRange(commerce.period)}</strong><small>Operational measures from fully synced ForeUp POS line items.</small></div><nav className="operations-tabs" aria-label="Food and beverage outlet"><button aria-pressed={outlet === "all"} className={outlet === "all" ? "active" : ""} onClick={() => setOutlet("all")} type="button">All F&B</button><button aria-pressed={outlet === "snack_shack"} className={outlet === "snack_shack" ? "active" : ""} onClick={() => setOutlet("snack_shack")} type="button">Snack Shack</button><button aria-pressed={outlet === "bar"} className={outlet === "bar" ? "active" : ""} onClick={() => setOutlet("bar")} type="button">Bar</button><button aria-pressed={outlet === "fnb_unassigned"} className={outlet === "fnb_unassigned" ? "active" : ""} onClick={() => setOutlet("fnb_unassigned")} type="button">Needs Mapping</button></nav><div className="live-grid"><MetricCard label="Outlet orders" value={outletMetric.transactions} note="Outlet-attributed orders; a split receipt can touch two outlets" Icon={ClipboardList} /><MetricCard label="Units served" value={totalUnits} note={`${outletName} food and drink line-item quantity`} Icon={CalendarDays} /><MetricCard label="Active days" value={activeDays} note={`${daily.length} fully covered days in range`} Icon={ChartNoAxesCombined} /><MetricCard label={outlet === "all" ? "Mapping coverage" : "Outlet unit mix"} value={outlet === "all" ? totalUnits ? percent(mappedUnits / totalUnits) : "—" : commerce.clubhouse.unitsSold ? percent(totalUnits / commerce.clubhouse.unitsSold) : "—"} note={outlet === "all" ? `${commerce.fnbUnassigned.unitsSold} F&B units need outlet mapping` : `${outletName} share of all F&B units`} Icon={CircleGauge} /></div>{outlet === "all" && <OutletDistribution snackShack={commerce.snackShack} bar={commerce.bar} unassigned={commerce.fnbUnassigned} />}<div className="operations-grid"><article className="detail-card metric-explainer"><div><div className="eyebrow">Service pace</div><h3>{outletName} operating pulse</h3><p>This is an operating view: order volume, unit movement, and mapping quality—not a financial statement.</p></div><dl className="detail-list"><div><dt>Units / outlet order</dt><dd>{outletMetric.transactions ? number(totalUnits / outletMetric.transactions, 1) : "—"}</dd></div><div><dt>Snack Shack unit share</dt><dd>{commerce.clubhouse.unitsSold ? percent(commerce.snackShack.unitsSold / commerce.clubhouse.unitsSold) : "—"}</dd></div><div><dt>Bar unit share</dt><dd>{commerce.clubhouse.unitsSold ? percent(commerce.bar.unitsSold / commerce.clubhouse.unitsSold) : "—"}</dd></div><div><dt>Busiest unit day</dt><dd>{busiestDay?.unitsSold ? formatShortDate(busiestDay.date) : "—"}</dd></div></dl></article><FoodAndBeverageTrend daily={daily} /></div><FoodAndBeverageLedger daily={daily} /><section className="empty-area"><ReceiptText size={22} /><strong>Trending items are being added to the durable POS import</strong><span>The outlet toggle uses verified daily metrics now. Item-level trends will appear only after the import retains each menu item and its outlet, so the list is real rather than inferred.</span></section></>;
}

function OutletDistribution({ snackShack, bar, unassigned }: { snackShack: CommerceReport["snackShack"]; bar: CommerceReport["bar"]; unassigned: CommerceReport["fnbUnassigned"] }) {
  const total = snackShack.unitsSold + bar.unitsSold + unassigned.unitsSold;
  const outlets = [{ label: "Snack Shack", value: snackShack }, { label: "Bar", value: bar }, { label: "Needs mapping", value: unassigned }];
  return <article className="detail-card outlet-distribution"><div><div className="eyebrow">Food & beverage distribution</div><h3>Where orders are landing</h3><p>Outlet labels use the ForeUp department/location on each line item. Ambiguous F&B is held for mapping, never guessed.</p></div><dl className="detail-list">{outlets.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value.unitsSold} units · {value.transactions} orders · {total ? percent(value.unitsSold / total) : "—"}</dd></div>)}</dl></article>;
}

function FoodAndBeverageTrend({ daily }: { daily: Array<{ date: string; transactions: number; unitsSold: number }> }) {
  const recent = daily.slice(-14), maxUnits = Math.max(1, ...recent.map((day) => day.unitsSold));
  return <article className="daily-performance commerce-performance"><div className="daily-performance-heading"><div><div className="eyebrow">Recent pace</div><h3>Daily F&B units</h3></div><span>Last {recent.length} days in range</span></div><div className="daily-bars" aria-label="Daily food and beverage units">{recent.map((day) => <div className="daily-bar" key={day.date} title={`${formatDate(day.date)}: ${day.unitsSold} units, ${day.transactions} outlet orders`}><i style={{ height: `${Math.max(5, Math.round(day.unitsSold / maxUnits * 100))}%` }} /><span>{formatShortDate(day.date)}</span></div>)}</div><p>Bars show units served; a zero is trustworthy only because every outlet/day row is required.</p></article>;
}

function FoodAndBeverageLedger({ daily }: { daily: Array<{ date: string; transactions: number; unitsSold: number }> }) {
  const recent = daily.slice(-7).reverse();
  if (!recent.length) return null;
  return <article className="detail-card daily-ledger"><div><div className="eyebrow">Recent service ledger</div><h3>F&B last 7 days</h3><p>Operational volume from the completed POS import.</p></div><dl className="detail-list">{recent.map((day) => <div key={day.date}><dt>{formatShortDate(day.date)} · {day.transactions} outlet orders</dt><dd>{day.unitsSold} units</dd></div>)}</dl></article>;
}

function MetricCard({ label, value, note, Icon }: { label: string; value: string | number; note: string; Icon: typeof ReceiptText }) { return <article className="live-card"><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function CommerceTrend({ daily, label }: { daily: CommerceReport["daily"]; label: string }) {
  const recent = daily.slice(-14), maxRevenue = Math.max(1, ...recent.map((day) => day.revenue));
  return <article className="daily-performance commerce-performance"><div className="daily-performance-heading"><div><div className="eyebrow">Recent pace</div><h3>{label} daily revenue</h3></div><span>Last {recent.length} days in range</span></div><div className="daily-bars" aria-label={`${label} daily revenue`}>{recent.map((day) => <div className="daily-bar" key={day.date} title={`${formatDate(day.date)}: ${money(day.revenue)}, ${day.transactions} transactions`}><i style={{ height: `${Math.max(5, Math.round(day.revenue / maxRevenue * 100))}%` }} /><span>{formatShortDate(day.date)}</span></div>)}</div><p>Bars show recorded revenue. A zero means the feed imported no attached sales for that department.</p></article>;
}

function DailyLedger({ daily, label }: { daily: CommerceReport["daily"]; label: string }) {
  const recent = daily.slice(-7).reverse();
  if (!recent.length) return null;
  return <article className="detail-card daily-ledger"><div><div className="eyebrow">Recent ledger</div><h3>{label} last 7 days</h3><p>Daily totals from the completed POS import.</p></div><dl className="detail-list">{recent.map((day) => <div key={day.date}><dt>{formatShortDate(day.date)} · {day.transactions} txns</dt><dd>{money(day.revenue)}</dd></div>)}</dl></article>;
}

function EmptyArea({ area, tab }: { area: OperationsArea; tab: string }) {
  const Icon = area === "pro-shop" ? ReceiptText : area === "platform" ? Cloud : Flag;
  const copy: Record<OperationsArea, string> = { golf: "", "pro-shop": "Sales and inventory are not loaded yet. This stays blank until the live endpoint is mapped.", clubhouse: "Clubhouse sales and menu data are not loaded yet. No sample transactions are being shown.", members: "Member directory reads the scheduled hold. If it is missing, that gap stays visible.", automations: "No production automation is active. Rules and schedules will appear only after approval.", platform: "The ForeUp hold is the source for dashboards. Additional services will appear as they are configured." };
  return <section className="empty-area"><Icon size={26} /><strong>{tab}</strong><span>{copy[area]}</span></section>;
}

function percent(value: number) { return `${Math.round(Math.max(0, value) * 100)}%`; }
function number(value: number, maximumFractionDigits = 0) { return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
function formatShortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }); }
function formatRange(period: GolfSnapshot["period"]) { return `${formatDate(period.start)} – ${formatDate(period.end)}`; }
function apiBasePath() { return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? "/fairwayai" : ""; }
function isoToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

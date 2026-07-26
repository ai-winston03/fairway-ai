"use client";

import { CalendarDays, CircleGauge, ClipboardList, Cloud, Flag, MessageSquareText, ReceiptText, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { MemberWorkspace } from "@/components/MemberWorkspace";

export type OperationsArea = "golf" | "pro-shop" | "clubhouse" | "members" | "automations" | "platform";
type ReportRange = "mtd" | "last-month" | "this-quarter" | "last-quarter" | "ytd" | "custom";

type Segment = { rounds: number; bookings: number; carts: number; greenFeeRevenue: number };
type GolfSnapshot = {
  today: { date: string; bookings: number; occupancy: number; playersCheckedIn: number; playerNoShows: number; potentialSlots: number; slotsAvailable: number; revenue: number };
  period: { start: string; end: string; label: string };
  member: Segment;
  nonMember: Segment;
  unclassifiedRounds: number;
  priceClasses: string[];
  sourceBookings: number;
};

const areas: Record<OperationsArea, { label: string; eyebrow: string; title: string; description: string; tabs: string[] }> = {
  golf: { label: "Golf", eyebrow: "Live ForeUp", title: "Golf operations", description: "Live tee-sheet health and member versus non-member play.", tabs: ["Overview", "Member play", "Non-member play", "Tee sheet"] },
  "pro-shop": { label: "Pro Shop", eyebrow: "ForeUp", title: "Pro shop", description: "Sales, carts, and inventory will appear as each live feed is connected.", tabs: ["Overview", "Sales", "Inventory"] },
  clubhouse: { label: "Clubhouse", eyebrow: "ForeUp", title: "Clubhouse", description: "Food, beverage, and event operations in one place.", tabs: ["Overview", "Food & beverage", "Events"] },
  members: { label: "Members", eyebrow: "ForeUp", title: "Members", description: "A real member directory starts with an approved sync—not invented rows.", tabs: ["Directory", "Activity", "Accounts"] },
  automations: { label: "Automations", eyebrow: "Control room", title: "Automations", description: "Review approved messages and scheduled jobs before they run.", tabs: ["Rules", "Schedule", "History"] },
  platform: { label: "Platform", eyebrow: "System", title: "Connections", description: "Service health and data-source status.", tabs: ["Connections", "Data sync", "Access"] }
};

export function InternalDashboard({ area }: { area: OperationsArea }) {
  const [activeTab, setActiveTab] = useState(areas[area].tabs[0]);
  const [golf, setGolf] = useState<GolfSnapshot | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [range, setRange] = useState<ReportRange>("mtd");
  const [rangeSelection, setRangeSelection] = useState<ReportRange>("mtd");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoadingGolf, setIsLoadingGolf] = useState(false);
  const [golfUpdatedAt, setGolfUpdatedAt] = useState<Date | null>(null);
  const config = areas[area];

  useEffect(() => setActiveTab(areas[area].tabs[0]), [area]);
  useEffect(() => {
    const controller = new AbortController();
    if (range === "custom" && (!customStart || !customEnd)) return () => controller.abort();
    const query = new URLSearchParams({ range });
    if (range === "custom") { query.set("start", customStart); query.set("end", customEnd); }
    query.set("_", String(reloadKey));
    setIsLoadingGolf(true);
    setConnectionError(null);
    fetch(`${apiBasePath()}/api/dashboard/summary?${query}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.foreupLive?.connected) { setGolf(payload.foreupLive.golf); setGolfUpdatedAt(new Date()); }
        else setConnectionError(payload.foreupLive?.error ?? "ForeUp is unavailable.");
      })
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setConnectionError("Unable to load ForeUp."); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingGolf(false); });
    return () => controller.abort();
  }, [range, customStart, customEnd, reloadKey]);

  return <section className="operations-dashboard" aria-label={`${config.label} workspace`}>
    <header className="operations-hero"><div><div className="eyebrow">{config.eyebrow}</div><h2>{config.title}</h2><p>{config.description}</p></div><div className={`connection-badge ${connectionError ? "warning" : ""}`}><span />{connectionError ? "Needs attention" : "ForeUp connected"}</div></header>
    <nav className="operations-tabs" aria-label={`${config.label} submenu`}>{config.tabs.map((tab) => <button aria-pressed={activeTab === tab} className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</nav>
    {area === "golf" && <ReportRangeControl range={rangeSelection} onRangeChange={(value) => { setRangeSelection(value); if (value !== "custom") setRange(value); }} customStart={customStart} customEnd={customEnd} setCustomStart={setCustomStart} setCustomEnd={setCustomEnd} onApplyCustom={() => { if (customStart && customEnd && customStart <= customEnd) { setRange("custom"); setReloadKey((value) => value + 1); } }} onRefresh={() => setReloadKey((value) => value + 1)} isLoading={isLoadingGolf} updatedAt={golfUpdatedAt} />}
    {area === "golf" ? <GolfPanel golf={golf} error={connectionError} tab={activeTab} /> : area === "members" ? <MembersPanel /> : <EmptyArea area={area} tab={activeTab} />}
  </section>;
}

function ReportRangeControl({ range, onRangeChange, customStart, customEnd, setCustomStart, setCustomEnd, onApplyCustom, onRefresh, isLoading, updatedAt }: { range: ReportRange; onRangeChange: (value: ReportRange) => void; customStart: string; customEnd: string; setCustomStart: (value: string) => void; setCustomEnd: (value: string) => void; onApplyCustom: () => void; onRefresh: () => void; isLoading: boolean; updatedAt: Date | null }) {
  const presets: Array<[ReportRange, string]> = [["mtd", "Month to date"], ["last-month", "Last month"], ["this-quarter", "This quarter"], ["last-quarter", "Last quarter"], ["ytd", "Year to date"]];
  return <div className="report-range" aria-label="Report date range"><label className="report-period-select"><span>Report period</span><select aria-label="Report period" onChange={(event) => onRangeChange(event.target.value as ReportRange)} value={range}>{presets.map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="custom">Custom range</option></select></label>{range === "custom" && <div className="custom-date-fields"><label>From <input max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} /></label><label>To <input min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} /></label><button className="apply-range" disabled={!customStart || !customEnd || customStart > customEnd} onClick={onApplyCustom} type="button">Apply</button></div>}<div className="report-range-meta">{isLoading ? <span className="range-loading">Updating report…</span> : updatedAt ? <span>Live data · updated {updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : null}<button aria-label="Refresh report" className="refresh-report" disabled={isLoading} onClick={onRefresh} title="Refresh report" type="button"><RefreshCw aria-hidden="true" size={14} /></button></div></div>;
}

function GolfPanel({ golf, error, tab }: { golf: GolfSnapshot | null; error: string | null; tab: string }) {
  if (error) return <section className="empty-area"><CircleGauge size={24} /><strong>Live golf data needs attention</strong><span>{error}</span></section>;
  if (!golf) return <section className="empty-area"><CircleGauge size={24} /><strong>Loading live golf data</strong><span>No placeholder figures are displayed while ForeUp responds.</span></section>;
  const totalRounds = golf.member.rounds + golf.nonMember.rounds;
  const memberShare = totalRounds ? golf.member.rounds / totalRounds : 0;

  if (tab === "Member play") return <SegmentPanel label="Member play" segment={golf.member} totalRounds={totalRounds} period={golf.period.label} variant="member" />;
  if (tab === "Non-member play") return <SegmentPanel label="Non-member play" segment={golf.nonMember} totalRounds={totalRounds} period={golf.period.label} variant="guest" />;
  if (tab === "Tee sheet") return <TeeSheetPanel golf={golf} />;

  const cards = [
    ["Member rounds", golf.member.rounds, `${percent(memberShare)} of classified play`, Users],
    ["Non-member rounds", golf.nonMember.rounds, `${percent(1 - memberShare)} of classified play`, Flag],
    ["Checked in", golf.today.playersCheckedIn, `${golf.today.playerNoShows} no-shows today`, ClipboardList],
    ["Today’s occupancy", percent(golf.today.occupancy), `${golf.today.slotsAvailable} positions remaining`, CircleGauge]
  ] as const;
  return <>
    <div className="period-bar"><span>{golf.period.label}</span><strong>{formatRange(golf.period)}</strong><small>Classified from ForeUp price classes: {golf.priceClasses.join(" · ") || "none"}</small></div>
    <div className="live-grid">{cards.map(([label, value, note, Icon]) => <article className="live-card" key={label}><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
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
    { label: "Green-fee revenue", value: money(segment.greenFeeRevenue), note: "Green Fees only", Icon: ReceiptText },
    { label: "Share of play", value: percent(share), note: "Classified member mix", Icon: Users }
  ];
  return <><div className={`segment-hero ${variant}`}><span>{period}</span><strong>{segment.rounds}</strong><p>{label.toLowerCase()} rounds · {percent(share)} of classified play</p></div><div className="live-grid">{cards.map(({ label: cardLabel, value, note, Icon }) => <article className="live-card" key={cardLabel}><Icon size={18} /><span>{cardLabel}</span><strong>{value}</strong><small>{note}</small></article>)}</div></>;
}

function TeeSheetPanel({ golf }: { golf: GolfSnapshot }) {
  const stats = golf.today;
  return <article className="detail-card"><div><div className="eyebrow">Live today</div><h3>Today’s tee sheet</h3><p>ForeUp snapshot for {formatDate(stats.date)}.</p></div><dl className="detail-list"><div><dt>Bookings</dt><dd>{stats.bookings}</dd></div><div><dt>Open positions</dt><dd>{stats.slotsAvailable}</dd></div><div><dt>Potential positions</dt><dd>{stats.potentialSlots}</dd></div><div><dt>Golf revenue</dt><dd>{money(stats.revenue)}</dd></div></dl></article>;
}

function SegmentSummary({ label, segment, share }: { label: string; segment: Segment; share: number }) {
  return <article className="segment-summary"><div><span>{label}</span><strong>{segment.rounds} rounds</strong></div><div className="share-track"><i style={{ width: `${Math.round(share * 100)}%` }} /></div><dl><div><dt>Tee times</dt><dd>{segment.bookings}</dd></div><div><dt>Carts</dt><dd>{segment.carts}</dd></div><div><dt>Green fees</dt><dd>{money(segment.greenFeeRevenue)}</dd></div></dl></article>;
}

function MembersPanel() { return <MemberWorkspace />; }

function EmptyArea({ area, tab }: { area: OperationsArea; tab: string }) {
  const Icon = area === "pro-shop" ? ReceiptText : area === "platform" ? Cloud : Flag;
  const copy: Record<OperationsArea, string> = { golf: "", "pro-shop": "Sales and inventory are not loaded yet. This stays blank until the live endpoint is mapped.", clubhouse: "Clubhouse sales and menu data are not loaded yet. No sample transactions are being shown.", members: "Member syncing has not been enabled. Once approved, this will use live ForeUp records only.", automations: "No production automation is active. Rules and schedules will appear only after approval.", platform: "ForeUp is connected. Additional services will appear as they are configured." };
  return <section className="empty-area"><Icon size={26} /><strong>{tab}</strong><span>{copy[area]}</span></section>;
}

function percent(value: number) { return `${Math.round(Math.max(0, value) * 100)}%`; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
function formatRange(period: GolfSnapshot["period"]) { return `${formatDate(period.start)} – ${formatDate(period.end)}`; }
function apiBasePath() { return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? "/fairwayai" : ""; }

"use client";

import { Cloud, Flag, ReceiptText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClubSettingsPanel } from "@/components/ClubSettingsPanel";
import { AutomationsPanel, CommercePanel, MembersPanel, PlatformPanel } from "@/components/OperationsPanels";
import { GolfPanel } from "@/components/GolfReporting";
import { holdGapKind, reportingHeroBadge } from "@/lib/golf-held-ui";
import type { CommerceReport, GolfSnapshot, HoldCoverage, OperationsArea, ReportRange } from "@/lib/golf-reporting-ui";
export type { OperationsArea } from "@/lib/golf-reporting-ui";

const areas: Record<OperationsArea, { label: string; eyebrow: string; title: string; description: string; tabs: string[] }> = {
  golf: { label: "Golf", eyebrow: "Held reporting copy", title: "Golf operations", description: "Synced tee-sheet performance, member mix, and operating health.", tabs: ["Overview", "Member play", "Non-member play", "Tee sheet"] },
  "pro-shop": { label: "Pro Shop", eyebrow: "Held reporting copy", title: "Pro shop", description: "Sales, carts, and inventory come from the scheduled ForeUp hold.", tabs: ["Overview", "Sales", "Inventory"] },
  clubhouse: { label: "Clubhouse", eyebrow: "Held reporting copy", title: "Clubhouse", description: "Food, beverage, and event operations from the scheduled ForeUp hold.", tabs: ["Overview", "Food & beverage", "Events"] },
  members: { label: "Members", eyebrow: "Held directory", title: "Members", description: "Directory and threads read the scheduled ForeUp hold. Missing holds stay visible.", tabs: ["Directory", "Holds", "Activity", "Accounts"] },
  automations: { label: "Automations", eyebrow: "Control room", title: "Automations", description: "Review approved messages and scheduled jobs before they run.", tabs: ["Rules", "Schedule", "History"] },
  platform: { label: "Platform", eyebrow: "System", title: "Connections", description: "Service health and data-source status.", tabs: ["Connections", "Data sync", "Club settings", "Access"] }
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
    setGolf(null);
    setCommerce(null);
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

  const reportingHero = area === "golf" || area === "pro-shop" || area === "clubhouse";
  const heroBadge = reportingHeroBadge(area);
  return <section className="operations-dashboard" aria-label={`${config.label} workspace`}>
    <header className="operations-hero"><div><div className="eyebrow">{config.eyebrow}</div><h2>{config.title}</h2><p>{config.description}</p></div><div className={heroBadge.className}><span />{heroBadge.label}</div></header>
    <nav className="operations-tabs" aria-label={`${config.label} submenu`}>{config.tabs.map((tab) => <button aria-pressed={activeTab === tab} className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</nav>
    {reportingHero && <ReportRangeControl range={rangeSelection} onRangeChange={setRangeSelection} customStart={customStart} customEnd={customEnd} setCustomStart={setCustomStart} setCustomEnd={setCustomEnd} onRefresh={() => setReloadKey((value) => value + 1)} isLoading={isLoadingGolf} updatedAt={golfUpdatedAt} />}
    {reportingHero && !connectionError && <HoldGapBanner coverage={area === "golf" ? golf?.coverage : commerce?.coverage} label={area === "golf" ? "Golf" : area === "pro-shop" ? "Pro shop" : "Clubhouse"} loadedEmpty={!isLoadingGolf && (area === "golf" ? !golf : !commerce)} />}
    {area === "golf" ? <GolfPanel golf={golf} error={connectionError} tab={activeTab} loading={isLoadingGolf} /> : area === "members" ? <MembersPanel tab={activeTab} /> : area === "pro-shop" || area === "clubhouse" ? <CommercePanel area={area} commerce={commerce} error={connectionError} tab={activeTab} loading={isLoadingGolf} /> : area === "automations" ? <AutomationsPanel tab={activeTab} /> : area === "platform" && activeTab === "Club settings" ? <ClubSettingsPanel /> : area === "platform" ? <PlatformPanel golf={golf} commerce={commerce} error={connectionError} tab={activeTab} /> : <EmptyArea area={area} tab={activeTab} />}
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

function HoldGapBanner({ coverage, label, loadedEmpty }: { coverage?: HoldCoverage; label: string; loadedEmpty?: boolean }) {
  const kind = holdGapKind(coverage?.status, loadedEmpty);
  if (kind === "missing") {
    return <section className="hold-gap missing"><strong>{label} is not synced for this range</strong><span>{coverage?.missingDays?.length ? `Missing ${formatMissingDays(coverage.missingDays)}. ` : ""}No totals are invented for days that are not in the hold. This is not a live ForeUp pull.</span></section>;
  }
  if (kind !== "partial" || !coverage) return null;
  return <section className="hold-gap"><strong>{coverage.missingDays.length} day{coverage.missingDays.length === 1 ? "" : "s"} missing from the held copy</strong><span>Showing {coverage.heldDays.length} held day{coverage.heldDays.length === 1 ? "" : "s"}. Missing {formatMissingDays(coverage.missingDays)}.</span></section>;
}

function EmptyArea({ area, tab }: { area: OperationsArea; tab: string }) {
  const Icon = area === "pro-shop" ? ReceiptText : area === "platform" ? Cloud : Flag;
  const copy: Record<OperationsArea, string> = { golf: "", "pro-shop": "Sales and inventory are not loaded yet. This stays blank until the live endpoint is mapped.", clubhouse: "Clubhouse sales and menu data are not loaded yet. No sample transactions are being shown.", members: "Member directory reads the scheduled hold. If it is missing, that gap stays visible.", automations: "No production automation is active. Rules and schedules will appear only after approval.", platform: "The ForeUp hold is the source for dashboards. Additional services will appear as they are configured." };
  return <section className="empty-area"><Icon size={26} /><strong>{tab}</strong><span>{copy[area]}</span></section>;
}

function apiBasePath() { return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? "/fairwayai" : ""; }
function isoToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

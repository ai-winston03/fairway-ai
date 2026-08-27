"use client";

import { RefreshCw } from "lucide-react";
import { holdGapKind } from "@/lib/golf-held-ui";
import type { HoldCoverage, ReportRange } from "@/lib/golf-reporting-ui";

export { GolfPanel } from "@/components/GolfReporting";
export { AutomationsPanel, MembersPanel, PlatformPanel } from "@/components/OperationsPanels";

export function ReportRangeControl({ range, onRangeChange, customStart, customEnd, setCustomStart, setCustomEnd, onRefresh, isLoading, updatedAt }: { range: ReportRange; onRangeChange: (value: ReportRange) => void; customStart: string; customEnd: string; setCustomStart: (value: string) => void; setCustomEnd: (value: string) => void; onRefresh: () => void; isLoading: boolean; updatedAt: Date | null }) {
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

export function HoldGapBanner({ coverage, label, loadedEmpty = false }: { coverage?: HoldCoverage; label: string; loadedEmpty?: boolean }) {
  const kind = holdGapKind(coverage?.status, loadedEmpty);
  if (kind === "none") return null;
  if (kind === "missing") {
    return <section className="hold-gap missing"><strong>{label} is not synced for this range</strong><span>Missing {formatMissingDays(coverage?.missingDays ?? [])}. No held days — totals are not invented. This is not a live ForeUp pull.</span></section>;
  }
  return <section className="hold-gap"><strong>{coverage?.missingDays.length} day{coverage?.missingDays.length === 1 ? "" : "s"} missing from the held copy</strong><span>Showing {coverage?.heldDays.length} held day{coverage?.heldDays.length === 1 ? "" : "s"}. Missing {formatMissingDays(coverage?.missingDays ?? [])}.</span></section>;
}

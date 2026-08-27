use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, Cloud, Flag, MessageSquareText, ReceiptText, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClubSettingsPanel } from "@/components/ClubSettingsPanel";
import { MemberWorkspace } from "@/components/MemberWorkspace";
import { StaffHoldsQueue } from "@/components/StaffHoldsQueue";
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
  return <section className="operations-dashboard" aria-label={`${config.label} workspace`}>
    <header className="operations-hero"><div><div className="eyebrow">{config.eyebrow}</div><h2>{config.title}</h2><p>{config.description}</p></div><div className="connection-badge warning"><span />{reportingHero || area === "platform" ? "Held copy" : "Held directory"}</div></header>
    <nav className="operations-tabs" aria-label={`${config.label} submenu`}>{config.tabs.map((tab) => <button aria-pressed={activeTab === tab} className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</nav>
    {reportingHero && <ReportRangeControl range={rangeSelection} onRangeChange={setRangeSelection} customStart={customStart} customEnd={customEnd} setCustomStart={setCustomStart} setCustomEnd={setCustomEnd} onRefresh={() => setReloadKey((value) => value + 1)} isLoading={isLoadingGolf} updatedAt={golfUpdatedAt} />}
    {reportingHero && !connectionError && <HoldGapBanner coverage={area === "golf" ? golf?.coverage : commerce?.coverage} label={area === "golf" ? "Golf" : area === "pro-shop" ? "Pro shop" : "Clubhouse"} loadedEmpty={!isLoadingGolf && (area === "golf" ? !golf : !commerce)} />}
    {area === "golf" ? <GolfPanel golf={golf} error={connectionError} tab={activeTab} loading={isLoadingGolf} /> : area === "members" ? <MembersPanel tab={activeTab} /> : area === "pro-shop" || area === "clubhouse" ? <CommercePanel area={area} commerce={commerce} error={connectionError} tab={activeTab} loading={isLoadingGolf} /> : area === "automations" ? <AutomationsPanel tab={activeTab} /> : area === "platform" && activeTab === "Club settings" ? <ClubSettingsPanel /> : area === "platform" ? <PlatformPanel golf={golf} commerce={commerce} error={connectionError} tab={activeTab} /> : <EmptyArea area={area} tab={activeTab} />}
  </section>;
}

"use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, Cloud, Flag, ReceiptText } from "lucide-react";
import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import type { CommerceReport, OperationsArea } from "@/lib/golf-reporting-ui";
import { formatDate, formatRange, formatShortDate, money, number, percent } from "@/lib/golf-reporting-ui";

export function CommercePanel({ area, commerce, error, tab, loading }: { area: "pro-shop" | "clubhouse"; commerce: CommerceReport | null; error: string | null; tab: string; loading: boolean }) {
  const department = area === "pro-shop" ? "proShop" : "clubhouse";
  const label = area === "pro-shop" ? "Pro shop" : "Clubhouse";
  if (error) return <section className="empty-area"><ReceiptText size={24} /><strong>{label} reporting needs attention</strong><span>{error}</span></section>;
  if (loading || !commerce) return <section className="empty-area"><ReceiptText size={24} /><strong>Loading {label.toLowerCase()} reporting</strong><span>No placeholder figures are displayed while the reporting hold responds.</span></section>;
  if (commerce.coverage?.status === "missing") return null;
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

function CommerceTrend({ daily, label }: { daily: CommerceReport["daily"]; label: string }) {
  const recent = daily.slice(-14), maxRevenue = Math.max(1, ...recent.map((day) => day.revenue));
  return <article className="daily-performance commerce-performance"><div className="daily-performance-heading"><div><div className="eyebrow">Recent pace</div><h3>{label} daily revenue</h3></div><span>Last {recent.length} days in range</span></div><div className="daily-bars" aria-label={`${label} daily revenue`}>{recent.map((day) => <div className="daily-bar" key={day.date} title={`${formatDate(day.date)}: ${money(day.revenue)}, ${day.transactions} transactions`}><i style={{ height: `${Math.max(5, Math.round(day.revenue / maxRevenue * 100))}%` }} /><span>{formatShortDate(day.date)}</span></div>)}</div><p>Bars show recorded revenue. A zero means the feed imported no attached sales for that department.</p></article>;
}

function DailyLedger({ daily, label }: { daily: CommerceReport["daily"]; label: string }) {
  const recent = daily.slice(-7).reverse();
  if (!recent.length) return null;
  return <article className="detail-card daily-ledger"><div><div className="eyebrow">Recent ledger</div><h3>{label} last 7 days</h3><p>Daily totals from the completed POS import.</p></div><dl className="detail-list">{recent.map((day) => <div key={day.date}><dt>{formatShortDate(day.date)} · {day.transactions} txns</dt><dd>{money(day.revenue)}</dd></div>)}</dl></article>;
}

export function EmptyArea({ area, tab }: { area: OperationsArea; tab: string }) {
  const Icon = area === "pro-shop" ? ReceiptText : area === "platform" ? Cloud : Flag;
  const copy: Record<OperationsArea, string> = { golf: "", "pro-shop": "Sales and inventory are not loaded yet. This stays blank until the live endpoint is mapped.", clubhouse: "Clubhouse sales and menu data are not loaded yet. No sample transactions are being shown.", members: "Member directory reads the scheduled hold. If it is missing, that gap stays visible.", automations: "No production automation is active. Rules and schedules will appear only after approval.", platform: "The ForeUp hold is the source for dashboards. Additional services will appear as they are configured." };
  return <section className="empty-area"><Icon size={26} /><strong>{tab}</strong><span>{copy[area]}</span></section>;
}

"use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, ReceiptText } from "lucide-react";
import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { formatDate, formatRange, formatShortDate, money, number, percent, type CommerceReport } from "@/lib/golf-reporting-ui";

export function FoodAndBeveragePanel({ commerce, tab }: { commerce: CommerceReport; tab: string }) {
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

export function CommerceTrend({ daily, label }: { daily: CommerceReport["daily"]; label: string }) {
  const recent = daily.slice(-14), maxRevenue = Math.max(1, ...recent.map((day) => day.revenue));
  return <article className="daily-performance commerce-performance"><div className="daily-performance-heading"><div><div className="eyebrow">Recent pace</div><h3>{label} daily revenue</h3></div><span>Last {recent.length} days in range</span></div><div className="daily-bars" aria-label={`${label} daily revenue`}>{recent.map((day) => <div className="daily-bar" key={day.date} title={`${formatDate(day.date)}: ${money(day.revenue)}, ${day.transactions} transactions`}><i style={{ height: `${Math.max(5, Math.round(day.revenue / maxRevenue * 100))}%` }} /><span>{formatShortDate(day.date)}</span></div>)}</div><p>Bars show recorded revenue. A zero means the feed imported no attached sales for that department.</p></article>;
}

export function DailyLedger({ daily, label }: { daily: CommerceReport["daily"]; label: string }) {
  const recent = daily.slice(-7).reverse();
  if (!recent.length) return null;
  return <article className="detail-card daily-ledger"><div><div className="eyebrow">Recent ledger</div><h3>{label} last 7 days</h3><p>Daily totals from the completed POS import.</p></div><dl className="detail-list">{recent.map((day) => <div key={day.date}><dt>{formatShortDate(day.date)} · {day.transactions} txns</dt><dd>{money(day.revenue)}</dd></div>)}</dl></article>;
}

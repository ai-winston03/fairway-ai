"use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, ReceiptText, Users } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { GOLF_NEEDS_ATTENTION, golfBodyKind } from "@/lib/golf-held-ui";
import { formatDate, formatRange, formatShortDate, money, number, percent, type GolfSnapshot, type Segment } from "@/lib/golf-reporting-ui";

export function GolfPanel({ golf, error, tab, loading }: { golf: GolfSnapshot | null; error: string | null; tab: string; loading: boolean }) {
  const body = golfBodyKind({ error, loading, golf });
  if (body === "error") return <section className="empty-area"><CircleGauge size={24} /><strong>{GOLF_NEEDS_ATTENTION}</strong><span>{error}</span></section>;
  if (body === "loading") return <section className="empty-area"><CircleGauge size={24} /><strong>Loading golf reporting</strong><span>No placeholder figures are displayed while the reporting database responds.</span></section>;
  if (body === "missing" || !golf) return null;
  const totalRounds = golf.member.rounds + golf.nonMember.rounds;
  const allRounds = totalRounds + golf.unclassifiedRounds;
  const memberShare = totalRounds ? golf.member.rounds / totalRounds : 0;

  if (tab === "Member play") return <SegmentPanel label="Member play" segment={golf.member} totalRounds={totalRounds} period={golf.period.label} variant="member" />;
  if (tab === "Non-member play") return <SegmentPanel label="Non-member play" segment={golf.nonMember} totalRounds={totalRounds} period={golf.period.label} variant="guest" />;
  if (tab === "Tee sheet") return <TeeSheetPanel golf={golf} />;

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

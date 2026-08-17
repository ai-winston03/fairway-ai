import { listDailyCommerceMetrics, listDailyGolfMetrics, upsertDailyCommerceMetric, upsertDailyGolfMetric } from "@dataconnect/admin-generated";
import { ForeupCommerceDepartment, ForeupCommerceMetric, ForeupGolfSnapshot, ForeupTeeSheetStats } from "@/lib/foreup-adapter";
import { fairwayDataConnect } from "@/lib/firebase-admin";
import { enumerateIsoDays, holdCoverage, latestSyncedAt, type HoldCoverage } from "@/lib/foreup-hold";

type Period = { start: string; end: string; label: string };

export const COMMERCE_DEPARTMENTS = ["pro_shop", "snack_shack", "bar", "fnb_unassigned"] as const;

export type DailyGolfMetricInput = {
  courseId: string;
  teeSheetId: string;
  date: string;
  snapshot: ForeupGolfSnapshot;
};

export type HeldGolfReport = ForeupGolfSnapshot & { coverage: HoldCoverage };

export type CommerceReport = {
  period: Period;
  coverage: HoldCoverage;
  proShop: { transactions: number; unitsSold: number; revenue: number };
  clubhouse: { transactions: number; unitsSold: number; revenue: number };
  snackShack: { transactions: number; unitsSold: number; revenue: number };
  bar: { transactions: number; unitsSold: number; revenue: number };
  fnbUnassigned: { transactions: number; unitsSold: number; revenue: number };
  daily: Array<{ date: string; department: ForeupCommerceDepartment; transactions: number; unitsSold: number; revenue: number }>;
};

function emptyToday(date: string): ForeupTeeSheetStats {
  return { date, bookings: 0, occupancy: 0, playersCheckedIn: 0, playerNoShows: 0, potentialSlots: 0, slotsAvailable: 0, revenue: 0 };
}

function emptyCommerceTotals() {
  return { transactions: 0, unitsSold: 0, revenue: 0 };
}

/** Returns null only when Data Connect itself is unavailable. Partial ranges stay visible. */
export async function readGolfReport(courseId: string, teeSheetId: string, period: Period, today: string): Promise<HeldGolfReport | null> {
  const dc = fairwayDataConnect();
  if (!dc) return null;
  const result = await listDailyGolfMetrics(dc, { courseId, teeSheetId, start: period.start, end: period.end });
  const rows = result.data.dailyGolfMetrics;
  const expectedDays = enumerateIsoDays(period.start, period.end);
  const heldDays = rows.map((row) => row.date);
  const coverage = holdCoverage(expectedDays, heldDays, latestSyncedAt(rows.map((row) => row.syncedAt)));
  const sum = <T extends keyof (typeof rows)[number]>(key: T) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const todayRow = rows.find((row) => row.date === today);
  const todayStats: ForeupTeeSheetStats = todayRow ? {
    date: todayRow.date,
    bookings: todayRow.bookings,
    occupancy: todayRow.occupancy,
    playersCheckedIn: todayRow.playersCheckedIn,
    playerNoShows: todayRow.playerNoShows,
    potentialSlots: todayRow.potentialSlots,
    slotsAvailable: todayRow.slotsAvailable,
    revenue: todayRow.revenue
  } : emptyToday(today);

  return {
    today: todayStats,
    period,
    coverage,
    member: {
      rounds: sum("memberRounds"), bookings: sum("memberBookings"), carts: sum("memberCarts"), greenFeeRevenue: sum("memberGreenFeeRevenue")
    },
    nonMember: {
      rounds: sum("nonMemberRounds"), bookings: sum("nonMemberBookings"), carts: sum("nonMemberCarts"), greenFeeRevenue: sum("nonMemberGreenFeeRevenue")
    },
    unclassifiedRounds: sum("unclassifiedRounds"),
    priceClasses: [],
    sourceBookings: sum("sourceBookings"),
    daily: rows.map((row) => ({
      date: row.date,
      rounds: Number(row.memberRounds) + Number(row.nonMemberRounds) + Number(row.unclassifiedRounds),
      bookings: Number(row.bookings),
      occupancy: Number(row.occupancy),
      potentialSlots: Number(row.potentialSlots),
      slotsAvailable: Number(row.slotsAvailable),
      revenue: Number(row.revenue),
      greenFeeRevenue: Number(row.memberGreenFeeRevenue) + Number(row.nonMemberGreenFeeRevenue)
    }))
  };
}

/** Upserts one date of imported ForeUp facts into the durable Postgres store. */
export async function writeDailyGolfMetric({ courseId, teeSheetId, date, snapshot }: DailyGolfMetricInput) {
  const dc = fairwayDataConnect();
  if (!dc) throw new Error("Firebase Data Connect is unavailable.");
  const { today, member, nonMember } = snapshot;
  await upsertDailyGolfMetric(dc, {
    courseId, teeSheetId, date,
    bookings: today.bookings, occupancy: today.occupancy, playersCheckedIn: today.playersCheckedIn,
    playerNoShows: today.playerNoShows, potentialSlots: today.potentialSlots, slotsAvailable: today.slotsAvailable,
    revenue: today.revenue, memberRounds: member.rounds, memberBookings: member.bookings,
    memberCarts: member.carts, memberGreenFeeRevenue: member.greenFeeRevenue,
    nonMemberRounds: nonMember.rounds, nonMemberBookings: nonMember.bookings,
    nonMemberCarts: nonMember.carts, nonMemberGreenFeeRevenue: nonMember.greenFeeRevenue,
    unclassifiedRounds: snapshot.unclassifiedRounds, sourceBookings: snapshot.sourceBookings
  });
}

/** Reads held department/date rows. Incomplete days stay in missingDays instead of zeroing the whole range. */
export async function readCommerceReport(courseId: string, teeSheetId: string, period: Period): Promise<CommerceReport | null> {
  const dc = fairwayDataConnect();
  if (!dc) return null;
  const result = await listDailyCommerceMetrics(dc, { courseId, teeSheetId, start: period.start, end: period.end });
  const rows = result.data.dailyCommerceMetrics;
  const expectedDays = enumerateIsoDays(period.start, period.end);
  const rowsByDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const current = rowsByDate.get(row.date) ?? [];
    current.push(row);
    rowsByDate.set(row.date, current);
  }
  const heldDays = [...rowsByDate.entries()]
    .filter(([, dayRows]) => COMMERCE_DEPARTMENTS.every((department) => dayRows.some((row) => row.department === department)))
    .map(([date]) => date);
  const usedRows = rows.filter((row) => heldDays.includes(row.date));
  const coverage = holdCoverage(expectedDays, heldDays, latestSyncedAt(rows.map((row) => row.syncedAt)));
  const totals = (department: ForeupCommerceDepartment) => usedRows.filter((row) => row.department === department).reduce((total, row) => ({
    transactions: total.transactions + Number(row.transactions),
    unitsSold: total.unitsSold + Number(row.unitsSold),
    revenue: total.revenue + Number(row.revenue)
  }), emptyCommerceTotals());
  return {
    period,
    coverage,
    proShop: totals("pro_shop"),
    clubhouse: (["snack_shack", "bar", "fnb_unassigned"] as const).reduce((total, department) => {
      const outlet = totals(department);
      return { transactions: total.transactions + outlet.transactions, unitsSold: total.unitsSold + outlet.unitsSold, revenue: total.revenue + outlet.revenue };
    }, emptyCommerceTotals()),
    snackShack: totals("snack_shack"),
    bar: totals("bar"),
    fnbUnassigned: totals("fnb_unassigned"),
    daily: usedRows.map((row) => ({
      date: row.date,
      department: COMMERCE_DEPARTMENTS.includes(row.department as typeof COMMERCE_DEPARTMENTS[number]) ? row.department as ForeupCommerceDepartment : "fnb_unassigned",
      transactions: Number(row.transactions), unitsSold: Number(row.unitsSold), revenue: Number(row.revenue)
    }))
  };
}

/** Writes every department row for a day.  The adapter emits explicit zeroes
 * for quiet departments, allowing readCommerceReport to verify completeness. */
export async function writeDailyCommerceMetrics(courseId: string, teeSheetId: string, date: string, metrics: ForeupCommerceMetric[] = []) {
  const dc = fairwayDataConnect();
  if (!dc) throw new Error("Firebase Data Connect is unavailable.");
  const byDepartment = new Map(metrics.map((metric) => [metric.department, metric]));
  for (const department of ["pro_shop", "snack_shack", "bar", "fnb_unassigned"] as const) {
    const metric = byDepartment.get(department) ?? { department, transactions: 0, unitsSold: 0, revenue: 0 };
    await upsertDailyCommerceMetric(dc, {
      courseId, teeSheetId, date, department,
      transactions: Math.round(metric.transactions), unitsSold: Math.round(metric.unitsSold), revenue: metric.revenue
    });
  }
}

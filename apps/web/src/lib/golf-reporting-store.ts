import { listDailyGolfMetrics, upsertDailyGolfMetric } from "@dataconnect/admin-generated";
import { ForeupGolfSnapshot, ForeupTeeSheetStats } from "@/lib/foreup-adapter";
import { fairwayDataConnect } from "@/lib/firebase-admin";

type Period = { start: string; end: string; label: string };

export type DailyGolfMetricInput = {
  courseId: string;
  teeSheetId: string;
  date: string;
  snapshot: ForeupGolfSnapshot;
};

/** Returns null when Data Connect has no rows for the selected reporting range. */
export async function readGolfReport(courseId: string, teeSheetId: string, period: Period, today: string): Promise<ForeupGolfSnapshot | null> {
  const dc = fairwayDataConnect();
  if (!dc) return null;
  const result = await listDailyGolfMetrics(dc, { courseId, teeSheetId, start: period.start, end: period.end });
  const rows = result.data.dailyGolfMetrics;
  if (!rows.length) return null;

  // A partial import is misleading for an aggregate report.  Only return a
  // range when every day is present; the dashboard then tells the operator to
  // run the protected sync instead of quietly presenting a partial total.
  const startAt = new Date(`${period.start}T12:00:00Z`);
  const endAt = new Date(`${period.end}T12:00:00Z`);
  const expectedDays = Math.floor((endAt.getTime() - startAt.getTime()) / 86_400_000) + 1;
  if (rows.length !== expectedDays) return null;

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
  } : { date: today, bookings: 0, occupancy: 0, playersCheckedIn: 0, playerNoShows: 0, potentialSlots: 0, slotsAvailable: 0, revenue: 0 };

  return {
    today: todayStats,
    period,
    member: {
      rounds: sum("memberRounds"), bookings: sum("memberBookings"), carts: sum("memberCarts"), greenFeeRevenue: sum("memberGreenFeeRevenue")
    },
    nonMember: {
      rounds: sum("nonMemberRounds"), bookings: sum("nonMemberBookings"), carts: sum("nonMemberCarts"), greenFeeRevenue: sum("nonMemberGreenFeeRevenue")
    },
    unclassifiedRounds: sum("unclassifiedRounds"),
    priceClasses: [],
    sourceBookings: sum("sourceBookings")
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

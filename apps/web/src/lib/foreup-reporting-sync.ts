import { cachedForeup } from "@/lib/foreup-cache";
import { addIsoDays, dailyHoldRange, writeHeldMemberDirectory } from "@/lib/foreup-hold";
import { foreup, upcomingTeeTimesByCustomer } from "@/lib/foreup-adapter";
import { writeDailyCommerceMetrics, writeDailyGolfMetric } from "@/lib/golf-reporting-store";
import { yubaToday } from "@/lib/report-period";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function syncForeupReportingRange(courseId: string, teeSheetId: string, start: string, end: string) {
  const startAt = new Date(`${start}T12:00:00Z`), endAt = new Date(`${end}T12:00:00Z`);
  const days = Math.floor((endAt.getTime() - startAt.getTime()) / 86_400_000) + 1;
  if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error("Sync range must be between 1 and 31 days.");

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(startAt);
    date.setUTCDate(date.getUTCDate() + offset);
    const day = isoDate(date);
    const snapshot = await foreup.getGolfSnapshot(courseId, teeSheetId, { start: day, end: day, label: day }, day);
    await writeDailyGolfMetric({ courseId, teeSheetId, date: day, snapshot });
    await writeDailyCommerceMetrics(courseId, teeSheetId, day, snapshot.commerce);
  }
  return { start, end, rowsWritten: days };
}

export async function syncForeupMemberHold(courseId: string, teeSheetId: string, today = yubaToday()) {
  const customers = await cachedForeup(`members:${courseId}`, 120_000, () => foreup.listCustomers(courseId));
  let upcomingByCustomerId: Awaited<ReturnType<typeof upcomingTeeTimesByCustomer>> = {};
  let upcomingSynced = false;
  let bookingsError: string | undefined;
  try {
    const end = addIsoDays(today, 90);
    const bookings = await cachedForeup(`upcoming:${courseId}:${today}`, 120_000, () => foreup.listBookings(courseId, teeSheetId, today, end));
    upcomingByCustomerId = upcomingTeeTimesByCustomer(bookings);
    upcomingSynced = true;
  } catch (error) {
    bookingsError = error instanceof Error ? error.message : "Upcoming booking hold failed.";
  }
  await writeHeldMemberDirectory({
    courseId,
    syncedAt: new Date().toISOString(),
    customers,
    upcomingByCustomerId,
    upcomingSynced
  });
  return {
    customers: customers.length,
    members: customers.filter((customer) => customer.member).length,
    upcomingCustomers: Object.keys(upcomingByCustomerId).length,
    upcomingSynced,
    bookingsError
  };
}

export async function syncForeupDailyHold(courseId: string, teeSheetId: string, today = yubaToday()) {
  const range = dailyHoldRange(today);
  const reporting = await syncForeupReportingRange(courseId, teeSheetId, range.start, range.end);
  const members = await syncForeupMemberHold(courseId, teeSheetId, today);
  return { range, reporting, members };
}

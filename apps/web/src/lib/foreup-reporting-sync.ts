import { foreup } from "@/lib/foreup-adapter";
import { writeDailyGolfMetric } from "@/lib/golf-reporting-store";

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
  }
  return { start, end, rowsWritten: days };
}

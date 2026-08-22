export type TimeWindow = "morning" | "afternoon" | "evening";

export type ProposedTeeTime = {
  id: string;
  startsAt: string;
  label: string;
  spotsOpen: number;
  source: "hold" | "demo";
};

export type HeldAvailability = {
  courseId: string;
  syncedAt: string;
  slots: ProposedTeeTime[];
};

export type TeeTimeQuery = {
  date?: string;
  window?: TimeWindow;
  time?: string;
  playerCount?: number;
};

export function slotDate(startsAt: string) {
  return startsAt.slice(0, 10);
}

export function slotHour(startsAt: string) {
  const hour = Number(startsAt.slice(11, 13));
  return Number.isFinite(hour) ? hour : 0;
}

export function slotClock(startsAt: string) {
  return startsAt.slice(11, 16);
}

export function windowForHour(hour: number): TimeWindow {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function formatSlotClock(startsAt: string) {
  const hour24 = slotHour(startsAt);
  const minute = startsAt.slice(14, 16);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

export function minutesFromClock(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function productionTeeTimes(slots: ProposedTeeTime[]) {
  return slots.filter((slot) => slot.source !== "demo" && slot.spotsOpen > 0);
}

/** Maps a ForeUp teetimes row onto the held-availability slot the bot reads. */
export function heldSlotFromTeeTime(slot: { id: string; startsAt: string; spotsOpen: number }): ProposedTeeTime | null {
  if (!slot.startsAt || !Number.isFinite(slot.spotsOpen)) return null;
  const clock = slotClock(slot.startsAt);
  if (!/^\d{2}:\d{2}$/.test(clock)) return null;
  return {
    id: slot.id || `${slotDate(slot.startsAt)}-${clock.replace(":", "")}`,
    startsAt: slot.startsAt,
    label: formatSlotClock(slot.startsAt),
    spotsOpen: slot.spotsOpen,
    source: "hold"
  };
}

export function filterAvailableTeeTimes(slots: ProposedTeeTime[], query: TeeTimeQuery): ProposedTeeTime[] {
  return slots
    .filter((slot) => {
      if (query.date && slotDate(slot.startsAt) !== query.date) return false;
      if (query.playerCount && slot.spotsOpen < query.playerCount) return false;
      if (query.window && windowForHour(slotHour(slot.startsAt)) !== query.window) return false;
      if (query.time) {
        const wanted = minutesFromClock(query.time.includes(":") ? query.time : `${query.time}:00`);
        const actual = minutesFromClock(slotClock(slot.startsAt));
        if (wanted == null || actual == null || Math.abs(actual - wanted) > 60) return false;
      }
      return slot.spotsOpen > 0;
    })
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, 3);
}

export function localDateTime(date: string, hour: number, minute: number) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${date}T${hh}:${mm}:00`;
}

export function makeTeeTime(date: string, hour: number, minute: number, spotsOpen: number, source: ProposedTeeTime["source"] = "hold"): ProposedTeeTime {
  const startsAt = localDateTime(date, hour, minute);
  return {
    id: `${slotDate(startsAt)}-${slotClock(startsAt).replace(":", "")}`,
    startsAt,
    label: formatSlotClock(startsAt),
    spotsOpen,
    source
  };
}

export function addIsoDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextWeekdayOnOrAfter(iso: string, weekday: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  const delta = (weekday - date.getUTCDay() + 7) % 7;
  return addIsoDays(iso, delta);
}

/** Demo hold used by BotSimulator and unit tests. Never treated as a live booking. */
export function buildDemoAvailability(today: string, source: ProposedTeeTime["source"] = "demo"): HeldAvailability {
  const saturday = nextWeekdayOnOrAfter(today, 6);
  const sunday = nextWeekdayOnOrAfter(today, 0) === today ? today : nextWeekdayOnOrAfter(addIsoDays(today, 1), 0);
  const tomorrow = addIsoDays(today, 1);
  return {
    courseId: "demo",
    syncedAt: `${today}T12:00:00.000Z`,
    slots: [
      makeTeeTime(saturday, 8, 20, 4, source),
      makeTeeTime(saturday, 8, 36, 3, source),
      makeTeeTime(saturday, 9, 4, 4, source),
      makeTeeTime(saturday, 13, 12, 2, source),
      makeTeeTime(sunday, 7, 52, 4, source),
      makeTeeTime(sunday, 8, 8, 4, source),
      makeTeeTime(tomorrow, 14, 0, 4, source),
      makeTeeTime(tomorrow, 14, 16, 3, source)
    ]
  };
}

export function demoAvailableTeeTimes(today: string) {
  return buildDemoAvailability(today).slots;
}

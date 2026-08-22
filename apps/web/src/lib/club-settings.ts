export const DEFAULT_MEMBERS_ONLY_MESSAGE = "this is a members only Yuba Golf Club bot";
export const DEFAULT_RESTAURANT_TIMEZONE = "America/Chicago";

export type ClubFaq = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
};

export type RestaurantHours = {
  open: string;
  close: string;
  timezone: string;
  days: string[];
};

export type ClubSettings = {
  courseId: string;
  proShopPhone: string;
  restaurantHours: RestaurantHours;
  faq: ClubFaq[];
  membersOnlyMessage: string;
  updatedAt?: string;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function defaultRestaurantHours(): RestaurantHours {
  return {
    open: "06:00",
    close: "20:00",
    timezone: DEFAULT_RESTAURANT_TIMEZONE,
    days: [...WEEKDAYS]
  };
}

export function defaultClubSettings(courseId = ""): ClubSettings {
  return {
    courseId,
    proShopPhone: "",
    restaurantHours: defaultRestaurantHours(),
    faq: [],
    membersOnlyMessage: DEFAULT_MEMBERS_ONLY_MESSAGE
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseClock(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function normalizeHours(value: unknown): RestaurantHours {
  const fallback = defaultRestaurantHours();
  if (!value || typeof value !== "object") return fallback;
  const data = value as Record<string, unknown>;
  const days = Array.isArray(data.days)
    ? data.days.map((day) => String(day).toLowerCase()).filter((day) => WEEKDAYS.includes(day as typeof WEEKDAYS[number]))
    : fallback.days;
  return {
    open: asString(data.open) || fallback.open,
    close: asString(data.close) || fallback.close,
    timezone: asString(data.timezone) || DEFAULT_RESTAURANT_TIMEZONE,
    days: days.length ? days : fallback.days
  };
}

function normalizeFaq(value: unknown): ClubFaq[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const data = item as Record<string, unknown>;
    const question = asString(data.question).trim();
    const answer = asString(data.answer).trim();
    if (!question || !answer) return [];
    const tags = Array.isArray(data.tags) ? data.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
    return [{
      id: asString(data.id).trim() || `faq-${index + 1}`,
      question,
      answer,
      tags
    }];
  });
}

export function normalizeClubSettings(courseId: string, value: unknown): ClubSettings {
  const fallback = defaultClubSettings(courseId);
  if (!value || typeof value !== "object") return fallback;
  const data = value as Record<string, unknown>;
  return {
    courseId,
    proShopPhone: asString(data.proShopPhone).trim(),
    restaurantHours: normalizeHours(data.restaurantHours),
    faq: normalizeFaq(data.faq),
    membersOnlyMessage: asString(data.membersOnlyMessage).trim() || DEFAULT_MEMBERS_ONLY_MESSAGE,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined
  };
}

export function isRestaurantOpen(hours: RestaurantHours, now: Date) {
  const timezone = hours.timezone || DEFAULT_RESTAURANT_TIMEZONE;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now).toLowerCase();
  if (!hours.days.includes(weekday)) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const current = hour * 60 + minute;
  const open = parseClock(hours.open);
  const close = parseClock(hours.close);
  if (open == null || close == null) return false;
  if (close === open) return true;
  if (close < open) return current >= open || current < close;
  return current >= open && current < close;
}

export function matchFaq(text: string, faqs: ClubFaq[]) {
  const lower = text.toLowerCase().trim();
  if (!lower || !faqs.length) return null;
  const words = lower.split(/\W+/).filter((word) => word.length > 2);
  let best: { faq: ClubFaq; score: number } | null = null;
  for (const faq of faqs) {
    const question = faq.question.toLowerCase();
    const tags = faq.tags.map((tag) => tag.toLowerCase());
    const haystack = [question, ...tags].join(" ");
    let score = words.filter((word) => haystack.includes(word)).length;
    if (lower.includes(question) || question.includes(lower)) score += 3;
    if (tags.some((tag) => tag && lower.includes(tag))) score += 2;
    if (score >= 2 && (!best || score > best.score)) best = { faq, score };
  }
  return best?.faq ?? null;
}

export function unansweredReferral(settings: ClubSettings) {
  const phone = settings.proShopPhone.trim();
  return phone
    ? `I do not have that answer. Call the pro shop at ${phone}.`
    : "I do not have that answer. Call the pro shop.";
}

export function restaurantClosedReply(settings: ClubSettings) {
  const hours = settings.restaurantHours;
  const window = `${hours.open} to ${hours.close} ${hours.timezone}`;
  const phone = settings.proShopPhone.trim();
  return phone
    ? `Food and drink orders are only available during restaurant hours (${window}). Call the pro shop at ${phone}.`
    : `Food and drink orders are only available during restaurant hours (${window}).`;
}


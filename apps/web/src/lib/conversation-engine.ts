import { BotBehaviorConfig, defaultBotConfig } from "@/lib/bot-config";
import {
  filterAvailableTeeTimes,
  formatSlotClock,
  ProposedTeeTime,
  TimeWindow
} from "@/lib/tee-time-availability";

export type ConversationIntent =
  | "greeting"
  | "book_tee_time"
  | "provide_details"
  | "select_slot"
  | "confirm"
  | "decline"
  | "handoff"
  | "charge_account"
  | "unknown";

export type ConversationPhase =
  | "idle"
  | "collecting"
  | "proposing"
  | "addons"
  | "confirming"
  | "staff_hold"
  | "complete";

export type BookingSlots = {
  date?: string;
  window?: TimeWindow;
  time?: string;
  playerCount?: number;
  guestCount?: number;
  cartCount?: number;
  foodAndBeverage?: string;
  selectedSlotId?: string;
};

export type ConversationState = {
  phase: ConversationPhase;
  intent: ConversationIntent;
  slots: BookingSlots;
  proposedSlots: ProposedTeeTime[];
  phoneMatched: boolean;
  memberId?: string;
  handoffReason?: string;
  booked: false;
};

export type ConversationTurnInput = {
  text: string;
  state?: ConversationState | null;
  now?: Date;
  timeZone?: string;
  config?: BotBehaviorConfig;
  availableSlots?: ProposedTeeTime[];
  phoneMatched?: boolean;
  memberId?: string;
  automationStatus?: "bot_active" | "staff_paused" | "staff_owned";
};

export type ConversationTurnResult = {
  state: ConversationState;
  reply: string;
  shouldReply: boolean;
  booked: false;
  nextActions: string[];
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

export function emptyConversationState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    phase: "idle",
    intent: "greeting",
    slots: {},
    proposedSlots: [],
    phoneMatched: false,
    booked: false,
    ...overrides
  };
}

export function calendarDateInZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function addIsoDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayName(iso: string) {
  return WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

export function formatSpokenDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function nextWeekday(today: string, weekday: number) {
  const current = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addIsoDays(today, (weekday - current + 7) % 7);
}

export function classifyIntent(text: string, config: BotBehaviorConfig = defaultBotConfig): ConversationIntent {
  const lower = text.toLowerCase().trim();
  if (config.staffHandoffKeywords.some((keyword) => lower.includes(keyword.toLowerCase()))) return "handoff";
  if (/\b(charge (it )?(to )?((my|the) )?(member )?account|put it on (my )?account|account charge)\b/.test(lower)) {
    return "charge_account";
  }
  if (/^\s*(yes|yep|yeah|y|confirm|book it|please book|that works|sounds good)\s*[.!]?\s*$/.test(lower)) return "confirm";
  if (/^\s*(no|nope|never mind|nevermind|different time|none of those|not those)\s*[.!]?\s*$/.test(lower)) return "decline";
  if (/^\s*([123]|the (first|second|third)( one)?)\s*$/.test(lower)) return "select_slot";
  if (/\b(book|tee time|tee-time|play|round)\b/.test(lower)) return "book_tee_time";
  if (/\b(today|tomorrow|weekend|morning|afternoon|evening|guest|cart|player|food|drink|burrito)\b/.test(lower)) {
    return "provide_details";
  }
  if (WEEKDAYS.some((day) => lower.includes(day)) || /\b(sat|sun|mon|tue|wed|thu|fri)\b/.test(lower)) return "book_tee_time";
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(lower)) return "greeting";
  return "unknown";
}

const COUNT_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8"
};

function withNumericWords(value: string) {
  return value.replace(/\b(one|two|three|four|five|six|seven|eight)\b/g, (word) => COUNT_WORDS[word] ?? word);
}

export function extractBookingSlots(text: string, now: Date, timeZone: string): Partial<BookingSlots> {
  const lower = withNumericWords(text.toLowerCase());
  const today = calendarDateInZone(now, timeZone);
  const slots: Partial<BookingSlots> = {};

  if (/\btoday\b/.test(lower)) slots.date = today;
  else if (/\btomorrow\b/.test(lower)) slots.date = addIsoDays(today, 1);
  else if (/\b(this )?weekend\b/.test(lower)) slots.date = nextWeekday(today, 6);
  else {
    const weekday = WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}\\b`).test(lower));
    const short = ["sun", "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat"].find((day) => new RegExp(`\\b${day}\\b`).test(lower));
    if (weekday >= 0) slots.date = nextWeekday(today, weekday);
    else if (short) {
      const mapped = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 }[short];
      if (mapped != null) slots.date = nextWeekday(today, mapped);
    }
  }

  const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const numeric = lower.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  const named = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/);
  if (iso) slots.date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (named) {
    const month = MONTHS[named[1]];
    const year = named[3] ? Number(named[3]) : Number(today.slice(0, 4));
    slots.date = `${year}-${pad(month)}-${pad(Number(named[2]))}`;
  } else if (numeric) {
    const year = numeric[3] ? Number(numeric[3]) : Number(today.slice(0, 4));
    slots.date = `${year}-${pad(Number(numeric[1]))}-${pad(Number(numeric[2]))}`;
  }

  if (/\bmorning\b/.test(lower)) slots.window = "morning";
  else if (/\bafternoon\b/.test(lower)) slots.window = "afternoon";
  else if (/\b(evening|tonight)\b/.test(lower)) slots.window = "evening";

  const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/)
    || lower.match(/\bat\s+(\d{1,2})(:\d{2})?\b/)
    || lower.match(/\b(\d{1,2}:\d{2})\b/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minutes = timeMatch[2] ? timeMatch[2].slice(1) : "00";
    const meridiem = timeMatch[3]?.replace(/\./g, "");
    if (meridiem?.startsWith("p") && hour < 12) hour += 12;
    if (meridiem?.startsWith("a") && hour === 12) hour = 0;
    if (!meridiem && !slots.window && hour <= 6) {
      hour += 12;
      slots.window = "afternoon";
    }
    slots.time = `${pad(hour)}:${minutes}`;
    slots.window = slots.window ?? (hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening");
  }

  if (/\b(just me|solo|only me)\b/.test(lower)) slots.playerCount = 1;
  else if (/\bfoursome\b/.test(lower)) slots.playerCount = 4;
  else if (/\bthreesome\b/.test(lower)) slots.playerCount = 3;
  else if (/\btwosome\b/.test(lower)) slots.playerCount = 2;
  else {
    const membersAndGuests = lower.match(/\b(\d+)\s*members?\s+and\s+(\d+)\s*guests?\b/);
    const players = lower.match(/\b(\d+)\s*(?:players?|golfers?)\b/) || lower.match(/\b(?:for|party of)\s+(\d+)\b/);
    if (membersAndGuests) {
      slots.playerCount = Number(membersAndGuests[1]) + Number(membersAndGuests[2]);
      slots.guestCount = Number(membersAndGuests[2]);
    } else if (players) slots.playerCount = Number(players[1]);
  }

  if (/\b(no guests?|without guests?|just members?)\b/.test(lower)) slots.guestCount = 0;
  else if (/\b(with a guest|and a guest|plus a guest|one guest|1 guest)\b/.test(lower)) slots.guestCount = 1;
  else {
    const guests = lower.match(/\b(\d+)\s*guests?\b/);
    if (guests) slots.guestCount = Number(guests[1]);
  }

  if (/\b(no carts?|walking|we('ll| will) walk)\b/.test(lower)) slots.cartCount = 0;
  else if (/\b(a cart|one cart|1 cart)\b/.test(lower)) slots.cartCount = 1;
  else {
    const carts = lower.match(/\b(\d+)\s*carts?\b/);
    if (carts) slots.cartCount = Number(carts[1]);
  }

  if (/^(none|nope)$/.test(lower) || /\b(no (food|drinks?|fnb|order)|nothing to eat)\b/.test(lower)) slots.foodAndBeverage = "none";
  else if (/\b(food|drink|breakfast|burrito|beer|transfusion|hot dog|order)\b/.test(lower)) {
    const note = text.replace(/\s+/g, " ").trim();
    slots.foodAndBeverage = note.length > 80 ? `${note.slice(0, 77)}...` : note;
  }

  return slots;
}

function mergeSlots(current: BookingSlots, incoming: Partial<BookingSlots>): BookingSlots {
  return {
    ...current,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined))
  };
}

function missingPrompt(slots: BookingSlots, config: BotBehaviorConfig): { action: string; prompt: string } | null {
  if (!slots.date) return { action: "ask_date", prompt: "What day would you like to play?" };
  if (!slots.window && !slots.time) return { action: "ask_time", prompt: "Morning, afternoon, or a specific tee time?" };
  if (!slots.playerCount) return { action: "ask_players", prompt: "How many players, including guests?" };
  if (config.askAboutGuests && slots.guestCount == null) return { action: "ask_guests", prompt: "Will any guests be joining?" };
  return null;
}

function addonPrompt(slots: BookingSlots, config: BotBehaviorConfig): { action: string; prompt: string } | null {
  if (config.askAboutCarts && slots.cartCount == null) return { action: "ask_carts", prompt: "How many carts should I reserve? Reply 0 if you are walking." };
  if (config.askAboutFood && !slots.foodAndBeverage) {
    return { action: "ask_food", prompt: "Any food or drinks to have ready, or reply none?" };
  }
  return null;
}

function selectedSlot(state: ConversationState) {
  return state.proposedSlots.find((slot) => slot.id === state.slots.selectedSlotId);
}

function summarizeRequest(state: ConversationState) {
  const slot = selectedSlot(state);
  const when = slot ? `${formatSpokenDate(slot.startsAt.slice(0, 10))} at ${formatSlotClock(slot.startsAt)}` : formatSpokenDate(state.slots.date ?? "");
  const players = state.slots.playerCount ?? 1;
  const guests = state.slots.guestCount ?? 0;
  const carts = state.slots.cartCount ?? 0;
  const food = !state.slots.foodAndBeverage || state.slots.foodAndBeverage === "none"
    ? "no F&B"
    : state.slots.foodAndBeverage;
  return `${when} for ${players} player${players === 1 ? "" : "s"} (${guests} guest${guests === 1 ? "" : "s"}), ${carts} cart${carts === 1 ? "" : "s"}, ${food}`;
}

function staffHold(state: ConversationState, reason: string, reply: string, actions: string[]): ConversationTurnResult {
  return {
    state: { ...state, phase: "staff_hold", intent: state.intent === "charge_account" ? "charge_account" : "handoff", handoffReason: reason, booked: false },
    reply,
    shouldReply: true,
    booked: false,
    nextActions: actions
  };
}

function replyFor(state: ConversationState, reply: string, actions: string[]): ConversationTurnResult {
  return { state: { ...state, booked: false }, reply, shouldReply: true, booked: false, nextActions: actions };
}

function matchProposedSlot(text: string, proposed: ProposedTeeTime[]) {
  const lower = text.toLowerCase().trim();
  if (/^(1|the first( one)?)$/.test(lower)) return proposed[0];
  if (/^(2|the second( one)?)$/.test(lower)) return proposed[1];
  if (/^(3|the third( one)?)$/.test(lower)) return proposed[2];
  return proposed.find((slot) => {
    const clock = formatSlotClock(slot.startsAt).toLowerCase();
    const compact = slot.startsAt.slice(11, 16);
    return lower.includes(clock) || lower.includes(compact) || lower.includes(compact.replace(/^0/, ""));
  });
}

export function runConversationTurn(input: ConversationTurnInput): ConversationTurnResult {
  const config = input.config ?? defaultBotConfig;
  const timeZone = input.timeZone ?? "America/Chicago";
  const now = input.now ?? new Date();
  const previous = input.state ?? emptyConversationState({
    phoneMatched: Boolean(input.phoneMatched),
    memberId: input.memberId
  });
  const state: ConversationState = {
    ...previous,
    phoneMatched: input.phoneMatched ?? previous.phoneMatched,
    memberId: input.memberId ?? previous.memberId,
    booked: false
  };

  if (input.automationStatus && input.automationStatus !== "bot_active") {
    return {
      state,
      reply: "",
      shouldReply: false,
      booked: false,
      nextActions: ["staff_owned"]
    };
  }

  const text = input.text.trim();
  const catalog = input.availableSlots ?? state.proposedSlots;
  const extracted = extractBookingSlots(text, now, timeZone);
  const intent = classifyIntent(text, config);
  state.intent = intent;
  state.slots = mergeSlots(state.slots, extracted);
  if (state.phase === "addons" && state.slots.cartCount == null && /^\d+$/.test(text)) {
    state.slots.cartCount = Number(text);
  }

  if (intent === "handoff") {
    return staffHold(state, "keyword", "I am connecting you with the club staff. Someone will reply here shortly.", ["staff_review"]);
  }

  if (intent === "charge_account") {
    return staffHold(
      state,
      "account_charge",
      state.phoneMatched
        ? "Account charges stay on hold for staff and a one-time code to the phone on file. I will not charge the member account from this chat."
        : "I cannot charge an account until this phone matches the member record. Staff will verify identity before any charge.",
      ["identity_hold", "staff_review"]
    );
  }

  if (state.slots.playerCount && state.slots.playerCount > config.maxPlayersBySms) {
    return staffHold(
      state,
      "player_limit",
      `Groups larger than ${config.maxPlayersBySms} need the shop. I have asked staff to take this from here.`,
      ["staff_review"]
    );
  }

  if (intent === "greeting" && state.phase === "idle" && !state.slots.date) {
    return replyFor(
      { ...state, phase: "collecting" },
      "I can hold a tee-time request, guests, carts, and a clubhouse order. What day would you like to play?",
      ["ask_date"]
    );
  }

  if (intent === "decline" && (state.phase === "proposing" || state.phase === "confirming")) {
    const next = { ...state, phase: "collecting" as const, proposedSlots: [], slots: { ...state.slots, selectedSlotId: undefined, time: undefined } };
    return replyFor(next, "No problem. What day or time should I look at instead?", ["ask_time"]);
  }

  const needed = missingPrompt(state.slots, config);
  if (needed) {
    return replyFor({ ...state, phase: "collecting" }, needed.prompt, [needed.action]);
  }

  const query = {
    date: state.slots.date,
    window: state.slots.window,
    time: state.slots.time,
    playerCount: state.slots.playerCount
  };
  const matches = filterAvailableTeeTimes(catalog, query);

  if (!state.slots.selectedSlotId) {
    if (matches.length === 0) {
      return staffHold(
        { ...state, phase: "staff_hold", proposedSlots: [] },
        "no_slots",
        `I do not have open tee times on file for ${formatSpokenDate(state.slots.date!)}. I will not book this. Staff will follow up with options.`,
        ["no_slots", "staff_review"]
      );
    }

    if (intent === "select_slot" || matchProposedSlot(text, state.proposedSlots.length ? state.proposedSlots : matches)) {
      const chosen = matchProposedSlot(text, state.proposedSlots.length ? state.proposedSlots : matches);
      if (!chosen) {
        return replyFor(
          { ...state, phase: "proposing", proposedSlots: matches },
          `I still have ${matches.map((slot) => slot.label).join(", ")}. Reply 1, 2, or 3.`,
          ["select_slot"]
        );
      }
      state.slots.selectedSlotId = chosen.id;
      state.proposedSlots = state.proposedSlots.length ? state.proposedSlots : matches;
    } else {
      const offered = matches;
      const next = { ...state, phase: "proposing" as const, proposedSlots: offered };
      if (offered.length === 1) {
        next.slots = { ...next.slots, selectedSlotId: offered[0].id };
      } else {
        return replyFor(
          next,
          `I have ${offered.map((slot) => slot.label).join(", ")} on ${formatSpokenDate(state.slots.date!)}. Reply 1, 2, or 3 — I will not book until staff confirm.`,
          ["offer_slots"]
        );
      }
    }
  }

  const extras = addonPrompt(state.slots, config);
  if (extras) {
    return replyFor({ ...state, phase: "addons" }, extras.prompt, [extras.action]);
  }

  if (intent !== "confirm") {
    return replyFor(
      { ...state, phase: "confirming" },
      `I can send this request to the shop: ${summarizeRequest(state)}. I cannot book live or charge an account from this chat. Reply YES to hold it for staff.`,
      ["confirm_request"]
    );
  }

  if (!state.phoneMatched) {
    return staffHold(
      state,
      "identity",
      "This phone does not match a member on file, so I will not book or charge. Staff will verify identity before anything is confirmed.",
      ["identity_hold", "staff_review"]
    );
  }

  return replyFor(
    { ...state, phase: "complete", booked: false },
    `Sent to the shop: ${summarizeRequest(state)}. Staff will confirm the tee time. I did not book or charge an account.`,
    ["hold_request"]
  );
}

import { BotBehaviorConfig, defaultBotConfig } from "@/lib/bot-config";
import { ClubSettings, defaultClubSettings, isRestaurantOpen } from "@/lib/club-settings";
import {
  ConversationState,
  emptyConversationState
} from "@/lib/conversation-engine";
import { smsSendingEnabled } from "@/lib/sms-provider";

export const PRE_TURN_OUTREACH_WINDOW_MINUTES = 180;

export type PreTurnOutreachReason =
  | "send"
  | "staff_paused"
  | "staff_owned"
  | "opted_out"
  | "ask_about_food_disabled"
  | "too_early"
  | "after_the_turn"
  | "already_sent"
  | "missing_tee_time"
  | "restaurant_closed"
  | "sending_held";

export type PreTurnTeeTime = {
  id: string;
  startsAt: string;
};

export type PreTurnOutreachInput = {
  teeTime?: PreTurnTeeTime | null;
  conversation: {
    automationStatus: "bot_active" | "staff_paused" | "staff_owned";
    botState?: ConversationState;
  };
  member?: { optOutText?: boolean } | null;
  now?: Date;
  config?: BotBehaviorConfig;
  clubSettings?: ClubSettings;
  timeZone?: string;
};

export type PreTurnOutreachDecision = {
  shouldSend: boolean;
  reason: PreTurnOutreachReason;
  message: string | null;
  state: ConversationState;
};

export function formatSnackShackTeeClock(startsAt: string, timeZone = "America/Chicago") {
  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(starts);
}

export function snackShackPromptText(startsAt: string, timeZone = "America/Chicago") {
  const clock = formatSnackShackTeeClock(startsAt, timeZone);
  const when = clock ? `Your ${clock} tee time is coming up. ` : "";
  return `${when}Want anything from the snack shack at the turn? Reply with an order or no.`;
}

export function minutesUntilTeeTime(startsAt: string, now: Date) {
  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime())) return null;
  return (starts.getTime() - now.getTime()) / 60_000;
}

export function planPreTurnSnackShackOutreach(input: PreTurnOutreachInput): PreTurnOutreachDecision {
  const config = input.config ?? defaultBotConfig;
  const timeZone = input.timeZone ?? "America/Chicago";
  const now = input.now ?? new Date();
  const state = input.conversation.botState ?? emptyConversationState();
  const skip = (reason: Exclude<PreTurnOutreachReason, "send">): PreTurnOutreachDecision => ({
    shouldSend: false,
    reason,
    message: null,
    state
  });

  if (!smsSendingEnabled()) return skip("sending_held");
  if (input.conversation.automationStatus === "staff_paused") return skip("staff_paused");
  if (input.conversation.automationStatus === "staff_owned") return skip("staff_owned");
  if (input.conversation.automationStatus !== "bot_active") return skip("staff_owned");
  if (input.member?.optOutText) return skip("opted_out");
  if (!config.askAboutFood) return skip("ask_about_food_disabled");

  const teeTime = input.teeTime;
  const minutesUntil = teeTime?.startsAt ? minutesUntilTeeTime(teeTime.startsAt, now) : null;
  if (!teeTime?.id || minutesUntil == null) return skip("missing_tee_time");
  if (minutesUntil <= 0) return skip("after_the_turn");
  if (minutesUntil > PRE_TURN_OUTREACH_WINDOW_MINUTES) return skip("too_early");
  if (state.preTurnOutreach?.teeTimeId === teeTime.id) return skip("already_sent");
  const clubSettings = input.clubSettings ?? defaultClubSettings();
  if (!isRestaurantOpen(clubSettings.restaurantHours, now)) return skip("restaurant_closed");

  const next: ConversationState = {
    ...state,
    phase: "pre_turn",
    intent: "unknown",
    booked: false,
    preTurnOutreach: {
      teeTimeId: teeTime.id,
      startsAt: teeTime.startsAt,
      status: "prompted",
      sentAt: now.toISOString()
    }
  };

  return {
    shouldSend: true,
    reason: "send",
    message: snackShackPromptText(teeTime.startsAt, timeZone),
    state: next
  };
}

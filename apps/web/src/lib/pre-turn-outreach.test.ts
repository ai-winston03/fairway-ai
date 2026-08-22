import { describe, expect, it } from "vitest";
import { defaultBotConfig } from "./bot-config";
import { defaultClubSettings } from "./club-settings";
import { emptyConversationState } from "./conversation-engine";
import {
  PRE_TURN_OUTREACH_WINDOW_MINUTES,
  planPreTurnSnackShackOutreach,
  snackShackPromptText
} from "./pre-turn-outreach";

const teeTime = {
  id: "2026-08-22-0820",
  startsAt: "2026-08-22T08:20:00-05:00"
};
const inWindow = new Date("2026-08-22T06:50:00-05:00");
const tooEarly = new Date("2026-08-22T04:00:00-05:00");
const afterTurn = new Date("2026-08-22T08:21:00-05:00");

function plan(overrides: Partial<Parameters<typeof planPreTurnSnackShackOutreach>[0]> = {}) {
  return planPreTurnSnackShackOutreach({
    teeTime,
    conversation: { automationStatus: "bot_active" },
    now: inWindow,
    ...overrides
  });
}

describe("planPreTurnSnackShackOutreach", () => {
  it("sends a snack-shack prompt before a future tee time when the bot is active", () => {
    const decision = plan();
    expect(decision.shouldSend).toBe(true);
    expect(decision.reason).toBe("send");
    expect(decision.message).toBe(snackShackPromptText(teeTime.startsAt));
    expect(decision.message).toMatch(/8:20 AM/);
    expect(decision.message).toMatch(/snack shack at the turn/i);
    expect(decision.state.phase).toBe("pre_turn");
    expect(decision.state.preTurnOutreach).toMatchObject({
      teeTimeId: teeTime.id,
      startsAt: teeTime.startsAt,
      status: "prompted"
    });
    expect(PRE_TURN_OUTREACH_WINDOW_MINUTES).toBe(180);
  });

  it("does not send when staff paused or owns the thread", () => {
    const paused = plan({ conversation: { automationStatus: "staff_paused" } });
    const owned = plan({ conversation: { automationStatus: "staff_owned" } });
    expect(paused).toMatchObject({ shouldSend: false, reason: "staff_paused", message: null });
    expect(owned).toMatchObject({ shouldSend: false, reason: "staff_owned", message: null });
  });

  it("does not send when the member opted out or food asks are off", () => {
    const optedOut = plan({ member: { optOutText: true } });
    const foodOff = plan({ config: { ...defaultBotConfig, askAboutFood: false } });
    expect(optedOut).toMatchObject({ shouldSend: false, reason: "opted_out" });
    expect(foodOff).toMatchObject({ shouldSend: false, reason: "ask_about_food_disabled" });
  });

  it("does not send too early or after the turn", () => {
    expect(plan({ now: tooEarly })).toMatchObject({ shouldSend: false, reason: "too_early" });
    expect(plan({ now: afterTurn })).toMatchObject({ shouldSend: false, reason: "after_the_turn" });
    expect(plan({ teeTime: null })).toMatchObject({ shouldSend: false, reason: "missing_tee_time" });
  });

  it("does not send twice for the same tee time", () => {
    const first = plan();
    const second = plan({ conversation: { automationStatus: "bot_active", botState: first.state } });
    expect(second).toMatchObject({ shouldSend: false, reason: "already_sent", message: null });
  });

  it("can still send for a later tee time after an earlier prompt", () => {
    const first = plan();
    const later = plan({
      teeTime: { id: "2026-08-23-0904", startsAt: "2026-08-23T09:04:00-05:00" },
      conversation: { automationStatus: "bot_active", botState: first.state },
      now: new Date("2026-08-23T07:30:00-05:00")
    });
    expect(later.shouldSend).toBe(true);
    expect(later.state.preTurnOutreach?.teeTimeId).toBe("2026-08-23-0904");
  });

  it("does not offer food when the restaurant is closed", () => {
    const decision = plan({
      clubSettings: {
        ...defaultClubSettings("course-1"),
        restaurantHours: {
          open: "11:00",
          close: "14:00",
          timezone: "America/Chicago",
          days: ["monday"]
        }
      }
    });
    expect(decision).toMatchObject({ shouldSend: false, reason: "restaurant_closed", message: null });
  });

  it("keeps prior booking slots when prompting", () => {
    const existing = emptyConversationState({
      phase: "complete",
      slots: { date: "2026-08-22", playerCount: 2, foodAndBeverage: "none" }
    });
    const decision = plan({ conversation: { automationStatus: "bot_active", botState: existing } });
    expect(decision.shouldSend).toBe(true);
    expect(decision.state.slots.playerCount).toBe(2);
    expect(decision.state.phase).toBe("pre_turn");
  });
});

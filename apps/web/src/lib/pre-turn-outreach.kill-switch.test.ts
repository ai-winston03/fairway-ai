import { afterEach, describe, expect, it } from "vitest";
import { planPreTurnSnackShackOutreach, snackShackPromptText } from "./pre-turn-outreach";

const teeTime = {
  id: "2026-08-22-0820",
  startsAt: "2026-08-22T08:20:00-05:00"
};
const inWindow = new Date("2026-08-22T06:50:00-05:00");
const original = process.env.FAIRWAY_SMS_SENDING_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
  else process.env.FAIRWAY_SMS_SENDING_ENABLED = original;
});

describe("pre-turn outreach kill switch", () => {
  it("does not send while outbound SMS is off", () => {
    delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
    const decision = planPreTurnSnackShackOutreach({
      teeTime,
      conversation: { automationStatus: "bot_active" },
      now: inWindow
    });
    expect(decision).toMatchObject({ shouldSend: false, reason: "sending_held", message: null });
  });

  it("can send once the switch is on", () => {
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
    const decision = planPreTurnSnackShackOutreach({
      teeTime,
      conversation: { automationStatus: "bot_active" },
      now: inWindow
    });
    expect(decision.shouldSend).toBe(true);
    expect(decision.reason).toBe("send");
    expect(decision.message).toBe(snackShackPromptText(teeTime.startsAt));
  });
});

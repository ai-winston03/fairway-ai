import { describe, expect, it } from "vitest";
import {
  SMS_BLOCKED_CLASS,
  SMS_HELD_BANNER,
  SMS_HELD_CLASS,
  SMS_HELD_GOLD,
  SMS_SEND_LABEL,
  automationsHeldState,
  memberSmsBadge,
  staffComposerState
} from "./sms-held-ui";

describe("member composer kill switch", () => {
  it("keeps the composer visible, Send labeled Send, and Send disabled while held", () => {
    const state = staffComposerState({
      optOutText: false,
      sendingEnabled: false,
      botOwnsThread: false,
      threadBusy: false,
      draft: "Ready to send"
    });
    expect(state.composerVisible).toBe(true);
    expect(state.sendLabel).toBe(SMS_SEND_LABEL);
    expect(state.sendLabel).not.toBe("Queue");
    expect(state.sendDisabled).toBe(true);
    expect(state.textareaDisabled).toBe(false);
    expect(state.showHeldBanner).toBe(true);
    expect(state.bannerText).toBe("Sending is off.");
  });

  it("does not show SMS live while sending is off", () => {
    const badge = memberSmsBadge({ optOutText: false, sendingEnabled: false, connected: true });
    expect(badge.label).toBe(SMS_HELD_BANNER);
    expect(badge.label).not.toBe("SMS live");
    expect(badge.className).toBe(SMS_HELD_CLASS);
    expect(badge.className).not.toBe(SMS_BLOCKED_CLASS);
  });

  it("keeps ForeUp opt-out red and blocked even while the kill switch is off", () => {
    const badge = memberSmsBadge({ optOutText: true, sendingEnabled: false, connected: true });
    expect(badge.className).toBe(SMS_BLOCKED_CLASS);
    expect(badge.label).toBe("SMS suppressed");
    const state = staffComposerState({
      optOutText: true,
      sendingEnabled: false,
      botOwnsThread: false,
      threadBusy: false,
      draft: "hello"
    });
    expect(state.sendDisabled).toBe(true);
    expect(state.showHeldBanner).toBe(false);
    expect(state.textareaDisabled).toBe(true);
  });

  it("shows SMS live only when sending is enabled and Twilio is connected", () => {
    expect(memberSmsBadge({ optOutText: false, sendingEnabled: true, connected: true }).label).toBe("SMS live");
    expect(memberSmsBadge({ optOutText: false, sendingEnabled: true, connected: false }).label).toBe("SMS queued");
  });
});

describe("automations Schedule/History held treatment", () => {
  it("uses the same Sending is off. banner on Schedule and History while sending is off", () => {
    expect(automationsHeldState({ tab: "Schedule", sendingEnabled: false })).toEqual({
      showHeldBanner: true,
      bannerText: "Sending is off."
    });
    expect(automationsHeldState({ tab: "History", sendingEnabled: false }).showHeldBanner).toBe(true);
    expect(SMS_HELD_GOLD).toBe("#b49352");
  });

  it("does not gold-banner the Rules tab", () => {
    expect(automationsHeldState({ tab: "Rules", sendingEnabled: false }).showHeldBanner).toBe(false);
  });
});

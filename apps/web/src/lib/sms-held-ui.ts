export const SMS_HELD_BANNER = "Sending is off.";
export const SMS_SEND_LABEL = "Send";
export const SMS_HELD_CLASS = "sms-state held";
export const SMS_BLOCKED_CLASS = "sms-state blocked";
export const SMS_LIVE_CLASS = "sms-state";
export const SMS_HELD_GOLD = "#b49352";

export type MemberSmsBadge = {
  className: string;
  label: string;
};

export function memberSmsBadge(input: {
  optOutText: boolean;
  sendingEnabled: boolean;
  connected: boolean;
}): MemberSmsBadge {
  if (input.optOutText) return { className: SMS_BLOCKED_CLASS, label: "SMS suppressed" };
  if (!input.sendingEnabled) return { className: SMS_HELD_CLASS, label: SMS_HELD_BANNER };
  if (input.connected) return { className: SMS_LIVE_CLASS, label: "SMS live" };
  return { className: SMS_LIVE_CLASS, label: "SMS queued" };
}

export function staffComposerState(input: {
  optOutText: boolean;
  sendingEnabled: boolean;
  botOwnsThread: boolean;
  threadBusy: boolean;
  draft: string;
}) {
  const composerVisible = true;
  const sendLabel = SMS_SEND_LABEL;
  const sendDisabled =
    input.optOutText ||
    !input.sendingEnabled ||
    input.botOwnsThread ||
    input.threadBusy ||
    !input.draft.trim();
  const showHeldBanner = !input.optOutText && !input.sendingEnabled;
  const textareaDisabled = input.optOutText || input.botOwnsThread || input.threadBusy;
  return {
    composerVisible,
    sendDisabled,
    sendLabel,
    showHeldBanner,
    bannerText: SMS_HELD_BANNER,
    textareaDisabled
  };
}

export function automationsHeldState(input: { tab: string; sendingEnabled: boolean }) {
  const scheduleOrHistory = input.tab === "Schedule" || input.tab === "History";
  return {
    showHeldBanner: scheduleOrHistory && !input.sendingEnabled,
    bannerText: SMS_HELD_BANNER,
    gold: SMS_HELD_GOLD
  };
}

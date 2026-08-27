import { createHmac, timingSafeEqual } from "crypto";

export type SmsProviderId = "twilio" | "none";
export type SmsDeliveryStatus = "queued" | "sent" | "delivered" | "failed";

export type SmsSendInput = {
  to: string;
  body: string;
  statusCallback?: string;
};

export type SmsSendResult = {
  provider: SmsProviderId;
  status: SmsDeliveryStatus;
  sid?: string;
  error?: string;
};

export type SmsProviderStatus = {
  provider: SmsProviderId;
  connected: boolean;
  sendingEnabled: boolean;
  fromNumber?: string;
  inboundPath: string;
  nextAction: string;
};

export const SMS_HELD_MESSAGE = "Sending is off.";

const inboundPath = "/api/sms/inbound";

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (value.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export function phoneMatchKey(value: string) {
  const digits = normalizePhone(value).replace(/\D/g, "");
  return digits.slice(-10);
}

function twilioRestAuth() {
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  if (apiKey && apiSecret) return { user: apiKey, pass: apiSecret };
  const token = process.env.TWILIO_AUTH_TOKEN;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (sid && token) return { user: sid, pass: token };
  return null;
}

export function twilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM_NUMBER && twilioRestAuth());
}

/** Default-off kill switch. Outbound SMS only when FAIRWAY_SMS_SENDING_ENABLED is exactly "true". */
export function smsSendingEnabled() {
  return process.env.FAIRWAY_SMS_SENDING_ENABLED === "true";
}

export function smsAllowlist() {
  return (process.env.FAIRWAY_SMS_ALLOWLIST ?? "")
    .split(/[\s,]+/)
    .map(normalizePhone)
    .filter(Boolean);
}

export function smsDestinationAllowed(to: string) {
  const allow = smsAllowlist();
  if (allow.length === 0) return false;
  const dest = phoneMatchKey(to);
  return Boolean(dest) && allow.some((entry) => phoneMatchKey(entry) === dest);
}

export function getSmsProviderStatus(): SmsProviderStatus {
  const sendingEnabled = smsSendingEnabled();
  if (twilioConfigured() && sendingEnabled) {
    return {
      provider: "twilio",
      connected: true,
      sendingEnabled,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
      inboundPath,
      nextAction: "Point the Twilio number webhook at /api/sms/inbound."
    };
  }
  if (twilioConfigured() && !sendingEnabled) {
    return {
      provider: "twilio",
      connected: false,
      sendingEnabled,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
      inboundPath,
      nextAction: SMS_HELD_MESSAGE
    };
  }
  return {
    provider: "none",
    connected: false,
    sendingEnabled,
    inboundPath,
    nextAction: sendingEnabled
      ? "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER. Outbound stays queued until then."
      : SMS_HELD_MESSAGE
  };
}

export function staffOutboundHeld() {
  if (smsSendingEnabled()) return null;
  return {
    status: 403 as const,
    body: {
      connected: true,
      sendingEnabled: false,
      error: SMS_HELD_MESSAGE,
      sms: getSmsProviderStatus(),
      send: { provider: "none" as const, status: "queued" as const, error: SMS_HELD_MESSAGE }
    }
  };
}

export function scheduledOutboundHold<T extends Record<string, unknown>>(payload: T) {
  if (smsSendingEnabled()) {
    return { ...payload, sendingEnabled: true, held: false };
  }
  return {
    ...payload,
    sendingEnabled: false,
    held: true,
    sent: 0,
    note: SMS_HELD_MESSAGE
  };
}

/** Inbound webhooks may record mail; they must not emit a TwiML or REST reply while held. */
export function inboundMaySendReply() {
  return smsSendingEnabled();
}

export async function sendSms(input: SmsSendInput): Promise<SmsSendResult> {
  const to = normalizePhone(input.to);
  if (!to) return { provider: "none", status: "failed", error: "Destination phone is missing." };
  if (!smsSendingEnabled()) {
    return { provider: "none", status: "queued", error: SMS_HELD_MESSAGE };
  }
  if (!smsDestinationAllowed(to)) {
    return { provider: "none", status: "queued" };
  }
  if (!twilioConfigured()) {
    return { provider: "none", status: "queued" };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = twilioRestAuth();
  const from = process.env.TWILIO_FROM_NUMBER!;
  if (!auth) return { provider: "none", status: "queued" };
  const body = new URLSearchParams({ To: to, From: from, Body: input.body });
  if (input.statusCallback) body.set("StatusCallback", input.statusCallback);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json() as { sid?: string; message?: string; status?: string };
  if (!response.ok || !payload.sid) {
    return {
      provider: "twilio",
      status: "failed",
      error: payload.message || `Twilio send failed (${response.status}).`
    };
  }
  return { provider: "twilio", status: payload.status === "failed" ? "failed" : "sent", sid: payload.sid };
}

export function verifyTwilioSignature(requestUrl: string, params: Record<string, string>, signature: string | null) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const sorted = Object.keys(params).sort().reduce((raw, key) => `${raw}${key}${params[key]}`, requestUrl);
  const expected = createHmac("sha1", token).update(sorted).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

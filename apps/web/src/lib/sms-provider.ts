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
  fromNumber?: string;
  inboundPath: string;
  nextAction: string;
};

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

export function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export function getSmsProviderStatus(): SmsProviderStatus {
  if (twilioConfigured()) {
    return {
      provider: "twilio",
      connected: true,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
      inboundPath,
      nextAction: "Point the Twilio number webhook at /api/sms/inbound."
    };
  }
  return {
    provider: "none",
    connected: false,
    inboundPath,
    nextAction: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER. Outbound stays queued until then."
  };
}

export async function sendSms(input: SmsSendInput): Promise<SmsSendResult> {
  const to = normalizePhone(input.to);
  if (!to) return { provider: "none", status: "failed", error: "Destination phone is missing." };
  if (!twilioConfigured()) {
    return { provider: "none", status: "queued" };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const body = new URLSearchParams({ To: to, From: from, Body: input.body });
  if (input.statusCallback) body.set("StatusCallback", input.statusCallback);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
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
  if (!token || !signature) return !twilioConfigured();
  const sorted = Object.keys(params).sort().reduce((raw, key) => `${raw}${key}${params[key]}`, requestUrl);
  const expected = createHmac("sha1", token).update(sorted).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SMS_HELD_MESSAGE,
  getSmsProviderStatus,
  inboundMaySendReply,
  normalizePhone,
  phoneMatchKey,
  scheduledOutboundHold,
  sendSms,
  smsDestinationAllowed,
  smsSendingEnabled,
  staffOutboundHeld,
  verifyTwilioSignature
} from "./sms-provider";

const loganPhone = "+14795798818";
const otherPhone = "+14795550101";
const envKeys = [
  "FAIRWAY_SMS_ALLOWLIST",
  "FAIRWAY_SMS_SENDING_ENABLED",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY",
  "TWILIO_API_SECRET",
  "TWILIO_FROM_NUMBER"
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureTwilio() {
  process.env.TWILIO_ACCOUNT_SID = "ACtestaccountsid000000000000000000";
  process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  process.env.TWILIO_FROM_NUMBER = "+18005550100";
  delete process.env.TWILIO_API_KEY;
  delete process.env.TWILIO_API_SECRET;
}

function mockFetch() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  restoreEnv();
});

afterEach(() => {
  restoreEnv();
  vi.unstubAllGlobals();
});

describe("sms phone matching", () => {
  it("normalizes US numbers", () => {
    expect(normalizePhone("479-555-0101")).toBe("+14795550101");
    expect(normalizePhone("+1 (479) 555-0101")).toBe("+14795550101");
    expect(phoneMatchKey("14795550101")).toBe("4795550101");
  });
});

describe("sms kill switch", () => {
  it("is off by default, including empty and non-true values", () => {
    delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
    expect(smsSendingEnabled()).toBe(false);
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "";
    expect(smsSendingEnabled()).toBe(false);
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "false";
    expect(smsSendingEnabled()).toBe(false);
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "TRUE";
    expect(smsSendingEnabled()).toBe(false);
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
    expect(smsSendingEnabled()).toBe(true);
  });

  it("no-ops sendSms while off even when Twilio and an allowlist are present", async () => {
    configureTwilio();
    process.env.FAIRWAY_SMS_ALLOWLIST = loganPhone;
    delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
    const fetchMock = mockFetch();
    expect(await sendSms({ to: loganPhone, body: "held" })).toEqual({
      provider: "none",
      status: "queued",
      error: SMS_HELD_MESSAGE
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not report SMS live / connected while sending is off", () => {
    configureTwilio();
    delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
    const status = getSmsProviderStatus();
    expect(status.sendingEnabled).toBe(false);
    expect(status.connected).toBe(false);
    expect(status.nextAction).toBe(SMS_HELD_MESSAGE);
  });

  it("returns 403 for staff send while off", () => {
    delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
    const held = staffOutboundHeld();
    expect(held?.status).toBe(403);
    expect(held?.body.error).toBe(SMS_HELD_MESSAGE);
    expect(held?.body.send).toEqual({ provider: "none", status: "queued", error: SMS_HELD_MESSAGE });
  });

  it("no-ops automations schedule/history POSTs while off", () => {
    delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
    const held = scheduledOutboundHold({ dueCount: 2, dueMessages: [{ id: "sched_1" }] });
    expect(held).toMatchObject({
      sendingEnabled: false,
      held: true,
      sent: 0,
      note: SMS_HELD_MESSAGE,
      dueCount: 2
    });
    expect(inboundMaySendReply()).toBe(false);
  });

  it("does not deny staff send once the switch is on", () => {
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
    expect(staffOutboundHeld()).toBeNull();
    expect(inboundMaySendReply()).toBe(true);
    expect(scheduledOutboundHold({ dueCount: 1 }).held).toBe(false);
  });
});

describe("sms allowlist", () => {
  it("fails closed when the allowlist is unset or empty", async () => {
    configureTwilio();
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
    delete process.env.FAIRWAY_SMS_ALLOWLIST;
    expect(smsDestinationAllowed(loganPhone)).toBe(false);
    const unsetFetch = mockFetch();
    expect(await sendSms({ to: loganPhone, body: "unset" })).toEqual({ provider: "none", status: "queued" });
    expect(unsetFetch).not.toHaveBeenCalled();

    process.env.FAIRWAY_SMS_ALLOWLIST = "";
    expect(smsDestinationAllowed(loganPhone)).toBe(false);
    const emptyFetch = mockFetch();
    expect(await sendSms({ to: loganPhone, body: "empty" })).toEqual({ provider: "none", status: "queued" });
    expect(emptyFetch).not.toHaveBeenCalled();

    process.env.FAIRWAY_SMS_ALLOWLIST = "  ,  ";
    expect(smsDestinationAllowed(otherPhone)).toBe(false);
    const blankFetch = mockFetch();
    expect(await sendSms({ to: otherPhone, body: "blank" })).toEqual({ provider: "none", status: "queued" });
    expect(blankFetch).not.toHaveBeenCalled();
  });

  it("allows only listed numbers", () => {
    process.env.FAIRWAY_SMS_ALLOWLIST = loganPhone;
    expect(smsDestinationAllowed("+1 (479) 579-8818")).toBe(true);
    expect(smsDestinationAllowed(otherPhone)).toBe(false);
  });

  it("queues sendSms for anyone off the allowlist without calling Twilio", async () => {
    configureTwilio();
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
    process.env.FAIRWAY_SMS_ALLOWLIST = loganPhone;
    const fetchMock = mockFetch();
    const result = await sendSms({ to: otherPhone, body: "nope" });
    expect(result).toEqual({ provider: "none", status: "queued" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Twilio only when sending is on and the destination is allowlisted", async () => {
    configureTwilio();
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
    process.env.FAIRWAY_SMS_ALLOWLIST = loganPhone;
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SMtest", status: "queued" })
    });
    const result = await sendSms({ to: loganPhone, body: "closed test" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.twilio.com");
    expect(result).toMatchObject({ provider: "twilio", status: "sent", sid: "SMtest" });
  });
});

describe("Twilio request signatures", () => {
  it("rejects missing token or signature instead of allowing unsigned inbound", () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(verifyTwilioSignature("https://example.test/api/sms/inbound", { Body: "hi" }, "sig")).toBe(false);
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    expect(verifyTwilioSignature("https://example.test/api/sms/inbound", { Body: "hi" }, null)).toBe(false);
  });

  it("accepts a valid Twilio signature", () => {
    const token = "test-auth-token";
    const url = "https://example.test/api/sms/inbound";
    const params = { Body: "hi", From: "+14795550101" };
    process.env.TWILIO_AUTH_TOKEN = token;
    const sorted = Object.keys(params).sort().reduce((raw, key) => `${raw}${key}${params[key as keyof typeof params]}`, url);
    const signature = createHmac("sha1", token).update(sorted).digest("base64");
    expect(verifyTwilioSignature(url, params, signature)).toBe(true);
    expect(verifyTwilioSignature(url, params, "not-the-signature")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePhone, phoneMatchKey, sendSms, smsDestinationAllowed } from "./sms-provider";

const loganPhone = "+14795798818";
const otherPhone = "+14795550101";
const envKeys = [
  "FAIRWAY_SMS_ALLOWLIST",
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

describe("sms allowlist", () => {
  it("fails closed when the allowlist is unset or empty", async () => {
    configureTwilio();
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

  it("queues sendSms for anyone off the Logan-only allowlist without calling Twilio", async () => {
    configureTwilio();
    process.env.FAIRWAY_SMS_ALLOWLIST = loganPhone;
    const fetchMock = mockFetch();
    const result = await sendSms({ to: otherPhone, body: "nope" });
    expect(result).toEqual({ provider: "none", status: "queued" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Twilio only for the Logan-only allowlisted destination", async () => {
    configureTwilio();
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

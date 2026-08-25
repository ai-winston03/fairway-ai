import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePhone, phoneMatchKey, sendSms, smsDestinationAllowed } from "./sms-provider";

const originalAllowlist = process.env.FAIRWAY_SMS_ALLOWLIST;

afterEach(() => {
  process.env.FAIRWAY_SMS_ALLOWLIST = originalAllowlist;
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
  it("fails closed when the allowlist is empty", () => {
    delete process.env.FAIRWAY_SMS_ALLOWLIST;
    expect(smsDestinationAllowed("+14795798818")).toBe(false);
  });

  it("allows only listed numbers", () => {
    process.env.FAIRWAY_SMS_ALLOWLIST = "+14795798818";
    expect(smsDestinationAllowed("+1 (479) 579-8818")).toBe(true);
    expect(smsDestinationAllowed("+14795550101")).toBe(false);
  });

  it("queues sendSms for anyone off the allowlist without calling Twilio", async () => {
    process.env.FAIRWAY_SMS_ALLOWLIST = "+14795798818";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendSms({ to: "+14795550101", body: "nope" });
    expect(result).toEqual({ provider: "none", status: "queued" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

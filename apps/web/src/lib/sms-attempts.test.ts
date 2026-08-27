import { afterEach, describe, expect, it, vi } from "vitest";
import { blockedSmsAttemptDoc, SMS_ATTEMPTS_COLLECTION } from "./sms-attempts";

const originalFrom = process.env.TWILIO_FROM_NUMBER;

afterEach(() => {
  if (originalFrom === undefined) delete process.env.TWILIO_FROM_NUMBER;
  else process.env.TWILIO_FROM_NUMBER = originalFrom;
});

describe("sms_attempts grain", () => {
  it("logs blocked sends without a message body",
    () => {
      process.env.TWILIO_FROM_NUMBER = "+18333367201";
      const doc = blockedSmsAttemptDoc({
        to: "+14795550101",
        intent: "staff",
        blockReason: "kill_switch",
        actorUid: "staff_1"
      });
      expect(doc).toMatchObject({
        to: "+14795550101",
        from: "+18333367201",
        intent: "staff",
        result: "blocked",
        blockReason: "kill_switch",
        actorUid: "staff_1"
      });
      expect(doc).not.toHaveProperty("body");
      expect(SMS_ATTEMPTS_COLLECTION).toBe("sms_attempts");
    }
  );
});

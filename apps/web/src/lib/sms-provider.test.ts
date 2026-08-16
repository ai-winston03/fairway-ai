import { describe, expect, it } from "vitest";
import { normalizePhone, phoneMatchKey } from "./sms-provider";

describe("sms phone matching", () => {
  it("normalizes US numbers", () => {
    expect(normalizePhone("479-555-0101")).toBe("+14795550101");
    expect(normalizePhone("+1 (479) 555-0101")).toBe("+14795550101");
    expect(phoneMatchKey("14795550101")).toBe("4795550101");
  });
});

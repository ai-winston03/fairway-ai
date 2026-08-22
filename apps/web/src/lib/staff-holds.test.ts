import { describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));
vi.mock("./sms-provider", () => ({ sendSms: vi.fn() }));

import { emptyConversationState } from "./conversation-engine";
import { sendSms } from "./sms-provider";
import { listStaffHolds, queueStaffHold } from "./staff-holds";

describe("staff holds queue", () => {
  it("persists booking and snack-shack holds as queued and never sends SMS", async () => {
    const courseId = `course-holds-${crypto.randomUUID()}`;
    const state = emptyConversationState({
      phoneMatched: true,
      memberId: "3612897",
      slots: { date: "2026-08-22", playerCount: 2, foodAndBeverage: "two hot dogs" }
    });

    const booking = await queueStaffHold({
      courseId,
      kind: "hold_request",
      conversationId: "3612897",
      memberId: "3612897",
      phone: "+18015550184",
      state,
      nextActions: ["hold_request"]
    });
    const snack = await queueStaffHold({
      courseId,
      kind: "hold_snack_shack",
      conversationId: "3612897",
      memberId: "3612897",
      phone: "+18015550184",
      state,
      nextActions: ["hold_snack_shack"]
    });

    expect(booking.status).toBe("queued");
    expect(snack.status).toBe("queued");
    const listed = await listStaffHolds(courseId);
    expect(listed.map((hold) => hold.kind).sort()).toEqual(["hold_request", "hold_snack_shack"]);
    expect(listed.every((hold) => hold.status === "queued")).toBe(true);
    expect(sendSms).not.toHaveBeenCalled();
  });
});

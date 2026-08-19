import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));

import { handleCustomerMessage } from "./customer-bot";
import type { ForeupCustomer } from "./foreup-adapter";
import { writeHeldAvailability, writeHeldMemberDirectory } from "./foreup-hold";
import { findMemberByPhone, getOrCreateConversation, setAutomationStatus } from "./inbox-store";
import { makeTeeTime } from "./tee-time-availability";

const courseId = `course-bot-${crypto.randomUUID()}`;
const memberPhone = "+18015550184";

function customer(id: string, overrides: Partial<ForeupCustomer> = {}): ForeupCustomer {
  return {
    id,
    accountNumber: id,
    name: `Member ${id}`,
    phone: memberPhone,
    email: `${id}@example.com`,
    member: true,
    membershipGroups: ["Family Equity"],
    priceClassId: "1",
    accountBalance: 0,
    invoiceBalance: 0,
    optOutText: false,
    optOutEmail: false,
    status: 1,
    city: "Yuba City",
    state: "CA",
    handicap: "12",
    ...overrides
  };
}

describe("customer bot phone match and persistence", () => {
  beforeEach(async () => {
    process.env.FOREUP_COURSE_ID = courseId;
    await writeHeldMemberDirectory({
      courseId,
      syncedAt: "2026-08-18T12:00:00.000Z",
      customers: [customer("3612897")],
      upcomingByCustomerId: {},
      upcomingSynced: true
    });
    await writeHeldAvailability({
      courseId,
      syncedAt: "2026-08-18T12:00:00.000Z",
      slots: [
        makeTeeTime("2026-08-22", 8, 20, 4, "hold"),
        makeTeeTime("2026-08-22", 8, 36, 3, "hold")
      ]
    });
  });

  it("matches the held member phone and keeps conversation state", async () => {
    expect(await findMemberByPhone(memberPhone)).toMatchObject({ id: "3612897", phone: memberPhone });
    expect(await findMemberByPhone("+18015550999")).toBeNull();

    const conversation = await getOrCreateConversation({ phone: memberPhone });
    const first = await handleCustomerMessage({
      conversation,
      body: "Book Saturday morning for 2 with no guests and 1 cart",
      now: new Date("2026-08-18T18:32:00-05:00")
    });
    expect(first.shouldReply).toBe(true);
    expect(first.conversation.memberId).toBe("3612897");
    expect(first.conversation.botState?.slots.date).toBe("2026-08-22");
    expect(first.result.booked).toBe(false);

    const second = await handleCustomerMessage({
      conversation: first.conversation,
      body: "1",
      now: new Date("2026-08-18T18:32:00-05:00")
    });
    expect(second.conversation.botState?.slots.selectedSlotId).toBe("2026-08-22-0820");
    expect(second.conversation.botState?.phase).toBe("addons");
  });

  it("does not auto-reply after a staff pause", async () => {
    const conversation = await getOrCreateConversation({ phone: "+18015550001" });
    const paused = await setAutomationStatus(conversation.id, "staff_paused");
    const turn = await handleCustomerMessage({
      conversation: paused ?? conversation,
      body: "Book Saturday"
    });
    expect(turn.shouldReply).toBe(false);
    expect(turn.reply).toBeNull();
  });

  it("pauses the bot on a handoff keyword", async () => {
    const conversation = await getOrCreateConversation({ phone: "+18015550002" });
    const turn = await handleCustomerMessage({ conversation, body: "I need a manager" });
    expect(turn.shouldReply).toBe(true);
    expect(turn.conversation.automationStatus).toBe("staff_paused");
    expect(turn.result.state.phase).toBe("staff_hold");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));

import { handleCustomerMessage, queuePreTurnSnackShackPrompt } from "./customer-bot";
import { DEFAULT_MEMBERS_ONLY_MESSAGE } from "./club-settings";
import type { ForeupCustomer } from "./foreup-adapter";
import { writeHeldAvailability, writeHeldMemberDirectory } from "./foreup-hold";
import { findMemberByPhone, getOrCreateConversation, setAutomationStatus } from "./inbox-store";
import { listStaffHolds } from "./staff-holds";
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

  it("queues a pre-turn snack-shack prompt and handles the reply", async () => {
    const conversation = await getOrCreateConversation({ phone: memberPhone });
    const queued = await queuePreTurnSnackShackPrompt({
      conversation,
      teeTime: { id: "2026-08-22-0820", startsAt: "2026-08-22T08:20:00-05:00" },
      now: new Date("2026-08-22T06:50:00-05:00")
    });
    expect(queued.shouldSend).toBe(true);
    expect(queued.message).toMatch(/snack shack at the turn/i);
    expect(queued.conversation.botState?.phase).toBe("pre_turn");

    const reply = await handleCustomerMessage({
      conversation: queued.conversation,
      body: "no",
      now: new Date("2026-08-22T06:51:00-05:00")
    });
    expect(reply.shouldReply).toBe(true);
    expect(reply.conversation.botState?.preTurnOutreach?.status).toBe("declined");
    expect(reply.conversation.botState?.slots.foodAndBeverage).toBe("none");
  });

  it("does not queue a pre-turn prompt when paused, owned, or opted out", async () => {
    const conversation = await getOrCreateConversation({ phone: "+18015550003" });
    const paused = await setAutomationStatus(conversation.id, "staff_paused");
    const pausedQueue = await queuePreTurnSnackShackPrompt({
      conversation: paused ?? conversation,
      teeTime: { id: "2026-08-22-0820", startsAt: "2026-08-22T08:20:00-05:00" },
      now: new Date("2026-08-22T06:50:00-05:00")
    });
    expect(pausedQueue.shouldSend).toBe(false);
    expect(pausedQueue.message).toBeNull();
    expect(pausedQueue.reason).toBe("staff_paused");

    const ownedConversation = await getOrCreateConversation({ phone: "+18015550004" });
    const owned = await setAutomationStatus(ownedConversation.id, "staff_owned");
    const ownedQueue = await queuePreTurnSnackShackPrompt({
      conversation: owned ?? ownedConversation,
      teeTime: { id: "2026-08-22-0820", startsAt: "2026-08-22T08:20:00-05:00" },
      now: new Date("2026-08-22T06:50:00-05:00")
    });
    expect(ownedQueue.reason).toBe("staff_owned");

    const optedOut = await queuePreTurnSnackShackPrompt({
      conversation: await getOrCreateConversation({ phone: "+18015550005" }),
      teeTime: { id: "2026-08-22-0820", startsAt: "2026-08-22T08:20:00-05:00" },
      member: { optOutText: true },
      now: new Date("2026-08-22T06:50:00-05:00")
    });
    expect(optedOut.reason).toBe("opted_out");
    expect(optedOut.shouldSend).toBe(false);
  });

  it("pauses the bot on a handoff keyword", async () => {
    const conversation = await getOrCreateConversation({ phone: memberPhone });
    const turn = await handleCustomerMessage({ conversation, body: "I need a manager" });
    expect(turn.shouldReply).toBe(true);
    expect(turn.conversation.automationStatus).toBe("staff_paused");
    expect(turn.result.state.phase).toBe("staff_hold");
  });

  it("hard-stops a non-member after one members-only message", async () => {
    const conversation = await getOrCreateConversation({ phone: "+18015550999" });
    const first = await handleCustomerMessage({ conversation, body: "Book Saturday" });
    expect(first.shouldReply).toBe(true);
    expect(first.reply).toBe(DEFAULT_MEMBERS_ONLY_MESSAGE);
    expect(first.conversation.botState?.membersOnlyStopped).toBe(true);
    const second = await handleCustomerMessage({
      conversation: first.conversation,
      body: "I am a member, book me"
    });
    expect(second.shouldReply).toBe(false);
    expect(second.reply).toBeNull();
  });

  it("does not offer demo tee times when the hold is empty", async () => {
    await writeHeldAvailability({ courseId, syncedAt: "2026-08-18T12:00:00.000Z", slots: [] });
    const existing = await getOrCreateConversation({ phone: memberPhone });
    const turn = await handleCustomerMessage({
      conversation: { ...existing, automationStatus: "bot_active", botState: undefined },
      body: "Book Saturday morning for 2 with no guests",
      now: new Date("2026-08-18T18:32:00-05:00"),
      persist: false
    });
    expect(turn.result.state.phase).toBe("staff_hold");
    expect(turn.result.state.handoffReason).toBe("no_slots");
    expect(turn.result.state.proposedSlots).toEqual([]);
    expect(turn.result.reply).not.toMatch(/8:20 AM/);
  });

  it("queues booking and snack-shack holds without marking them sent", async () => {
    const existing = await getOrCreateConversation({ phone: memberPhone });
    const active = await setAutomationStatus(existing.id, "bot_active");
    const conversation = { ...(active ?? existing), automationStatus: "bot_active" as const, botState: undefined };
    const now = new Date("2026-08-18T18:32:00-05:00");
    let current = await handleCustomerMessage({
      conversation,
      body: "Book Saturday morning for 2 with no guests and no carts",
      now
    });
    current = await handleCustomerMessage({ conversation: current.conversation, body: "1", now });
    current = await handleCustomerMessage({ conversation: current.conversation, body: "no food", now });
    current = await handleCustomerMessage({ conversation: current.conversation, body: "yes", now });
    expect(current.result.nextActions).toEqual(["hold_request"]);

    const prompted = await queuePreTurnSnackShackPrompt({
      conversation: {
        ...current.conversation,
        botState: {
          ...current.conversation.botState!,
          preTurnOutreach: undefined,
          phase: "complete"
        }
      },
      teeTime: { id: `hold-test-${crypto.randomUUID()}`, startsAt: "2026-08-22T08:20:00-05:00" },
      now: new Date("2026-08-22T06:50:00-05:00")
    });
    const snack = await handleCustomerMessage({
      conversation: prompted.conversation,
      body: "two hot dogs",
      now: new Date("2026-08-22T06:51:00-05:00")
    });
    expect(snack.result.nextActions).toContain("hold_snack_shack");

    const holds = await listStaffHolds(courseId);
    expect(holds.some((hold) => hold.kind === "hold_request" && hold.status === "queued")).toBe(true);
    expect(holds.some((hold) => hold.kind === "hold_snack_shack" && hold.status === "queued")).toBe(true);
    expect(holds.every((hold) => hold.status === "queued")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { defaultBotConfig } from "./bot-config";
import {
  classifyIntent,
  emptyConversationState,
  extractBookingSlots,
  runConversationTurn,
  type ConversationState
} from "./conversation-engine";
import { demoAvailableTeeTimes, makeTeeTime } from "./tee-time-availability";

const now = new Date("2026-08-18T18:32:00-05:00");
const today = "2026-08-18";
const saturday = "2026-08-22";
const slots = demoAvailableTeeTimes(today);

function turn(text: string, state?: ConversationState | null, available = slots, phoneMatched = true) {
  return runConversationTurn({ text, state, now, availableSlots: available, phoneMatched });
}

describe("classifyIntent", () => {
  it("detects booking, handoff, charge, and confirm intents", () => {
    expect(classifyIntent("Book a tee time Saturday")).toBe("book_tee_time");
    expect(classifyIntent("I want a refund")).toBe("handoff");
    expect(classifyIntent("Please charge my account")).toBe("charge_account");
    expect(classifyIntent("yes")).toBe("confirm");
    expect(classifyIntent("2")).toBe("select_slot");
  });
});

describe("extractBookingSlots", () => {
  it("fills day, window, players, guests, and carts from one message", () => {
    const extracted = extractBookingSlots("Saturday morning for 3 with one guest and 2 carts", now, "America/Chicago");
    expect(extracted).toMatchObject({
      date: saturday,
      window: "morning",
      playerCount: 3,
      guestCount: 1,
      cartCount: 2
    });
  });

  it("understands two members and one guest", () => {
    const extracted = extractBookingSlots("Saturday morning for two members and one guest", now, "America/Chicago");
    expect(extracted).toMatchObject({ date: saturday, playerCount: 3, guestCount: 1 });
  });
});

describe("runConversationTurn", () => {
  it("asks for the next missing slot instead of inventing a booking", () => {
    const first = turn("I want to play Saturday");
    expect(first.state.slots.date).toBe(saturday);
    expect(first.state.phase).toBe("collecting");
    expect(first.reply).toMatch(/morning|afternoon|tee time/i);
    expect(first.booked).toBe(false);
  });

  it("proposes held Saturday morning times after slots are filled", () => {
    const first = turn("Book Saturday morning for 3 with one guest and 2 carts");
    expect(first.state.phase).toBe("proposing");
    expect(first.reply).toMatch(/8:20 AM/);
    expect(first.reply).toMatch(/8:36 AM/);
    expect(first.reply).toMatch(/9:04 AM/);
    expect(first.booked).toBe(false);

    const picked = turn("1", first.state);
    expect(picked.state.slots.selectedSlotId).toBe(`${saturday}-0820`);
    expect(picked.state.phase).toBe("addons");
    expect(picked.reply).toMatch(/food or drinks/i);
  });

  it("does not book when the hold has no matching tee times", () => {
    const result = turn("Book Saturday morning for 2 with no guests", null, []);
    expect(result.state.phase).toBe("staff_hold");
    expect(result.state.handoffReason).toBe("no_slots");
    expect(result.state.slots.selectedSlotId).toBeUndefined();
    expect(result.booked).toBe(false);
    expect(result.reply).toMatch(/will not book/i);
    expect(result.nextActions).toContain("no_slots");
  });

  it("does not book a slot that cannot fit the player count", () => {
    const tight = [makeTeeTime(saturday, 8, 20, 1, "hold")];
    const result = turn("Book Saturday morning for 3 with no guests", null, tight);
    expect(result.state.phase).toBe("staff_hold");
    expect(result.booked).toBe(false);
    expect(result.state.handoffReason).toBe("no_slots");
  });

  it("hands off on staff keywords and does not book", () => {
    const result = turn("This is a complaint about yesterday");
    expect(result.state.phase).toBe("staff_hold");
    expect(result.state.intent).toBe("handoff");
    expect(result.reply).toMatch(/club staff/);
    expect(result.booked).toBe(false);
  });

  it("does not auto-reply when staff owns or paused the thread", () => {
    const paused = runConversationTurn({
      text: "Book Saturday morning for 2",
      now,
      availableSlots: slots,
      phoneMatched: true,
      automationStatus: "staff_paused"
    });
    const owned = runConversationTurn({
      text: "Book Saturday morning for 2",
      now,
      availableSlots: slots,
      phoneMatched: true,
      automationStatus: "staff_owned"
    });
    expect(paused.shouldReply).toBe(false);
    expect(owned.shouldReply).toBe(false);
    expect(paused.booked).toBe(false);
  });

  it("holds account charges for staff and OTP instead of booking", () => {
    const result = turn("Please charge my account");
    expect(result.state.phase).toBe("staff_hold");
    expect(result.state.intent).toBe("charge_account");
    expect(result.reply).toMatch(/one-time code|will not charge/i);
    expect(result.booked).toBe(false);
  });

  it("requires a phone match before confirming a request", () => {
    const ready = turn("Book Saturday morning for 2 with no guests, no carts, and no food", null, slots, true);
    const selected = turn("1", ready.state, slots, true);
    const food = selected.state.slots.foodAndBeverage ? selected : turn("no food", selected.state, slots, true);
    const unmatched = turn("yes", food.state, slots, false);
    expect(unmatched.state.phase).toBe("staff_hold");
    expect(unmatched.state.handoffReason).toBe("identity");
    expect(unmatched.booked).toBe(false);
    expect(unmatched.reply).toMatch(/does not match/);
  });

  it("confirms only as a staff hold and never sets booked", () => {
    let current = turn("Book Saturday morning for 2 with no guests and no carts", null, slots, true);
    current = turn("1", current.state, slots, true);
    current = turn("no food", current.state, slots, true);
    expect(current.state.phase).toBe("confirming");
    current = turn("yes", current.state, slots, true);
    expect(current.state.phase).toBe("complete");
    expect(current.booked).toBe(false);
    expect(current.state.booked).toBe(false);
    expect(current.nextActions).toEqual(["hold_request"]);
    expect(current.reply).toMatch(/did not book or charge/i);
  });

  it("records a pre-turn snack-shack yes, no, and order", () => {
    const prompted = emptyConversationState({
      phase: "pre_turn",
      phoneMatched: true,
      preTurnOutreach: {
        teeTimeId: `${saturday}-0820`,
        startsAt: `${saturday}T08:20:00-05:00`,
        status: "prompted"
      }
    });

    const yes = turn("yes", prompted);
    expect(yes.state.phase).toBe("pre_turn");
    expect(yes.state.preTurnOutreach?.status).toBe("prompted");
    expect(yes.reply).toMatch(/what should the snack shack/i);
    expect(yes.booked).toBe(false);

    const order = turn("two hot dogs", yes.state);
    expect(order.state.preTurnOutreach?.status).toBe("ordered");
    expect(order.state.slots.foodAndBeverage).toMatch(/hot dogs/i);
    expect(order.reply).toMatch(/noted for the snack shack/i);
    expect(order.nextActions).toContain("hold_snack_shack");
    expect(order.booked).toBe(false);

    const declined = turn("no", prompted);
    expect(declined.state.preTurnOutreach?.status).toBe("declined");
    expect(declined.state.slots.foodAndBeverage).toBe("none");
    expect(declined.reply).toMatch(/nothing from the snack shack/i);
    expect(declined.nextActions).toContain("snack_shack_declined");
  });

  it("does not auto-reply to a pre-turn thread when staff owns it", () => {
    const prompted = emptyConversationState({
      phase: "pre_turn",
      preTurnOutreach: { teeTimeId: "tee-1", startsAt: `${saturday}T08:20:00-05:00`, status: "prompted" }
    });
    const result = runConversationTurn({
      text: "two hot dogs",
      state: prompted,
      now,
      automationStatus: "staff_owned"
    });
    expect(result.shouldReply).toBe(false);
    expect(result.state.preTurnOutreach?.status).toBe("prompted");
  });

  it("respects bot config when guests are not required", () => {
    const result = runConversationTurn({
      text: "Book Saturday morning for 2",
      now,
      availableSlots: slots,
      phoneMatched: true,
      config: { ...defaultBotConfig, askAboutGuests: false, askAboutCarts: false, askAboutFood: false }
    });
    expect(result.state.phase).toBe("proposing");
    expect(result.state.slots.guestCount).toBeUndefined();
  });
});

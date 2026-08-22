import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));

import type { ForeupCustomer, ForeupUpcomingTeeTime } from "./foreup-adapter";
import { writeHeldMemberDirectory } from "./foreup-hold";
import { getOrCreateConversation, setAutomationStatus } from "./inbox-store";
import { PRE_TURN_SNACK_SHACK_JOB, runPreTurnSnackShackJob } from "./pre-turn-scheduler";

const inWindow = new Date("2026-08-22T06:50:00-05:00");
const tooEarly = new Date("2026-08-22T04:00:00-05:00");
const teeTime: ForeupUpcomingTeeTime = {
  id: "2026-08-22-0820",
  startsAt: "2026-08-22T08:20:00-05:00",
  title: "Saturday",
  players: 2,
  carts: 1,
  status: "confirmed"
};

function customer(id: string, overrides: Partial<ForeupCustomer> = {}): ForeupCustomer {
  return {
    id,
    accountNumber: id,
    name: `Member ${id}`,
    phone: `+1801555${id.slice(-4).padStart(4, "0")}`,
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

async function seed(courseId: string, customers: ForeupCustomer[], upcomingByCustomerId: Record<string, ForeupUpcomingTeeTime[]>, upcomingSynced = true) {
  await writeHeldMemberDirectory({
    courseId,
    syncedAt: "2026-08-22T12:00:00.000Z",
    customers,
    upcomingByCustomerId,
    upcomingSynced
  });
}

describe("runPreTurnSnackShackJob", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the scheduler job used by POST /api/scheduler/run", () => {
    expect(PRE_TURN_SNACK_SHACK_JOB).toBe("pre-turn-snack-shack");
  });

  it("returns hold_missing when the directory is not held", async () => {
    const result = await runPreTurnSnackShackJob({
      courseId: `course-missing-${crypto.randomUUID()}`,
      now: inWindow
    });
    expect(result).toMatchObject({
      code: "hold_missing",
      holdStatus: "missing",
      queued: 0,
      delivery: "queued"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns hold_upcoming_missing when tee times are not held", async () => {
    const courseId = `course-upcoming-${crypto.randomUUID()}`;
    const member = customer("3612801");
    await seed(courseId, [member], { "3612801": [teeTime] }, false);
    const result = await runPreTurnSnackShackJob({ courseId, now: inWindow });
    expect(result).toMatchObject({
      code: "hold_upcoming_missing",
      holdStatus: "missing",
      upcomingSynced: false,
      queued: 0
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("queues a snack-shack prompt for a held tee time in the pre-turn window", async () => {
    const courseId = `course-send-${crypto.randomUUID()}`;
    const member = customer("3612802");
    process.env.FOREUP_COURSE_ID = courseId;
    await seed(courseId, [member], { "3612802": [teeTime] });
    const result = await runPreTurnSnackShackJob({ courseId, now: inWindow });
    expect(result.holdStatus).toBe("held");
    expect(result.queued).toBe(1);
    expect(result.candidates[0]).toMatchObject({
      memberId: "3612802",
      teeTimeId: teeTime.id,
      shouldSend: true,
      reason: "send"
    });
    expect(result.candidates[0].message).toMatch(/snack shack at the turn/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips tee times that are too early without live ForeUp", async () => {
    const courseId = `course-early-${crypto.randomUUID()}`;
    const member = customer("3612803");
    await seed(courseId, [member], { "3612803": [teeTime] });
    const result = await runPreTurnSnackShackJob({ courseId, now: tooEarly });
    expect(result.queued).toBe(0);
    expect(result.candidates[0]).toMatchObject({
      memberId: "3612803",
      shouldSend: false,
      reason: "too_early"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips paused and owned threads", async () => {
    const courseId = `course-pause-${crypto.randomUUID()}`;
    const pausedMember = customer("3612804");
    const ownedMember = customer("3612805");
    process.env.FOREUP_COURSE_ID = courseId;
    await seed(courseId, [pausedMember, ownedMember], {
      "3612804": [teeTime],
      "3612805": [teeTime]
    });
    const paused = await getOrCreateConversation({ memberId: pausedMember.id, phone: pausedMember.phone });
    await setAutomationStatus(paused.id, "staff_paused");
    const owned = await getOrCreateConversation({ memberId: ownedMember.id, phone: ownedMember.phone });
    await setAutomationStatus(owned.id, "staff_owned");

    const result = await runPreTurnSnackShackJob({ courseId, now: inWindow });
    expect(result.queued).toBe(0);
    expect(result.candidates.find((item) => item.memberId === "3612804")?.reason).toBe("staff_paused");
    expect(result.candidates.find((item) => item.memberId === "3612805")?.reason).toBe("staff_owned");
  });

  it("skips members who opted out of SMS", async () => {
    const courseId = `course-optout-${crypto.randomUUID()}`;
    const member = customer("3612806", { optOutText: true });
    await seed(courseId, [member], { "3612806": [teeTime] });
    const result = await runPreTurnSnackShackJob({ courseId, now: inWindow });
    expect(result.queued).toBe(0);
    expect(result.candidates[0]).toMatchObject({
      memberId: "3612806",
      shouldSend: false,
      reason: "opted_out"
    });
  });
});

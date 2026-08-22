import { describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));

import {
  combineHoldStatus,
  dailyHoldRange,
  enumerateIsoDays,
  holdCoverage,
  listHeldAvailableTeeTimes,
  memberHoldMissingPayload,
  readHeldMember,
  readHeldMemberDirectory,
  writeHeldAvailability,
  writeHeldMemberDirectory
} from "./foreup-hold";
import type { ForeupCustomer } from "./foreup-adapter";

function customer(id: string, overrides: Partial<ForeupCustomer> = {}): ForeupCustomer {
  return {
    id,
    accountNumber: id,
    name: `Member ${id}`,
    phone: "+18015550184",
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

describe("holdCoverage", () => {
  it("returns missing when no expected or held days exist", () => {
    expect(holdCoverage(["2026-08-01", "2026-08-02"], []).status).toBe("missing");
    expect(holdCoverage([], []).status).toBe("missing");
  });

  it("returns partial coverage and keeps held days visible", () => {
    const coverage = holdCoverage(enumerateIsoDays("2026-08-01", "2026-08-03"), ["2026-08-01", "2026-08-03"], "2026-08-03T12:00:00.000Z");
    expect(coverage.status).toBe("partial");
    expect(coverage.heldDays).toEqual(["2026-08-01", "2026-08-03"]);
    expect(coverage.missingDays).toEqual(["2026-08-02"]);
    expect(coverage.lastSyncedAt).toBe("2026-08-03T12:00:00.000Z");
  });

  it("returns complete only when every expected day is held", () => {
    expect(holdCoverage(["2026-08-01", "2026-08-02"], ["2026-08-02", "2026-08-01"]).status).toBe("complete");
  });
});

describe("dailyHoldRange", () => {
  it("uses month-to-date once the month is at least a week old", () => {
    expect(dailyHoldRange("2026-08-16")).toEqual({ start: "2026-08-01", end: "2026-08-16" });
  });

  it("widens into the previous month for the first days of a month", () => {
    expect(dailyHoldRange("2026-08-03")).toEqual({ start: "2026-07-28", end: "2026-08-03" });
  });
});

describe("combineHoldStatus", () => {
  it("treats mixed complete and missing feeds as a visible gap", () => {
    expect(combineHoldStatus("complete", "missing")).toBe("partial");
    expect(combineHoldStatus("missing", "missing")).toBe("missing");
    expect(combineHoldStatus("complete", "complete")).toBe("complete");
  });
});

describe("held member directory", () => {
  it("does not invent a live directory when nothing is held", async () => {
    expect(await readHeldMemberDirectory("course-missing")).toBeNull();
    expect(memberHoldMissingPayload("directory")).toMatchObject({ connected: false, code: "hold_missing" });
  });

  it("reads back a written directory without requiring ForeUp", async () => {
    const courseId = `course-${crypto.randomUUID()}`;
    await writeHeldMemberDirectory({
      courseId,
      syncedAt: "2026-08-16T12:00:00.000Z",
      customers: [customer("3612897")],
      upcomingByCustomerId: { "3612897": [{ id: "tee_1", startsAt: "2026-08-17T15:36:00.000Z", title: "Saturday", players: 2, carts: 1, status: "confirmed" }] },
      upcomingSynced: true
    });
    const held = await readHeldMemberDirectory(courseId);
    expect(held?.customers).toHaveLength(1);
    const profile = await readHeldMember(courseId, "3612897");
    expect("missing" in profile).toBe(false);
    if ("missing" in profile) return;
    expect(profile.teeTimesStatus).toBe("held");
    expect(profile.teeTimes).toHaveLength(1);
  });
});

describe("held tee-time availability", () => {
  it("reads back written slots without a live ForeUp pull", async () => {
    const courseId = `course-teetimes-${crypto.randomUUID()}`;
    await writeHeldAvailability({
      courseId,
      syncedAt: "2026-08-22T12:00:00.000Z",
      slots: [
        { id: "2026-08-22-0820", startsAt: "2026-08-22T08:20:00", label: "8:20 AM", spotsOpen: 4, source: "hold" },
        { id: "2026-08-22-0836", startsAt: "2026-08-22T08:36:00", label: "8:36 AM", spotsOpen: 0, source: "hold" }
      ]
    });
    expect(await listHeldAvailableTeeTimes(courseId)).toEqual([
      { id: "2026-08-22-0820", startsAt: "2026-08-22T08:20:00", label: "8:20 AM", spotsOpen: 4, source: "hold" }
    ]);
  });
});

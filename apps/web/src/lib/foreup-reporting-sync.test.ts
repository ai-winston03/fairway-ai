import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));
vi.mock("./sms-provider", () => ({ sendSms: vi.fn() }));

import { foreup } from "./foreup-adapter";
import { listHeldAvailableTeeTimes, readHeldAvailability } from "./foreup-hold";
import { AVAILABILITY_HOLD_DAYS, syncForeupAvailabilityHold } from "./foreup-reporting-sync";
import { sendSms } from "./sms-provider";

describe("syncForeupAvailabilityHold", () => {
  beforeEach(() => {
    vi.mocked(sendSms).mockClear();
  });

  it("writes held tee times from GET teetimes without booking or SMS", async () => {
    const courseId = `course-teetimes-${crypto.randomUUID()}`;
    const listTeeTimes = vi.fn(async (_courseId: string, _teeSheetId: string, date: string) => {
      if (date !== "2026-08-22") return [];
      return [
        { id: "slot-1", startsAt: "2026-08-22T08:20:00-05:00", spotsOpen: 4 },
        { id: "slot-2", startsAt: "2026-08-22T08:36:00-05:00", spotsOpen: 0 }
      ];
    });

    const result = await syncForeupAvailabilityHold(courseId, "sheet-1", "2026-08-22", {
      days: 2,
      listTeeTimes
    });

    expect(result).toEqual({ days: 2, slots: 2, openSlots: 1 });
    expect(listTeeTimes).toHaveBeenCalledTimes(2);
    expect(listTeeTimes).toHaveBeenCalledWith(courseId, "sheet-1", "2026-08-22");
    expect(listTeeTimes).toHaveBeenCalledWith(courseId, "sheet-1", "2026-08-23");

    const held = await readHeldAvailability(courseId);
    expect(held?.slots).toEqual([
      { id: "slot-1", startsAt: "2026-08-22T08:20:00-05:00", label: "8:20 AM", spotsOpen: 4, source: "hold" },
      { id: "slot-2", startsAt: "2026-08-22T08:36:00-05:00", label: "8:36 AM", spotsOpen: 0, source: "hold" }
    ]);
    expect(await listHeldAvailableTeeTimes(courseId)).toEqual([
      { id: "slot-1", startsAt: "2026-08-22T08:20:00-05:00", label: "8:20 AM", spotsOpen: 4, source: "hold" }
    ]);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("does not write when a teetimes page cannot be mapped", async () => {
    const courseId = `course-bad-teetimes-${crypto.randomUUID()}`;
    await expect(syncForeupAvailabilityHold(courseId, "sheet-1", "2026-08-22", {
      days: 1,
      listTeeTimes: async () => [{ id: "bad", startsAt: "", spotsOpen: Number.NaN }]
    })).rejects.toThrow(/open-spot count/i);
    expect(await readHeldAvailability(courseId)).toBeNull();
  });

  it("keeps createBooking disabled and names the App Hosting window", async () => {
    expect(AVAILABILITY_HOLD_DAYS).toBe(14);
    await expect(foreup.createBooking({
      courseId: "9039",
      teeSheetId: "sheet-1",
      customerId: "3612897",
      playerCount: 2,
      guestCount: 0,
      requestedDate: "2026-08-22",
      requestedWindow: "morning",
      carts: 1
    })).rejects.toThrow(/intentionally disabled/i);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./firebase-admin", () => ({ firebaseAdmin: () => null }));

import {
  DEFAULT_MEMBERS_ONLY_MESSAGE,
  DEFAULT_RESTAURANT_TIMEZONE,
  defaultClubSettings,
  isRestaurantOpen,
  matchFaq,
  unansweredReferral
} from "./club-settings";
import { readClubSettings, writeClubSettings } from "./club-settings-store";

const tuesdayLunch = new Date("2026-08-18T12:15:00-05:00");
const tuesdayNight = new Date("2026-08-18T21:00:00-05:00");

describe("club settings defaults", () => {
  it("defaults members-only copy and Chicago restaurant hours", () => {
    const settings = defaultClubSettings("course-1");
    expect(settings.membersOnlyMessage).toBe(DEFAULT_MEMBERS_ONLY_MESSAGE);
    expect(settings.restaurantHours.timezone).toBe(DEFAULT_RESTAURANT_TIMEZONE);
    expect(settings.faq).toEqual([]);
  });
});

describe("isRestaurantOpen", () => {
  const hours = {
    open: "11:00",
    close: "20:00",
    timezone: "America/Chicago",
    days: ["tuesday"]
  };

  it("is open during configured hours and closed otherwise", () => {
    expect(isRestaurantOpen(hours, tuesdayLunch)).toBe(true);
    expect(isRestaurantOpen(hours, tuesdayNight)).toBe(false);
    expect(isRestaurantOpen({ ...hours, days: ["monday"] }, tuesdayLunch)).toBe(false);
  });
});

describe("matchFaq and unanswered referral", () => {
  it("matches tags and refers other questions to the pro shop", () => {
    const faq = matchFaq("what is the dress code", [
      { id: "dress", question: "What is the dress code?", answer: "Collared shirts.", tags: ["dress code"] }
    ]);
    expect(faq?.answer).toBe("Collared shirts.");
    expect(unansweredReferral({
      ...defaultClubSettings("course-1"),
      proShopPhone: "530-555-0100"
    })).toMatch(/530-555-0100/);
  });
});

describe("clubSettings store", () => {
  beforeEach(() => {
    process.env.FOREUP_COURSE_ID = "course-settings-test";
  });

  it("reads back written settings from the in-process store when Admin is absent", async () => {
    const courseId = `course-settings-${crypto.randomUUID()}`;
    const written = await writeClubSettings({
      ...defaultClubSettings(courseId),
      proShopPhone: "530-555-0144",
      faq: [{ id: "hours", question: "When do you open?", answer: "Sunrise.", tags: ["hours"] }]
    });
    expect(written.proShopPhone).toBe("530-555-0144");
    const read = await readClubSettings(courseId);
    expect(read.faq[0]?.answer).toBe("Sunrise.");
    expect(read.membersOnlyMessage).toBe(DEFAULT_MEMBERS_ONLY_MESSAGE);
  });
});

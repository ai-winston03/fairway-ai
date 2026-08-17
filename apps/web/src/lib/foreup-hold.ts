import type { ForeupCustomer, ForeupUpcomingTeeTime } from "./foreup-adapter";
import { firebaseAdmin } from "./firebase-admin";

export type HoldStatus = "complete" | "partial" | "missing";

export type HoldCoverage = {
  status: HoldStatus;
  expectedDays: string[];
  heldDays: string[];
  missingDays: string[];
  lastSyncedAt: string | null;
};

export type HeldMemberDirectory = {
  courseId: string;
  syncedAt: string;
  customers: ForeupCustomer[];
  upcomingByCustomerId: Record<string, ForeupUpcomingTeeTime[]>;
  upcomingSynced: boolean;
};

export type HeldMemberProfile = {
  member: ForeupCustomer;
  teeTimes: ForeupUpcomingTeeTime[];
  teeTimesStatus: "held" | "missing";
  syncedAt: string;
};

const memoryDirectories = new Map<string, HeldMemberDirectory>();

export function addIsoDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function enumerateIsoDays(start: string, end: string) {
  const days: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return days;
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return days;
}

/** Current month through today, widened to at least the last 7 days so month boundaries stay current. */
export function dailyHoldRange(today: string) {
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = addIsoDays(today, -6);
  return { start: weekStart < monthStart ? weekStart : monthStart, end: today };
}

export function holdCoverage(expectedDays: string[], heldDays: string[], lastSyncedAt: string | null = null): HoldCoverage {
  const expected = [...expectedDays];
  const held = [...new Set(heldDays)].filter((day) => expected.includes(day)).sort();
  const missingDays = expected.filter((day) => !held.includes(day));
  const status: HoldStatus = expected.length === 0 || held.length === 0
    ? "missing"
    : missingDays.length === 0 ? "complete" : "partial";
  return { status, expectedDays: expected, heldDays: held, missingDays, lastSyncedAt };
}

export function combineHoldStatus(left: HoldStatus, right: HoldStatus): HoldStatus {
  if (left === "missing" && right === "missing") return "missing";
  if (left === "complete" && right === "complete") return "complete";
  return "partial";
}

export function latestSyncedAt(values: Array<string | null | undefined>) {
  const stamps = values.filter((value): value is string => Boolean(value)).sort();
  return stamps.at(-1) ?? null;
}

export function memberHoldMissingPayload(kind: "directory" | "member") {
  if (kind === "directory") {
    return {
      connected: false as const,
      code: "hold_missing",
      error: "Member directory is not synced yet. Run the daily ForeUp hold."
    };
  }
  return {
    connected: false as const,
    code: "hold_member_missing",
    error: "That member is not in the held directory."
  };
}

function directoryDocId(courseId: string) {
  return `members-${courseId}`;
}

function parseDirectory(courseId: string, data: Record<string, unknown> | undefined): HeldMemberDirectory | null {
  if (!data || !Array.isArray(data.customers) || typeof data.syncedAt !== "string") return null;
  const upcoming = data.upcomingByCustomerId && typeof data.upcomingByCustomerId === "object" && !Array.isArray(data.upcomingByCustomerId)
    ? data.upcomingByCustomerId as Record<string, ForeupUpcomingTeeTime[]>
    : {};
  return {
    courseId,
    syncedAt: data.syncedAt,
    customers: data.customers as ForeupCustomer[],
    upcomingByCustomerId: upcoming,
    upcomingSynced: data.upcomingSynced === true
  };
}

export async function writeHeldMemberDirectory(snapshot: HeldMemberDirectory) {
  memoryDirectories.set(snapshot.courseId, snapshot);
  const firebase = firebaseAdmin();
  if (!firebase) return;
  try {
    await firebase.db.collection("foreupHold").doc(directoryDocId(snapshot.courseId)).set({
      courseId: snapshot.courseId,
      kind: "members",
      syncedAt: snapshot.syncedAt,
      customers: snapshot.customers,
      upcomingByCustomerId: snapshot.upcomingByCustomerId,
      upcomingSynced: snapshot.upcomingSynced
    }, { merge: true });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unable to write the member hold.");
  }
}

export async function readHeldMemberDirectory(courseId: string): Promise<HeldMemberDirectory | null> {
  const firebase = firebaseAdmin();
  if (firebase) {
    try {
      const snapshot = await firebase.db.collection("foreupHold").doc(directoryDocId(courseId)).get();
      const held = parseDirectory(courseId, snapshot.data() as Record<string, unknown> | undefined);
      if (held) {
        memoryDirectories.set(courseId, held);
        return held;
      }
    } catch {
      // A hold outage must not become a silent live ForeUp read.
    }
  }
  return memoryDirectories.get(courseId) ?? null;
}

export async function readHeldMember(courseId: string, memberId: string): Promise<HeldMemberProfile | { missing: "directory" | "member" }> {
  const directory = await readHeldMemberDirectory(courseId);
  if (!directory) return { missing: "directory" };
  const member = directory.customers.find((customer) => customer.id === memberId && customer.member);
  if (!member) return { missing: "member" };
  const teeTimes = directory.upcomingByCustomerId[memberId] ?? [];
  return {
    member,
    teeTimes,
    teeTimesStatus: directory.upcomingSynced ? "held" : "missing",
    syncedAt: directory.syncedAt
  };
}

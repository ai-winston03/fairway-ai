import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebase-admin";
import type { BookingSlots, ConversationState } from "@/lib/conversation-engine";
import type { ProposedTeeTime } from "@/lib/tee-time-availability";

export type StaffHoldKind = "hold_request" | "hold_snack_shack";
export type StaffHoldStatus = "queued";

export type StaffHoldPayload = {
  slots: BookingSlots;
  selectedSlot?: ProposedTeeTime;
  foodAndBeverage?: string;
  nextActions: string[];
};

export type StaffHold = {
  id: string;
  courseId: string;
  kind: StaffHoldKind;
  status: StaffHoldStatus;
  conversationId: string;
  memberId?: string;
  phone: string;
  summary: string;
  payload: StaffHoldPayload;
  createdAt: string;
};

export type QueueStaffHoldInput = {
  courseId: string;
  kind: StaffHoldKind;
  conversationId: string;
  memberId?: string;
  phone: string;
  state: ConversationState;
  nextActions: string[];
};

const memory = new Map<string, StaffHold[]>();

function nowIso() {
  return new Date().toISOString();
}

function stamp(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && value) return value;
  return nowIso();
}

function selectedSlot(state: ConversationState) {
  return state.proposedSlots.find((slot) => slot.id === state.slots.selectedSlotId);
}

export function staffHoldSummary(kind: StaffHoldKind, state: ConversationState) {
  const slot = selectedSlot(state);
  const when = slot?.startsAt ?? state.preTurnOutreach?.startsAt ?? state.slots.date ?? "unscheduled";
  const players = state.slots.playerCount ?? 0;
  const food = state.slots.foodAndBeverage && state.slots.foodAndBeverage !== "none"
    ? state.slots.foodAndBeverage
    : "no F&B";
  if (kind === "hold_snack_shack") {
    if (!state.slots.foodAndBeverage) {
      return `Snack shack prompt queued · ${when}`;
    }
    return `Snack shack hold · ${food} · ${when}`;
  }
  return `Booking hold · ${when} · ${players} player${players === 1 ? "" : "s"} · ${food}`;
}

export function holdKindFromActions(actions: string[]): StaffHoldKind | null {
  if (actions.includes("hold_snack_shack")) return "hold_snack_shack";
  if (actions.includes("hold_request")) return "hold_request";
  return null;
}

function parseHold(id: string, data: Record<string, unknown>): StaffHold | null {
  if (data.kind !== "hold_request" && data.kind !== "hold_snack_shack") return null;
  if (typeof data.courseId !== "string" || typeof data.conversationId !== "string" || typeof data.phone !== "string") {
    return null;
  }
  return {
    id,
    courseId: data.courseId,
    kind: data.kind,
    status: "queued",
    conversationId: data.conversationId,
    memberId: typeof data.memberId === "string" ? data.memberId : undefined,
    phone: data.phone,
    summary: typeof data.summary === "string" ? data.summary : "Queued staff hold",
    payload: (data.payload && typeof data.payload === "object" ? data.payload : { slots: {}, nextActions: [] }) as StaffHoldPayload,
    createdAt: stamp(data.createdAt)
  };
}

export async function queueStaffHold(input: QueueStaffHoldInput): Promise<StaffHold> {
  const hold: StaffHold = {
    id: crypto.randomUUID(),
    courseId: input.courseId,
    kind: input.kind,
    status: "queued",
    conversationId: input.conversationId,
    memberId: input.memberId,
    phone: input.phone,
    summary: staffHoldSummary(input.kind, input.state),
    payload: {
      slots: input.state.slots,
      selectedSlot: selectedSlot(input.state),
      foodAndBeverage: input.state.slots.foodAndBeverage,
      nextActions: input.nextActions
    },
    createdAt: nowIso()
  };

  const existing = memory.get(input.courseId) ?? [];
  memory.set(input.courseId, [hold, ...existing]);

  const firebase = firebaseAdmin();
  if (!firebase) return hold;

  await firebase.db.collection("staffHolds").doc(hold.id).set({
    courseId: hold.courseId,
    kind: hold.kind,
    status: "queued",
    conversationId: hold.conversationId,
    memberId: hold.memberId ?? null,
    phone: hold.phone,
    summary: hold.summary,
    payload: hold.payload,
    createdAt: FieldValue.serverTimestamp()
  });
  return hold;
}

export async function listStaffHolds(courseId: string): Promise<StaffHold[]> {
  const firebase = firebaseAdmin();
  if (firebase) {
    try {
      const snapshot = await firebase.db
        .collection("staffHolds")
        .where("courseId", "==", courseId)
        .limit(100)
        .get();
      const holds = snapshot.docs
        .map((doc) => parseHold(doc.id, doc.data() as Record<string, unknown>))
        .filter((hold): hold is StaffHold => Boolean(hold))
        .map((hold) => ({ ...hold, status: "queued" as const }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      memory.set(courseId, holds);
      return holds;
    } catch {
      // A queue outage must not invent a live SMS send or a second file store.
    }
  }
  return [...(memory.get(courseId) ?? [])].map((hold) => ({ ...hold, status: "queued" }));
}

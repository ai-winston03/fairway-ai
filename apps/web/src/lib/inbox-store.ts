import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { defaultBotConfig } from "@/lib/bot-config";
import { readHeldMemberDirectory } from "@/lib/foreup-hold";
import type { ForeupCustomer } from "@/lib/foreup-adapter";
import { createBotReply } from "@/lib/mock-data";
import { normalizePhone, phoneMatchKey, SmsDeliveryStatus, SmsProviderId } from "@/lib/sms-provider";

export type AutomationStatus = "bot_active" | "staff_paused" | "staff_owned";
export type MessageDirection = "inbound" | "outbound";
export type MessageAuthor = "member" | "bot" | "staff";

export type InboxMessage = {
  id: string;
  conversationId: string;
  memberId?: string;
  direction: MessageDirection;
  author: MessageAuthor;
  body: string;
  phone: string;
  status: SmsDeliveryStatus | "received";
  provider: SmsProviderId | "twilio";
  providerSid?: string;
  createdAt: string;
};

export type InboxConversation = {
  id: string;
  memberId?: string;
  phone: string;
  automationStatus: AutomationStatus;
  assignedStaffUids: string[];
  lastBody?: string;
  lastMessageAt?: string;
  unread: number;
};

type MemoryState = {
  conversations: Map<string, InboxConversation>;
  messages: Map<string, InboxMessage[]>;
};

const memory: MemoryState = {
  conversations: new Map(),
  messages: new Map()
};

function nowIso() {
  return new Date().toISOString();
}

function stamp(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return nowIso();
}

function assignedStaffUidsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

export function mentionsHandoff(body: string) {
  const lower = body.toLowerCase();
  return defaultBotConfig.staffHandoffKeywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export async function findMemberByPhone(phone: string): Promise<ForeupCustomer | null> {
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) return null;
  const key = phoneMatchKey(phone);
  if (!key) return null;
  try {
    const hold = await readHeldMemberDirectory(courseId);
    return hold?.customers.find((customer) => customer.member && phoneMatchKey(customer.phone) === key) ?? null;
  } catch {
    return null;
  }
}

export async function getOrCreateConversation(input: { memberId?: string; phone: string }) {
  const phone = normalizePhone(input.phone);
  const member = input.memberId
    ? { id: input.memberId, phone }
    : await findMemberByPhone(phone);
  const id = member?.id || `phone_${phoneMatchKey(phone) || phone.replace(/\D/g, "")}`;
  const firebase = firebaseAdmin();
  if (!firebase) {
    const existing = memory.conversations.get(id);
    if (existing) return existing;
    const created: InboxConversation = {
      id,
      memberId: member?.id,
      phone: member?.phone ? normalizePhone(member.phone) : phone,
      automationStatus: "bot_active",
      assignedStaffUids: [],
      unread: 0
    };
    memory.conversations.set(id, created);
    memory.messages.set(id, []);
    return created;
  }

  const ref = firebase.db.collection("conversations").doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() as Omit<InboxConversation, "id">;
    return {
      id,
      ...data,
      phone: data.phone || phone,
      memberId: data.memberId || member?.id,
      assignedStaffUids: assignedStaffUidsFrom(data.assignedStaffUids)
    };
  }
  const created: InboxConversation = {
    id,
    memberId: member?.id,
    phone: member && "phone" in member && member.phone ? normalizePhone(member.phone) : phone,
    automationStatus: "bot_active",
    assignedStaffUids: [],
    unread: 0
  };
  await ref.set({
    ...created,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return created;
}

export async function getConversationByMemberId(memberId: string) {
  const firebase = firebaseAdmin();
  if (!firebase) return memory.conversations.get(memberId) ?? null;
  const snap = await firebase.db.collection("conversations").doc(memberId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Omit<InboxConversation, "id">;
  return { id: snap.id, ...data, assignedStaffUids: assignedStaffUidsFrom(data.assignedStaffUids) };
}

export async function listMessages(conversationId: string, limit = 100): Promise<InboxMessage[]> {
  const firebase = firebaseAdmin();
  if (!firebase) return [...(memory.messages.get(conversationId) ?? [])];
  const snaps = await firebase.db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(limit)
    .get();
  return snaps.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      conversationId,
      memberId: data.memberId,
      direction: data.direction,
      author: data.author,
      body: data.body,
      phone: data.phone,
      status: data.status,
      provider: data.provider,
      providerSid: data.providerSid,
      createdAt: stamp(data.createdAt)
    };
  });
}

export async function appendMessage(input: {
  conversation: InboxConversation;
  direction: MessageDirection;
  author: MessageAuthor;
  body: string;
  status: InboxMessage["status"];
  provider: InboxMessage["provider"];
  providerSid?: string;
}) {
  const createdAt = nowIso();
  const message: InboxMessage = {
    id: crypto.randomUUID(),
    conversationId: input.conversation.id,
    memberId: input.conversation.memberId,
    direction: input.direction,
    author: input.author,
    body: input.body,
    phone: input.conversation.phone,
    status: input.status,
    provider: input.provider,
    providerSid: input.providerSid,
    createdAt
  };

  const unread = input.direction === "inbound" ? (input.conversation.unread ?? 0) + 1 : 0;
  const nextConversation: InboxConversation = {
    ...input.conversation,
    lastBody: input.body,
    lastMessageAt: createdAt,
    unread
  };

  const firebase = firebaseAdmin();
  if (!firebase) {
    memory.conversations.set(nextConversation.id, nextConversation);
    memory.messages.set(nextConversation.id, [...(memory.messages.get(nextConversation.id) ?? []), message]);
    return { conversation: nextConversation, message };
  }

  const convoRef = firebase.db.collection("conversations").doc(input.conversation.id);
  const messageRef = convoRef.collection("messages").doc(message.id);
  await firebase.db.runTransaction(async (tx) => {
    tx.set(messageRef, {
      ...message,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(convoRef, {
      memberId: nextConversation.memberId ?? null,
      phone: nextConversation.phone,
      automationStatus: nextConversation.automationStatus,
      assignedStaffUids: nextConversation.assignedStaffUids ?? [],
      lastBody: nextConversation.lastBody,
      lastMessageAt: FieldValue.serverTimestamp(),
      unread,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { conversation: nextConversation, message };
}

export async function setAutomationStatus(conversationId: string, automationStatus: AutomationStatus) {
  const firebase = firebaseAdmin();
  if (!firebase) {
    const existing = memory.conversations.get(conversationId);
    if (!existing) return null;
    const next = { ...existing, automationStatus };
    memory.conversations.set(conversationId, next);
    return next;
  }
  const ref = firebase.db.collection("conversations").doc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set({ automationStatus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const data = snap.data() as Omit<InboxConversation, "id">;
  return {
    id: conversationId,
    ...data,
    automationStatus,
    assignedStaffUids: assignedStaffUidsFrom(data.assignedStaffUids)
  };
}

export async function assignStaffToConversation(conversationId: string, staffUid: string) {
  const firebase = firebaseAdmin();
  if (!firebase) {
    const existing = memory.conversations.get(conversationId);
    if (!existing) return null;
    const assignedStaffUids = existing.assignedStaffUids.includes(staffUid)
      ? existing.assignedStaffUids
      : [...existing.assignedStaffUids, staffUid];
    const next = { ...existing, assignedStaffUids };
    memory.conversations.set(conversationId, next);
    return next;
  }
  const ref = firebase.db.collection("conversations").doc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as Omit<InboxConversation, "id">;
  const assignedStaffUids = assignedStaffUidsFrom(data.assignedStaffUids);
  if (!assignedStaffUids.includes(staffUid)) assignedStaffUids.push(staffUid);
  await ref.set({ assignedStaffUids, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { id: conversationId, ...data, assignedStaffUids };
}

export function draftBotReply(body: string) {
  return createBotReply(body);
}

export function staffHoldMessage() {
  return "I am connecting you with the club staff. Someone will reply here shortly.";
}

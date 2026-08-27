import { firebaseAdmin } from "@/lib/firebase-admin";

export const SMS_ATTEMPTS_COLLECTION = "sms_attempts";

export type SmsAttemptIntent = "staff" | "inbound_reply" | "scheduled" | "automation" | "unknown";
export type SmsBlockReason = "kill_switch" | "empty_allowlist" | "opt_out" | "other";

export type SmsAttemptLog = {
  to: string;
  from?: string;
  intent?: SmsAttemptIntent;
  blockReason: SmsBlockReason;
  actorUid?: string | null;
};

export function blockedSmsAttemptDoc(entry: SmsAttemptLog) {
  return {
    createdAt: new Date(),
    to: entry.to,
    from: entry.from ?? process.env.TWILIO_FROM_NUMBER ?? "",
    intent: entry.intent ?? "unknown",
    result: "blocked" as const,
    blockReason: entry.blockReason,
    actorUid: entry.actorUid ?? null
  };
}

/** Server-only. Failures must never change send behavior. Never store message body. */
export async function logBlockedSmsAttempt(entry: SmsAttemptLog): Promise<void> {
  const firebase = firebaseAdmin();
  if (!firebase) return;
  try {
    await firebase.db.collection(SMS_ATTEMPTS_COLLECTION).add(blockedSmsAttemptDoc(entry));
  } catch {
    // Logging must never change send behavior.
  }
}

export function logBlockedSmsAttemptSafe(entry: SmsAttemptLog): void {
  void logBlockedSmsAttempt(entry);
}

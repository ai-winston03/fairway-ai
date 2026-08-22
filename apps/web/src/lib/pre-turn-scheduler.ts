import { queuePreTurnSnackShackPrompt } from "@/lib/customer-bot";
import { readHeldMemberDirectory } from "@/lib/foreup-hold";
import { getConversationByMemberId, getOrCreateConversation } from "@/lib/inbox-store";
import {
  PRE_TURN_OUTREACH_WINDOW_MINUTES,
  minutesUntilTeeTime,
  type PreTurnOutreachReason
} from "@/lib/pre-turn-outreach";
import { queueStaffHold } from "@/lib/staff-holds";

export const PRE_TURN_SNACK_SHACK_JOB = "pre-turn-snack-shack";

export type PreTurnSnackShackSkipReason = PreTurnOutreachReason | "missing_phone" | "not_a_member";

export type PreTurnSnackShackCandidate = {
  memberId: string;
  teeTimeId: string;
  startsAt: string;
  shouldSend: boolean;
  reason: PreTurnSnackShackSkipReason;
  message: string | null;
  conversationId?: string;
};

export type PreTurnSnackShackJobResult = {
  code?: "hold_missing" | "hold_upcoming_missing";
  holdStatus: "missing" | "held";
  upcomingSynced: boolean;
  delivery: "queued";
  queued: number;
  skipped: number;
  candidates: PreTurnSnackShackCandidate[];
};

export type PreTurnSnackShackJobInput = {
  courseId: string;
  now?: Date;
  persist?: boolean;
};

function emptyResult(
  holdStatus: "missing" | "held",
  code?: PreTurnSnackShackJobResult["code"],
  upcomingSynced = false
): PreTurnSnackShackJobResult {
  return {
    code,
    holdStatus,
    upcomingSynced,
    delivery: "queued",
    queued: 0,
    skipped: 0,
    candidates: []
  };
}

function candidate(
  memberId: string,
  teeTimeId: string,
  startsAt: string,
  reason: PreTurnSnackShackSkipReason,
  extras: Partial<PreTurnSnackShackCandidate> = {}
): PreTurnSnackShackCandidate {
  return {
    memberId,
    teeTimeId,
    startsAt,
    shouldSend: false,
    reason,
    message: null,
    ...extras
  };
}

/**
 * Queues snack-shack prompts for held upcoming tee times in the pre-turn window.
 * Reads the ForeUp hold only. Does not live-pull ForeUp or send SMS.
 */
export async function runPreTurnSnackShackJob(
  input: PreTurnSnackShackJobInput
): Promise<PreTurnSnackShackJobResult> {
  const now = input.now ?? new Date();
  const persist = input.persist !== false;
  const directory = await readHeldMemberDirectory(input.courseId);
  if (!directory) return emptyResult("missing", "hold_missing");
  if (!directory.upcomingSynced) return emptyResult("missing", "hold_upcoming_missing", false);

  const candidates: PreTurnSnackShackCandidate[] = [];

  for (const customer of directory.customers) {
    const teeTimes = directory.upcomingByCustomerId[customer.id] ?? [];
    for (const teeTime of teeTimes) {
      const teeTimeId = teeTime.id ?? "";
      const startsAt = teeTime.startsAt ?? "";
      if (!customer.member) {
        candidates.push(candidate(customer.id, teeTimeId, startsAt, "not_a_member"));
        continue;
      }

      const minutesUntil = startsAt ? minutesUntilTeeTime(startsAt, now) : null;
      if (!teeTimeId || minutesUntil == null) {
        candidates.push(candidate(customer.id, teeTimeId, startsAt, "missing_tee_time"));
        continue;
      }
      if (minutesUntil <= 0) {
        candidates.push(candidate(customer.id, teeTimeId, startsAt, "after_the_turn"));
        continue;
      }
      if (minutesUntil > PRE_TURN_OUTREACH_WINDOW_MINUTES) {
        candidates.push(candidate(customer.id, teeTimeId, startsAt, "too_early"));
        continue;
      }
      if (!customer.phone) {
        candidates.push(candidate(customer.id, teeTimeId, startsAt, "missing_phone"));
        continue;
      }

      const existing = await getConversationByMemberId(customer.id);
      const conversation = existing ?? await getOrCreateConversation({
        memberId: customer.id,
        phone: customer.phone
      });
      const queued = await queuePreTurnSnackShackPrompt({
        conversation,
        teeTime: { id: teeTimeId, startsAt },
        member: { optOutText: customer.optOutText },
        persist,
        now
      });
      if (persist && queued.shouldSend && queued.conversation.botState) {
        await queueStaffHold({
          courseId: input.courseId,
          kind: "hold_snack_shack",
          conversationId: queued.conversation.id,
          memberId: customer.id,
          phone: customer.phone,
          state: queued.conversation.botState,
          nextActions: ["hold_snack_shack", "pre_turn_prompt"]
        });
      }
      candidates.push({
        memberId: customer.id,
        teeTimeId,
        startsAt,
        shouldSend: queued.shouldSend,
        reason: queued.reason,
        message: queued.message,
        conversationId: queued.conversation.id
      });
    }
  }

  const queued = candidates.filter((item) => item.shouldSend).length;
  return {
    holdStatus: "held",
    upcomingSynced: true,
    delivery: "queued",
    queued,
    skipped: candidates.length - queued,
    candidates
  };
}

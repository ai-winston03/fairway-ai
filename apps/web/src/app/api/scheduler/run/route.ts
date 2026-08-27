import { NextRequest, NextResponse } from "next/server";
import { syncForeupDailyHold } from "@/lib/foreup-reporting-sync";
import { getDueScheduledMessages } from "@/lib/member-directory";
import { PRE_TURN_SNACK_SHACK_JOB, runPreTurnSnackShackJob } from "@/lib/pre-turn-scheduler";
import { scheduledOutboundHold, smsSendingEnabled } from "@/lib/sms-provider";
import { verifiedStaff } from "@/lib/staff-access";

function schedulerAuthorized(request: NextRequest) {
  const secret = process.env.SCHEDULER_SECRET || process.env.FOREUP_SYNC_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!schedulerAuthorized(request) && !await verifiedStaff(request)) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { now?: string; jobs?: string[] };
  const now = body.now ? new Date(body.now) : new Date();
  const jobs = Array.isArray(body.jobs) && body.jobs.length ? body.jobs : ["messages"];

  const payload: Record<string, unknown> = {
    mode: "deterministic-script",
    aiUsed: false,
    jobs
  };

  if (jobs.includes("messages")) {
    const dueMessages = getDueScheduledMessages(now);
    payload.dueCount = dueMessages.length;
    payload.dueMessages = dueMessages;
    payload.note = "Cron should call this endpoint or the scheduler script. AI should only run when a deterministic parser marks a job needs_review.";
    if (!smsSendingEnabled()) {
      payload.sent = 0;
      payload.held = true;
      payload.note = "Sending is off.";
    }
  }

  if (jobs.includes("foreup-hold")) {
    const courseId = process.env.FOREUP_COURSE_ID, teeSheetId = process.env.FOREUP_TEESHEET_ID;
    if (!courseId || !teeSheetId) {
      return NextResponse.json({ error: "ForeUp course configuration is missing.", ...payload }, { status: 503 });
    }
    try {
      payload.foreupHold = await syncForeupDailyHold(courseId, teeSheetId);
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "ForeUp hold sync failed.",
        ...payload
      }, { status: 502 });
    }
  }

  if (jobs.includes(PRE_TURN_SNACK_SHACK_JOB)) {
    const courseId = process.env.FOREUP_COURSE_ID;
    if (!courseId) {
      return NextResponse.json({ error: "ForeUp course configuration is missing.", ...payload }, { status: 503 });
    }
    if (!smsSendingEnabled()) {
      payload.preTurnSnackShack = { delivery: "held", queued: 0, skipped: 0, reason: "Sending is off." };
    } else {
      payload.preTurnSnackShack = await runPreTurnSnackShackJob({ courseId, now });
    }
  }

  return NextResponse.json(scheduledOutboundHold(payload));
}

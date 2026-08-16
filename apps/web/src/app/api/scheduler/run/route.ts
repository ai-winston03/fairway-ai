import { NextRequest, NextResponse } from "next/server";
import { getDueScheduledMessages } from "@/lib/member-directory";
import { verifiedStaff } from "@/lib/staff-access";

function schedulerAuthorized(request: NextRequest) {
  const secret = process.env.SCHEDULER_SECRET || process.env.FOREUP_SYNC_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!schedulerAuthorized(request) && !await verifiedStaff(request)) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const now = body.now ? new Date(body.now) : new Date();
  const dueMessages = getDueScheduledMessages(now);

  return NextResponse.json({
    mode: "deterministic-script",
    aiUsed: false,
    dueCount: dueMessages.length,
    dueMessages,
    note:
      "Cron should call this endpoint or the scheduler script. AI should only run when a deterministic parser marks a job needs_review."
  });
}

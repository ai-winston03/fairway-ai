import { NextRequest, NextResponse } from "next/server";
import { getDueScheduledMessages } from "@/lib/member-directory";

export async function POST(request: NextRequest) {
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

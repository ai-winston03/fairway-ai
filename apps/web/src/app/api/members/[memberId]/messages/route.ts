import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memberHoldMissingPayload, readHeldMember } from "@/lib/foreup-hold";
import {
  appendMessage,
  getConversationByMemberId,
  getOrCreateConversation,
  listMessages
} from "@/lib/inbox-store";
import { logBlockedSmsAttemptSafe } from "@/lib/sms-attempts";
import { getSmsProviderStatus, sendSms, staffOutboundHeld } from "@/lib/sms-provider";
import { canMessageMember, canViewMemberThread } from "@/lib/authz";
import { verifiedStaff } from "@/lib/staff-access";

type RouteContext = { params: Promise<{ memberId: string }> };

const sendSchema = z.object({
  body: z.string().trim().min(1).max(1600)
});

async function heldMemberPhone(memberId: string) {
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) return { error: NextResponse.json({ connected: false, error: "ForeUp course configuration is missing." }, { status: 503 }) };
  const profile = await readHeldMember(courseId, memberId);
  if ("missing" in profile) {
    const payload = memberHoldMissingPayload(profile.missing);
    return { error: NextResponse.json(payload, { status: profile.missing === "directory" ? 503 : 404 }) };
  }
  if (!profile.member.phone) return { error: NextResponse.json({ connected: false, error: "This member has no phone number." }, { status: 409 }) };
  return { phone: profile.member.phone, optOutText: profile.member.optOutText };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const staff = await verifiedStaff(request);
  if (!staff) {
    return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  }
  const { memberId } = await context.params;
  const conversation = await getConversationByMemberId(memberId);
  if (conversation && !canViewMemberThread(staff, conversation.assignedStaffUids, staff.uid)) {
    return NextResponse.json({ connected: false, error: "This member thread is not assigned to you." }, { status: 403 });
  }
  if (!conversation && !canViewMemberThread(staff, [], staff.uid)) {
    return NextResponse.json({ connected: false, error: "This member thread is not assigned to you." }, { status: 403 });
  }
  const messages = conversation ? await listMessages(conversation.id) : [];
  return NextResponse.json({
    connected: true,
    sms: getSmsProviderStatus(),
    conversation,
    messages
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const staff = await verifiedStaff(request);
  if (!staff) {
    return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  }
  const { memberId } = await context.params;
  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ connected: false, error: "Message body is required." }, { status: 400 });
  }
  const held = await heldMemberPhone(memberId);
  if ("error" in held) return held.error;
  if (held.optOutText) {
    logBlockedSmsAttemptSafe({ to: held.phone, intent: "staff", actorUid: staff.uid, blockReason: "opt_out" });
    return NextResponse.json({
      connected: false,
      error: "ForeUp has this member opted out. Sending is disabled."
    }, { status: 403 });
  }
  const blocked = staffOutboundHeld();
  if (blocked) {
    logBlockedSmsAttemptSafe({ to: held.phone, intent: "staff", actorUid: staff.uid, blockReason: "kill_switch" });
    return NextResponse.json(blocked.body, { status: blocked.status });
  }
  const existing = await getConversationByMemberId(memberId);
  if (!canMessageMember(staff, existing?.assignedStaffUids ?? [], staff.uid)) {
    return NextResponse.json({ connected: false, error: "You can only text members assigned to you." }, { status: 403 });
  }
  const conversation = existing ?? await getOrCreateConversation({ memberId, phone: held.phone });
  if (conversation.automationStatus === "bot_active") {
    return NextResponse.json({
      connected: true,
      error: "Pause the bot before sending a staff reply."
    }, { status: 409 });
  }
  const sent = await sendSms({ to: conversation.phone, body: parsed.data.body, intent: "staff", actorUid: staff.uid });
  const saved = await appendMessage({
    conversation,
    direction: "outbound",
    author: "staff",
    body: parsed.data.body,
    status: sent.status,
    provider: sent.provider,
    providerSid: sent.sid
  });
  return NextResponse.json({
    connected: true,
    sms: getSmsProviderStatus(),
    conversation: saved.conversation,
    message: saved.message,
    send: sent
  });
}

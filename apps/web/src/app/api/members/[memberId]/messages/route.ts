import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cachedForeup } from "@/lib/foreup-cache";
import { foreup } from "@/lib/foreup-adapter";
import {
  appendMessage,
  getConversationByMemberId,
  getOrCreateConversation,
  listMessages
} from "@/lib/inbox-store";
import { getSmsProviderStatus, sendSms } from "@/lib/sms-provider";
import { canMessageMember, canViewMemberThread } from "@/lib/authz";
import { verifiedStaff } from "@/lib/staff-access";

type RouteContext = { params: Promise<{ memberId: string }> };

const sendSchema = z.object({
  body: z.string().trim().min(1).max(1600)
});

async function memberPhone(memberId: string) {
  const courseId = process.env.FOREUP_COURSE_ID;
  if (!courseId) return "";
  const customers = await cachedForeup(`members:${courseId}`, 120_000, () => foreup.listCustomers(courseId));
  return customers.find((customer) => customer.id === memberId)?.phone ?? "";
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
  const phone = await memberPhone(memberId);
  if (!phone) {
    return NextResponse.json({ connected: false, error: "This member has no phone number." }, { status: 409 });
  }
  const existing = await getConversationByMemberId(memberId);
  if (!canMessageMember(staff, existing?.assignedStaffUids ?? [], staff.uid)) {
    return NextResponse.json({ connected: false, error: "You can only text members assigned to you." }, { status: 403 });
  }
  const conversation = existing ?? await getOrCreateConversation({ memberId, phone });
  if (conversation.automationStatus === "bot_active") {
    return NextResponse.json({
      connected: true,
      error: "Pause the bot before sending a staff reply."
    }, { status: 409 });
  }
  const sent = await sendSms({ to: conversation.phone, body: parsed.data.body });
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

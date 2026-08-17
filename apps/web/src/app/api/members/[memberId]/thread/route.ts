import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memberHoldMissingPayload, readHeldMember } from "@/lib/foreup-hold";
import {
  assignStaffToConversation,
  draftBotReply,
  getConversationByMemberId,
  getOrCreateConversation,
  setAutomationStatus
} from "@/lib/inbox-store";
import { canClaimMemberThread, canMessageMember, canViewMemberThread } from "@/lib/authz";
import { verifiedStaff } from "@/lib/staff-access";

type RouteContext = { params: Promise<{ memberId: string }> };

const threadSchema = z.object({
  action: z.enum(["pause", "resume", "own", "draft", "assign"]),
  body: z.string().trim().optional(),
  staffUid: z.string().trim().min(1).optional()
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
  return { phone: profile.member.phone };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const staff = await verifiedStaff(request);
  if (!staff) {
    return NextResponse.json({ connected: false, error: "Sign in is required." }, { status: 401 });
  }
  const { memberId } = await context.params;
  const parsed = threadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ connected: false, error: "Unknown thread action." }, { status: 400 });
  }
  const existing = await getConversationByMemberId(memberId);
  const assigned = existing?.assignedStaffUids ?? [];
  if (parsed.data.action === "assign") {
    if (!canClaimMemberThread(staff)) {
      return NextResponse.json({ connected: false, error: "Only managers can assign member threads." }, { status: 403 });
    }
    const held = await heldMemberPhone(memberId);
    if ("error" in held) return held.error;
    const conversation = existing ?? await getOrCreateConversation({ memberId, phone: held.phone });
    const next = await assignStaffToConversation(conversation.id, parsed.data.staffUid || staff.uid);
    return NextResponse.json({ connected: true, conversation: next ?? conversation });
  }
  if (parsed.data.action === "draft") {
    if (!canViewMemberThread(staff, assigned, staff.uid)) {
      return NextResponse.json({ connected: false, error: "This member thread is not assigned to you." }, { status: 403 });
    }
    const held = await heldMemberPhone(memberId);
    if ("error" in held) return held.error;
    const conversation = existing ?? await getOrCreateConversation({ memberId, phone: held.phone });
    return NextResponse.json({
      connected: true,
      conversation,
      draft: draftBotReply(parsed.data.body || conversation.lastBody || "tee time")
    });
  }
  const canAct = parsed.data.action === "resume" || parsed.data.action === "pause" || parsed.data.action === "own"
    ? canClaimMemberThread(staff) || canMessageMember(staff, assigned, staff.uid)
    : false;
  if (!canAct) {
    return NextResponse.json({ connected: false, error: "This member thread is not assigned to you." }, { status: 403 });
  }
  const held = await heldMemberPhone(memberId);
  if ("error" in held) return held.error;
  const conversation = existing ?? await getOrCreateConversation({ memberId, phone: held.phone });
  const claimed = canClaimMemberThread(staff)
    ? await assignStaffToConversation(conversation.id, staff.uid) ?? conversation
    : conversation;
  const status = parsed.data.action === "resume" ? "bot_active" : parsed.data.action === "own" ? "staff_owned" : "staff_paused";
  const next = await setAutomationStatus(claimed.id, status);
  return NextResponse.json({ connected: true, conversation: next ?? { ...claimed, automationStatus: status } });
}

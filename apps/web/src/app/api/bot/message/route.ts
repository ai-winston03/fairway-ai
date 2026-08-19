import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleCustomerMessage } from "@/lib/customer-bot";
import { getOrCreateConversation } from "@/lib/inbox-store";
import { staffGuard } from "@/lib/staff-access";

const messageSchema = z.object({
  from: z.string().min(3),
  body: z.string().min(1),
  channel: z.enum(["sms", "web"]).default("sms"),
  persist: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  const access = await staffGuard(request, "member:message");
  if (access.error) return access.error;
  const payload = messageSchema.parse(await request.json());
  const conversation = await getOrCreateConversation({ phone: payload.from });
  const turn = await handleCustomerMessage({
    conversation,
    body: payload.body,
    persist: payload.persist
  });

  return NextResponse.json({
    reply: turn.reply,
    shouldReply: turn.shouldReply,
    booked: false,
    nextActions: turn.result.nextActions,
    channel: payload.channel,
    conversation: {
      id: turn.conversation.id,
      automationStatus: turn.conversation.automationStatus,
      phone: turn.conversation.phone,
      memberId: turn.conversation.memberId,
      phase: turn.result.state.phase,
      slots: turn.result.state.slots
    }
  });
}

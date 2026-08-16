import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBotReply } from "@/lib/mock-data";
import { staffGuard } from "@/lib/staff-access";

const messageSchema = z.object({
  from: z.string().min(3),
  body: z.string().min(1),
  channel: z.enum(["sms", "web"]).default("sms")
});

export async function POST(request: NextRequest) {
  const access = await staffGuard(request, "member:message");
  if (access.error) return access.error;
  const payload = messageSchema.parse(await request.json());

  return NextResponse.json({
    reply: createBotReply(payload.body),
    nextActions: ["identify_member", "check_availability", "ask_guest_cart_food"],
    channel: payload.channel
  });
}

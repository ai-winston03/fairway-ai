import { NextRequest, NextResponse } from "next/server";
import { handleCustomerMessage } from "@/lib/customer-bot";
import {
  appendMessage,
  getOrCreateConversation,
  type InboxConversation
} from "@/lib/inbox-store";
import { getSmsProviderStatus, inboundMaySendReply, sendSms, verifyTwilioSignature, type SmsSendResult } from "@/lib/sms-provider";
import { verifiedStaff } from "@/lib/staff-access";

function twiml(message?: string) {
  const body = message
    ? `<Response><Message>${escapeXml(message)}</Message></Response>`
    : "<Response></Response>";
  return new NextResponse(`<?xml version=\"1.0\" encoding=\"UTF-8\"?>${body}`, {
    headers: { "Content-Type": "text/xml" }
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&" + "amp;")
    .replaceAll("<", "&" + "lt;")
    .replaceAll(">", "&" + "gt;")
    .replaceAll('"', "&" + "quot;")
    .replaceAll("'", "&" + "apos;");
}

export async function POST(request: NextRequest) {
  // Twilio inbound is not a staff session. Never require Firebase sign-in here.
  // Always verify the provider signature and fail closed if it is missing.
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  const signature = request.headers.get("x-twilio-signature");
  const requestUrl = process.env.TWILIO_WEBHOOK_URL || request.url;
  if (!verifyTwilioSignature(requestUrl, params, signature)) {
    return new NextResponse("Invalid Twilio signature.", { status: 403 });
  }

  const from = params.From || "";
  const body = (params.Body || "").trim();
  const sid = params.MessageSid;
  if (!from || !body) return twiml();
  // Outbound allowlist must not drop inbound mail. Record the text; replies stay gated by inboundMaySendReply().

  const fallbackConversation: InboxConversation = {
    id: `phone_${from.replace(/\D/g, "").slice(-10) || "unknown"}`,
    phone: from,
    automationStatus: "bot_active",
    assignedStaffUids: [],
    unread: 0
  };

  let conversation: InboxConversation = fallbackConversation;
  try {
    conversation = await getOrCreateConversation({ phone: from });
  } catch {
    conversation = fallbackConversation;
  }

  try {
    const inbound = await appendMessage({
      conversation,
      direction: "inbound",
      author: "member",
      body,
      status: "received",
      provider: "twilio",
      providerSid: sid
    });
    conversation = inbound.conversation;
  } catch {
    // Keep the turn even if inbox persist fails.
  }

  if (!inboundMaySendReply()) return twiml();

  let turn;
  try {
    turn = await handleCustomerMessage({ conversation, body });
  } catch {
    turn = await handleCustomerMessage({ conversation, body, persist: false });
  }
  if (!turn.shouldReply || !turn.reply) return twiml();

  const sent: SmsSendResult = await sendSms({ to: turn.conversation.phone || from, body: turn.reply }).catch((): SmsSendResult => ({
    provider: "none",
    status: "failed"
  }));
  try {
    await appendMessage({
      conversation: turn.conversation,
      direction: "outbound",
      author: "bot",
      body: turn.reply,
      status: sent.status,
      provider: sent.provider,
      providerSid: sent.sid
    });
  } catch {
    // Delivery does not depend on inbox persist.
  }
  if (sent.sid || sent.status === "sent" || sent.status === "queued" && sent.provider === "twilio") {
    return twiml();
  }
  return twiml(turn.reply);
}

export async function GET(request: NextRequest) {
  if (!await verifiedStaff(request)) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  return NextResponse.json(getSmsProviderStatus());
}

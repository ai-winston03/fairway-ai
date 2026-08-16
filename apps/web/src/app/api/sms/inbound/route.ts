import { NextRequest, NextResponse } from "next/server";
import {
  appendMessage,
  draftBotReply,
  getOrCreateConversation,
  mentionsHandoff,
  setAutomationStatus,
  staffHoldMessage
} from "@/lib/inbox-store";
import { getSmsProviderStatus, sendSms, twilioConfigured, verifyTwilioSignature } from "@/lib/sms-provider";
import { verifiedStaff } from "@/lib/staff-access";

function twiml(message?: string) {
  const body = message
    ? `<Response><Message>${escapeXml(message)}</Message></Response>`
    : "<Response></Response>";
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
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
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  const signature = request.headers.get("x-twilio-signature");
  const requestUrl = process.env.TWILIO_WEBHOOK_URL || request.url;
  if (twilioConfigured() && !verifyTwilioSignature(requestUrl, params, signature)) {
    return new NextResponse("Invalid Twilio signature.", { status: 403 });
  }

  const from = params.From || "";
  const body = (params.Body || "").trim();
  const sid = params.MessageSid;
  if (!from || !body) return twiml();

  let conversation = await getOrCreateConversation({ phone: from });
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

  const handoff = mentionsHandoff(body);
  if (handoff && conversation.automationStatus === "bot_active") {
    conversation = await setAutomationStatus(conversation.id, "staff_paused") ?? conversation;
    const hold = staffHoldMessage();
    const sent = await sendSms({ to: conversation.phone, body: hold });
    await appendMessage({
      conversation,
      direction: "outbound",
      author: "bot",
      body: hold,
      status: sent.status,
      provider: sent.provider,
      providerSid: sent.sid
    });
    return twiml();
  }

  if (conversation.automationStatus !== "bot_active") return twiml();

  const reply = draftBotReply(body);
  const sent = await sendSms({ to: conversation.phone, body: reply });
  await appendMessage({
    conversation,
    direction: "outbound",
    author: "bot",
    body: reply,
    status: sent.status,
    provider: sent.provider,
    providerSid: sent.sid
  });
  return twiml();
}

export async function GET(request: NextRequest) {
  if (!await verifiedStaff(request)) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  return NextResponse.json(getSmsProviderStatus());
}

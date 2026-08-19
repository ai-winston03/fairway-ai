import { NextRequest, NextResponse } from "next/server";
import { handleCustomerMessage } from "@/lib/customer-bot";
import {
  appendMessage,
  getOrCreateConversation
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

  const turn = await handleCustomerMessage({ conversation, body });
  if (!turn.shouldReply || !turn.reply) return twiml();

  const sent = await sendSms({ to: turn.conversation.phone, body: turn.reply });
  await appendMessage({
    conversation: turn.conversation,
    direction: "outbound",
    author: "bot",
    body: turn.reply,
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

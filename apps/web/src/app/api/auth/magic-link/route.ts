import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { firebaseAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const lastRequestByEmail = new Map<string, number>();

function isEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }

function genericSuccess() {
  // Do not reveal who is invited or whether a specific address has an account.
  return NextResponse.json({ sent: true, message: "If that address has staff access, a sign-in link is on its way." });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });

  const now = Date.now();
  if (now - (lastRequestByEmail.get(email) ?? 0) < RATE_WINDOW_MS) return genericSuccess();

  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Secure sign-in is temporarily unavailable." }, { status: 503 });

  const bootstrapEmail = (process.env.FAIRWAY_BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const invite = await firebase.db.collection("staffInvites").doc(email).get();
  if (email !== bootstrapEmail && !invite.exists) return genericSuccess();

  const smtpPassword = process.env.FAIRWAY_SMTP_PASSWORD;
  const smtpFrom = process.env.FAIRWAY_SMTP_FROM ?? "Fairway AI <ai.winston@icloud.com>";
  if (!smtpPassword) return NextResponse.json({ error: "Secure email delivery is temporarily unavailable." }, { status: 503 });

  // App Hosting proxies requests to an internal Cloud Run hostname. Firebase
  // only accepts the public, allowlisted return URL for its action links.
  const origin = process.env.FAIRWAY_AI_BASE_URL ?? new URL(request.url).origin;
  const link = await firebase.auth.generateSignInWithEmailLink(email, { url: origin, handleCodeInApp: true });
  const transport = nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    auth: { user: "ai.winston@icloud.com", pass: smtpPassword },
    requireTLS: true
  });
  await transport.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Your Fairway AI sign-in link",
    text: `Use this one-time link to sign in to Fairway AI:\n\n${link}\n\nThis link is only for ${email}.`,
    html: `<p>Use this one-time link to sign in to Fairway AI:</p><p><a href="${link}">Sign in to Fairway AI</a></p><p>This link is only for ${email}.</p>`
  });
  lastRequestByEmail.set(email, now);
  return genericSuccess();
}

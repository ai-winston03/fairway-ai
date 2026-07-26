import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const lastRequestByEmail = new Map<string, number>();

function isEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }
function genericSuccess() { return NextResponse.json({ sent: true }); }

/**
 * Firebase Auth owns both the action code and email delivery.  Do not relay
 * staff authentication through a personal mailbox or SMTP account.
 */
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

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Firebase Authentication is not configured." }, { status: 503 });
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestType: "EMAIL_SIGNIN",
      email,
      continueUrl: "https://fairway-ai--fairway-ai-yuba.us-central1.hosted.app",
      canHandleCodeInApp: true
    })
  });
  if (!response.ok) return NextResponse.json({ error: "Firebase could not send the sign-in email. Please try again." }, { status: 502 });
  lastRequestByEmail.set(email, now);
  return genericSuccess();
}

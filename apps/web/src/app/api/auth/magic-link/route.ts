import { NextRequest, NextResponse } from "next/server";
import { demoAccessProfiles } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const profile = demoAccessProfiles.find((user) => user.email.toLowerCase() === email);

  return NextResponse.json({
    mode: "mock",
    sent: Boolean(profile),
    email,
    profile: profile ?? null,
    note:
      "Production should send a signed, expiring magic link through Auth.js, Clerk, or a transactional email provider."
  });
}

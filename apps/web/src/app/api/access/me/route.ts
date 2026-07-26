import { NextResponse } from "next/server";
import { verifiedStaff } from "@/lib/staff-access";

export async function GET(request: Request) {
  const profile = await verifiedStaff(request);
  if (!profile) return NextResponse.json({ error: "This account has not been granted Fairway access." }, { status: 403 });
  const response = NextResponse.json({ profile });
  const token = request.headers.get("authorization")?.startsWith("Bearer ") ? request.headers.get("authorization")?.slice(7) : null;
  if (token) response.cookies.set("fairway_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 50 * 60, path: "/" });
  return response;
}

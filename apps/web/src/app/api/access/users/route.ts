import { NextResponse } from "next/server";
import { Department, StaffRole } from "@/lib/authz";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { mayManageUsers, profileForRole, verifiedStaff } from "@/lib/staff-access";

async function manager(request: Request) {
  const profile = await verifiedStaff(request);
  return profile && mayManageUsers(profile) ? profile : null;
}

export async function GET(request: Request) {
  if (!await manager(request)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const users = await firebase.db.collection("staffUsers").orderBy("email").get();
  const invites = await firebase.db.collection("staffInvites").orderBy("email").get();
  return NextResponse.json({ users: users.docs.map((doc) => ({ uid: doc.id, ...doc.data() })), invites: invites.docs.map((doc) => doc.data()) });
}

export async function POST(request: Request) {
  if (!await manager(request)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const body = await request.json() as { email?: string; role?: StaffRole; department?: Department };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !body.role) return NextResponse.json({ error: "A valid email and role are required." }, { status: 400 });
  const profile = profileForRole("", email, body.role, body.department);
  await firebase.db.collection("staffInvites").doc(email).set({ ...profile, email, invitedAt: Date.now() });
  return NextResponse.json({ invite: { ...profile, email } }, { status: 201 });
}

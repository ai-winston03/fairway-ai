import { NextResponse } from "next/server";
import { Department, StaffRole } from "@/lib/authz";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { StaffRecord, mayManageUsers, profileForRole, verifiedStaff } from "@/lib/staff-access";

const roles: StaffRole[] = ["employee", "department-manager", "owner", "admin"];

async function manager(request: Request) {
  const profile = await verifiedStaff(request);
  return profile && mayManageUsers(profile) ? profile : null;
}

function serialize(uid: string, data: Record<string, unknown>) {
  return { uid, ...data };
}

async function remainingActiveAdmins(excludeUid?: string) {
  const firebase = firebaseAdmin();
  if (!firebase) return 0;
  const users = await firebase.db.collection("staffUsers").where("role", "in", ["admin", "owner"]).get();
  return users.docs.filter((doc) => {
    if (excludeUid && doc.id === excludeUid) return false;
    const value = doc.data() as Partial<StaffRecord>;
    return value.status !== "disabled";
  }).length;
}

export async function GET(request: Request) {
  if (!await manager(request)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const users = await firebase.db.collection("staffUsers").orderBy("email").get();
  const invites = await firebase.db.collection("staffInvites").orderBy("email").get();
  return NextResponse.json({
    users: users.docs.map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>)),
    invites: invites.docs.map((doc) => doc.data())
  });
}

export async function POST(request: Request) {
  if (!await manager(request)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const body = await request.json() as { email?: string; role?: StaffRole; department?: Department };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !body.role || !roles.includes(body.role)) {
    return NextResponse.json({ error: "A valid email and role are required." }, { status: 400 });
  }
  const profile = profileForRole("", email, body.role, body.department);
  await firebase.db.collection("staffInvites").doc(email).set({ ...profile, email, invitedAt: Date.now() });
  return NextResponse.json({ invite: { ...profile, email } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await manager(request);
  if (!actor) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const body = await request.json() as {
    uid?: string;
    email?: string;
    role?: StaffRole;
    status?: "active" | "disabled";
    department?: Department;
  };
  const email = body.email?.trim().toLowerCase();

  if (email && !body.uid) {
    const inviteRef = firebase.db.collection("staffInvites").doc(email);
    const invite = await inviteRef.get();
    if (!invite.exists) return NextResponse.json({ error: "Invitation was not found." }, { status: 404 });
    if (body.role && !roles.includes(body.role)) return NextResponse.json({ error: "A valid role is required." }, { status: 400 });
    const current = invite.data() as Partial<StaffRecord>;
    const profile = profileForRole(current.name ?? "", email, body.role ?? (current.role as StaffRole) ?? "employee", body.department ?? current.department);
    await inviteRef.set({ ...current, ...profile, email }, { merge: true });
    return NextResponse.json({ invite: { ...current, ...profile, email } });
  }

  if (!body.uid) return NextResponse.json({ error: "A staff user id is required." }, { status: 400 });
  if (body.uid === actor.uid && (body.status === "disabled" || (body.role && body.role !== actor.role))) {
    return NextResponse.json({ error: "You cannot disable or change your own access." }, { status: 400 });
  }
  const userRef = firebase.db.collection("staffUsers").doc(body.uid);
  const existing = await userRef.get();
  if (!existing.exists) return NextResponse.json({ error: "Staff user was not found." }, { status: 404 });
  const current = existing.data() as Omit<StaffRecord, "uid">;
  const nextRole = body.role && roles.includes(body.role) ? body.role : current.role;
  const nextStatus = body.status ?? current.status ?? "active";
  if ((current.role === "admin" || current.role === "owner") && (nextStatus === "disabled" || (nextRole !== "admin" && nextRole !== "owner"))) {
    if (await remainingActiveAdmins(body.uid) < 1) {
      return NextResponse.json({ error: "Keep at least one active admin or owner." }, { status: 400 });
    }
  }
  const profile = profileForRole(current.name, current.email, nextRole, body.department ?? current.department);
  const record = { ...current, ...profile, status: nextStatus };
  await userRef.set({ ...record, updatedAt: Date.now() }, { merge: true });
  if (nextStatus === "disabled") {
    try { await firebase.auth.revokeRefreshTokens(body.uid); } catch { /* user may not have signed in yet */ }
  }
  return NextResponse.json({ user: { uid: body.uid, ...record } });
}

export async function DELETE(request: Request) {
  const actor = await manager(request);
  if (!actor) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const firebase = firebaseAdmin();
  if (!firebase) return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  const body = await request.json() as { uid?: string; email?: string };
  const email = body.email?.trim().toLowerCase();

  if (email && !body.uid) {
    await firebase.db.collection("staffInvites").doc(email).delete();
    return NextResponse.json({ revoked: email });
  }

  if (!body.uid) return NextResponse.json({ error: "A staff user id or invite email is required." }, { status: 400 });
  if (body.uid === actor.uid) return NextResponse.json({ error: "You cannot revoke your own access." }, { status: 400 });
  const userRef = firebase.db.collection("staffUsers").doc(body.uid);
  const existing = await userRef.get();
  if (!existing.exists) return NextResponse.json({ error: "Staff user was not found." }, { status: 404 });
  const current = existing.data() as Omit<StaffRecord, "uid">;
  if ((current.role === "admin" || current.role === "owner") && await remainingActiveAdmins(body.uid) < 1) {
    return NextResponse.json({ error: "Keep at least one active admin or owner." }, { status: 400 });
  }
  await userRef.set({ ...current, status: "disabled", updatedAt: Date.now() }, { merge: true });
  try { await firebase.auth.revokeRefreshTokens(body.uid); } catch { /* ignore missing auth user */ }
  return NextResponse.json({ user: { uid: body.uid, ...current, status: "disabled" } });
}

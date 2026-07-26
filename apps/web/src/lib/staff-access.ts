import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { Department, Permission, StaffRole, TeamAccessProfile, demoAccessProfiles } from "@/lib/authz";

export type StaffRecord = TeamAccessProfile & { uid: string; status: "active" | "disabled"; createdAt?: unknown; updatedAt?: unknown };

const defaultDepartment: Record<StaffRole, Department> = {
  employee: "operations", "department-manager": "operations", owner: "operations", admin: "operations"
};

export function profileForRole(name: string, email: string, role: StaffRole, department: Department = defaultDepartment[role]): TeamAccessProfile {
  const template = demoAccessProfiles.find((profile) => profile.role === role) ?? demoAccessProfiles[0];
  return { ...template, name: name || template.name, email: email.toLowerCase(), role, department, permissions: [...template.permissions], kpiGroups: [...template.kpiGroups] };
}

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

export async function verifiedStaff(request: Request): Promise<StaffRecord | null> {
  const authorization = request.headers.get("authorization");
  const cookieToken = request.headers.get("cookie")?.match(/(?:^|; )fairway_session=([^;]+)/)?.[1];
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookieToken ? decodeURIComponent(cookieToken) : null;
  const firebase = firebaseAdmin();
  if (!token || !firebase) {
    // The local Next dev server is for development only. App Hosting never
    // takes this branch: it always requires a verified Firebase user.
    if (process.env.NODE_ENV === "development" && process.env.ALLOW_LOCAL_DEMO !== "false") {
      return { ...profileForRole("Local developer", "local@fairway.test", "admin"), uid: "local-development", status: "active" };
    }
    return null;
  }
  try {
    const decoded = await firebase.auth.verifyIdToken(token);
    const doc = firebase.db.collection("staffUsers").doc(decoded.uid);
    const existing = await doc.get();
    if (existing.exists) {
      const value = existing.data() as Omit<StaffRecord, "uid">;
      return value.status === "active" ? { ...value, uid: decoded.uid } : null;
    }

    const email = normalizeEmail(decoded.email ?? "");
    const bootstrap = normalizeEmail(process.env.FAIRWAY_BOOTSTRAP_ADMIN_EMAIL ?? "");
    const invite = email ? await firebase.db.collection("staffInvites").doc(email).get() : null;
    if (email && (email === bootstrap || invite?.exists)) {
      const invited = invite?.data() as Partial<StaffRecord> | undefined;
      const profile = profileForRole(decoded.name ?? "", email, (email === bootstrap ? "admin" : invited?.role ?? "employee") as StaffRole, invited?.department as Department | undefined);
      const record: Omit<StaffRecord, "uid"> = { ...profile, status: "active" };
      await doc.set({ ...record, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      if (invite?.exists) await invite.ref.delete();
      return { ...record, uid: decoded.uid };
    }
  } catch {
    return null;
  }
  return null;
}

export function mayManageUsers(profile: StaffRecord) { return profile.permissions.includes("users:manage" as Permission); }

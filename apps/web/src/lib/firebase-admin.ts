import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDataConnect } from "firebase-admin/data-connect";
import { getFirestore } from "firebase-admin/firestore";
import { connectorConfig } from "@dataconnect/admin-generated";

/**
 * App Hosting supplies application-default credentials.  The explicit values
 * are only for local development with a service account; neither belongs in
 * the browser bundle.
 */
export function resolveAdminProjectId() {
  return process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || "";
}

function adminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = resolveAdminProjectId();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return initializeApp(
    projectId && clientEmail && privateKey
      ? { credential: cert({ projectId, clientEmail, privateKey }), projectId }
      : { credential: applicationDefault(), ...(projectId ? { projectId } : {}) }
  );
}

export function firebaseAdmin() {
  try {
    return { db: getFirestore(adminApp()), auth: getAuth(adminApp()) };
  } catch {
    // The local dashboard remains usable without Firebase credentials.  A
    // production deployment must configure Firebase; callers fail closed for
    // staff access and use the in-process cache only for local development.
    return null;
  }
}

/** Server-only connector for Firebase Data Connect / Cloud SQL Postgres. */
export function fairwayDataConnect() {
  try {
    return getDataConnect(connectorConfig, adminApp());
  } catch {
    return null;
  }
}

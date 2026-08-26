import { afterEach, describe, expect, it } from "vitest";
import { resolveAdminProjectId } from "./firebase-admin";

const keys = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function restore() {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(restore);

describe("resolveAdminProjectId", () => {
  it("prefers the admin project id, then public Firebase project id", () => {
    delete process.env.FIREBASE_ADMIN_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "fairway-ai-yuba";
    expect(resolveAdminProjectId()).toBe("fairway-ai-yuba");

    process.env.FIREBASE_ADMIN_PROJECT_ID = "admin-project";
    expect(resolveAdminProjectId()).toBe("admin-project");
  });
});

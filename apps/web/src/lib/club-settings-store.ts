import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { ClubSettings, defaultClubSettings, normalizeClubSettings } from "@/lib/club-settings";

const memory = new Map<string, ClubSettings>();

function withUpdatedAt(data: Record<string, unknown>) {
  const value = data.updatedAt;
  if (value instanceof Timestamp) return { ...data, updatedAt: value.toDate().toISOString() };
  return data;
}

export async function readClubSettings(courseId: string): Promise<ClubSettings> {
  const firebase = firebaseAdmin();
  if (firebase) {
    try {
      const snapshot = await firebase.db.collection("clubSettings").doc(courseId).get();
      if (snapshot.exists) {
        const settings = normalizeClubSettings(courseId, withUpdatedAt(snapshot.data() as Record<string, unknown>));
        memory.set(courseId, settings);
        return settings;
      }
    } catch {
      // A settings outage must not invent a second local file store.
    }
  }
  return memory.get(courseId) ?? defaultClubSettings(courseId);
}

export async function writeClubSettings(input: ClubSettings): Promise<ClubSettings> {
  const settings = normalizeClubSettings(input.courseId, input);
  memory.set(settings.courseId, settings);
  const firebase = firebaseAdmin();
  if (!firebase) return { ...settings, updatedAt: settings.updatedAt ?? new Date().toISOString() };
  await firebase.db.collection("clubSettings").doc(settings.courseId).set({
    courseId: settings.courseId,
    proShopPhone: settings.proShopPhone,
    restaurantHours: settings.restaurantHours,
    faq: settings.faq,
    membersOnlyMessage: settings.membersOnlyMessage,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ...settings, updatedAt: new Date().toISOString() };
}

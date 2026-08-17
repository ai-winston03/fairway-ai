import { createHash } from "node:crypto";
import { firebaseAdmin } from "@/lib/firebase-admin";

type CacheEntry<T> = { expiresAt: number; value: T };
const memoryCache = new Map<string, CacheEntry<unknown>>();

function keyId(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Sync-job helper only. Request routes (dashboard, members, member threads)
 * must read the durable hold and must not call this on a cache miss.
 * Firestore makes a scheduled pull survive App Hosting recycling; memory keeps
 * repeat sync reads inside one job fast.
 */
export async function cachedForeup<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const inMemory = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (inMemory && inMemory.expiresAt > now) return inMemory.value;

  const firebase = firebaseAdmin();
  const ref = firebase?.db.collection("foreupCache").doc(keyId(key));
  if (ref) {
    try {
      const snapshot = await ref.get();
      const cached = snapshot.data();
      if (cached && typeof cached.payload === "string" && Number(cached.expiresAt) > now) {
        const value = JSON.parse(cached.payload) as T;
        memoryCache.set(key, { value, expiresAt: Number(cached.expiresAt) });
        return value;
      }
    } catch {
      // A cache outage must never take down live ForeUp reads.
    }
  }

  const value = await load();
  const expiresAt = now + ttlMs;
  memoryCache.set(key, { value, expiresAt });
  if (ref) {
    void ref.set({ key, payload: JSON.stringify(value), refreshedAt: now, expiresAt }, { merge: true }).catch(() => undefined);
  }
  return value;
}

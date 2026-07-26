import { createHash } from "node:crypto";
import { firebaseAdmin } from "@/lib/firebase-admin";

type CacheEntry<T> = { expiresAt: number; value: T };
const memoryCache = new Map<string, CacheEntry<unknown>>();

function keyId(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Read-through cache for ForeUp.  Firestore makes this survive App Hosting
 * instance recycling; memory keeps repeat reads within one request path fast.
 * The caller controls freshness by endpoint: tee sheets are short-lived,
 * member directory medium-lived, and closed reporting periods long-lived.
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

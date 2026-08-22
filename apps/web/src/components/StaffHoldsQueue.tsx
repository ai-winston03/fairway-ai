"use client";

import { ClipboardList, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { StaffHold } from "@/lib/staff-holds";

function apiPath(path: string) {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? `/fairwayai${path}` : path;
}

export function StaffHoldsQueue() {
  const [holds, setHolds] = useState<StaffHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath("/api/staff-holds"), { cache: "no-store" });
      const payload = await response.json() as { connected?: boolean; holds?: StaffHold[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load staff holds.");
      setHolds(payload.holds ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load staff holds.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="staff-holds" aria-label="Staff fulfillment holds">
      <header className="member-workspace-header">
        <div>
          <div className="eyebrow">Firestore queue</div>
          <h3>Fulfillment holds</h3>
          <p>Queued snack-shack and booking requests. Drafts stay queued. This view does not send SMS or mark a hold sent.</p>
        </div>
        <button aria-label="Refresh staff holds" className="refresh-report" onClick={() => void load()} type="button">
          <RefreshCw size={14} />
        </button>
      </header>
      {loading ? <section className="empty-area"><ClipboardList size={24} /><strong>Loading staff holds</strong><span>Reading the Firestore staffHolds collection.</span></section> : null}
      {error ? <section className="empty-area"><ClipboardList size={24} /><strong>Staff holds need attention</strong><span>{error}</span></section> : null}
      {!loading && !error && !holds.length ? (
        <section className="empty-area">
          <ClipboardList size={24} />
          <strong>No queued holds</strong>
          <span>When a member confirms a request or a snack-shack order, it appears here as queued.</span>
        </section>
      ) : null}
      {!loading && !error && holds.length ? (
        <div className="staff-hold-list">
          {holds.map((hold) => (
            <article className="staff-hold-card" key={hold.id}>
              <div>
                <strong>{hold.kind === "hold_snack_shack" ? "Snack shack" : "Booking request"}</strong>
                <span>{hold.summary}</span>
                <small>{hold.phone}{hold.memberId ? ` · ${hold.memberId}` : ""} · {formatHoldTime(hold.createdAt)}</small>
              </div>
              <em>queued</em>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatHoldTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(date);
}

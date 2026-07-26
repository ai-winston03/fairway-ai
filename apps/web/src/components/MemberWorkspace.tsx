"use client";

import { CalendarDays, ChevronRight, MessageSquareText, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  membershipGroups: string[];
  accountBalance: number;
  optOutText: boolean;
  city: string;
  state: string;
  handicap: string;
};

type TeeTime = { id: string; startsAt: string; title: string; players: number; carts: number; status: string };
type MemberProfileResponse = { connected: boolean; member?: Member; teeTimes?: TeeTime[]; syncedAt?: string; error?: string };

function apiPath(path: string) {
  // Tailscale exposes the app beneath /fairwayai; local Next development is served at root.
  return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? `/fairwayai${path}` : path;
}

export function MemberWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return members;
    return members.filter((member) => [member.name, member.phone, member.email, ...member.membershipGroups].join(" ").toLowerCase().includes(value));
  }, [members, query]);
  const selected = members.find((member) => member.id === selectedId) ?? filtered[0];

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath("/api/members"), { cache: "no-store" });
      const payload = await response.json() as { connected: boolean; members?: Member[]; error?: string };
      if (!payload.connected) throw new Error(payload.error ?? "ForeUp member sync is unavailable.");
      const next = payload.members ?? [];
      setMembers(next);
      setSelectedId((current) => current && next.some((member) => member.id === current) ? current : next[0]?.id ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ForeUp members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMembers(); }, []);
  useEffect(() => {
    if (!selected?.id) { setProfile(null); return; }
    const controller = new AbortController();
    setLoadingProfile(true);
    fetch(apiPath(`/api/members/${selected.id}`), { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: MemberProfileResponse) => setProfile(payload))
      .catch((profileError: unknown) => {
        if ((profileError as { name?: string }).name !== "AbortError") setProfile({ connected: false, error: "Unable to load the member profile." });
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingProfile(false); });
    return () => controller.abort();
  }, [selected?.id]);

  if (loading) return <section className="empty-area"><Users size={24} /><strong>Loading member directory</strong><span>Reading current records from ForeUp.</span></section>;
  if (error) return <section className="empty-area"><Users size={24} /><strong>Member directory needs attention</strong><span>{error}</span></section>;

  return <section className="member-workspace" aria-label="Member directory and conversations">
    <header className="member-workspace-header">
      <div><div className="eyebrow">Live ForeUp directory</div><h3>Member conversations</h3><p>Search a member, review their next tee times, then open their SMS thread.</p></div>
      <button className="refresh-report" aria-label="Refresh member directory" onClick={() => void loadMembers()} title="Refresh directory" type="button"><RefreshCw size={14} /></button>
    </header>
    <div className="member-workspace-grid">
      <aside className="member-search-panel">
        <label className="member-search"><Search size={16} /><input aria-label="Search members" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, or email" /></label>
        <span className="member-count">{filtered.length} members</span>
        <div className="member-result-list">
          {filtered.map((member) => <button className={selected?.id === member.id ? "selected" : ""} key={member.id} onClick={() => setSelectedId(member.id)} type="button"><span className="member-initials">{initials(member.name)}</span><span><strong>{member.name}</strong><small>{member.membershipGroups.join(" · ") || "Member"}</small></span><ChevronRight size={15} /></button>)}
          {!filtered.length && <p className="member-empty">No member matches that search.</p>}
        </div>
      </aside>
      <section className="member-detail-panel">
        {selected ? <>
          <div className="member-detail-heading"><div><h3>{selected.name}</h3><span>{selected.phone || "No phone on file"} · {selected.email || "No email on file"}</span></div><span className={selected.optOutText ? "sms-state blocked" : "sms-state"}><ShieldCheck size={14} />{selected.optOutText ? "SMS suppressed" : "SMS eligible"}</span></div>
          <div className="member-fact-row"><span>{selected.membershipGroups.join(" · ") || "Member"}</span><span>Handicap {selected.handicap || "—"}</span><span>{[selected.city, selected.state].filter(Boolean).join(", ") || "Location unavailable"}</span></div>
          <div className="member-tee-times"><div className="member-section-title"><CalendarDays size={16} /><strong>Scheduled tee times</strong><small>Next 90 days</small></div>{loadingProfile ? <p>Loading tee times…</p> : profile?.connected ? profile.teeTimes?.length ? <div className="tee-time-list">{profile.teeTimes.map((teeTime) => <article key={teeTime.id}><strong>{formatTeeTime(teeTime.startsAt)}</strong><span>{teeTime.title} · {teeTime.players} players · {teeTime.carts} carts</span><small>{teeTime.status}</small></article>)}</div> : <p>No upcoming tee times in ForeUp.</p> : <p>{profile?.error ?? "No member profile loaded."}</p>}</div>
          <div className="member-thread-ready"><MessageSquareText size={18} /><div><strong>SMS thread</strong><p>{selected.optOutText ? "ForeUp has this member opted out. Sending is disabled." : "Two-way SMS will activate here when the Twilio number and webhook are connected."}</p></div><button className="button secondary" disabled type="button">Twilio not connected</button></div>
        </> : <div className="empty-state"><Users size={22} /><span>Select a member to view their profile.</span></div>}
      </section>
    </div>
  </section>;
}

function initials(name: string) { return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function formatTeeTime(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

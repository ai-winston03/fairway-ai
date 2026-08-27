"use client";

import { CalendarDays, ChevronRight, MessageSquareText, PauseCircle, PlayCircle, ReceiptText, RefreshCw, Search, Send, ShieldCheck, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { memberSmsBadge, staffComposerState } from "@/lib/sms-held-ui";

type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  membershipGroups: string[];
  accountBalance: number;
  invoiceBalance: number;
  optOutText: boolean;
  optOutEmail: boolean;
  city: string;
  state: string;
  handicap: string;
};

type TeeTime = { id: string; startsAt: string; title: string; players: number; carts: number; status: string };
type MemberProfileResponse = { connected: boolean; member?: Member; teeTimes?: TeeTime[]; teeTimesStatus?: "held" | "missing"; syncedAt?: string; error?: string };
type ThreadMessage = {
  id: string;
  author: "member" | "bot" | "staff";
  body: string;
  status: string;
  createdAt: string;
};
type ThreadConversation = { id: string; automationStatus: "bot_active" | "staff_paused" | "staff_owned"; phone: string };
type SmsStatus = { connected: boolean; sendingEnabled?: boolean; provider: string; nextAction: string };

function apiPath(path: string) {
  // Tailscale exposes the app beneath /fairwayai; local Next development is served at root.
  return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? `/fairwayai${path}` : path;
}

export function MemberWorkspace() {
  const [members, setMembers] = useState<Member[]>([]);
  const [directorySyncedAt, setDirectorySyncedAt] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [conversation, setConversation] = useState<ThreadConversation | null>(null);
  const [sms, setSms] = useState<SmsStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [threadBusy, setThreadBusy] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return members;
    return members.filter((member) => [member.name, member.phone, member.email, ...member.membershipGroups].join(" ").toLowerCase().includes(value));
  }, [members, query]);
  const selected = members.find((member) => member.id === selectedId) ?? filtered[0];
  const botOwnsThread = conversation?.automationStatus === "bot_active";
  const sendingEnabled = sms?.sendingEnabled === true;
  const badge = selected
    ? memberSmsBadge({ optOutText: selected.optOutText, sendingEnabled, connected: sms?.connected === true })
    : null;
  const composer = staffComposerState({
    optOutText: selected?.optOutText === true,
    sendingEnabled,
    botOwnsThread,
    threadBusy,
    draft
  });

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath("/api/members"), { cache: "no-store" });
      const payload = await response.json() as { connected: boolean; members?: Member[]; syncedAt?: string; error?: string };
      if (!payload.connected) throw new Error(payload.error ?? "Member directory is not synced yet. Run the daily ForeUp hold.");
      const next = payload.members ?? [];
      setDirectorySyncedAt(payload.syncedAt ?? null);
      setMembers(next);
      setSelectedId((current) => current && next.some((member) => member.id === current) ? current : next[0]?.id ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ForeUp members.");
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(memberId: string, signal?: AbortSignal) {
    const response = await fetch(apiPath(`/api/members/${memberId}/messages`), { cache: "no-store", signal });
    const payload = await response.json() as { conversation?: ThreadConversation | null; messages?: ThreadMessage[]; sms?: SmsStatus; error?: string };
    if (signal?.aborted) return;
    setConversation(payload.conversation ?? null);
    setMessages(payload.messages ?? []);
    setSms(payload.sms ?? null);
    setThreadError(payload.error ?? null);
  }

  async function runThreadAction(action: "pause" | "resume" | "own" | "draft") {
    if (!selected) return;
    setThreadBusy(true);
    setThreadError(null);
    try {
      const response = await fetch(apiPath(`/api/members/${selected.id}/thread`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, body: draft })
      });
      const payload = await response.json() as { conversation?: ThreadConversation; draft?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Thread update failed.");
      if (payload.conversation) setConversation(payload.conversation);
      if (payload.draft) setDraft(payload.draft);
    } catch (actionError) {
      setThreadError(actionError instanceof Error ? actionError.message : "Thread update failed.");
    } finally {
      setThreadBusy(false);
    }
  }

  async function sendStaffMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim() || selected.optOutText || botOwnsThread || !sendingEnabled) return;
    setThreadBusy(true);
    setThreadError(null);
    try {
      const response = await fetch(apiPath(`/api/members/${selected.id}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Send failed.");
      setDraft("");
      await loadThread(selected.id);
    } catch (sendError) {
      setThreadError(sendError instanceof Error ? sendError.message : "Send failed.");
    } finally {
      setThreadBusy(false);
    }
  }

  useEffect(() => { void loadMembers(); }, []);
  useEffect(() => {
    if (!selected?.id) { setProfile(null); setMessages([]); setConversation(null); return; }
    const controller = new AbortController();
    setLoadingProfile(true);
    fetch(apiPath(`/api/members/${selected.id}`), { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: MemberProfileResponse) => setProfile(payload))
      .catch((profileError: unknown) => {
        if ((profileError as { name?: string }).name !== "AbortError") setProfile({ connected: false, error: "Unable to load the member profile." });
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingProfile(false); });
    void loadThread(selected.id, controller.signal).catch((threadLoadError: unknown) => {
      if ((threadLoadError as { name?: string }).name !== "AbortError") setThreadError("Unable to load the SMS thread.");
    });
    return () => controller.abort();
  }, [selected?.id]);

  if (loading) return <section className="empty-area"><Users size={24} /><strong>Loading member directory</strong><span>Reading the held ForeUp directory. This path does not live-pull ForeUp.</span></section>;
  if (error) return <section className="empty-area"><Users size={24} /><strong>Member directory needs attention</strong><span>{error}</span></section>;

  const smsEligible = members.filter((member) => member.phone && !member.optOutText).length;
  const emailEligible = members.filter((member) => member.email && !member.optOutEmail).length;
  const invoiceBalance = members.reduce((total, member) => total + member.invoiceBalance, 0);
  const accountBalance = members.reduce((total, member) => total + member.accountBalance, 0);
  const membershipGroups = new Set(members.flatMap((member) => member.membershipGroups)).size;

  return <section className="member-workspace" aria-label="Member directory and conversations">
    <header className="member-workspace-header">
      <div><div className="eyebrow">Held ForeUp directory</div><h3>Member health and conversations</h3><p>Search a member, review their next held tee times, then open their SMS thread.{directorySyncedAt ? ` Last synced ${new Date(directorySyncedAt).toLocaleString()}.` : ""}</p></div>
      <button className="refresh-report" aria-label="Refresh member directory" onClick={() => void loadMembers()} title="Refresh directory" type="button"><RefreshCw size={14} /></button>
    </header>
    <div className="live-grid member-health-grid"><article className="live-card"><Users size={18} /><span>Members</span><strong>{members.length}</strong><small>{membershipGroups} membership group{membershipGroups === 1 ? "" : "s"} represented</small></article><article className="live-card"><MessageSquareText size={18} /><span>SMS eligible</span><strong>{smsEligible}</strong><small>{members.length ? `${Math.round(smsEligible / members.length * 100)}% with a non-opted-out mobile` : "No members loaded"}</small></article><article className="live-card"><ShieldCheck size={18} /><span>Email eligible</span><strong>{emailEligible}</strong><small>{members.length ? `${Math.round(emailEligible / members.length * 100)}% contactable by email` : "No members loaded"}</small></article><article className="live-card"><ReceiptText size={18} /><span>Account balance</span><strong>{formatMoney(accountBalance)}</strong><small>{formatMoney(invoiceBalance)} invoice balance across directory</small></article></div>
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
          <div className="member-detail-heading"><div><h3>{selected.name}</h3><span>{selected.phone || "No phone on file"} · {selected.email || "No email on file"}</span></div><span className={badge?.className}><ShieldCheck size={14} />{badge?.label}</span></div>
          <div className="member-fact-row"><span>{selected.membershipGroups.join(" · ") || "Member"}</span><span>Handicap {selected.handicap || "—"}</span><span>{[selected.city, selected.state].filter(Boolean).join(", ") || "Location unavailable"}</span></div>
          <div className="member-tee-times"><div className="member-section-title"><CalendarDays size={16} /><strong>Scheduled tee times</strong><small>Held next 90 days</small></div>{loadingProfile ? <p>Loading tee times…</p> : profile?.connected ? profile.teeTimes?.length ? <div className="tee-time-list">{profile.teeTimes.map((teeTime) => <article key={teeTime.id}><strong>{formatTeeTime(teeTime.startsAt)}</strong><span>{teeTime.title} · {teeTime.players} players · {teeTime.carts} carts</span><small>{teeTime.status}</small></article>)}</div> : <p>{profile.teeTimesStatus === "missing" ? "Upcoming tee times are not in the held copy." : "No upcoming tee times in the held copy."}</p> : <p>{profile?.error ?? "No member profile loaded."}</p>}</div>
          <div className="member-thread">
            <div className="member-thread-toolbar">
              <div><strong>SMS thread</strong><p>{selected.optOutText ? "ForeUp has this member opted out. Sending is disabled." : sendingEnabled ? (sms?.connected ? "Twilio is connected. Inbound hits /api/sms/inbound." : "Twilio is not connected yet. Drafts and staff replies are stored and queued.") : composer.bannerText}</p></div>
              <div className="member-thread-actions">
                {botOwnsThread
                  ? <button className="button secondary" disabled={threadBusy || selected.optOutText} onClick={() => void runThreadAction("pause")} type="button"><PauseCircle size={14} />Pause bot</button>
                  : <button className="button secondary" disabled={threadBusy} onClick={() => void runThreadAction("resume")} type="button"><PlayCircle size={14} />Resume bot</button>}
                <button className="button secondary" disabled={threadBusy || selected.optOutText} onClick={() => void runThreadAction("draft")} type="button">Draft reply</button>
              </div>
            </div>
            <div className="member-thread-list">
              {messages.length ? messages.map((message) => <article className={`member-bubble ${message.author}`} key={message.id}><strong>{message.author}</strong><p>{message.body}</p><small>{formatMessageTime(message.createdAt)} · {message.status}</small></article>) : <p className="member-empty">No messages yet. The thread is ready for inbound Twilio or a staff draft.</p>}
            </div>
            {threadError && <p className="member-thread-error">{threadError}</p>}
            {composer.showHeldBanner && <p className="sms-held-banner" role="status">{composer.bannerText}</p>}
            {composer.composerVisible && <form className="member-composer" onSubmit={(event) => void sendStaffMessage(event)}>
              <textarea aria-label="Staff reply" disabled={composer.textareaDisabled} onChange={(event) => setDraft(event.target.value)} placeholder={botOwnsThread ? "Pause the bot before sending a staff reply." : "Write a staff reply"} value={draft} />
              <button className="button" disabled={composer.sendDisabled} type="submit"><Send size={14} />{composer.sendLabel}</button>
            </form>}
          </div>
        </> : <div className="empty-state"><Users size={22} /><span>Select a member to view their profile.</span></div>}
      </section>
    </div>
  </section>;
}

function initials(name: string) { return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function formatTeeTime(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatMessageTime(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

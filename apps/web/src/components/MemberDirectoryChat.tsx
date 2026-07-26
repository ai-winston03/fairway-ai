"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  PauseCircle,
  PlayCircle,
  DownloadCloud,
  MessageSquareText,
  Search,
  Send,
  StickyNote,
  TicketCheck,
  Users
} from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  DirectoryMember,
  getBotThreadControl,
  directoryMembers,
  ForeupImportSummary,
  getMemberCustomerProfile,
  getMemberConversation,
  MemberChatMessage,
  scheduledMessages
} from "@/lib/member-directory";

export function MemberDirectoryChat() {
  const [members, setMembers] = useState<DirectoryMember[]>(directoryMembers);
  const [selectedMemberId, setSelectedMemberId] = useState(directoryMembers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [importSummary, setImportSummary] = useState<ForeupImportSummary | null>(null);
  const [conversation, setConversation] = useState<MemberChatMessage[]>(
    getMemberConversation(directoryMembers[0]?.id ?? "")
  );
  const [pausedThreads, setPausedThreads] = useState<Record<string, boolean>>({});

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? members[0];
  const customerProfile = selectedMember ? getMemberCustomerProfile(selectedMember.id) : null;
  const botControl = selectedMember ? getBotThreadControl(selectedMember.id) : null;
  const staffPaused = Boolean(selectedMember && pausedThreads[selectedMember.id]);
  const botOwnsThread = botControl?.status === "bot_active" && !staffPaused;
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return members;

    return members.filter((member) => {
      return [member.name, member.membershipType, member.phone, member.email, member.foreupCustomerId]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [members, query]);

  async function importMembers() {
    const response = await fetch(`${apiBasePath()}/api/foreup/members/import`, { method: "POST" });
    const result = await response.json();

    setMembers(result.members);
    setImportSummary(result.summary);
    setSelectedMemberId(result.members[0]?.id ?? "");
    setConversation(getMemberConversation(result.members[0]?.id ?? ""));
  }

  function selectMember(memberId: string) {
    setSelectedMemberId(memberId);
    setConversation(getMemberConversation(memberId));
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    if (!selectedMember || !draft.trim() || botOwnsThread) return;

    const message: MemberChatMessage = {
      id: crypto.randomUUID(),
      memberId: selectedMember.id,
      direction: "outbound",
      channel: "sms",
      body: draft.trim(),
      sentAt: new Date().toISOString(),
      source: "staff"
    };

    setConversation((current) => [...current, message]);
    setDraft("");
  }

  function toggleBotPause() {
    if (!selectedMember) return;

    setPausedThreads((current) => ({
      ...current,
      [selectedMember.id]: !current[selectedMember.id]
    }));
  }

  return (
    <section className="panel full directory-panel" id="member-directory">
      <div className="panel-header">
        <div>
          <div className="eyebrow">ForeUp member sync</div>
          <h2 className="panel-title">Directory & Member Chats</h2>
          <p className="panel-subtitle">
            Import ForeUp customers, keep a searchable member directory, and switch between individual SMS threads.
          </p>
        </div>
        <button className="button" onClick={importMembers} type="button">
          <DownloadCloud size={16} />
          Import from ForeUp
        </button>
      </div>

      <div className="directory-grid">
        <aside className="member-directory" aria-label="Member directory">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search members"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, membership"
              value={query}
            />
          </label>

          <div className="import-summary">
            <CheckCircle2 size={16} />
            <span>
              {importSummary
                ? `${importSummary.imported} imported · ${importSummary.updated} updated · ${importSummary.mode}`
                : `${members.length} mock ForeUp members loaded`}
            </span>
          </div>

          <div className="member-list">
            {filteredMembers.map((member) => (
              <button
                className={`member-row ${member.id === selectedMember?.id ? "active" : ""}`}
                key={member.id}
                onClick={() => selectMember(member.id)}
                type="button"
              >
                <span className="member-avatar">{initials(member.name)}</span>
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.membershipType} · {member.phone}</small>
                </span>
                <StatusDot status={member.status} />
              </button>
            ))}
          </div>
        </aside>

        <div className="member-chat">
          {selectedMember ? (
            <>
              <div className="chat-member-header">
                <div>
                  <h3>{selectedMember.name}</h3>
                  <span>
                    ForeUp #{selectedMember.foreupCustomerId} · {selectedMember.membershipType}
                  </span>
                </div>
                <div className="member-facts">
                  <span>{selectedMember.email}</span>
                  <span>AR ${(selectedMember.arBalanceCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className={`bot-control-strip ${botOwnsThread ? "bot-active" : "staff-paused"}`}>
                <div>
                  <MessageSquareText size={16} />
                  <span>
                    {botOwnsThread
                      ? `Bot is handling ${botControl?.activeWorkflow}. Pause before replying.`
                      : "Bot paused. Staff can reply without automation interleaving."}
                  </span>
                </div>
                <button className={botOwnsThread ? "button pause-button" : "button secondary"} onClick={toggleBotPause} type="button">
                  {botOwnsThread ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                  {botOwnsThread ? "Pause bot" : "Resume bot"}
                </button>
              </div>

              <div className="thread-list" aria-label={`Conversation with ${selectedMember.name}`}>
                {conversation.map((message) => (
                  <div className={`thread-message ${message.direction}`} key={message.id}>
                    <small>
                      {message.source} · {new Date(message.sentAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </small>
                    <span>{message.body}</span>
                  </div>
                ))}
              </div>

              <form className="chat-composer" onSubmit={sendMessage}>
                <input
                  aria-label={`Message ${selectedMember.name}`}
                  disabled={botOwnsThread}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={botOwnsThread ? "Pause bot to send a staff reply" : `Message ${selectedMember.name}`}
                  value={draft}
                />
                <button className="button" disabled={botOwnsThread} type="submit">
                  <Send size={16} />
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state">
              <Users size={22} />
              <span>No member selected.</span>
            </div>
          )}
        </div>

        {selectedMember && customerProfile ? (
          <aside className="customer-profile" aria-label={`ForeUp profile for ${selectedMember.name}`}>
            <div className="profile-header">
              <div>
                <span>Customer profile</span>
                <strong>{selectedMember.name}</strong>
              </div>
              <small>ForeUp #{selectedMember.foreupCustomerId}</small>
            </div>

            <div className="profile-balance-grid">
              <div className={customerProfile.accountBalanceCents > 50000 ? "profile-stat warning" : "profile-stat"}>
                <CreditCard size={15} />
                <span>AR balance</span>
                <strong>{formatMoney(customerProfile.accountBalanceCents)}</strong>
              </div>
              <div className="profile-stat">
                <CreditCard size={15} />
                <span>Credit book</span>
                <strong>{formatMoney(customerProfile.creditBookCents)}</strong>
              </div>
            </div>

            <ProfileSection icon={<TicketCheck size={15} />} title="Passes">
              {customerProfile.passes.length > 0 ? (
                customerProfile.passes.map((pass) => (
                  <div className="profile-row" key={pass.id}>
                    <span>{pass.name}</span>
                    <strong>{pass.remaining} left</strong>
                  </div>
                ))
              ) : (
                <span className="profile-empty">No active passes.</span>
              )}
            </ProfileSection>

            <ProfileSection icon={<CalendarClock size={15} />} title="Scheduled tee times">
              {customerProfile.scheduledTeeTimes.map((teeTime) => (
                <div className="tee-time-card" key={teeTime.id}>
                  <strong>{formatDateTime(teeTime.startsAt)}</strong>
                  <span>
                    {teeTime.players} players · {teeTime.guests} guests · {teeTime.carts} carts
                  </span>
                  <small>{teeTime.status.replace("_", " ")}</small>
                </div>
              ))}
            </ProfileSection>

            <ProfileSection icon={<StickyNote size={15} />} title="Notes and preferences">
              <div className="profile-chip-list">
                {[...customerProfile.preferences, ...customerProfile.staffNotes].map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </ProfileSection>

            <small className="profile-sync">Synced {formatDateTime(customerProfile.lastForeupSyncAt)}</small>
          </aside>
        ) : null}

        <aside className="schedule-rail" aria-label="Scheduled messages">
          <div className="rail-heading">
            <CalendarClock size={17} />
            <span>Scripted Schedule</span>
          </div>
          <p>
            Cron jobs execute templates and checks first. AI remains off unless a job lands in review.
          </p>
          <div className="scheduled-list">
            {scheduledMessages.map((message) => (
              <div className="scheduled-card" key={message.id}>
                <div>
                  <strong>{message.name}</strong>
                  <small>{message.memberName}</small>
                </div>
                <span className={message.status === "active" ? "schedule-status active" : "schedule-status review"}>
                  {message.status === "active" ? "Script" : "Review"}
                </span>
                <small className="cron-line">
                  <Clock3 size={13} />
                  {message.cron}
                </small>
                <small>AI allowed: {message.aiAllowed ? "yes" : "no"}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ProfileSection({
  children,
  icon,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="profile-section">
      <div className="profile-section-title">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(cents / 100);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatusDot({ status }: { status: DirectoryMember["status"] }) {
  return <span className={`status-dot ${status}`} aria-label={`Member status ${status}`} />;
}

function apiBasePath() {
  if (typeof window === "undefined") return "";

  return window.location.pathname.startsWith("/fairwayai") ? "/fairwayai" : "";
}

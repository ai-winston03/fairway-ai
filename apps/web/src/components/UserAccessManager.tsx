"use client";

import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { StaffRole } from "@/lib/authz";

type Person = {
  uid?: string;
  email: string;
  name?: string;
  role: StaffRole;
  department: string;
  status?: string;
};

const roleNames: Record<StaffRole, string> = {
  employee: "General employee",
  "department-manager": "Department manager",
  owner: "Owner",
  admin: "Admin"
};

export function UserAccessManager() {
  const [users, setUsers] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Person[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("employee");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/access/users");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers(data.users ?? []);
      setInvites(data.invites ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load staff access.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const invitedEmail = email.trim().toLowerCase();
    const response = await fetch("/api/access/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: invitedEmail, role, department: "operations" })
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Unable to save invitation.");
    const delivery = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: invitedEmail })
    });
    const deliveryData = await delivery.json() as { error?: string };
    if (!delivery.ok) {
      return setMessage(`Access was saved, but Firebase could not send the sign-in email: ${deliveryData.error ?? "try again from the login page."}`);
    }
    setEmail("");
    setMessage(`Invitation sent to ${invitedEmail}.`);
    void load();
  }

  async function patch(body: Record<string, unknown>, key: string, ok: string) {
    setBusyKey(key);
    setMessage(null);
    try {
      const response = await fetch("/api/access/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update access.");
      setMessage(ok);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update access.");
    } finally {
      setBusyKey(null);
    }
  }

  async function revoke(body: Record<string, unknown>, key: string, ok: string) {
    setBusyKey(key);
    setMessage(null);
    try {
      const response = await fetch("/api/access/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to revoke access.");
      setMessage(ok);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke access.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="access-manager">
      <header className="operations-hero">
        <div>
          <div className="eyebrow">Firebase access control</div>
          <h2>Users & permissions</h2>
          <p>Invite staff, change roles, disable accounts, and revoke sessions before Twilio goes live.</p>
        </div>
        <div className="connection-badge"><span /><ShieldCheck size={14} />Protected</div>
      </header>
      <div className="access-grid">
        <article className="detail-card access-invite-card">
          <div>
            <div className="eyebrow">Invite staff</div>
            <h3>Grant access</h3>
            <p>Invited users receive a passwordless email sign-in link—no shared passwords.</p>
          </div>
          <form className="access-form" onSubmit={invite}>
            <input aria-label="Staff email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" />
            <select aria-label="Role" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
              {Object.entries(roleNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <button className="button" type="submit"><UserPlus size={16} />Invite user</button>
          </form>
          {message ? <p className="security-note">{message}</p> : null}
        </article>
        <article className="detail-card role-policy-card">
          <div>
            <div className="eyebrow">Role policy</div>
            <h3>What each role can do</h3>
          </div>
          <ul className="permission-list">
            <li><strong>Employee</strong><span>Directory lookup. Texts only assigned members.</span></li>
            <li><strong>Department manager</strong><span>Team KPIs. Can claim a thread, then text.</span></li>
            <li><strong>Owner</strong><span>All reporting. Can text any member.</span></li>
            <li><strong>Admin</strong><span>Users, disable/revoke, settings, any member thread.</span></li>
          </ul>
        </article>
      </div>
      <section className="detail-card access-list">
        <div>
          <div className="eyebrow">Directory</div>
          <h3><UsersRound size={17} /> Active & invited users</h3>
        </div>
        {loading ? <p>Loading access records…</p> : <div>
          {users.map((person) => {
            const disabled = person.status === "disabled";
            return (
              <p key={person.uid}>
                <strong>{person.name || person.email}</strong>
                <span>{person.email} · {disabled ? "disabled" : "active"}</span>
                <select
                  aria-label={`Role for ${person.email}`}
                  disabled={busyKey === person.uid}
                  value={person.role}
                  onChange={(event) => void patch({ uid: person.uid, role: event.target.value }, person.uid ?? person.email, `Updated ${person.email} to ${roleNames[event.target.value as StaffRole]}.`)}
                >
                  {Object.entries(roleNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button
                  className="button secondary"
                  disabled={busyKey === person.uid}
                  onClick={() => void patch({ uid: person.uid, status: disabled ? "active" : "disabled" }, person.uid ?? person.email, disabled ? `Re-enabled ${person.email}.` : `Disabled ${person.email}.`)}
                  type="button"
                >
                  {disabled ? "Enable" : "Disable"}
                </button>
                <button
                  className="button secondary"
                  disabled={busyKey === person.uid}
                  onClick={() => void revoke({ uid: person.uid }, person.uid ?? person.email, `Revoked sessions for ${person.email}.`)}
                  type="button"
                >
                  Revoke
                </button>
              </p>
            );
          })}
          {invites.map((person) => (
            <p key={person.email}>
              <strong>{person.email}</strong>
              <span>invited, awaiting first sign-in</span>
              <select
                aria-label={`Role for invite ${person.email}`}
                disabled={busyKey === person.email}
                value={person.role}
                onChange={(event) => void patch({ email: person.email, role: event.target.value }, person.email, `Updated invite ${person.email}.`)}
              >
                {Object.entries(roleNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button
                className="button secondary"
                disabled={busyKey === person.email}
                onClick={() => void revoke({ email: person.email }, person.email, `Revoked invite for ${person.email}.`)}
                type="button"
              >
                Revoke invite
              </button>
            </p>
          ))}
          {!users.length && !invites.length ? <p>No staff users yet. Your bootstrap admin is created when that email link is used.</p> : null}
        </div>}
      </section>
    </section>
  );
}

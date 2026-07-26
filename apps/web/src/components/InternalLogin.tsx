"use client";

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase-client";

type InternalLoginProps = { error?: string | null };

export function InternalLogin({ error }: InternalLoginProps) {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [completingLink, setCompletingLink] = useState(false);

  useEffect(() => {
    if (!firebaseAuth || !isSignInWithEmailLink(firebaseAuth, window.location.href)) return;
    setCompletingLink(true);
    const savedEmail = window.localStorage.getItem("fairway_magic_link_email") ?? "";
    setEmail(savedEmail);
    if (!savedEmail) {
      setMessage("Enter the email address that received this link to finish signing in.");
      return;
    }
    setWorking(true);
    void signInWithEmailLink(firebaseAuth, savedEmail, window.location.href)
      .then(() => window.localStorage.removeItem("fairway_magic_link_email"))
      .catch((signInError) => setMessage(signInError instanceof Error ? signInError.message : "That sign-in link could not be completed."))
      .finally(() => setWorking(false));
  }, []);

  async function signIn() {
    if (!firebaseAuth) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setMessage("Enter your work email to receive a sign-in link."); return; }
    setWorking(true); setMessage(null);
    try {
      if (completingLink) {
        await signInWithEmailLink(firebaseAuth, normalizedEmail, window.location.href);
        window.localStorage.removeItem("fairway_magic_link_email");
        return;
      }
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Sign-in email could not be sent.");
      window.localStorage.setItem("fairway_magic_link_email", normalizedEmail);
      setMessage(`If ${normalizedEmail} has staff access, a secure sign-in link is on its way. Open it in this browser to continue.`);
    } catch (signInError) {
      setMessage(signInError instanceof Error ? signInError.message : "Sign-in could not be completed.");
    } finally { setWorking(false); }
  }

  return <section className="panel login-panel sso-panel">
    <div className="panel-header"><div><div className="eyebrow">Secure staff access</div><h1 className="panel-title">Sign in to Fairway</h1><p className="panel-subtitle">Firebase Authentication and role-based access protect member and operational data.</p></div><ShieldCheck size={20} color="var(--green)" /></div>
    <div className="login-body">
      {firebaseEnabled ? <form className="access-form" onSubmit={(event) => { event.preventDefault(); void signIn(); }}>
        <label className="sr-only" htmlFor="fairway-login-email">Work email</label>
        <input autoComplete="email" id="fairway-login-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@club.com" required type="email" value={email} />
        <button className="button" disabled={working} type="submit"><Mail size={16} />{working ? "Signing in…" : completingLink ? "Complete sign-in" : "Email me a sign-in link"}</button>
      </form> : <div className="magic-link-demo"><ShieldCheck size={16} /><span>Firebase sign-in is being configured. This local preview is not a shareable production login.</span></div>}
      <p className="security-note">Only invited staff accounts can enter. Administrators assign role, department, and reporting permissions from Access.</p>
      {message || error ? <p className="login-error">{message ?? error}</p> : null}
    </div>
  </section>;
}

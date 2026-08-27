"use client";

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase-client";

type InternalLoginProps = { error?: string | null };

export function InternalLogin({ error }: InternalLoginProps) {
  const [working, setWorking] = useState(false);
  const [inboxNote, setInboxNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [completingLink, setCompletingLink] = useState(false);
  const completionStarted = useRef(false);

  function handleCompletionError(signInError: unknown) {
    const code = typeof signInError === "object" && signInError !== null && "code" in signInError
      ? String(signInError.code)
      : "";
    setInboxNote(null);
    if (code !== "auth/invalid-action-code" && code !== "auth/expired-action-code") {
      setMessage(signInError instanceof Error ? signInError.message : "That sign-in link could not be completed.");
      return;
    }

    window.localStorage.removeItem("fairway_magic_link_email");
    window.history.replaceState({}, document.title, window.location.pathname);
    setCompletingLink(false);
    setMessage("That sign-in link has expired or was already used. Request a fresh link below.");
  }

  async function completeSignIn(signInEmail: string) {
    if (!firebaseAuth || completionStarted.current) return;
    completionStarted.current = true;
    setWorking(true);
    try {
      await signInWithEmailLink(firebaseAuth, signInEmail, window.location.href);
      window.localStorage.removeItem("fairway_magic_link_email");
    } catch (signInError) {
      handleCompletionError(signInError);
    } finally {
      completionStarted.current = false;
      setWorking(false);
    }
  }

  useEffect(() => {
    if (!firebaseAuth || !isSignInWithEmailLink(firebaseAuth, window.location.href)) return;
    setCompletingLink(true);
    const savedEmail = window.localStorage.getItem("fairway_magic_link_email") ?? "";
    setEmail(savedEmail);
    if (!savedEmail) {
      setMessage("Enter the email address that received this link to finish signing in.");
      return;
    }
    void completeSignIn(savedEmail);
  }, []);

  async function signIn() {
    if (!firebaseAuth) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setInboxNote(null); setMessage("Enter your work email to receive a sign-in link."); return; }
    setWorking(true); setMessage(null); setInboxNote(null);
    try {
      if (completingLink) {
        await completeSignIn(normalizedEmail);
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
      setInboxNote("Your sign-in request was accepted. Check your inbox for the secure link, then open it in this browser to continue.");
    } catch (signInError) {
      handleCompletionError(signInError);
    } finally { setWorking(false); }
  }

  return <section className="panel login-panel sso-panel">
    <img alt="Yuba Golf Club" className="login-emblem" src="/full-name-emblem-black.svg" height={64} />
    <div className="panel-header"><div><div className="eyebrow">Secure staff access</div><h1 className="panel-title">Sign in to Fairway</h1><p className="panel-subtitle">Firebase Authentication and role-based access protect member and operational data.</p></div></div>
    <div className="login-body">
      {firebaseEnabled ? <form className="login-stack" onSubmit={(event) => { event.preventDefault(); void signIn(); }}>
        <label className="sr-only" htmlFor="fairway-login-email">Work email</label>
        <input autoComplete="email" id="fairway-login-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@club.com" required type="email" value={email} />
        <button className="button login-magic-link" disabled={working} type="submit"><Mail size={16} />{completingLink ? "Complete sign-in" : "Email me a sign-in link"}</button>
        {inboxNote ? <p className="login-inbox-note">{inboxNote}</p> : null}
      </form> : <div className="magic-link-demo"><span>Firebase sign-in is being configured. This local preview is not a shareable production login.</span></div>}
      <p className="security-note">Only invited staff accounts can enter. Administrators assign role, department, and reporting permissions from Access.</p>
      {message || error ? <p className="login-error">{message ?? error}</p> : null}
    </div>
  </section>;
}

"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  ClubFaq,
  ClubSettings,
  defaultClubSettings,
  DEFAULT_MEMBERS_ONLY_MESSAGE
} from "@/lib/club-settings";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function apiPath(path: string) {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? `/fairwayai${path}` : path;
}

export function ClubSettingsPanel() {
  const [settings, setSettings] = useState<ClubSettings>(defaultClubSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath("/api/club-settings"), { cache: "no-store" });
      const payload = await response.json() as { connected?: boolean; settings?: ClubSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Unable to load club settings.");
      setSettings(payload.settings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load club settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function updateFaq(index: number, patch: Partial<ClubFaq>) {
    setSettings((current) => ({
      ...current,
      faq: current.faq.map((item, faqIndex) => faqIndex === index ? { ...item, ...patch } : item)
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(apiPath("/api/club-settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proShopPhone: settings.proShopPhone,
          restaurantHours: settings.restaurantHours,
          faq: settings.faq,
          membersOnlyMessage: settings.membersOnlyMessage || DEFAULT_MEMBERS_ONLY_MESSAGE
        })
      });
      const payload = await response.json() as { settings?: ClubSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "Unable to save club settings.");
      setSettings(payload.settings);
      setSavedAt(new Date().toLocaleString());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save club settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="empty-area"><strong>Loading club settings</strong><span>Reading Firestore clubSettings for this course.</span></section>;
  }

  return (
    <form className="club-settings" onSubmit={(event) => void save(event)}>
      <div className="period-bar">
        <span>Club settings</span>
        <strong>Pro shop, hours, FAQ, and members-only copy</strong>
        <small>Stored in Firestore. The customer bot reads this on every turn.</small>
      </div>
      {error ? <p className="member-thread-error">{error}</p> : null}
      <div className="settings-grid club-settings-grid">
        <label className="field">
          <span>Pro shop phone</span>
          <input
            aria-label="Pro shop phone"
            onChange={(event) => setSettings((current) => ({ ...current, proShopPhone: event.target.value }))}
            placeholder="530-555-0100"
            value={settings.proShopPhone}
          />
        </label>
        <label className="field">
          <span>Restaurant opens</span>
          <input
            aria-label="Restaurant opens"
            onChange={(event) => setSettings((current) => ({
              ...current,
              restaurantHours: { ...current.restaurantHours, open: event.target.value }
            }))}
            type="time"
            value={settings.restaurantHours.open}
          />
        </label>
        <label className="field">
          <span>Restaurant closes</span>
          <input
            aria-label="Restaurant closes"
            onChange={(event) => setSettings((current) => ({
              ...current,
              restaurantHours: { ...current.restaurantHours, close: event.target.value }
            }))}
            type="time"
            value={settings.restaurantHours.close}
          />
        </label>
        <label className="field">
          <span>Timezone</span>
          <input
            aria-label="Restaurant timezone"
            onChange={(event) => setSettings((current) => ({
              ...current,
              restaurantHours: { ...current.restaurantHours, timezone: event.target.value || "America/Chicago" }
            }))}
            value={settings.restaurantHours.timezone}
          />
        </label>
        <label className="field club-settings-message">
          <span>Members-only message</span>
          <textarea
            aria-label="Members-only message"
            onChange={(event) => setSettings((current) => ({ ...current, membersOnlyMessage: event.target.value }))}
            value={settings.membersOnlyMessage}
          />
        </label>
      </div>
      <fieldset className="club-settings-days">
        <legend>Restaurant days</legend>
        {WEEKDAYS.map((day) => {
          const checked = settings.restaurantHours.days.includes(day);
          return (
            <label key={day}>
              <input
                checked={checked}
                onChange={() => setSettings((current) => {
                  const days = checked
                    ? current.restaurantHours.days.filter((value) => value !== day)
                    : [...current.restaurantHours.days, day];
                  return { ...current, restaurantHours: { ...current.restaurantHours, days } };
                })}
                type="checkbox"
              />
              {day}
            </label>
          );
        })}
      </fieldset>
      <section className="club-settings-faq">
        <div className="member-section-title">
          <strong>FAQ</strong>
          <button
            className="button secondary"
            onClick={() => setSettings((current) => ({
              ...current,
              faq: [...current.faq, { id: crypto.randomUUID(), question: "", answer: "", tags: [] }]
            }))}
            type="button"
          >
            <Plus size={14} />Add FAQ
          </button>
        </div>
        {settings.faq.length ? settings.faq.map((item, index) => (
          <article className="club-faq-card" key={item.id}>
            <label className="field">
              <span>Question</span>
              <input aria-label={`FAQ question ${index + 1}`} onChange={(event) => updateFaq(index, { question: event.target.value })} value={item.question} />
            </label>
            <label className="field">
              <span>Answer</span>
              <textarea aria-label={`FAQ answer ${index + 1}`} onChange={(event) => updateFaq(index, { answer: event.target.value })} value={item.answer} />
            </label>
            <label className="field">
              <span>Tags</span>
              <input
                aria-label={`FAQ tags ${index + 1}`}
                onChange={(event) => updateFaq(index, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
                placeholder="hours, dress code"
                value={item.tags.join(", ")}
              />
            </label>
            <button
              className="button secondary"
              onClick={() => setSettings((current) => ({ ...current, faq: current.faq.filter((faq) => faq.id !== item.id) }))}
              type="button"
            >
              <Trash2 size={14} />Remove
            </button>
          </article>
        )) : <p className="member-empty">No FAQ entries yet. Add one for dress code, hours, or other shop questions.</p>}
      </section>
      <div className="club-settings-actions">
        <button className="button" disabled={saving} type="submit"><Save size={14} />Save settings</button>
        {savedAt ? <small>Saved {savedAt}</small> : <small>Unanswered bot questions use the pro shop phone.</small>}
      </div>
    </form>
  );
}

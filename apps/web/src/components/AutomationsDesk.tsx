"use client";

import { CalendarDays, ClipboardList, Flag, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { SendingOffBanner } from "@/components/SendingOffBanner";
import { automationsHeldState } from "@/lib/sms-held-ui";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";

function apiPath(path: string) {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? `/fairwayai${path}` : path;
}

const tabs = ["Rules", "Schedule", "History"];

export function AutomationsDesk({ tab, onTabChange }: { tab: string; onTabChange: (tab: string) => void }) {
  const activeTab = tabs.includes(tab) ? tab : "Rules";
  const [sendingEnabled, setSendingEnabled] = useState(false);
  const held = automationsHeldState({ tab: activeTab, sendingEnabled });

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiPath("/api/sms/status"), { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { sendingEnabled?: boolean }) => setSendingEnabled(payload.sendingEnabled === true))
      .catch(() => setSendingEnabled(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!held.showHeldBanner) return;
    const controller = new AbortController();
    void fetch(apiPath("/api/scheduler/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: ["messages"] }),
      signal: controller.signal
    }).catch(() => undefined);
    return () => controller.abort();
  }, [held.showHeldBanner, activeTab]);

  return (
    <section className="operations-dashboard" aria-label="Automations workspace">
      <header className="operations-hero">
        <div>
          <div className="eyebrow">Control room</div>
          <h2>Automations</h2>
          <p>Review approved messages and scheduled jobs before they run.</p>
        </div>
        <div className="connection-badge"><span />Held directory</div>
      </header>
      <nav className="operations-tabs" aria-label="Automations submenu">
        {tabs.map((item) => (
          <button aria-pressed={activeTab === item} className={activeTab === item ? "active" : ""} key={item} onClick={() => onTabChange(item)} type="button">{item}</button>
        ))}
      </nav>
      {held.showHeldBanner && <SendingOffBanner />}
      <AutomationsPanel tab={activeTab} />
    </section>
  );
}

function MetricCard({ label, value, note, Icon }: { label: string; value: string | number; note: string; Icon: typeof Flag }) {
  return <article className="live-card"><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function AutomationsPanel({ tab }: { tab: string }) {
  const active = workflowLibrary.filter((workflow) => workflow.status === "active");
  const scheduled = active.filter((workflow) => workflow.cronExpression);
  const reviewRequired = active.filter((workflow) => !evaluateWorkflowSafety(workflow).safeForAutopilot);
  const aiEnabled = active.filter((workflow) => workflow.aiAllowed);
  const label = tab === "Rules" ? "Rules" : tab === "Schedule" ? "Schedule" : "History";
  if (tab === "History") return <section className="empty-area"><CalendarDays size={24} /><strong>Execution history is not retained yet</strong><span>Configured-rule health is shown here today. Delivery, hold, and failure events will appear only after durable run logging is added—no invented performance metrics.</span></section>;
  return <><div className="period-bar"><span>{label}</span><strong>Configured operating controls</strong><small>These are live rule definitions, not claimed delivery outcomes.</small></div><div className="live-grid"><MetricCard label="Active workflows" value={active.length} note="Configured operating workflows" Icon={Flag} /><MetricCard label="Scheduled jobs" value={scheduled.length} note="Rules with a defined cron schedule" Icon={CalendarDays} /><MetricCard label="Approval gates" value={reviewRequired.length} note="Workflows requiring staff review" Icon={ClipboardList} /><MetricCard label="AI-enabled jobs" value={aiEnabled.length} note="Scheduled workflows default to deterministic rules" Icon={MessageSquareText} /></div><article className="detail-card daily-ledger"><div><div className="eyebrow">Operational coverage</div><h3>Configured workflow controls</h3><p>Each workflow stays visible with its trigger, safety posture, and handoff expectation.</p></div><dl className="detail-list">{active.map((workflow) => { const safety = evaluateWorkflowSafety(workflow); return <div key={workflow.id}><dt>{workflow.name} · {workflow.cronExpression ?? workflow.trigger}</dt><dd>{safety.safeForAutopilot ? "Autopilot eligible" : "Staff review"}</dd></div>; })}</dl></article></>;
}

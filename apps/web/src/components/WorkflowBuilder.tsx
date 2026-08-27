"use client";

import { BotOff, CalendarClock, LockKeyhole, Play, Route, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SendingOffBanner } from "@/components/SendingOffBanner";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";

function apiPath(path: string) {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/fairwayai") ? `/fairwayai${path}` : path;
}

export function WorkflowBuilder() {
  const [selectedId, setSelectedId] = useState(workflowLibrary[0].id);
  const [sendingEnabled, setSendingEnabled] = useState(false);
  const workflow = workflowLibrary.find((item) => item.id === selectedId) ?? workflowLibrary[0];
  const safety = useMemo(() => evaluateWorkflowSafety(workflow), [workflow]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiPath("/api/sms/status"), { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { sendingEnabled?: boolean }) => setSendingEnabled(payload.sendingEnabled === true))
      .catch(() => setSendingEnabled(false));
    return () => controller.abort();
  }, []);

  async function simulate() {
    if (!sendingEnabled) return;
    await fetch(apiPath("/api/workflows/evaluate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId: workflow.id })
    });
  }

  return (
    <article className="panel full">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Workflow Builder</h2>
          <p className="panel-subtitle">Time triggers, scripts, verification, payment rules, escalation</p>
        </div>
        <button className="button secondary" disabled={!sendingEnabled} onClick={() => void simulate()} type="button">
          <Play size={16} />
          Simulate
        </button>
      </div>

      {!sendingEnabled && <SendingOffBanner />}

      <div className="workflow-builder">
        <aside className="workflow-list" aria-label="Workflow list">
          {workflowLibrary.map((item) => (
            <button
              className={`workflow-tab ${item.id === selectedId ? "active" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              type="button"
            >
              <span>{item.name}</span>
              <small>{item.trigger}</small>
            </button>
          ))}
        </aside>

        <section className="workflow-detail">
          <div className="workflow-meta">
            <div>
              <CalendarClock size={17} />
              <span>{workflow.cronExpression ?? workflow.trigger}</span>
            </div>
            <div>
              <Route size={17} />
              <span>{workflow.audience}</span>
            </div>
            <div className={workflow.aiAllowed ? "warning" : "safe"}>
              <BotOff size={17} />
              <span>{workflow.aiAllowed ? "AI allowed" : "Script first"}</span>
            </div>
            <div className={safety.safeForAutopilot ? "safe" : "warning"}>
              <ShieldCheck size={17} />
              <span>{safety.safeForAutopilot ? "Autopilot eligible" : "Needs review"}</span>
            </div>
          </div>
          <div className="rules-columns">
            <div>
              <h3>Deterministic Rules</h3>
              <ul>{workflow.deterministicRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            </div>
            <div>
              <h3>Security Gates</h3>
              <ul>
                <li>Phone match: {workflow.verification.requireMemberPhoneMatch ? "required" : "off"}</li>
                <li>Account-charge OTP: {workflow.verification.requireOneTimeCodeForAccountCharge ? "required" : "off"}</li>
                <li>Staff approval above ${(workflow.verification.requireStaffApprovalAboveCents / 100).toFixed(0)}</li>
                <li>Block charges above ${(workflow.verification.blockWhenArAboveCents / 100).toFixed(0)} AR</li>
                <li>Alcohol approval: {workflow.verification.alcoholRequiresStaffApproval ? "required" : "off"}</li>
              </ul>
            </div>
          </div>
          <div className="script-list">
            {workflow.steps.map((step, index) => (
              <div className="script-step" key={step.label}>
                <span className="step-number">{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.script}</p>
                  <small>Intent: {step.expectedIntent}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="fallback-box">
            <LockKeyhole size={17} />
            <span>{workflow.fallback}</span>
          </div>
        </section>
      </div>
    </article>
  );
}

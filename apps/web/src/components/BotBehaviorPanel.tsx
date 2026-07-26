"use client";

import { Bot, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { defaultBotConfig } from "@/lib/bot-config";

export function BotBehaviorPanel() {
  const [config, setConfig] = useState(defaultBotConfig);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function toggle(key: "requireApprovalForCharges" | "askAboutGuests" | "askAboutCarts" | "askAboutFood") {
    setConfig((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <article className="panel full">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Bot Behavior</h2>
          <p className="panel-subtitle">Manage customer-facing SMS rules without changing code</p>
        </div>
        <button className="button" onClick={() => setSavedAt(new Date().toLocaleTimeString())} type="button">
          <Save size={16} />
          Save Rules
        </button>
      </div>

      <div className="settings-grid">
        <label className="field">
          <span>Voice</span>
          <select
            value={config.tone}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                tone: event.target.value as typeof current.tone
              }))
            }
          >
            <option value="concise">Concise</option>
            <option value="friendly">Friendly</option>
            <option value="premium">Premium club</option>
          </select>
        </label>

        <label className="field">
          <span>Max SMS players</span>
          <input
            max={8}
            min={1}
            onChange={(event) =>
              setConfig((current) => ({ ...current, maxPlayersBySms: Number(event.target.value) }))
            }
            type="number"
            value={config.maxPlayersBySms}
          />
        </label>

        <label className="field">
          <span>AR warning threshold</span>
          <input
            min={0}
            onChange={(event) =>
              setConfig((current) => ({ ...current, arWarningThresholdCents: Number(event.target.value) * 100 }))
            }
            type="number"
            value={config.arWarningThresholdCents / 100}
          />
        </label>

        <div className="toggle-list">
          <button
            className={`toggle ${config.askAboutGuests ? "on" : ""}`}
            onClick={() => toggle("askAboutGuests")}
            type="button"
          >
            <Bot size={16} />
            Ask about guests
          </button>
          <button
            className={`toggle ${config.askAboutCarts ? "on" : ""}`}
            onClick={() => toggle("askAboutCarts")}
            type="button"
          >
            <SlidersHorizontal size={16} />
            Ask about carts
          </button>
          <button
            className={`toggle ${config.askAboutFood ? "on" : ""}`}
            onClick={() => toggle("askAboutFood")}
            type="button"
          >
            <SlidersHorizontal size={16} />
            Ask about F&B
          </button>
          <button
            className={`toggle ${config.requireApprovalForCharges ? "on" : ""}`}
            onClick={() => toggle("requireApprovalForCharges")}
            type="button"
          >
            <ShieldAlert size={16} />
            Staff approval for charges
          </button>
        </div>
      </div>

      <div className="rules-summary">
        <strong>Handoff keywords:</strong> {config.staffHandoffKeywords.join(", ")}
        {savedAt ? <span>Saved at {savedAt}</span> : <span>Unsaved demo rules</span>}
      </div>
    </article>
  );
}

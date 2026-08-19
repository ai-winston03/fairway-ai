"use client";

import { CalendarClock, Send, ShieldCheck, ShoppingCart, Users } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  ConversationState,
  calendarDateInZone,
  emptyConversationState,
  runConversationTurn
} from "@/lib/conversation-engine";
import { initialMessages, Message } from "@/lib/mock-data";
import { demoAvailableTeeTimes } from "@/lib/tee-time-availability";

function slotSummary(state: ConversationState) {
  const parts = [
    state.slots.date,
    state.slots.window,
    state.slots.playerCount ? `${state.slots.playerCount} players` : null,
    state.slots.guestCount != null ? `${state.slots.guestCount} guests` : null,
    state.slots.cartCount != null ? `${state.slots.cartCount} carts` : null,
    state.slots.foodAndBeverage,
    state.phase === "staff_hold" ? "staff hold" : null
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Collecting date, players, guests, carts, and F&B";
}

export function BotSimulator() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<ConversationState>(() => emptyConversationState({
    phase: "collecting",
    phoneMatched: true,
    memberId: "demo-member"
  }));
  const today = calendarDateInZone(new Date(), "America/Chicago");
  const availableSlots = useMemo(() => demoAvailableTeeTimes(today), [today]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    const text = draft.trim();
    if (!text) return;

    const turn = runConversationTurn({
      text,
      state,
      availableSlots,
      phoneMatched: true,
      memberId: "demo-member"
    });

    const memberMessage: Message = {
      id: crypto.randomUUID(),
      author: "member",
      text,
      timestamp: "Now"
    };

    const nextMessages = [...messages, memberMessage];
    if (turn.shouldReply && turn.reply) {
      nextMessages.push({
        id: crypto.randomUUID(),
        author: "bot",
        text: turn.reply,
        timestamp: "Now"
      });
    }

    setMessages(nextMessages);
    setState(turn.state);
    setDraft("");
  }

  return (
    <section className="panel bot-panel" id="customer-bot">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Live customer channel</div>
          <h1 className="panel-title">Customer SMS Bot</h1>
          <p className="panel-subtitle">Tee times, guests, carts, member charges, F&B ordering</p>
        </div>
        <div className="status-pill">
          <span />
          {state.phase === "staff_hold" ? "Staff hold" : "Online"}
        </div>
      </div>

      <div className="bot-tools" aria-label="Bot capabilities">
        <span>
          <Users size={15} />
          Guest-aware
        </span>
        <span>
          <ShoppingCart size={15} />
          F&B ready
        </span>
        <span>
          <ShieldCheck size={15} />
          Charge approval
        </span>
        <span>
          <CalendarClock size={15} />
          foreUP hold
        </span>
      </div>

      <p className="panel-subtitle" aria-live="polite">{slotSummary(state)}</p>

      <div className="conversation" aria-label="SMS bot conversation">
        {messages.map((message) => (
          <div className={`message-row ${message.author}`} key={message.id}>
            <div className="message-meta">{message.author === "bot" ? "FairwayAI" : "Member"} · {message.timestamp}</div>
            <div className={`bubble ${message.author}`}>
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={sendMessage}>
        <input
          aria-label="Message"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Try: Book Saturday morning for 3 with one guest and 2 carts"
          value={draft}
        />
        <button className="button" type="submit">
          <Send size={16} />
          Send
        </button>
      </form>

      <div className="workflow" aria-label="Bot booking workflow">
        <div className="step">
          <span className="step-number">1</span>
          <span>Collect desired date, time window, players, member identity, and guests.</span>
        </div>
        <div className="step">
          <span className="step-number">2</span>
          <span>Offer held tee times, then ask about carts and F&B pickup.</span>
        </div>
        <div className="step">
          <span className="step-number">3</span>
          <span>Hold the request for staff. No live ForeUp booking or account charge from this chat.</span>
        </div>
      </div>
    </section>
  );
}

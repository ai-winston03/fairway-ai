"use client";

import { CalendarClock, Send, ShieldCheck, ShoppingCart, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { createBotReply, initialMessages, Message } from "@/lib/mock-data";

export function BotSimulator() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    const text = draft.trim();
    if (!text) return;

    const memberMessage: Message = {
      id: crypto.randomUUID(),
      author: "member",
      text,
      timestamp: "Now"
    };

    const botMessage: Message = {
      id: crypto.randomUUID(),
      author: "bot",
      text: createBotReply(text),
      timestamp: "Now"
    };

    setMessages((current) => [...current, memberMessage, botMessage]);
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
          Online
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
          foreUP flow
        </span>
      </div>

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
          <span>Offer available tee times, then ask about carts, rentals, and F&B pickup.</span>
        </div>
        <div className="step">
          <span className="step-number">3</span>
          <span>Create foreUP booking, cart/account transaction if needed, then text confirmation.</span>
        </div>
      </div>
    </section>
  );
}

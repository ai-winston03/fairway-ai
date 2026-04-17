# AI Integration Guide

## Design Principle: AI Seams

Every service in FairwayAI is built with "AI seams" — well-defined integration points where AI can plug in without requiring a full rewrite.

- **Today**: services work fine without AI (deterministic logic)
- **Tomorrow**: AI enhances or replaces specific decision points
- **Eventually**: fully agentic workflows automate entire user journeys

---

## The AI Seam Pattern

Each service exposes four AI integration points:

### 1. Tool Definitions
Structured function schemas the AI engine can call via function/tool calling.

### 2. Domain Events
Every significant state change emits a typed event the AI engine subscribes to.

### 3. Context Adapters
Serialize domain state into AI-friendly context for RAG and prompting.

### 4. AI Query Endpoints
Natural-language `/ai/ask` routes on each service.

---

## AI Engine Service

Central `services/ai-engine` provides agent orchestration, tool registry, memory (pgvector), and RAG over course knowledge.

### Agent Types

| Agent | Trigger | Capability |
|-------|---------|------------|
| BookingAgent | Member chat | End-to-end tee time booking via conversation |
| TournamentAgent | Staff request | Pairing generation, rules Q&A, scorekeeping |
| OpsAgent | Cron/event | Maintenance scheduling, anomaly alerts |
| RevenueAgent | Cron | Daily revenue summary, anomaly detection |
| ConciergeAgent | Member app | Personalized recommendations, day planning |
| MarketingAgent | Cron/event | Re-engagement messages, promotion targeting |

---

## Progressive AI Adoption Levels

- **Level 0**: No AI — pure deterministic logic
- **Level 1**: AI Assist — suggestions, human confirms
- **Level 2**: AI Automate — routine tasks autonomous
- **Level 3**: AI Agent — multi-step orchestrated workflows

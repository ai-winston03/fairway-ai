# ⛳ FairwayAI — AI-First Golf Course & Clubhouse Management Platform

FairwayAI is a modular, AI-ready software platform for managing golf courses, clubhouses, pro shops, tournaments, and member experiences. Every service is designed with AI hooks so intelligence can be layered in progressively — from simple automation to fully agentic workflows.

---

## 🏗️ Architecture Overview

```
fairway-ai/
├── apps/
│   ├── web/              # Member portal & admin dashboard (Next.js)
│   ├── mobile/           # Member mobile app (React Native / Expo)
│   └── kiosk/            # Check-in kiosk & pro shop POS (Electron/web)
├── services/
│   ├── core/             # Auth, members, billing (Node/Fastify)
│   ├── tee-times/        # Booking, scheduling, waitlists
│   ├── tournament/       # Pairings, scoring, leaderboards
│   ├── fnb/              # F&B POS, kitchen, tabs, menus
│   ├── pro-shop/         # Inventory, rentals, fittings
│   ├── notifications/    # SMS/email/push dispatcher
│   └── ai-engine/        # 🤖 Central AI service (agents, tools, memory)
├── packages/
│   ├── ui/               # Shared component library
│   ├── sdk/              # TypeScript SDK for service clients
│   ├── ai-tools/         # Shared AI tool definitions (function calling)
│   └── types/            # Shared TypeScript types/contracts
├── infra/
│   ├── docker/           # Docker Compose for local dev
│   ├── terraform/        # Cloud provisioning (optional)
│   └── scripts/          # DB migrations, seed data
└── docs/
    ├── architecture.md
    ├── ai-integration.md
    └── api-reference.md
```

---

## 🤖 AI Integration Strategy

FairwayAI is built "AI-seam-first" — every service exposes:

1. **Tool definitions** (`ai-tools/`) — structured function signatures AI agents can call
2. **Event hooks** — domain events (booking created, round completed) that can trigger AI workflows
3. **Context adapters** — lightweight wrappers that serialize domain state into AI-friendly context
4. **Agent endpoints** — `/ai/ask` routes on each service for natural-language queries

### AI Use Cases (by layer)

| Layer | AI Capability |
|-------|--------------|
| Member portal | Conversational booking assistant, personalized recommendations |
| Tee times | Dynamic pricing optimization, demand forecasting, waitlist intelligence |
| Tournament | Auto-pairing by handicap/skill, live commentary generation, rules Q&A |
| F&B | Menu recommendations, upsell suggestions, kitchen workload prediction |
| Pro shop | Inventory demand forecasting, fitting recommendations |
| Operations | Maintenance scheduling, staff optimization, anomaly detection |
| Finance | Revenue forecasting, member churn prediction, billing anomaly alerts |
| Notifications | AI-written personalized messages, optimal send-time prediction |

### AI Engine Service (`services/ai-engine/`)

The central brain. Responsibilities:
- **Agent orchestration** — multi-step task agents (e.g., "plan member's golf day")
- **Tool registry** — all service tools registered here for LLM function calling
- **Memory** — per-member preference memory, course condition history
- **RAG** — rules of golf, club policies, course documentation
- **Streaming** — SSE/WebSocket for real-time AI responses in the UI

---

## 🧱 Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 15 (App Router) | SSR, great DX, AI streaming support |
| Mobile | Expo (React Native) | Cross-platform, shared components |
| API | Fastify (Node.js) | Fast, schema-first, plugin ecosystem |
| Database | PostgreSQL + Prisma | Relational data, great type safety |
| Cache | Redis | Sessions, rate limiting, real-time |
| Queue | BullMQ (Redis) | Job queues for async AI tasks |
| AI | OpenAI / Anthropic (configurable) | Swappable via AI SDK |
| AI SDK | Vercel AI SDK | Streaming, tool calling, multi-provider |
| Search | pgvector | Embeddings for member/content search |
| Auth | Clerk or Auth.js | Member + staff auth |
| Payments | Stripe | Billing, POS, member accounts |
| Monorepo | Turborepo + pnpm | Fast builds, shared packages |
| CI/CD | GitHub Actions | Automated tests, deploys |

---

## 🚀 Getting Started

```bash
# Clone
git clone https://github.com/ai-winston03/fairway-ai.git
cd fairway-ai

# Install
pnpm install

# Start local services
docker-compose up -d

# Run dev
pnpm dev
```

---

## 📋 Roadmap

- [ ] Phase 1: Core (auth, members, tee times, basic booking)
- [ ] Phase 2: AI booking assistant + dynamic pricing
- [ ] Phase 3: Tournament engine + live scoring
- [ ] Phase 4: F&B POS + member charge accounts
- [ ] Phase 5: Full agentic ops (maintenance, staffing, forecasting)

---

## 📄 License

MIT

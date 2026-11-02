# LoomPilot (Textile AI Advisory System)

> **LoomPilot** is an AI assistant for textile manufacturers that guides orders through quotation, shop-floor production monitoring, and payment collection.

---

## 1. Advisory-Only Principle

LoomPilot is strictly **advisory**. It never takes unilateral business actions:
- **No autonomous hiring or worker reassignment**: it only computes required capacity and proposes ranked recovery recommendations.
- **No autonomous purchasing**: it calculates required purchases and stock deficits, and flags assumptions for human review.
- **No autonomous customer communications**: all quotations and payment reminders are created as drafts requiring human approval (Sales for quotes, Accounts for payment reminders).
- **Zero LLM math**: all costs, volatility risk buffers, worker ETAs, and variances are computed by pure, deterministic, unit-tested Python functions in `agents/app/domain`. Guardrails validate all numbers produced in natural language outputs.
- **Zero LLM overhead on track**: the monitoring agent skips all LLM calls when an active order is meeting its scheduled pace.

---

## 2. Architecture & Monorepo Structure

```
LoomPilot/
├── apps/
│   ├── api/             # Node.js + Express + TypeScript + Mongoose (exclusive write access to MongoDB)
│   └── web/             # React + Vite + TypeScript + Tailwind CSS + shadcn/ui + PWA
├── packages/
│   ├── shared/          # Shared schemas (Zod), types, role matrix, and money utils
│   └── agents-client/   # TypeScript client generated from FastAPI OpenAPI schema
├── agents/              # Python 3.12 + FastAPI + uv + structlog
├── docs/                # Architecture specifications, ADRs, role-permission matrix
├── docker-compose.yml   # Multi-container setup (MongoDB replica set with keyfile, Redis, API, Agents, Web)
└── Makefile             # Developer shortcuts
```

### Database & Permissions
- **MongoDB 7 Single-Node Replica Set**: Enables multi-document transactions for order confirmation (stock reservation + production plan creation).
- **Read-Only Agent User**: Agents connect directly to MongoDB via a dedicated `agent_ro` user with read-only privileges.
- **Internal Agent Gateway**: Agents persist proposals (drafts, alerts, recommendations) exclusively by calling the Node API's `/internal/*` routes protected by a constant-time `x-service-token`.

---

## 3. Prerequisites

- **Node.js**: v20 or v22
- **pnpm**: v9 or v12
- **Python**: 3.12+
- **uv**: Python package manager (`curl -LsSf https://astral.sh/uv/install.sh` or `pip install uv`)
- **Docker & Docker Compose**: Optional for containerised execution

---

## 4. Quickstart (Default: Zero-API-Key Fake Provider)

1. **Clone and setup environment**:
   ```bash
   cp .env.example .env
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   cd agents && uv sync && cd ..
   ```

3. **Start local infrastructure with Docker**:
   ```bash
   docker compose up -d mongo redis
   ```

4. **Seed sample data**:
   ```bash
   pnpm --filter @loompilot/api seed
   ```

5. **Start services**:
   ```bash
   # Terminal 1 (Python Agents)
   cd agents && uv run uvicorn app.main:app --reload --port 8000

   # Terminal 2 (Node API)
   pnpm --filter @loompilot/api dev

   # Terminal 3 (Web UI)
   pnpm --filter @loompilot/web dev
   ```

---

## 5. Running Tests

```bash
# Run all Node & TypeScript tests (Vitest + MongoMemoryReplSet)
pnpm -r test

# Run all Python tests (Domain math, edge cases, FastAPI TestClient)
cd agents && uv run pytest

# Typecheck and lint
pnpm -r lint && pnpm -r typecheck
cd agents && uv run ruff check . && uv run mypy app
```

---

## 6. Switching to a Real LLM Provider

LoomPilot defaults to `LLM_PROVIDER=fake`, which provides deterministic responses and validates guardrails without requiring network requests or API credits.

To switch to Anthropic:
1. Update `.env`:
   ```dotenv
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
   ```
2. Restart the agents service (`cd agents && uv run uvicorn app.main:app --reload --port 8000`).

---

## 7. Operational Roles

| Role | Responsibilities | Key Restrictions |
|---|---|---|
| **Owner** | Full visibility, strategic dashboard, system settings | Master administrative oversight |
| **Manager** | Production plans, output review, alert resolution | Cannot approve payment reminders |
| **Sales** | Customer enquiries, quotation review, customer dispatch | Cannot view internal raw material purchase costs |
| **Store** | Inventory, receipts, stock movements | **Blocked from cost & margin numbers** |
| **Accounts**| Invoicing, collections, payment follow-up | **Exclusive permission to approve payment reminders** |


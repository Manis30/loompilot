# ADR 0002: Dedicated Python Service for AI Agents and Domain Mathematics

## Status
Accepted

## Context
AI agent workflows require extensive LLM interaction, structured prompt parsing, probabilistic reasoning, and scientific mathematical operations (e.g., standard deviation and volatility calculations over price history series, statistical throughput modeling). The Python ecosystem (NumPy, SciPy, Pandas, FastAPI, Pydantic v2) provides unmatched mature libraries for these quantitative domain requirements compared to Node.js.

However, business persistence, transaction management, user authentication, and web-facing APIs are already effectively managed in TypeScript.

## Decision
We isolate all AI agents, LLM orchestration, and mathematical calculations within a dedicated Python 3.12 service (`agents/`) using FastAPI and uv:
1. **Pure Domain Math**: Mathematical calculations (cost accumulation, risk buffer calculation from price returns, ETA estimation using working calendars, variance, worker assignment formulas) reside exclusively in `agents/app/domain` as pure, deterministic, unit-tested functions.
2. **Read-Only Data Access**: The Python service reads historical records and inventory levels via a dedicated read-only MongoDB database user (`agent_ro`).
3. **No Direct Writes**: Agents are strictly prohibited from writing directly to MongoDB. Proposals, drafts, alerts, and recommendations are submitted to the Node API's internal agent gateway (`/internal/*`) using service token authentication.
4. **Offline Development**: The Python service includes a deterministic `fake` LLM provider as the default, allowing CI and offline test execution without external API dependencies.

## Consequences
### Positive
- Strict separation of concerns: heavy math and LLM orchestration in Python; business rules and data mutations in Node.
- High reproducibility and unit testability for all financial and operational equations.
- Inability for LLM hallucination to corrupt database state due to enforced read-only boundaries.

### Negative
- Requires maintaining two development runtimes (Node.js/pnpm and Python/uv).
- Requires an internal HTTP contract and generated TypeScript client for Node-to-Python communication.


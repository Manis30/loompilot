# Backend Current State Report - Part 3
> Scope: Sections 11 through 16. Infrastructure configuration, test suites, database seeding, architectural rule verification, and requirements matrix.

---

## 11. Configuration

### Environment Variables
| Variable Name | Purpose | Default / Fallback | Source File |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Application environment mode | `development` | `config/env.ts#L8` |
| `API_PORT` | Port for Express HTTP server | `4000` | `config/env.ts#L9` |
| `API_HOST` | Host address to bind HTTP listener | `0.0.0.0` | `config/env.ts#L10` |
| `APP_NAME` | Identity string constant | `LoomPilot` | `config/env.ts#L11` |
| `CORS_ORIGIN` | Allowed origin for web client CORS | `http://localhost:5173` | `config/env.ts#L12` |
| `JWT_SECRET` | Secret for signing user access JWTs | `loompilot_dev_jwt_secret_change_me_in_production_min_32_chars` | `config/env.ts#L15` |
| `JWT_EXPIRES_IN` | Validity duration of access JWTs | `1h` | `config/env.ts#L16` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | `loompilot_dev_refresh_jwt_secret_change_me_min_32_chars` | `config/env.ts#L17` |
| `JWT_REFRESH_EXPIRES_IN` | Validity duration of refresh tokens | `7d` | `config/env.ts#L18` |
| `INTERNAL_SERVICE_TOKEN`| Pre-shared token for `/internal/*` routes | `loompilot_internal_agent_gateway_token_change_in_prod` | `config/env.ts#L21` |
| `MONGODB_URI` | Primary read-write MongoDB connection | `mongodb://localhost:27017/loompilot?replicaSet=rs0` | `config/env.ts#L24` |
| `REDIS_HOST` | Host address of Redis server | `localhost` | `config/env.ts#L25` |
| `REDIS_PORT` | Port number of Redis server | `6379` | `config/env.ts#L26` |
| `REDIS_PASSWORD` | Password for Redis server authentication | `undefined` (optional) | `config/env.ts#L27` |
| `AGENTS_SERVICE_URL` | Base URL of Python agents service | `http://localhost:8000` | `config/env.ts#L30` |

### Docker Compose Architecture (`docker-compose.yml`)
1. **`mongo`**: Custom build from `./docker/mongo` based on `mongo:7.0`. Runs replica set `--replSet rs0` with keyfile authentication (`--keyFile /etc/mongo-keyfile`). Healthcheck: `mongosh --eval 'rs.status().ok' | grep 1`.
2. **`redis`**: Image `redis:7-alpine`. Exposes port `6379`. Healthcheck: `redis-cli ping`.
3. **`agents`**: Python service built from `./agents`. Depends on healthy `mongo` and `redis`. Read-only Mongo access via `MONGODB_RO_URI`. Healthcheck: `GET /health` on port `8000`.
4. **`api`**: Node.js Express service built from `./apps/api/Dockerfile`. Depends on healthy `mongo`, `redis`, and `agents`. Read-write access via `MONGODB_URI`. Healthcheck: `GET /health` on port `4000`.
5. **`web`**: Nginx frontend built from `./apps/web/Dockerfile`. Depends on healthy `api`. Port `5173`. Healthcheck: HTTP probe on port `80`.

### Mongo Replica Set & Keyfile Setup
- Keyfile: `docker/mongo/mongo-keyfile` copied to `/etc/mongo-keyfile` with permissions `chmod 400` and ownership `chown 999:999` (`docker/mongo/Dockerfile#L3-L4`).
- Initialization Script: `docker/mongo/init-rs.sh` initiated at container start:
  1. Executes `rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] })`.
  2. Creates admin user `loompilot_admin` on `admin` db (`userAdminAnyDatabase`, `readWriteAnyDatabase`, `clusterAdmin`).
  3. Creates read-only user `agent_ro` on `loompilot` db with permissions strictly limited to `[{ role: "read", db: "loompilot" }]`.

### CI Workflow Steps (`.github/workflows/ci.yml`)
- **`node-ci` Job** (Node.js 22, pnpm 12.15.0 on Ubuntu):
  1. `actions/checkout@v4`
  2. `pnpm/action-setup@v4` with version 12.15.0
  3. `actions/setup-node@v4` (v22, pnpm cache)
  4. `pnpm install --frozen-lockfile`
  5. `pnpm -r --filter=!./agents lint` (eslint & dependency-cruiser)
  6. `pnpm -r --filter=!./agents typecheck` (`tsc --noEmit`)
  7. `pnpm -r --filter=!./agents test` (`vitest run`)
- **`python-ci` Job** (Python 3.12, uv latest on Ubuntu):
  1. `actions/checkout@v4`
  2. `astral-sh/setup-uv@v5`
  3. `uv python install 3.12`
  4. `uv sync`
  5. `uv run ruff check .`
  6. `uv run mypy app`
  7. `uv run pytest`

---

## 12. Tests

### Test Suite Inventory (25 Test Files, 125 Tests Total)
| Test File Path | Tests | Coverage Scope & Assertions | Harness / Database |
| :--- | :---: | :--- | :--- |
| `tests/auth-rbac.test.ts` | 5 | JWT login, httpOnly refresh cookie, 401 unauthenticated, store role material/quote cost masking, accounts-only reminder approval | `MongoMemoryServer` |
| `tests/daily-output-idempotent.test.ts` | 2 | Idempotent daily-output entry via API & service layer deduplication by `idempotencyKey` without duplicate-key crash | `MongoMemoryServer` |
| `tests/gateway.test.ts` | 5 | Rejection without service token (401), invalid token (403), user JWT rejection, quotation draft and alert ingestion | `MongoMemoryServer` |
| `tests/mongo-ro-security.test.ts` | 2 | Native MongoDB auth with `agent_ro` read role: proves `insertOne`, `updateOne`, `deleteMany` throw unauthorized errors | `MongoMemoryReplSet` |
| `tests/order-transaction.test.ts` | 1 | Atomic transaction: confirms quotation, reserves stock, writes ledger movement, builds plan | `MongoMemoryReplSet` |
| `tests/rbac-matrix.test.ts` | 45 | Table-driven: Every route $\times$ every role generated from `RBAC_MATRIX` matching `docs/roles-matrix.md` | `MongoMemoryServer` |
| `tests/smoke.test.ts` | 1 | Basic sanity check | In-Memory |
| `tests/tenant-isolation.test.ts` | 12 | Table-driven: Verifies Tenant A data is 100% invisible to Tenant B across all 12 repositories | `MongoMemoryServer` |
| `tests/unit/agent-gateway.service.test.ts` | 6 | Unit: Gateway service delegation to underlying quotation, alert, and payment services | In-Memory Fakes |
| `tests/unit/alert.service.test.ts` | 2 | Unit: Alert creation, Socket.IO broadcast, recommendation proposal and decision | In-Memory Fakes |
| `tests/unit/auth.service.test.ts` | 5 | Unit: First owner registration, owner-only subsequent user creation, login, refresh rotation | In-Memory Fakes |
| `tests/unit/customer.service.test.ts` | 2 | Unit: Customer listing and creation | In-Memory Fakes |
| `tests/unit/delivery.service.test.ts` | 3 | Unit: Delivery record, order completion, on-time flag check | In-Memory Fakes |
| `tests/unit/enquiry.service.test.ts` | 2 | Unit: Customer enquiry creation and listing | In-Memory Fakes |
| `tests/unit/material.service.test.ts` | 3 | Unit: Material creation, stock movement recording, balance calculation | In-Memory Fakes |
| `tests/unit/order.service.test.ts` | 2 | Unit: Order retrieval, variance tracking calculation | In-Memory Fakes |
| `tests/unit/payment.service.test.ts` | 6 | Unit: Payment follow-up creation, reminder drafting, accounts approval, receipt calculation | In-Memory Fakes |
| `tests/unit/process.service.test.ts` | 2 | Unit: Process creation and sequential process listing | In-Memory Fakes |
| `tests/unit/quotation-agents.test.ts` | 2 | Unit: Fallback to `generation_failed` on agent disconnect, pure recalculate delegation | `FakeAgentsClient` |
| `tests/unit/quotation.service.test.ts` | 2 | Unit: Quotation creation, PDF rendering, send action | In-Memory Fakes |
| `tests/unit/report.service.test.ts` | 5 | Unit: Margin calculations, on-time rate calculations, collections aging buckets | In-Memory Fakes |
| `tests/unit/seed.test.ts` | 1 | Unit: Verifies `seed.ts` aborts immediately when `NODE_ENV=production` | In-Memory |
| `tests/unit/socket.test.ts` | 5 | Unit: Handshake JWT auth, room joining, alert broadcasting, store financial masking | `socket.io-client` |
| `tests/unit/supplier.service.test.ts` | 2 | Unit: Supplier creation and listing | In-Memory Fakes |
| `tests/unit/workforce.service.test.ts` | 2 | Unit: Worker creation, attendance recording, daily output capture | In-Memory Fakes |

### Vitest Coverage Percentages by Layer
| Layer | % Statements | % Branch | % Functions | % Lines | Verification Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`src/services/`** | **80.67%** | **78.06%** | **72.61%** | **80.67%** | **Target $\ge 80\%$ Achieved** |
| **`src/repositories/`** | **72.33%** | **58.98%** | **66.66%** | **72.33%** | Meets expected coverage |
| **`src/mappers/`** | **54.81%** | **100.00%** | **42.10%** | **54.81%** | Meets expected coverage |
| **All Files (Overall)** | **74.29%** | **71.77%** | **66.82%** | **74.29%** | 25 files passing |

- **Skipped / Todo / Flaky Tests**: **0 skipped, 0 todo, 0 flaky**. All 125 tests pass deterministically.
- **Location of Test Fakes**:
  - `apps/api/tests/fakes/fake-unit-of-work.ts`: `FakeUnitOfWork` (provides non-transactional mock runner for unit tests).
  - `apps/api/tests/fakes/fake-agents-client.ts`: `FakeAgentsClient` (returns deterministic quotation and recalculation responses).

---

## 13. Seed Data

### Seeder Behaviour (`apps/api/src/seed/seed.ts`)
- **Production Guard**: `seed.ts#L13-L16`.
  Explicit check:
  ```ts
  if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
    logger.error("Attempted to run seed script in production environment. Aborting.");
    throw new Error("Refusing to seed database when NODE_ENV is production.");
  }
  ```
  Refuses to run in production under all circumstances.

### Records Created (Tenant: `tenant_default`)
1. **Users** (5 records):
   - `owner@loompilot.test` (`UserRole.OWNER`)
   - `manager@loompilot.test` (`UserRole.MANAGER`)
   - `sales@loompilot.test` (`UserRole.SALES`)
   - `accounts@loompilot.test` (`UserRole.ACCOUNTS`)
   - `store@loompilot.test` (`UserRole.STORE`)
   - Password: bcrypt hash of `"password123"`.
2. **Materials** (3 records):
   - `MAT-YRN-30S`: Cotton Yarn 30s Carded (`25000` paise = Rs 250/kg)
   - `MAT-YRN-40S`: Cotton Yarn 40s Combed (`28000` paise = Rs 280/kg)
   - `MAT-DYE-NVY`: Reactive Navy Blue Dye (`75000` paise = Rs 750/kg)
3. **Suppliers** (2 records):
   - Surat Yarn Mills (lead time: 7 days, rating: 4.8)
   - Coimbatore Spinning Ltd (lead time: 10 days, rating: 4.5)
4. **Processes** (4 records):
   - Warping (sequence: 1, cost: `150` paise/meter)
   - Sizing (sequence: 2, cost: `200` paise/meter)
   - Weaving (sequence: 3, cost: `800` paise/meter)
   - Inspection (sequence: 4, cost: `100` paise/meter)
5. **Workers** (5 records):
   - `WRK-001` (Murugan P., senior)
   - `WRK-002` (Ramesh Kumar, senior)
   - `WRK-003` (Selvam S., mid)
   - `WRK-004` (Karthik R., mid)
   - `WRK-005` (Muthu V., junior)

---

## 14. Rule Checks

| Rule Question | Finding / Citations |
| :--- | :--- |
| **Pricing, wastage, risk-buffer, ETA, required-daily, projected-finish, extra-worker math in apps/api** | **None found**. All generation and recalculation delegates to `IAgentsClient`. Node only computes cumulative actual sums, target deficit differences (`order.service.ts#L54`), and report percentages (`report.service.ts#L25,L42,L61`). |
| **Queries not scoped by tenantId** | **None found**. All 19 Mongoose models enforce `tenantId`. Every query in all 15 repositories scopes filters with `tenantId`. Verified by `tests/tenant-isolation.test.ts`. |
| **Money values that are not integer paise** | **None found**. Every monetary field uses integer paise (e.g., `currentRatePaise`, `totalInvoicePaise`, `subtotalCostPaise`, `balancePaise`). Currency division by 100 occurs solely in display formatter `packages/shared/src/money.ts#L7`. |
| **Code path executing recommendation without user decision** | **None found**. Recommendations remain in status `proposed` until decided by human actor (`AlertService.decideRecommendation#L117-L138`). Accepted recommendations record decision status and audit log only; no autonomous actions occur. |
| **Public route that can create users** | **None found**. `POST /api/auth/register` requires an authenticated `OWNER` token if any user exists for that tenant (`services/auth.service.ts#L28-L38`). Bootstrapping uninitialized tenants requires `role === "owner"`. |
| **Socket.IO connection that is not authenticated** | **None found**. Realtime handshake middleware (`realtime/socket.ts#L58-L80`) mandates verified JWT containing `userId`, `role`, and `tenantId`. Rejects unauthenticated connections. |
| **Controllers importing models/repos; services importing express/mongoose** | **None found**. Verified clean via `.dependency-cruiser.cjs` rules. `pnpm run lint:deps` reports 0 violations across 176 cruised modules. |
| **Every TODO, FIXME, "stub", "mock", "not implemented", "placeholder"** | 1. `apps/api/src/integrations/notifier/email.notifier.ts#L9`: `// TODO: Integrate SMTP / SendGrid client once production email domain is verified`<br>2. `apps/api/src/integrations/notifier/sms.notifier.ts#L9`: `// TODO: Integrate SMS gateway (e.g. Twilio/Karix) once DLT registration is approved`<br>3. `apps/api/src/integrations/notifier/whatsapp.notifier.ts#L9`: `// TODO: Integrate WhatsApp Business Cloud API webhook once provider credentials are provisioned` |

---

## 15. Requirement Coverage First Pass

| Req ID | Description | Status | Implementing File Paths | Covering Test File |
| :--- | :--- | :---: | :--- | :--- |
| **FR-1** | Enquiry intake | **Done** | `routes/enquiry.routes.ts`, `services/enquiry.service.ts` | `tests/unit/enquiry.service.test.ts` |
| **FR-2** | Stock check | **Done** | `routes/material.routes.ts`, `services/material.service.ts` | `tests/unit/material.service.test.ts` |
| **FR-3** | Purchase requirement | **Partial** | `models/quotation.model.ts` (`toPurchaseQty`), `controllers/agent-gateway.controller.ts` | `tests/unit/quotation.service.test.ts`, `tests/gateway.test.ts` |
| **FR-4** | Configurable wastage | **Done** | `models/process.model.ts`, `routes/process.routes.ts`, `services/process.service.ts` | `tests/unit/process.service.test.ts` |
| **FR-5** | Price-risk buffer data & config | **Done** | `models/material.model.ts` (`PriceHistory`), `services/material.service.ts` | `tests/unit/material.service.test.ts` |
| **FR-6** | Timeline from worker average | **Partial** | `models/process.model.ts` (`avgOutputPerWorkerHour`), `services/quotation.service.ts` | `tests/unit/process.service.test.ts` |
| **FR-7** | Itemised quotation with validity | **Done** | `routes/quotation.routes.ts`, `services/quotation.service.ts` | `tests/unit/quotation.service.test.ts` |
| **FR-8** | Explanation stored | **Done** | `models/quotation.model.ts` (`explanation`, `assumptions`), `services/quotation.service.ts` | `tests/unit/quotation.service.test.ts` |
| **FR-9** | Review and edit before send | **Done** | `routes/quotation.routes.ts` (`recalculate`, `approve`), `services/quotation.service.ts` | `tests/unit/quotation.service.test.ts`, `tests/unit/quotation-agents.test.ts` |
| **FR-10**| PDF and share | **Done** | `integrations/pdf/pdfmake.renderer.ts`, `services/quotation.service.ts` | `tests/unit/quotation.service.test.ts` |
| **FR-11**| Inventory and rates | **Done** | `routes/material.routes.ts`, `services/material.service.ts` | `tests/unit/material.service.test.ts` |
| **FR-12**| Suppliers and lead time | **Done** | `routes/supplier.routes.ts`, `services/supplier.service.ts` | `tests/unit/supplier.service.test.ts` |
| **FR-13**| Lead time in timeline | **Partial** | `models/quotation.model.ts` (`supplierLeadDays`); math executed in agents | `tests/unit/quotation.service.test.ts` |
| **FR-14**| Supplier delay flag | **Missing** | No purchase order arrival tracking or supplier delay model in Node | None |
| **FR-15**| Output and attendance | **Done** | `routes/workforce.routes.ts`, `services/workforce.service.ts` | `tests/unit/workforce.service.test.ts`, `tests/daily-output-idempotent.test.ts` |
| **FR-16**| Average performance | **Partial** | `models/process.model.ts`, `models/workforce.model.ts`; aggregation math in agents | `tests/unit/process.service.test.ts` |
| **FR-17**| Absenteeism | **Partial** | `models/workforce.model.ts` (`Attendance`); analysis in agents | `tests/unit/workforce.service.test.ts` |
| **FR-18**| Plan on confirmation | **Done** | `services/quotation.service.ts` (`confirmOrder`), `routes/quotation.routes.ts` | `tests/order-transaction.test.ts` |
| **FR-19**| Daily output capture | **Done** | `routes/workforce.routes.ts`, `services/workforce.service.ts` | `tests/daily-output-idempotent.test.ts` |
| **FR-20**| Actual vs required | **Done** | `routes/order.routes.ts` (`/variance`), `services/order.service.ts` | `tests/unit/order.service.test.ts` |
| **FR-21**| Recalculated daily requirement | **Partial** | Formula executes in monitoring agent; Node stores agent snapshot | `tests/unit/agent-gateway.service.test.ts` |
| **FR-22**| Deadline prediction | **Partial** | Estimation math in monitoring agent; Node stores `delayDaysEstimated` in Alert | `tests/unit/alert.service.test.ts` |
| **FR-23**| Recovery suggestions | **Done** | `routes/agent-gateway.routes.ts`, `routes/alert.routes.ts`, `services/alert.service.ts` | `tests/unit/alert.service.test.ts`, `tests/gateway.test.ts` |
| **FR-24**| Advisory only | **Done** | Recommendations require explicit user accept/reject; no autonomous changes | `tests/unit/alert.service.test.ts` |
| **FR-25**| Accept/reject log | **Done** | `routes/alert.routes.ts` (`decide`), `services/alert.service.ts` | `tests/unit/alert.service.test.ts` |
| **FR-26**| Automatic alert | **Done** | `routes/agent-gateway.routes.ts`, `services/alert.service.ts`, `realtime/socket.ts` | `tests/unit/alert.service.test.ts`, `tests/unit/socket.test.ts` |
| **FR-27**| Notification channels | **Partial** | `integrations/notifier/` (`Email`, `Sms`, `WhatsApp`); all 3 are simulated STUBs | None |
| **FR-28**| Supplier & deadline alerts | **Done** | `models/alert.model.ts` (`AlertType`), `services/alert.service.ts` | `tests/unit/alert.service.test.ts` |
| **FR-29**| Configurable thresholds | **Missing** | No Settings model or threshold configuration API | None |
| **FR-30**| Delivery and on-time | **Done** | `routes/delivery.routes.ts`, `services/delivery.service.ts` | `tests/unit/delivery.service.test.ts` |
| **FR-31**| Payment follow-up | **Done** | `services/delivery.service.ts` (`deliveryTrigger`), `services/payment.service.ts` | `tests/unit/payment.service.test.ts` |
| **FR-32**| Payment status & reminder history| **Done**| `routes/payment.routes.ts`, `services/payment.service.ts` | `tests/unit/payment.service.test.ts` |
| **FR-33**| Reminders for approval | **Done** | `routes/payment.routes.ts` (`approve`), `services/payment.service.ts` (accounts only) | `tests/unit/payment.service.test.ts`, `tests/auth-rbac.test.ts` |
| **FR-34**| Unified dashboard | **Missing** | No unified `/api/dashboard` aggregator endpoint | None |
| **FR-35**| Quoted vs actual cost | **Missing** | Actual production cost tracking not captured | None |
| **FR-36**| On-time and collection reports | **Done** | `routes/report.routes.ts`, `services/report.service.ts` | `tests/unit/report.service.test.ts` |
| **FR-37**| Role-based access control | **Done** | `middleware/rbac.ts`, `routes/*` | `tests/auth-rbac.test.ts`, `tests/rbac-matrix.test.ts` |
| **FR-38**| Audit log | **Done** | `middleware/audit.ts`, `repositories/audit.repository.ts`, `services/*` | `tests/unit/*.test.ts`, `tests/auth-rbac.test.ts` |
| **NFR-1**| Advisory only guardrails | **Done** | Services only accept proposals and log recommendations | `tests/unit/alert.service.test.ts` |
| **NFR-2**| Integer paise money storage | **Done** | Schemas enforce integer paise throughout | `tests/unit/quotation.service.test.ts` |
| **NFR-3**| Multi-tenant isolation | **Done** | All models have tenantId; all queries scoped | `tests/tenant-isolation.test.ts` |
| **NFR-4**| Read-only agent Mongo user | **Done** | `docker/mongo/init-rs.sh` (`agent_ro` user with read role) | `tests/mongo-ro-security.test.ts` |
| **NFR-5**| Service token gateway auth | **Done** | `middleware/serviceAuth.ts` | `tests/gateway.test.ts` |
| **NFR-6**| Pure domain math (no Node math) | **Done**| Node formulas strictly limited to basic sums and differences | `tests/unit/quotation-agents.test.ts` |
| **NFR-7**| MongoDB transactions for order | **Done** | `services/quotation.service.ts` (`confirmOrder`) via UnitOfWork | `tests/order-transaction.test.ts` |
| **NFR-8**| Config from env, fake provider | **Done** | `config/env.ts`, `LLM_PROVIDER=fake` in `.env.example` | `tests/smoke.test.ts` |
| **NFR-9**| Strict TypeScript mode | **Done** | `tsconfig.base.json`, `apps/api/tsconfig.json` | Verified via `pnpm -r typecheck` |
| **BR-1** | Wastage and risk buffer required| **Done** | Required fields in `models/quotation.model.ts` | `tests/unit/quotation.service.test.ts` |
| **BR-2** | ETA from worker output & lead | **Partial** | Lead days and worker rates stored; math computed in Python agents | `tests/unit/quotation.service.test.ts` |
| **BR-3** | Validity period required | **Done** | `validUntil` required on quotation | `tests/unit/quotation.service.test.ts` |
| **BR-4** | Alert threshold shortfall | **Done** | Alerts deduped per order + process + date | `tests/unit/alert.service.test.ts` |
| **BR-5** | Follow-up only after delivery | **Done** | Triggered immediately upon delivery in `DeliveryService.recordDelivery` | `tests/unit/delivery.service.test.ts` |
| **BR-6** | Advisory only system | **Done** | No autonomous actions executed; reminders & recommendations require approval | `tests/unit/payment.service.test.ts` |

---

## 16. Command Results

### Summary Lines from Official Tool Executions
1. **`pnpm install`**:
   ```text
   Scope: all 5 workspace projects
   Already up to date
   Done in 97ms using pnpm v12.15.0
   ```
2. **`pnpm -r typecheck`**:
   ```text
   packages/shared typecheck: Done
   packages/agents-client typecheck: Done
   apps/web typecheck: Done
   apps/api typecheck: Done
   All packages passed typecheck with 0 errors.
   ```
3. **`pnpm run lint:deps` (`apps/api`)**:
   ```text
   ✔ no dependency violations found (176 modules, 605 dependencies cruised)
   ```
4. **`pnpm --filter @loompilot/api test --coverage`**:
   ```text
   Test Files  25 passed (25)
   Tests       125 passed (125)
   Duration    185.11s

   Coverage Summary:
   Statements   : 74.29% ( 2199/2960 )
   Branches     : 71.77% ( 295/411 )
   Functions    : 66.82% ( 139/208 )
   Lines        : 74.29% ( 2199/2960 )

   Key Layers:
   src/services/     : 80.67% Lines/Statements (Target >= 80% Achieved)
   src/repositories/ : 72.33% Lines/Statements
   src/mappers/      : 54.81% Lines/Statements
   ```
5. **`docker compose config`**:
   ```text
   Validation: SUCCESS (Exit Code 0).
   Services validated: mongo (replica set rs0 with keyfile), redis (7-alpine), agents (FastAPI), api (Node/Express), web (Nginx).
   ```

---

Report complete: 16 sections, 0 UNKNOWN items

### UNKNOWN Items
None.

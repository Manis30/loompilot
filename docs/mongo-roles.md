# MongoDB Atlas Security Roles & Read Views Configuration

## 1. Overview
In MongoDB Atlas, database users and custom roles cannot be created via the standard `mongosh` shell commands (`db.createUser` / `db.createRole`) because Atlas manages authentication credentials through its central control plane.

This document provides step-by-step instructions to configure the read-only database users using the **Atlas Web UI**, the **Atlas CLI (`atlas`)**, or the **Atlas Administration REST API**:
- **`agents_ro`**: Read-only user for analytical Python backend agents (`agents/`). Configured via a strict **ALLOWLIST** of domain collections plus `agentSafeUsers`. Never has access to authentication credentials, internal audit logs, job queues, or confidential costing collections.
- **`chat_ro`**: Read-only user for client-facing conversational LLM tools. Scoped strictly to the client-safe views (`clientSafeOrders`, `clientSafeQuotations`, and `clientSafeRevisions`).

---

## 2. Role Specifications & Collection Access Boundaries

| Role / User | Database Scope | Allowed Resources (Strict Allowlist) | Denied / Excluded Resources |
|---|---|---|---|
| **`agents_ro`** | `loompilot` only | **Explicit Collection Allowlist**:<br>• `machines`<br>• `materials`<br>• `products`<br>• `marketSources`<br>• `priceObservations`<br>• `priceHistory`<br>• `priceAlerts`<br>• `orders`<br>• `feasibilityReports`<br>• `quotations`<br>• `quotationRevisions`<br>• `purchaseDecisions`<br>• `orderAssignments`<br>• `deliveries`<br>• `payments`<br>• `supervisorDailyReports`<br>• `dailyOutputs`<br>• `machineStatusLogs`<br>• `monitoringSnapshots`<br>• `stockMovements`<br>• `reservations`<br>• `alerts`<br>• `clientInteractions`<br>• `conversations`<br>• `messages`<br>• `escalations`<br>• `agentRuns`<br>• `settings`<br>• `clients`<br>• `suppliers`<br>• **`agentSafeUsers`** (read-only view exposing id, name, role, processAreas, status) | **Strictly Forbidden** (never granted):<br>❌ `users`<br>❌ `clientAccounts`<br>❌ `auditLogs`<br>❌ `refreshTokens`<br>❌ `idempotencyKeys`<br>❌ `outboxMessages`<br>❌ `notifications`<br>❌ `files`<br>❌ `importJobs`<br>❌ `quotationCostings` |
| **`chat_ro`** | `loompilot` only | **Views only**:<br>• `clientSafeOrders`<br>• `clientSafeQuotations`<br>• `clientSafeRevisions` | All base collections and administrative costing/job collections. |

> [!IMPORTANT]
> **Client Isolation Warning**:
> MongoDB Atlas RBAC enforces collection- and view-level access boundaries, but cannot enforce row/document-level tenant filtering natively.
> **Per-client and per-tenant isolation MUST be strictly enforced by the Agent Tools and Application Gateway** by including mandatory `tenantId` and `clientId` query filters on all view queries.

---

## 3. Provisioning Method A: Atlas Web UI

### Step 1: Create Custom Roles
1. In the Atlas Console, navigate to **Security** > **Database Access** > **Custom Roles**.
2. Click **Add Custom Role**:
   - **Role Name**: `LoomPilotAgentsAllowlistReadOnly`
     - **Database**: `loompilot`
     - **Actions**: `find` on the exact allowlist collections: `machines`, `materials`, `products`, `marketSources`, `priceObservations`, `priceHistory`, `priceAlerts`, `orders`, `feasibilityReports`, `quotations`, `quotationRevisions`, `purchaseDecisions`, `orderAssignments`, `deliveries`, `payments`, `supervisorDailyReports`, `dailyOutputs`, `machineStatusLogs`, `monitoringSnapshots`, `stockMovements`, `reservations`, `alerts`, `clientInteractions`, `conversations`, `messages`, `escalations`, `agentRuns`, `settings`, `clients`, `suppliers`, and `agentSafeUsers`.
   - **Role Name**: `LoomPilotChatReadOnly`
     - **Database**: `loompilot`
     - **Actions**: `find` on views: `clientSafeOrders`, `clientSafeQuotations`, `clientSafeRevisions`.

### Step 2: Create Database Users
1. Go to **Security** > **Database Access** > **Database Users**.
2. Click **Add New Database User**:
   - **Authentication Method**: Password (or AWS IAM / X.509).
   - **Username**: `agents_ro`
   - **Password**: Generate secure 32+ character passphrase.
   - **Database User Privileges**: Assign `LoomPilotAgentsAllowlistReadOnly`.
3. Repeat for `chat_ro`:
   - **Username**: `chat_ro`
   - **Password**: Generate secure 32+ character passphrase.
   - **Database User Privileges**: Assign `LoomPilotChatReadOnly`.

---

## 4. Provisioning Method B: Atlas CLI (`atlas`)

Ensure you have the MongoDB Atlas CLI installed and authenticated (`atlas auth login`).

### Step 1: Create Custom Roles
```bash
# Custom role for chat_ro
atlas customDbRoles create LoomPilotChatReadOnly \
  --privilege find@loompilot.clientSafeOrders \
  --privilege find@loompilot.clientSafeQuotations \
  --privilege find@loompilot.clientSafeRevisions \
  --projectId "<ATLAS_PROJECT_ID>"

# Custom role for agents_ro (explicit collection allowlist)
atlas customDbRoles create LoomPilotAgentsAllowlistReadOnly \
  --privilege find@loompilot.machines \
  --privilege find@loompilot.materials \
  --privilege find@loompilot.products \
  --privilege find@loompilot.marketSources \
  --privilege find@loompilot.priceObservations \
  --privilege find@loompilot.priceHistory \
  --privilege find@loompilot.priceAlerts \
  --privilege find@loompilot.orders \
  --privilege find@loompilot.feasibilityReports \
  --privilege find@loompilot.quotations \
  --privilege find@loompilot.quotationRevisions \
  --privilege find@loompilot.purchaseDecisions \
  --privilege find@loompilot.orderAssignments \
  --privilege find@loompilot.deliveries \
  --privilege find@loompilot.payments \
  --privilege find@loompilot.supervisorDailyReports \
  --privilege find@loompilot.dailyOutputs \
  --privilege find@loompilot.machineStatusLogs \
  --privilege find@loompilot.monitoringSnapshots \
  --privilege find@loompilot.stockMovements \
  --privilege find@loompilot.reservations \
  --privilege find@loompilot.alerts \
  --privilege find@loompilot.clientInteractions \
  --privilege find@loompilot.conversations \
  --privilege find@loompilot.messages \
  --privilege find@loompilot.escalations \
  --privilege find@loompilot.agentRuns \
  --privilege find@loompilot.settings \
  --privilege find@loompilot.clients \
  --privilege find@loompilot.suppliers \
  --privilege find@loompilot.agentSafeUsers \
  --projectId "<ATLAS_PROJECT_ID>"
```

### Step 2: Create Database Users
```bash
atlas dbusers create \
  --username agents_ro \
  --password "<SECURE_PASSWORD>" \
  --role LoomPilotAgentsAllowlistReadOnly@loompilot \
  --projectId "<ATLAS_PROJECT_ID>"

atlas dbusers create \
  --username chat_ro \
  --password "<SECURE_PASSWORD>" \
  --role LoomPilotChatReadOnly@loompilot \
  --projectId "<ATLAS_PROJECT_ID>"
```

---

## 5. Provisioning Method C: Atlas Administration REST API

Use the Atlas Administration API endpoint `/groups/{GROUP-ID}/databaseUsers`:

```bash
curl --user "{PUBLIC_KEY}:{PRIVATE_KEY}" --digest \
  --header "Accept: application/vnd.atlas.2023-01-01+json" \
  --header "Content-Type: application/json" \
  --include \
  --request POST "https://cloud.mongodb.com/api/atlas/v2/groups/{GROUP-ID}/databaseUsers" \
  --data '{
    "databaseName": "admin",
    "password": "<SECURE_PASSWORD>",
    "roles": [
      {
        "databaseName": "loompilot",
        "roleName": "LoomPilotChatReadOnly"
      }
    ],
    "username": "chat_ro"
  }'
```

---

## 6. Client-Safe and Agent-Safe Aggregation Views Setup

Before client queries can be routed to `clientSafeOrders`, `clientSafeQuotations`, `clientSafeRevisions`, and `agentSafeUsers`, the views must be created in the database. Run the migration script via Node.js:

```bash
pnpm --filter @loompilot/api tsx src/seed/migrations/create-views.ts
```

The migration defines:
- **`clientSafeOrders`**: Computed client status (`received`, `under_review`, `quotation_ready`, `confirmed`, `in_production`, `ready`, `delivered`, `closed`, `declined`) and public timeline/progress metrics.
- **`clientSafeQuotations`**: Filtering `$match` admitting only customer-visible states (`sent`, `accepted`, `declined`, `expired`) and whitelist projection of pricing, valid-until, and `clientExplanation`. Internal explanation, assumptions, costings, and margins are strictly excluded.
- **`clientSafeRevisions`**: Customer-visible revisions (`sent`, `accepted`, `declined`) exposing agreed price changes and reasons without internal cost drivers.
- **`agentSafeUsers`**: Sanitized projection of `users` exposing `_id`, `tenantId`, `name`, `role`, `processAreas`, and `status`, while hiding password hashes and contact/lockout secrets.

# MongoDB Atlas Security Roles & Read Views Configuration (Stage 3.5 Step 4)

## 1. Overview
In MongoDB Atlas, database users and custom roles are managed securely through Atlas control planes (Web UI, Atlas CLI, or Atlas Administration API).

This document establishes the least-privilege security boundaries and read-only views for external consumers:
- **`chat_ro`**: Read-only user for client-facing conversational LLM tools. Scoped strictly to the two client-safe views (`clientSafeOrders` and `clientSafeProducts`).
- **`agents_ro`**: Read-only user for analytical Python backend agents (`agents/`). Configured via a strict **ALLOWLIST** of 10 domain collections plus 3 agent-safe views (`agentSafeOrders`, `agentSafeUsers`, `agentSafeClients`). Never granted base `orders`, `users`, `clients`, or any platform collection.
- **`admin_assistant_ro`**: Documented (uncreated) future role for executive/admin assistant workflows requiring operational audit and costing access.

---

## 2. Role Specifications & Collection Access Boundaries

| Role / User | Database Scope | Allowed Resources (Strict Allowlist) | Denied / Excluded Resources |
|---|---|---|---|
| **`chat_ro`** | `loompilot` only | **Views only**:<br>• `clientSafeOrders`<br>• `clientSafeProducts` | All base collections (`orders`, `products`, `materials`, `users`, `clients`), costing, and platform collections. |
| **`agents_ro`** | `loompilot` only | **Explicit Allowlist (13 Resources)**:<br>• `agentSafeOrders` (view)<br>• `agentSafeUsers` (view)<br>• `agentSafeClients` (view)<br>• `materials`<br>• `machines`<br>• `products`<br>• `suppliers`<br>• `marketPrices`<br>• `supervisorDailyReports`<br>• `stockMovements`<br>• `maintenanceTickets`<br>• `settings`<br>• `agentRuns` | **Strictly Forbidden** (never granted):<br>❌ `orders` (base collection)<br>❌ `users` (base collection)<br>❌ `clients` (base collection)<br>❌ `auditLogs`<br>❌ `refreshTokens`<br>❌ `idempotencyKeys`<br>❌ `outboxMessages`<br>❌ `notifications`<br>❌ `files`<br>❌ `importJobs`<br>❌ `counters` |
| **`admin_assistant_ro`**<br>*(Documented Only)* | `loompilot` only | *Planned Future Scope*:<br>• `orders`<br>• `auditLogs`<br>• `agentSafeUsers`<br>• `clients`<br>• Selected catalog/operational collections | Direct modifications (write actions), auth tokens, secrets. |

> [!IMPORTANT]
> **Tenant & Client Isolation**:
> MongoDB Atlas RBAC enforces database- and collection/view-level boundaries.
> Document-level multi-tenancy (`tenantId` and `clientId`) is enforced strictly at the API and agent query generation layers.

---

## 3. Provisioning Method A: Atlas Web UI

### Step 1: Create Custom Roles
1. In the Atlas Console, navigate to **Security** > **Database Access** > **Custom Roles**.
2. Click **Add Custom Role**:
   - **Role Name**: `LoomPilotChatReadOnly`
     - **Database**: `loompilot`
     - **Actions**: `find` on `clientSafeOrders` and `clientSafeProducts`.
   - **Role Name**: `LoomPilotAgentsAllowlistReadOnly`
     - **Database**: `loompilot`
     - **Actions**: `find` on the exact 13 allowlisted resources:
       `agentSafeOrders`, `agentSafeUsers`, `agentSafeClients`, `materials`, `machines`, `products`, `suppliers`, `marketPrices`, `supervisorDailyReports`, `stockMovements`, `maintenanceTickets`, `settings`, and `agentRuns`.

### Step 2: Create Database Users
1. Go to **Security** > **Database Access** > **Database Users**.
2. Click **Add New Database User**:
   - **Username**: `chat_ro`
   - **Password**: Generate secure 32+ character passphrase.
   - **Database User Privileges**: Assign `LoomPilotChatReadOnly`.
3. Repeat for `agents_ro`:
   - **Username**: `agents_ro`
   - **Password**: Generate secure 32+ character passphrase.
   - **Database User Privileges**: Assign `LoomPilotAgentsAllowlistReadOnly`.

---

## 4. Provisioning Method B: Atlas CLI (`atlas`)

```bash
# 1. Custom role for chat_ro (views only)
atlas customDbRoles create LoomPilotChatReadOnly \
  --privilege find@loompilot.clientSafeOrders \
  --privilege find@loompilot.clientSafeProducts \
  --projectId "<ATLAS_PROJECT_ID>"

# 2. Custom role for agents_ro (strict 13-resource allowlist)
atlas customDbRoles create LoomPilotAgentsAllowlistReadOnly \
  --privilege find@loompilot.agentSafeOrders \
  --privilege find@loompilot.agentSafeUsers \
  --privilege find@loompilot.agentSafeClients \
  --privilege find@loompilot.materials \
  --privilege find@loompilot.machines \
  --privilege find@loompilot.products \
  --privilege find@loompilot.suppliers \
  --privilege find@loompilot.marketPrices \
  --privilege find@loompilot.supervisorDailyReports \
  --privilege find@loompilot.stockMovements \
  --privilege find@loompilot.maintenanceTickets \
  --privilege find@loompilot.settings \
  --privilege find@loompilot.agentRuns \
  --projectId "<ATLAS_PROJECT_ID>"

# 3. Create database users
atlas dbusers create \
  --username chat_ro \
  --password "<SECURE_PASSWORD>" \
  --role LoomPilotChatReadOnly@loompilot \
  --projectId "<ATLAS_PROJECT_ID>"

atlas dbusers create \
  --username agents_ro \
  --password "<SECURE_PASSWORD>" \
  --role LoomPilotAgentsAllowlistReadOnly@loompilot \
  --projectId "<ATLAS_PROJECT_ID>"
```

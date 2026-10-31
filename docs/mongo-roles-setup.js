/**
 * MongoDB Roles and Users Provisioning Script for LoomPilot (Stage 3.5 Step 4)
 *
 * NOTE: DO NOT RUN AUTOMATICALLY AGAINST PRODUCTION ATLAS.
 * Run manually in mongosh with clusterAdmin / userAdmin privileges:
 *
 *   mongosh "<YOUR_ATLAS_MONGODB_URI>" < docs/mongo-roles-setup.js
 */

const DB_NAME = "loompilot";
const targetDb = db.getSiblingDB(DB_NAME);

print(`Configuring security roles on database: ${DB_NAME}`);

// 1. Role: chat_ro_role (Strict view-only role for customer chat assistant)
// Reads ONLY clientSafeOrders and clientSafeProducts. Never reads base collections or platform data.
targetDb.createRole({
  role: "chat_ro_role",
  privileges: [
    {
      resource: { db: DB_NAME, collection: "clientSafeOrders" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "clientSafeProducts" },
      actions: ["find"],
    },
  ],
  roles: [],
});

// 2. Role: agents_ro_role (Strict allowlist for analytical Python backend agents)
// Allows find ONLY on the exact 13 allowlisted domain collections and safe views.
// NEVER granted: orders (base), users (base), clients (base), or any platform collection
// (auditLogs, refreshTokens, idempotencyKeys, outboxMessages, notifications, files, importJobs, counters).
targetDb.createRole({
  role: "agents_ro_role",
  privileges: [
    { resource: { db: DB_NAME, collection: "agentSafeOrders" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "agentSafeUsers" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "agentSafeClients" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "materials" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "machines" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "products" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "suppliers" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "marketPrices" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "supervisorDailyReports" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "stockMovements" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "maintenanceTickets" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "settings" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "agentRuns" }, actions: ["find"] },
  ],
  roles: [],
});

print("Security roles created successfully.");

// 3. Documented (NOT created) Role: admin_assistant_ro
// Planned for executive assistant agent:
// Reads operational and platform logs under strict supervision, including auditLogs,
// full orders, costing projections, and system metrics. Documented here for future phases.
/*
targetDb.createRole({
  role: "admin_assistant_ro_role",
  privileges: [
    { resource: { db: DB_NAME, collection: "orders" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "auditLogs" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "agentSafeUsers" }, actions: ["find"] },
    { resource: { db: DB_NAME, collection: "clients" }, actions: ["find"] },
    // ... Additional operational collections as defined in Stage 4/5 roadmap
  ],
  roles: [],
});
*/

// 4. Create Users Template (To be executed with strong secrets in deployment)
/*
targetDb.createUser({
  user: "chat_ro",
  pwd: "CHAT_RO_STRONG_PASSWORD_CHANGE_ME",
  roles: [{ role: "chat_ro_role", db: DB_NAME }],
});

targetDb.createUser({
  user: "agents_ro",
  pwd: "AGENTS_RO_STRONG_PASSWORD_CHANGE_ME",
  roles: [{ role: "agents_ro_role", db: DB_NAME }],
});
*/

/**
 * MongoDB Roles and Users Provisioning Script for LoomPilot
 *
 * NOTE: DO NOT RUN AUTOMATICALLY AGAINST PRODUCTION ATLAS.
 * Run manually in mongosh with clusterAdmin / userAdmin privileges:
 *
 *   mongosh "<YOUR_ATLAS_MONGODB_URI>" < docs/mongo-roles-setup.js
 */

const DB_NAME = "loompilot";
const db = db.getSiblingDB(DB_NAME);

print(`Configuring security roles on database: ${DB_NAME}`);

// 1. Role: agents_ro (Full read-only access across all operational collections)
db.createRole({
  role: "agents_ro_role",
  privileges: [
    {
      resource: { db: DB_NAME, collection: "" },
      actions: ["find"],
    },
  ],
  roles: [],
});

// 2. Role: chat_ro_role (Strict view-only role for customer chat assistant)
// EXPLICITLY BLOCKED: quotationCostings, users, refreshTokens, auditLogs, settings
db.createRole({
  role: "chat_ro_role",
  privileges: [
    {
      resource: { db: DB_NAME, collection: "clientSafeOrders" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "clientSafeQuotations" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "products" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "materials" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "priceHistory" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "conversations" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "messages" },
      actions: ["find"],
    },
    {
      resource: { db: DB_NAME, collection: "deliveries" },
      actions: ["find"],
    },
  ],
  roles: [],
});

print("Security roles created successfully.");

// 3. Create users (Credentials should be updated with secure production secrets)
/*
db.createUser({
  user: "agent_ro",
  pwd: "AGENT_RO_STRONG_PASSWORD_CHANGE_ME",
  roles: [{ role: "agents_ro_role", db: DB_NAME }],
});

db.createUser({
  user: "chat_ro",
  pwd: "CHAT_RO_STRONG_PASSWORD_CHANGE_ME",
  roles: [{ role: "chat_ro_role", db: DB_NAME }],
});
*/


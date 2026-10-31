import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { connectMongo, disconnectMongo } from "../config/database.js";
import { createClientSafeViews } from "../seed/migrations/create-views.js";
import { runDevSeed } from "../seed/dev-seed.js";
import { logger } from "../utils/logger.js";
import "../models/index.js";

function parseArgs(args: string[]): { execute: boolean; confirmDb?: string } {
  let execute = false;
  let confirmDb: string | undefined;

  for (const arg of args) {
    if (arg === "--execute") {
      execute = true;
    } else if (arg.startsWith("--confirm-db=")) {
      confirmDb = arg.split("=")[1];
    }
  }

  return { execute, confirmDb };
}

export async function resetDevDatabase(args: string[] = process.argv.slice(2)): Promise<void> {
  const env = getEnv();

  // 1. Production refusal
  if (env.NODE_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Execution refused: Resetting database is strictly prohibited in production environments!");
  }

  const { execute, confirmDb } = parseArgs(args);
  const targetDb = env.MONGODB_DB_NAME || "loompilot";

  // 2. Dry-run safety guard
  if (!execute || confirmDb !== targetDb) {
    console.log("================================================================================");
    console.log(`[DRY-RUN] LoomPilot Development Database Reset`);
    console.log(`Target Database : ${targetDb}`);
    console.log(`Environment     : ${env.NODE_ENV}`);
    console.log("--------------------------------------------------------------------------------");
    console.log("No changes were made. To execute destructive database reset, specify:");
    console.log(`  pnpm run db:reset-dev -- --execute --confirm-db=${targetDb}`);
    console.log("================================================================================");
    return;
  }

  logger.warn({ targetDb }, "EXECUTING DESTRUCTIVE DATABASE RESET...");

  await connectMongo();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to get database handle from Mongoose connection");
  }

  // 3. Drop all non-system collections & views
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    if (!col.name.startsWith("system.")) {
      logger.info({ collection: col.name }, `Dropping ${col.name}...`);
      await db.collection(col.name).drop();
    }
  }

  // 4. Synchronize indexes across all schemas
  logger.info("Synchronizing indexes across all domain collections...");
  const modelNames = mongoose.modelNames();
  for (const name of modelNames) {
    const model = mongoose.model(name);
    await model.syncIndexes();
  }

  // 5. Create Schema v4 Views
  logger.info("Creating Schema v4 clientSafe and agentSafe database views...");
  await createClientSafeViews(db);

  // 6. Run Dev Seed
  logger.info("Seeding development fixtures (admin, supervisors, catalog, clients)...");
  await runDevSeed();

  logger.info("Database reset and dev seeding completed successfully!");
}

if (process.argv[1]?.includes("reset-dev")) {
  resetDevDatabase()
    .then(async () => {
      await disconnectMongo();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, "Database reset failed");
      await disconnectMongo();
      process.exit(1);
    });
}

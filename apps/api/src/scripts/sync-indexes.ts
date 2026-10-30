import mongoose from "mongoose";
import { connectMongo, disconnectMongo } from "../config/database.js";
import { logger } from "../utils/logger.js";
// Side-effect import to ensure all schemas and compound indexes are registered on Mongoose
import "../models/index.js";

export async function syncAllIndexes(): Promise<void> {
  try {
    logger.info("Connecting to MongoDB to synchronize indexes...");
    await connectMongo();

    const modelNames = mongoose.modelNames();
    logger.info({ count: modelNames.length }, `Found ${modelNames.length} registered Mongoose models to sync`);

    for (const name of modelNames) {
      const model = mongoose.model(name);
      logger.info({ model: name }, `Synchronizing indexes for model: ${name}...`);
      const result = await model.syncIndexes();
      logger.info({ model: name, dropped: result }, `Indexes synchronized successfully for ${name}`);
    }

    logger.info("All collection indexes synchronized successfully.");
  } catch (err) {
    logger.error({ err }, "Error synchronizing database indexes");
    process.exitCode = 1;
  } finally {
    await disconnectMongo();
  }
}

// Execute when run directly as CLI
if (process.argv[1] && process.argv[1].includes("sync-indexes")) {
  void syncAllIndexes();
}

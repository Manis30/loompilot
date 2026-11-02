import mongoose from "mongoose";
import { getEnv } from "./env.js";
import { logger } from "../utils/logger.js";

let isConnecting = false;

export async function connectMongo(uri?: string, dbName?: string): Promise<typeof mongoose> {
  const env = getEnv();
  const targetUri = uri ?? env.MONGODB_URI;
  const targetDb = dbName ?? env.MONGODB_DB_NAME;

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (isConnecting) {
    return mongoose;
  }

  isConnecting = true;

  try {
    mongoose.connection.on("connected", () => {
      logger.info({ db: targetDb }, "MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      logger.error({ err }, "MongoDB connection error");
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    // In production, automatic index builds on startup degrade cluster performance and can cause
    // long build locks. Indexes must be created explicitly via migration scripts or `pnpm run db:indexes`.
    mongoose.set("autoIndex", env.NODE_ENV !== "production");

    await mongoose.connect(targetUri, {
      dbName: targetDb,
      serverSelectionTimeoutMS: 5000,
      autoIndex: env.NODE_ENV !== "production",
    });

    return mongoose;
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB");
    throw err;
  } finally {
    isConnecting = false;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    logger.info("Closing MongoDB connection...");
    await mongoose.disconnect();
    logger.info("MongoDB connection closed");
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}


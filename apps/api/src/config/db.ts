import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const mongoUri = uri || env.MONGODB_URI;
  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info({ uri: mongoUri.replace(/\/\/.*@/, "//***@") }, "MongoDB connected successfully");
    return conn;
  } catch (err) {
    logger.error({ err }, "MongoDB connection error");
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}


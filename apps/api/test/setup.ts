// Set test environment variables immediately at top-level before any imports
process.env["NODE_ENV"] = "test";
process.env["PORT"] = "4001";
process.env["LOG_LEVEL"] = "silent";
process.env["MONGODB_URI"] = "mongodb://localhost:27017/loompilot_test?replicaSet=rs0";
process.env["MONGODB_DB_NAME"] = "loompilot_test";
process.env["REDIS_URL"] = "redis://localhost:6379";
process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_min_32_characters_12345";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_min_32_characters_12345";
process.env["AGENT_SERVICE_TOKEN"] = "test_agent_service_token_min_32_characters_12345";
process.env["CORS_ORIGINS"] = "http://localhost:5173,http://localhost:3000";

import { beforeAll, afterAll } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import { connectMongo, disconnectMongo } from "../src/config/database.js";
import { setRedisClient, disconnectRedis } from "../src/config/redis.js";

let replSet: MongoMemoryReplSet | null = null;

beforeAll(async () => {
  // Setup Mock Redis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockRedis = new (RedisMock as any)();
  mockRedis.status = "ready";
  setRedisClient(mockRedis);

  // Setup In-Memory MongoDB Replica Set for transactions
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [
      {
        launchTimeout: 30000,
      },
    ],
  });
  const mongoUri = replSet.getUri();
  process.env["MONGODB_URI"] = mongoUri;

  await connectMongo(mongoUri, "loompilot_test");
}, 60000);

afterAll(async () => {
  await disconnectMongo();
  if (replSet) {
    await replSet.stop();
  }
  await disconnectRedis();
}, 60000);

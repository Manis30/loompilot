import { isMongoConnected } from "../config/database.js";
import { isRedisReady } from "../config/redis.js";

export interface HealthStatus {
  status: "ok";
  timestamp: string;
  uptime: number;
}

export interface ReadinessStatus {
  status: "ready" | "not_ready";
  mongo: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  timestamp: string;
}

export class HealthService {
  getHealth(): HealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  getReadiness(): ReadinessStatus {
    const mongoConnected = isMongoConnected();
    const redisReady = isRedisReady();

    const isReady = mongoConnected && redisReady;

    return {
      status: isReady ? "ready" : "not_ready",
      mongo: mongoConnected ? "connected" : "disconnected",
      redis: redisReady ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }
}


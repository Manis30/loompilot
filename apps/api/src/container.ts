import { Redis } from "ioredis";
import { IUnitOfWork } from "./interfaces/unit-of-work.interface.js";
import { MongoUnitOfWork } from "./repositories/unit-of-work.js";
import { getRedisClient } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { getEnv, Env } from "./config/env.js";
import { HealthService } from "./services/health.service.js";
import { HealthController } from "./controllers/health.controller.js";

export interface AppContainer {
  env: Env;
  logger: typeof logger;
  redisClient: Redis;
  unitOfWork: IUnitOfWork;
  healthService: HealthService;
  healthController: HealthController;
}

let containerInstance: AppContainer | null = null;

export function createContainer(): AppContainer {
  const env = getEnv();
  const redisClient = getRedisClient();
  const unitOfWork = new MongoUnitOfWork();
  const healthService = new HealthService();
  const healthController = new HealthController(healthService);

  containerInstance = {
    env,
    logger,
    redisClient,
    unitOfWork,
    healthService,
    healthController,
  };

  return containerInstance;
}

export function getContainer(): AppContainer {
  if (!containerInstance) {
    return createContainer();
  }
  return containerInstance;
}

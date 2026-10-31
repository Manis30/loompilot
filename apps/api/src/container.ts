import { Redis } from "ioredis";
import { IUnitOfWork } from "./interfaces/unit-of-work.interface.js";
import { MongoUnitOfWork } from "./repositories/unit-of-work.js";
import { getRedisClient } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { getEnv, Env } from "./config/env.js";
import { HealthService } from "./services/health.service.js";
import { HealthController } from "./controllers/health.controller.js";
import { IAgentsClient } from "./interfaces/agents-client.interface.js";
import { HttpAgentsClient } from "./integrations/agents/http-agents-client.js";
import { FakeAgentsClient } from "./integrations/agents/fake-agents-client.js";
import { IFileStorage } from "./interfaces/file-storage.interface.js";
import { LocalDiskFileStorage } from "./integrations/storage/local-disk-storage.js";
import { IJobQueue } from "./interfaces/job-queue.interface.js";
import { BullMqJobQueue } from "./jobs/bullmq-queue.js";
import { IPaymentGateway } from "./interfaces/payment-gateway.interface.js";
import { FakeGateway } from "./integrations/payment/fake-gateway.js";
import { RazorpayGateway } from "./integrations/payment/razorpay-gateway.js";
import { INotifier } from "./interfaces/notifier.interface.js";
import { EmailNotifier } from "./integrations/notifier/email-notifier.js";

export interface AppContainer {
  env: Env;
  logger: typeof logger;
  redisClient: Redis;
  unitOfWork: IUnitOfWork;
  healthService: HealthService;
  healthController: HealthController;
  agentsClient: IAgentsClient;
  fileStorage: IFileStorage;
  jobQueue: IJobQueue;
  paymentGateway: IPaymentGateway;
  notifier: INotifier;
}

let containerInstance: AppContainer | null = null;

export function createContainer(): AppContainer {
  const env = getEnv();
  const redisClient = getRedisClient();
  const unitOfWork = new MongoUnitOfWork();
  const healthService = new HealthService();
  const healthController = new HealthController(healthService);

  const agentsClient: IAgentsClient =
    env.AGENTS_MODE === "http"
      ? new HttpAgentsClient({
          baseUrl: env.AGENTS_BASE_URL,
          serviceToken: env.AGENT_SERVICE_TOKEN,
        })
      : new FakeAgentsClient();

  const fileStorage: IFileStorage = new LocalDiskFileStorage(env.FILE_STORAGE_PATH);

  const jobQueue: IJobQueue = new BullMqJobQueue(redisClient);

  const paymentGateway: IPaymentGateway =
    env.PAYMENT_GATEWAY === "razorpay"
      ? new RazorpayGateway({
          keyId: env.RAZORPAY_KEY_ID,
          keySecret: env.RAZORPAY_KEY_SECRET,
          webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        })
      : new FakeGateway();

  const notifier: INotifier = new EmailNotifier({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
  });

  containerInstance = {
    env,
    logger,
    redisClient,
    unitOfWork,
    healthService,
    healthController,
    agentsClient,
    fileStorage,
    jobQueue,
    paymentGateway,
    notifier,
  };

  return containerInstance;
}

export function getContainer(): AppContainer {
  if (!containerInstance) {
    return createContainer();
  }
  return containerInstance;
}

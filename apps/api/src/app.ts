import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { pinoHttp } from "pino-http";
import { getEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limiter.js";
import { NotFoundError, AppError } from "./errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { swaggerSpec } from "./config/swagger.js";
import { createHealthRoutes } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { meRouter } from "./routes/me.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { clientPortalRouter } from "./routes/client-portal.routes.js";
import { clientRouter } from "./routes/client.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { supplierRouter } from "./routes/supplier.routes.js";
import { materialRouter } from "./routes/material.routes.js";
import { machineRouter } from "./routes/machine.routes.js";
import { productRouter } from "./routes/product.routes.js";
import { clientCatalogueRouter } from "./routes/client-catalogue.routes.js";
import { fileRouter } from "./routes/file.routes.js";
import { stockRouter } from "./routes/stock.routes.js";
import { importRouter } from "./routes/import.routes.js";
import { auditRouter } from "./routes/audit.routes.js";
import { clientOrderRouter } from "./routes/client-order.routes.js";
import { orderRouter } from "./routes/order.routes.js";
import { internalGatewayRouter } from "./routes/internal-gateway.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";
import { AppContainer, getContainer } from "./container.js";

export function createApp(container: AppContainer = getContainer()): Express {
  const env = container.env || getEnv();
  const app = express();

  // Trust reverse proxy in production (e.g. Nginx, ALB) for accurate req.ip in rate limiter & audit
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // 1. Request ID attribution
  app.use(requestIdMiddleware);

  // 2. Security headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    })
  );

  // 3. CORS configuration
  const allowedOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(
            new AppError(
              ErrorCode.FORBIDDEN,
              `Cross-Origin request from origin '${origin}' is not allowed`,
              403
            )
          );
        }
      },
      credentials: true,
      exposedHeaders: ["x-request-id"],
    })
  );

  // 4. Redis-backed Rate Limiter
  app.use(createRateLimiter(container.redisClient, env));

  // 5. Request parsing with configurable body size limit & cookies
  app.use(
    express.json({
      limit: env.BODY_LIMIT,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: env.BODY_LIMIT }));
  app.use(cookieParser());

  // 6. Structured HTTP logging
  if (env.NODE_ENV !== "test") {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => String((req as express.Request).id || "unknown"),
        customLogLevel: (_req, res, err) => {
          if (res.statusCode >= 500 || err) return "error";
          if (res.statusCode >= 400) return "warn";
          return "info";
        },
      })
    );
  }

  // 7. Swagger API documentation (disabled when NODE_ENV === 'production')
  if (env.NODE_ENV !== "production") {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get("/docs.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });
  }

  // 8. Health & readiness endpoints
  const healthRoutes = createHealthRoutes(container.healthController);
  app.use(healthRoutes);
  app.use("/api/v1", healthRoutes);

  // 9. Stage 3 Core Domain Routes
  app.use("/api/v1", authRouter);
  app.use("/api/v1/me", meRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/clients", clientPortalRouter);
  app.use("/api/v1/clients", clientRouter);
  app.use("/api/v1/audit", auditRouter);

  // Phase B: Master Data & Platform Basics Routes
  app.use("/api/v1/settings", settingsRouter);
  app.use("/api/v1/suppliers", supplierRouter);
  app.use("/api/v1/materials", materialRouter);
  app.use("/api/v1/machines", machineRouter);
  app.use("/api/v1/products", productRouter);
  app.use("/api/v1/client", clientCatalogueRouter);
  app.use("/api/v1/files", fileRouter);
  app.use("/api/v1/stock", stockRouter);
  app.use("/api/v1/imports", importRouter);

  // Phase C: Orders, Feasibility & Quotations
  app.use("/api/v1/client/orders", clientOrderRouter);
  app.use("/api/v1/orders", orderRouter);
  app.use("/internal/v1", internalGatewayRouter);

  // Phase D: Razorpay Webhooks
  app.use("/webhooks", webhookRouter);

  // 10. Unmatched routes -> 404
  app.use((req) => {
    throw new NotFoundError(`Endpoint '${req.method} ${req.path}'`);
  });

  // 11. Standardized error handling middleware
  app.use(errorHandler);

  return app;
}

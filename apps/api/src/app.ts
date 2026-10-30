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
import { NotFoundError } from "./errors/app-error.js";
import { swaggerSpec } from "./config/swagger.js";
import { createHealthRoutes } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { meRouter } from "./routes/me.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { clientAccountRouter } from "./routes/client-account.routes.js";
import { auditRouter } from "./routes/audit.routes.js";
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
          callback(new Error(`Origin '${origin}' not permitted by CORS policy`));
        }
      },
      credentials: true,
      exposedHeaders: ["x-request-id"],
    })
  );

  // 4. Redis-backed Rate Limiter
  app.use(createRateLimiter(container.redisClient, env));

  // 5. Request parsing with configurable body size limit & cookies
  app.use(express.json({ limit: env.BODY_LIMIT }));
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
  app.use("/api/v1/client-accounts", clientAccountRouter);
  app.use("/api/v1/audit", auditRouter);

  // 10. Unmatched routes -> 404
  app.use((req) => {
    throw new NotFoundError(`Endpoint '${req.method} ${req.path}'`);
  });

  // 11. Standardized error handling middleware
  app.use(errorHandler);

  return app;
}

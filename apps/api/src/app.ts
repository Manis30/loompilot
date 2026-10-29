import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { getRedisClient } from "./config/redis.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { auditMiddleware } from "./middleware/audit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalApiLimiter } from "./middleware/rateLimiter.js";
import { setupSwagger } from "./docs/openapi.js";

import {
  authRoutes,
  userRoutes,
  auditRoutes,
  enquiryRoutes,
  customerRoutes,
  materialRoutes,
  supplierRoutes,
  processRoutes,
  workforceRoutes,
  orderRoutes,
  quotationRoutes,
  alertRoutes,
  deliveryRoutes,
  paymentRoutes,
  reportRoutes,
  agentGatewayRoutes,
  settingsRoutes,
  productRoutes,
  supplierOrderRoutes,
  importRoutes,
} from "./container.js";

export const app = express();

// Trust reverse proxy in production
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Helmet security headers (bypass CSP on /docs for Swagger UI)
app.use((req, res, next) => {
  if (req.path.startsWith("/docs")) {
    return next();
  }
  helmet()(req, res, next);
});

// Explicit CORS allowlist
const allowedOrigins = (env.ALLOWED_ORIGINS || env.CORS_ORIGIN)
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*") && env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Request tracing and auditing
app.use(requestIdMiddleware);
app.use(auditMiddleware);

// Health checks
app.get("/health/live", (_req, res) => {
  res.json({
    status: "ok",
    app: env.APP_NAME,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/ready", async (_req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  let isRedisConnected = false;
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    isRedisConnected = pong === "PONG";
  } catch {
    isRedisConnected = false;
  }

  const isReady = isMongoConnected && (env.NODE_ENV === "test" || isRedisConnected);
  const status = isReady ? "ok" : "unhealthy";
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status,
    app: env.APP_NAME,
    mongo: isMongoConnected ? "connected" : "disconnected",
    redis: isRedisConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    app: env.APP_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Interactive Swagger UI & OpenAPI Specification
setupSwagger(app);

// Internal Agent Gateway (service token authenticated)
app.use("/internal/v1", agentGatewayRoutes);

// Rate limiter applied across all application API routes
app.use("/api/v1", generalApiLimiter);

// Public / Authenticated Application API routes v1
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/audit", auditRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/enquiries", enquiryRoutes);
app.use("/api/v1/quotations", quotationRoutes);
app.use("/api/v1/materials", materialRoutes);
app.use("/api/v1/suppliers", supplierRoutes);
app.use("/api/v1/processes", processRoutes);
app.use("/api/v1/workforce", workforceRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/alerts", alertRoutes);
app.use("/api/v1/deliveries", deliveryRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/supplier-orders", supplierOrderRoutes);
app.use("/api/v1/imports", importRoutes);

// Central error handler
app.use(errorHandler);

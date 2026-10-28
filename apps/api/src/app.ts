import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { auditMiddleware } from "./middleware/audit.js";
import { errorHandler } from "./middleware/errorHandler.js";

import { enquiryRoutes, customerRoutes } from "./container.js";

// Routes
import { authRouter } from "./modules/auth/routes.js";
import { quotationsRouter } from "./modules/quotations/routes.js";
import { materialsRouter } from "./modules/materials/routes.js";
import { suppliersRouter } from "./modules/suppliers/routes.js";
import { processesRouter } from "./modules/processes/routes.js";
import { workforceRouter } from "./modules/workforce/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { alertsRouter } from "./modules/alerts/routes.js";
import { deliveriesRouter } from "./modules/deliveries/routes.js";
import { paymentsRouter } from "./modules/payments/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { internalGatewayRouter } from "./internal/gateway.js";

export const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Request tracing and auditing
app.use(requestIdMiddleware);
app.use(auditMiddleware);

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    app: env.APP_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Internal Agent Gateway (service token authenticated)
app.use("/internal", internalGatewayRouter);

// Public / Authenticated Application API routes
app.use("/api/auth", authRouter);
app.use("/api/customers", customerRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/quotations", quotationsRouter);
app.use("/api/materials", materialsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/processes", processesRouter);
app.use("/api/workforce", workforceRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/deliveries", deliveriesRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/reports", reportsRouter);

// Central error handler
app.use(errorHandler);


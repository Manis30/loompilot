import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { auditMiddleware } from "./middleware/audit.js";
import { errorHandler } from "./middleware/errorHandler.js";

import { authRoutes, enquiryRoutes, customerRoutes, materialRoutes, supplierRoutes, processRoutes, workforceRoutes, orderRoutes, quotationRoutes, alertRoutes } from "./container.js";

// Routes
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
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/processes", processRoutes);
app.use("/api/workforce", workforceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/deliveries", deliveriesRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/reports", reportsRouter);

// Central error handler
app.use(errorHandler);

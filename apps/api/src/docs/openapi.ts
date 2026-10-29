import { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { APP_NAME } from "../config/constants.js";
import { env } from "../config/env.js";
import { openapiSchemas } from "./schemas.js";
import { openapiPaths } from "./paths/index.js";

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: `${APP_NAME} API`,
    version: "0.1.0",
    description: `### ${APP_NAME} Textile Manufacturing AI Platform API

**LoomPilot** is an advisory AI assistant and ERP backbone for textile manufacturers that follows each order from enquiry to payment across three synchronized phases:
1. **Phase 1 (Quotation)**: Check stock, compute required yarn and material purchases, add wastage allowance and price-risk buffer, estimate delivery time from workers' average output, and produce an itemized quotation with a validity period and plain-language explanation.
2. **Phase 2 (Monitoring)**: Compute daily required output, track actual daily output from shop floor workers, alert management the same day when output falls short, and provide AI recovery options (extra workers, revised daily targets).
3. **Phase 3 (Payment Follow-up)**: On delivery recording, create accounts receivable follow-up records and draft courteous reminders that Accounts approves before sending.

#### Architectural Principles & API Rules:
- **Financial Safety**: All monetary values cross API boundaries and database records as **integer paise** (\`100 paise = ₹1.00\`). No floating-point currency calculations.
- **Human-in-the-Loop**: The system is advisory only. Quotations and payment reminders require explicit human review and approval.
- **Role-Based Access Control (RBAC)**: Strict tenant isolation and role restrictions (\`owner\`, \`manager\`, \`store\`, \`sales\`, \`accounts\`). Cost and margin data are masked from the \`store\` role; only \`accounts\` can approve payment reminders.
- **Request Tracing**: All responses include a unique \`requestId\` header (\`X-Request-Id\`) and JSON body property for end-to-end distributed tracing.`,
    contact: {
      name: `${APP_NAME} Engineering Team`,
      email: "dev@loompilot.internal",
    },
    license: {
      name: "Proprietary",
    },
  },
  servers: [
    {
      url: `http://localhost:${env.API_PORT}`,
      description: "Local Development Server",
    },
  ],
  tags: [
    { name: "Auth", description: "User authentication, JWT token issuance, refresh token rotation, and current user profile" },
    { name: "Enquiries", description: "Customer RFQ enquiries, fabric specifications, target deadlines" },
    { name: "Quotations", description: "Advisory quotation drafting, material BOM, risk buffer, ETA, approval, PDF download, and order confirmation" },
    { name: "Customers", description: "Customer directory, contact records, credit limits, and payment terms" },
    { name: "Suppliers", description: "Yarn, dye, and accessory suppliers with historical lead times" },
    { name: "Materials", description: "Raw material catalog, inventory stocks, and unit rate price history" },
    { name: "Processes", description: "Textile production stages (Spinning, Dyeing, Weaving, Inspection, Packaging)" },
    { name: "Workforce", description: "Textile worker roster, daily attendance, and shift-wise production output tracking" },
    { name: "Orders", description: "Production order execution, staged progress tracking, and deficit variance calculations" },
    { name: "Alerts", description: "Realtime production shortfall and supplier delay alerts with AI recovery recommendations" },
    { name: "Deliveries", description: "Order dispatch records, on-time delivery metrics, and invoice generation triggers" },
    { name: "Payments", description: "Accounts receivable follow-ups, payment receipts, and Human-in-the-Loop reminder approval" },
    { name: "Reports", description: "Financial gross margin analysis, on-time delivery rates, and accounts receivable collections aging" },
    { name: "Agent Gateway (Internal)", description: "Internal service-token-authenticated endpoints for Python AI microservice integration" },
    { name: "Health", description: "System health status and orchestrator readiness check" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard JWT Access Token in the Authorization header: `Bearer <token>`",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "loompilot_refresh_token",
        description: "HttpOnly, SameSite=Strict cookie holding the refresh token for `POST /api/auth/refresh`",
      },
      serviceTokenAuth: {
        type: "apiKey",
        in: "header",
        name: "x-service-token",
        description: "Internal shared secret token used by Python Agents service to communicate with `/internal/*` routes",
      },
    },
    schemas: openapiSchemas,
  },
  paths: openapiPaths,
};

export function setupSwagger(app: Express): void {
  if (!env.ENABLE_API_DOCS) {
    return;
  }

  // 1. Raw OpenAPI 3.0.3 JSON Endpoint
  app.get("/api-docs.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openapiSpec);
  });

  // 2. Interactive Swagger UI
  const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: `${APP_NAME} - Interactive API Explorer`,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      deepLinking: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  };

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));
}


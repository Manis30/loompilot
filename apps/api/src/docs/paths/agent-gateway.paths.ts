/**
 * OpenAPI 3.0.3 Paths for Internal Agent Gateway (/internal/*)
 * Protected by serviceTokenAuth (header x-service-token).
 */
export const agentGatewayPaths = {
  "/internal/v1/quotations/drafts": {
    post: {
      tags: ["Agent Gateway (Internal)"],
      summary: "Ingest quotation draft from Python agent service",
      description: "Internal gateway endpoint called by the Python Agents microservice to deliver computed quotation calculations (wastage buffer, price risk, worker ETA, itemized BOM). Protected by service token header `x-service-token`.",
      operationId: "ingestQuotationDraft",
      security: [{ serviceTokenAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["tenantId", "enquiryId", "lineItems", "finalPricePaise", "validUntil"],
              properties: {
                tenantId: { type: "string", example: "tenant_default" },
                enquiryId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c401" },
                lineItems: { type: "array", items: { $ref: "#/components/schemas/QuotationLineItem" } },
                materialCostPaise: { type: "integer", example: 14000000 },
                processingCostPaise: { type: "integer", example: 2000000 },
                overheadCostPaise: { type: "integer", example: 1000000 },
                wastagePct: { type: "number", example: 2.5 },
                wastageCostPaise: { type: "integer", example: 425000 },
                riskBufferPct: { type: "number", example: 5.0 },
                riskBufferCostPaise: { type: "integer", example: 850000 },
                subtotalCostPaise: { type: "integer", example: 18275000 },
                marginPct: { type: "number", example: 15.0 },
                profitPaise: { type: "integer", example: 3225000 },
                finalPricePaise: { type: "integer", example: 21500000 },
                etaDate: { type: "string", format: "date", example: "2026-11-20" },
                validUntil: { type: "string", format: "date", example: "2026-11-05" },
                explanation: { type: "string", example: "Computed based on yarn supplier 7-day lead time." },
                assumptions: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Draft quotation ingested successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Quotation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - invalid or missing service token.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/internal/v1/alerts": {
    post: {
      tags: ["Agent Gateway (Internal)"],
      summary: "Ingest production shortfall alert from Python agent service",
      description: "Triggered by production monitoring runs when actual worker output falls behind schedule. Emits realtime WebSocket notification to tenant managers and owners. Protected by `x-service-token`.",
      operationId: "ingestAlert",
      security: [{ serviceTokenAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateAlertRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Alert ingested and broadcasted successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Alert" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - invalid service token.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/internal/v1/recommendations": {
    post: {
      tags: ["Agent Gateway (Internal)"],
      summary: "Ingest recovery recommendation from Python agent service",
      description: "Delivers actionable mitigation options (shift adjustments, extra workers, revised daily targets) following an output shortfall alert. Protected by `x-service-token`.",
      operationId: "ingestRecommendation",
      security: [{ serviceTokenAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateRecommendationRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Recommendation ingested successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Recommendation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - invalid service token.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/internal/v1/monitoring-snapshots": {
    post: {
      tags: ["Agent Gateway (Internal)"],
      summary: "Record monitoring run snapshot",
      description: "Records the periodic sweep state of production progress tracking. Protected by `x-service-token`.",
      operationId: "recordMonitoringSnapshot",
      security: [{ serviceTokenAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordMonitoringSnapshotRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Monitoring snapshot recorded.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/RecordMonitoringSnapshotResponse" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - invalid service token.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/internal/v1/payment-followups": {
    post: {
      tags: ["Agent Gateway (Internal)"],
      summary: "Ingest payment follow-up record",
      description: "Triggered immediately after delivery recording to establish receivables balance ledger and scheduled reminder pipeline. Protected by `x-service-token`.",
      operationId: "ingestPaymentFollowup",
      security: [{ serviceTokenAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreatePaymentFollowupRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Payment follow-up record created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Payment" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - invalid service token.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/internal/v1/payment-reminder-drafts": {
    post: {
      tags: ["Agent Gateway (Internal)"],
      summary: "Ingest drafted payment reminder",
      description: "Delivers drafted reminder text (email / WhatsApp / SMS) generated by agents for Human-in-the-Loop Accounts approval. Protected by `x-service-token`.",
      operationId: "ingestPaymentReminderDraft",
      security: [{ serviceTokenAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AddReminderDraftRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Reminder draft ingested and pending Accounts approval.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Payment" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized - invalid service token.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


/**
 * OpenAPI 3.0.3 Paths for Workforce, Attendance & Daily Output
 */
export const workforcePaths = {
  "/api/v1/workforce/workers": {
    get: {
      tags: ["Workforce"],
      summary: "List factory workers",
      description: "Returns paginated list of workers with skill levels and assigned process. Accessible to all roles.",
      operationId: "listWorkers",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "Paginated workers list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Worker" } },
                  total: { type: "integer", example: 10 },
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 20 },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
    post: {
      tags: ["Workforce"],
      summary: "Create worker profile",
      description: "Registers a new worker profile. Permitted roles: `owner`, `manager`.",
      operationId: "createWorker",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateWorkerRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Worker created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Worker" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        409: { description: "Conflict. Worker code already exists.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/workforce/workers/{id}": {
    patch: {
      tags: ["Workforce"],
      summary: "Update worker profile",
      description: "Updates worker details or soft deactivates. Owner or Manager.",
      operationId: "updateWorker",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        200: {
          description: "Worker updated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Worker" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/v1/workforce/attendance": {
    get: {
      tags: ["Workforce"],
      summary: "Get daily attendance records",
      description: "Returns attendance records for a specified date (YYYY-MM-DD). Accessible to all roles.",
      operationId: "getAttendance",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "date", in: "query", required: true, schema: { type: "string", format: "date" }, example: "2026-10-28", description: "Attendance date (YYYY-MM-DD)" },
      ],
      responses: {
        200: {
          description: "Attendance records for date.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/AttendanceRecord" } },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Missing date query parameter.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
    post: {
      tags: ["Workforce"],
      summary: "Record batch attendance",
      description: "Upserts worker presence and hours worked for a given date. Permitted roles: `owner`, `manager`.",
      operationId: "recordAttendance",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordAttendanceRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Attendance records saved.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/AttendanceRecord" } },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/workforce/daily-outputs": {
    post: {
      tags: ["Workforce"],
      summary: "Capture daily process output (Idempotent)",
      description: "Records daily manufactured output quantity for an order and process. **Idempotency Guarantee**: If a record with `idempotencyKey` was already saved, returns the existing record without duplicate error. If new, triggers a debounced monitoring analysis job for this order. Permitted roles: `owner`, `manager`.",
      operationId: "recordDailyOutput",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordDailyOutputRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Daily output recorded (or existing record returned idempotently).",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/DailyOutput" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/workforce/daily-outputs/{id}": {
    patch: {
      tags: ["Workforce"],
      summary: "Update recorded daily output with reason",
      operationId: "updateDailyOutput",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        200: {
          description: "Daily output updated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/DailyOutput" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/v1/workforce/orders/{orderId}/outputs": {
    get: {
      tags: ["Workforce"],
      summary: "Get daily outputs for an order",
      description: "Retrieves all logged daily output records associated with an order ID. Accessible to all roles.",
      operationId: "getOutputsForOrder",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "orderId", in: "path", required: true, schema: { type: "string" }, description: "Production Order ObjectId" },
      ],
      responses: {
        200: {
          description: "List of daily output entries.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/DailyOutput" } },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


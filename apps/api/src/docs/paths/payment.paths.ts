/**
 * OpenAPI 3.0.3 Paths for Payments & Follow-up Reminders
 */
export const paymentPaths = {
  "/api/v1/payments": {
    get: {
      tags: ["Payments"],
      summary: "List payments and follow-ups",
      description: "Returns paginated list of invoice payment records, balance amounts in integer paise, and reminder queues. Permitted roles: `owner`, `manager`, `accounts`. Store and Sales roles are denied.",
      operationId: "listPayments",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "status", in: "query", schema: { type: "string", enum: ["pending", "partial", "paid", "overdue"] } },
        { name: "customerId", in: "query", schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Paginated list of payment records.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Payment" } },
                  total: { type: "integer", example: 6 },
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 20 },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient (store & sales denied).", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/payments/{id}": {
    get: {
      tags: ["Payments"],
      summary: "Get payment by ID",
      description: "Retrieves complete invoice payment ledger, balance in paise, and all associated reminder drafts. Permitted roles: `owner`, `manager`, `accounts`.",
      operationId: "getPaymentById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Payment ObjectId" },
      ],
      responses: {
        200: {
          description: "Payment details.",
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
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Payment record not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/payments/{id}/reminders/{reminderId}/approve": {
    post: {
      tags: ["Payments"],
      summary: "Approve or reject reminder draft (Accounts Exclusive)",
      description: "Human-in-the-loop approval: AI drafts payment reminders, but an Accounts staff member must review and approve them before transmission. STRICTLY restricted to `accounts` role only (even owner cannot approve reminders).",
      operationId: "approvePaymentReminder",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Payment ObjectId" },
        { name: "reminderId", in: "path", required: true, schema: { type: "string" }, description: "Payment Reminder ObjectId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApproveReminderRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Reminder approved or rejected successfully.",
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
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - strictly exclusive to accounts role.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Payment or reminder not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/payments/{id}/receipts": {
    post: {
      tags: ["Payments"],
      summary: "Record payment receipt",
      description: "Records an incoming customer payment in integer paise. Automatically reduces balance, updates status to `partial` or `paid`, and halts pending overdue reminders once fully paid. Permitted roles: `owner`, `accounts`.",
      operationId: "recordPaymentReceipt",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Payment ObjectId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordReceiptRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Receipt recorded and payment balance updated.",
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
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Payment not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


/**
 * OpenAPI 3.0.3 Paths for Audit Trail
 */
export const auditPaths = {
  "/api/v1/audit": {
    get: {
      tags: ["Audit Trail"],
      summary: "Query system audit logs",
      description: "Returns paginated immutable audit logs for the caller's tenant. Filterable by `entityType`, `entityId`, `actorId`, and date range (`startDate`, `endDate`). Append-only: updates and deletes are strictly prohibited. Permitted role: `owner` only.",
      operationId: "getAuditLogs",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "entityType",
          in: "query",
          schema: { type: "string" },
          description: "Filter by entity type (e.g. user, quotation, order, payment_reminder)",
        },
        {
          name: "entityId",
          in: "query",
          schema: { type: "string" },
          description: "Filter by specific entity ID",
        },
        {
          name: "actorId",
          in: "query",
          schema: { type: "string" },
          description: "Filter by actor / user ID who performed the action",
        },
        {
          name: "startDate",
          in: "query",
          schema: { type: "string", format: "date-time" },
          description: "Filter by start timestamp (inclusive)",
        },
        {
          name: "endDate",
          in: "query",
          schema: { type: "string", format: "date-time" },
          description: "Filter by end timestamp (inclusive)",
        },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Page number",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50 },
          description: "Items per page (max 100)",
        },
      ],
      responses: {
        200: {
          description: "Paginated audit log entries.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AuditLogEntry" },
                  },
                  meta: { $ref: "#/components/schemas/PaginationMeta" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        403: {
          description: "Forbidden. Only owner can view audit logs.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },
};


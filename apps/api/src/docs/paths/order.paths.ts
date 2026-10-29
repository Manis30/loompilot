/**
 * OpenAPI 3.0.3 Paths for Production Orders
 */
export const orderPaths = {
  "/api/v1/orders": {
    get: {
      tags: ["Orders"],
      summary: "List production orders",
      description: "Returns paginated production orders with status and target dates. Accessible to all roles.",
      operationId: "listOrders",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "Paginated orders list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/ProductionOrder" } },
                  total: { type: "integer", example: 8 },
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
  },

  "/api/v1/orders/{id}": {
    get: {
      tags: ["Orders"],
      summary: "Get order by ID",
      description: "Retrieves complete production order record and staged process plan steps. Accessible to all roles.",
      operationId: "getOrderById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Production Order ObjectId" },
      ],
      responses: {
        200: {
          description: "Order details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/ProductionOrder" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Order not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/orders/{id}/variance": {
    get: {
      tags: ["Orders"],
      summary: "Get order production variance report",
      description: "Computes cumulative actual output vs planned process targets and identifies stage deficits. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "getOrderVariance",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Production Order ObjectId" },
      ],
      responses: {
        200: {
          description: "Variance analysis report.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/OrderVarianceReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Order not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/orders/{id}/costs": {
    get: {
      tags: ["Orders"],
      summary: "Get actual vs quoted costs for order",
      operationId: "getOrderCosts",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Order costs breakdown and variance",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/OrderCostReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/v1/orders/{id}/issue-materials": {
    post: {
      tags: ["Orders"],
      summary: "Issue materials to production floor for order",
      operationId: "issueMaterialsToOrder",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/IssueMaterialsRequest" } } },
      },
      responses: {
        200: {
          description: "Materials issued",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "object" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
};


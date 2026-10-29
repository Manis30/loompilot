/**
 * OpenAPI 3.0.3 Paths for Deliveries
 */
export const deliveryPaths = {
  "/api/v1/deliveries": {
    get: {
      tags: ["Deliveries"],
      summary: "List deliveries",
      description: "Returns paginated list of recorded order deliveries. Accessible to all authenticated roles.",
      operationId: "listDeliveries",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "orderId", in: "query", schema: { type: "string" } },
        { name: "customerId", in: "query", schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Paginated list of deliveries.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Delivery" } },
                  total: { type: "integer", example: 5 },
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
      tags: ["Deliveries"],
      summary: "Record goods delivery",
      description: "Records a completed or partial order dispatch. Computes on-time delivery status against the production order target date and immediately triggers asynchronous payment follow-up creation. Permitted roles: `owner`, `manager`, `store`.",
      operationId: "recordDelivery",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordDeliveryRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Delivery recorded successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Delivery" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/deliveries/{id}": {
    get: {
      tags: ["Deliveries"],
      summary: "Get delivery by ID",
      description: "Retrieves complete delivery record with invoice amount and delivery confirmation details. Accessible to all authenticated roles.",
      operationId: "getDeliveryById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Delivery ObjectId" },
      ],
      responses: {
        200: {
          description: "Delivery details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Delivery" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Delivery not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


/**
 * OpenAPI 3.0.3 Paths for Enquiries
 */
export const enquiryPaths = {
  "/api/enquiries": {
    get: {
      tags: ["Enquiries"],
      summary: "List customer enquiries",
      description: "Returns paginated list of enquiries received for this tenant. Accessible to all roles.",
      operationId: "listEnquiries",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "Paginated enquiries list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Enquiry" } },
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
    post: {
      tags: ["Enquiries"],
      summary: "Create customer enquiry",
      description: "Logs a new free-text customer enquiry for processing. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "createEnquiry",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateEnquiryRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Enquiry logged.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Enquiry" },
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

  "/api/enquiries/{id}": {
    get: {
      tags: ["Enquiries"],
      summary: "Get enquiry by ID",
      description: "Retrieves a single enquiry by its ObjectId. Accessible to all roles.",
      operationId: "getEnquiryById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Enquiry ObjectId" },
      ],
      responses: {
        200: {
          description: "Enquiry details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Enquiry" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Enquiry not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


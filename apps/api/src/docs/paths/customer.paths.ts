/**
 * OpenAPI 3.0.3 Paths for Customers
 */
export const customerPaths = {
  "/api/v1/customers": {
    get: {
      tags: ["Customers"],
      summary: "List customers",
      description: "Returns paginated list of customers for the authenticated tenant. Accessible to all roles (owner, manager, sales, store, accounts).",
      operationId: "listCustomers",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
        { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Page size" },
      ],
      responses: {
        200: {
          description: "Paginated customers list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Customer" } },
                  total: { type: "integer", example: 12 },
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
      tags: ["Customers"],
      summary: "Create customer",
      description: "Creates a new customer record. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "createCustomer",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateCustomerRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Customer created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Customer" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden. Store or accounts role not allowed.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        409: { description: "Conflict. Customer code already exists in this tenant.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/customers/{id}": {
    get: {
      tags: ["Customers"],
      summary: "Get customer by ID",
      description: "Retrieves a single customer record by MongoDB ObjectId. Accessible to all roles.",
      operationId: "getCustomerById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Customer ObjectId" },
      ],
      responses: {
        200: {
          description: "Customer details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Customer" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Customer not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


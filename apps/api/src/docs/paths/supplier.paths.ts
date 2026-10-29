/**
 * OpenAPI 3.0.3 Paths for Suppliers
 */
export const supplierPaths = {
  "/api/suppliers": {
    get: {
      tags: ["Suppliers"],
      summary: "List suppliers",
      description: "Returns paginated list of yarn/material suppliers with ratings and lead times. Accessible to all roles.",
      operationId: "listSuppliers",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "Paginated suppliers list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Supplier" } },
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
      tags: ["Suppliers"],
      summary: "Create supplier",
      description: "Creates a new material supplier record. Permitted roles: `owner`, `manager`, `store`.",
      operationId: "createSupplier",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateSupplierRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Supplier created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Supplier" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden. Sales or accounts role not allowed.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/suppliers/{id}": {
    get: {
      tags: ["Suppliers"],
      summary: "Get supplier by ID",
      description: "Retrieves a single supplier by ObjectId. Accessible to all roles.",
      operationId: "getSupplierById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Supplier ObjectId" },
      ],
      responses: {
        200: {
          description: "Supplier details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Supplier" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Supplier not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


/**
 * OpenAPI 3.0.3 Paths for Materials & Inventory
 */
export const materialPaths = {
  "/api/materials": {
    get: {
      tags: ["Materials"],
      summary: "List inventory materials",
      description: "Returns paginated raw materials. **Role Restriction**: If the caller has the `store` role, financial fields (`currentRatePaise`, `avgCostPaise`) are stripped/hidden.",
      operationId: "listMaterials",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "Paginated materials list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Material" } },
                  total: { type: "integer", example: 15 },
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
      tags: ["Materials"],
      summary: "Create material master record",
      description: "Creates a new raw material master record. Permitted roles: `owner`, `manager`.",
      operationId: "createMaterial",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateMaterialRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Material created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Material" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden. Sales, store, or accounts role not allowed.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        409: { description: "Conflict. Material code already exists.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/materials/{id}": {
    get: {
      tags: ["Materials"],
      summary: "Get material by ID",
      description: "Retrieves a single material record by ObjectId. **Role Restriction**: Cost and rate fields are masked for `store` role.",
      operationId: "getMaterialById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Material ObjectId" },
      ],
      responses: {
        200: {
          description: "Material details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Material" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Material not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/materials/{id}/movements": {
    get: {
      tags: ["Materials"],
      summary: "Get stock movement ledger for material",
      description: "Retrieves chronological stock transaction history (receipts, issues, reservations, adjustments). Accessible to all roles.",
      operationId: "getMaterialMovements",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Material ObjectId" },
      ],
      responses: {
        200: {
          description: "List of stock movements.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/StockMovement" } },
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
      tags: ["Materials"],
      summary: "Record stock ledger movement",
      description: "Records an inward receipt, outward issue, reservation, or stock adjustment. Updates `onHandQuantity` and logs ledger entry. Permitted roles: `owner`, `manager`, `store`.",
      operationId: "recordMaterialMovement",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Material ObjectId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordMovementRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Stock movement recorded and inventory balance updated.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/StockMovement" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error or insufficient stock.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Material not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/materials/{id}/price-history": {
    get: {
      tags: ["Materials"],
      summary: "Get material price history",
      description: "Retrieves historical price records for price-risk buffer analysis. Accessible to all roles.",
      operationId: "getMaterialPriceHistory",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Material ObjectId" },
      ],
      responses: {
        200: {
          description: "List of price history records.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/PriceHistory" } },
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


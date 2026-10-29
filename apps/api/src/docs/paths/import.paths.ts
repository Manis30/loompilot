export const importPaths = {
  "/api/v1/imports/templates/{type}": {
    get: {
      tags: ["Bulk Imports"],
      summary: "Download CSV template",
      operationId: "getImportTemplate",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "type", in: "path", required: true, schema: { type: "string", enum: ["customers", "suppliers", "materials"] } },
      ],
      responses: {
        200: {
          description: "CSV template file",
          content: {
            "text/csv": {
              schema: { type: "string" },
            },
          },
        },
      },
    },
  },
  "/api/v1/imports/customers": {
    post: {
      tags: ["Bulk Imports"],
      summary: "Bulk import customers from CSV",
      operationId: "importCustomers",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "commit", in: "query", schema: { type: "boolean", default: false }, description: "True to commit, false for dry-run preview" },
      ],
      requestBody: {
        required: true,
        content: {
          "text/csv": {
            schema: { type: "string" },
          },
          "text/plain": {
            schema: { type: "string" },
          },
        },
      },
      responses: {
        200: {
          description: "Import report",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/ImportReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        422: {
          description: "Validation failure during commit",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StandardError" },
            },
          },
        },
      },
    },
  },
  "/api/v1/imports/suppliers": {
    post: {
      tags: ["Bulk Imports"],
      summary: "Bulk import suppliers from CSV",
      operationId: "importSuppliers",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "commit", in: "query", schema: { type: "boolean", default: false } },
      ],
      requestBody: {
        required: true,
        content: {
          "text/csv": { schema: { type: "string" } },
          "text/plain": { schema: { type: "string" } },
        },
      },
      responses: {
        200: {
          description: "Import report",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/ImportReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        422: {
          description: "Validation failure during commit",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StandardError" },
            },
          },
        },
      },
    },
  },
  "/api/v1/imports/materials": {
    post: {
      tags: ["Bulk Imports"],
      summary: "Bulk import materials from CSV",
      operationId: "importMaterials",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "commit", in: "query", schema: { type: "boolean", default: false } },
      ],
      requestBody: {
        required: true,
        content: {
          "text/csv": { schema: { type: "string" } },
          "text/plain": { schema: { type: "string" } },
        },
      },
      responses: {
        200: {
          description: "Import report",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/ImportReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        422: {
          description: "Validation failure during commit",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StandardError" },
            },
          },
        },
      },
    },
  },
};


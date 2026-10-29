export const productPaths = {
  "/api/v1/products": {
    get: {
      tags: ["Products"],
      summary: "List products",
      description: "Returns products for the tenant.",
      operationId: "listProducts",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Products list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Products"],
      summary: "Create product",
      description: "Creates a product. Owner or Manager.",
      operationId: "createProduct",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateProductRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Created product",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Product" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/products/{id}": {
    get: {
      tags: ["Products"],
      summary: "Get product by ID",
      operationId: "getProductById",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Product details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Product" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    patch: {
      tags: ["Products"],
      summary: "Update product",
      operationId: "updateProduct",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateProductRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Updated product",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Product" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/products/{id}/bom": {
    get: {
      tags: ["Products"],
      summary: "Get active BOM for product",
      operationId: "getActiveBom",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Active BOM",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Bom" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Products"],
      summary: "Create new immutable BOM version",
      operationId: "createBom",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateBomRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Created BOM version",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Bom" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/products/{id}/bom/versions": {
    get: {
      tags: ["Products"],
      summary: "List all BOM versions for product",
      operationId: "listBomVersions",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "List of BOM versions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Bom" } },
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


export const supplierOrderPaths = {
  "/api/v1/supplier-orders": {
    get: {
      tags: ["Supplier Orders"],
      summary: "List supplier purchase orders",
      operationId: "listSupplierOrders",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "supplierId", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "List of supplier orders",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/SupplierOrder" } },
                  total: { type: "integer" },
                  page: { type: "integer" },
                  limit: { type: "integer" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Supplier Orders"],
      summary: "Create supplier order draft",
      operationId: "createSupplierOrder",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateSupplierOrderRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Created supplier order",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/SupplierOrder" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/supplier-orders/{id}": {
    get: {
      tags: ["Supplier Orders"],
      summary: "Get supplier order by ID",
      operationId: "getSupplierOrderById",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Supplier order details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/SupplierOrder" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    patch: {
      tags: ["Supplier Orders"],
      summary: "Update supplier order",
      operationId: "updateSupplierOrder",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateSupplierOrderRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Updated supplier order",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/SupplierOrder" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/supplier-orders/{id}/receive": {
    post: {
      tags: ["Supplier Orders"],
      summary: "Receive items against purchase order",
      description: "Records receipt of materials against PO and executes goods receipt atomically.",
      operationId: "receiveSupplierOrderItems",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ReceiveSupplierOrderRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Updated order with received items",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/SupplierOrder" },
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


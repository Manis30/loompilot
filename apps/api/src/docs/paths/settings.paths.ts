export const settingsPaths = {
  "/api/v1/settings": {
    get: {
      tags: ["Settings"],
      summary: "Get tenant settings",
      description: "Returns general settings for the current tenant.",
      operationId: "getSettings",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Tenant settings",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/TenantSettings" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    patch: {
      tags: ["Settings"],
      summary: "Update tenant settings",
      description: "Updates general settings. Owner only.",
      operationId: "updateSettings",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateTenantSettingsRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Updated settings",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/TenantSettings" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/settings/holidays": {
    get: {
      tags: ["Settings"],
      summary: "List holidays",
      description: "Lists configured holidays for the tenant.",
      operationId: "listHolidays",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "year", in: "query", schema: { type: "integer" } },
      ],
      responses: {
        200: {
          description: "Holidays list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Holiday" } },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Settings"],
      summary: "Create holiday",
      description: "Creates a new tenant holiday. Owner only.",
      operationId: "createHoliday",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateHolidayRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Created holiday",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Holiday" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/settings/holidays/{id}": {
    delete: {
      tags: ["Settings"],
      summary: "Delete holiday",
      description: "Deletes a holiday by ID. Owner only.",
      operationId: "deleteHoliday",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Holiday deleted",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "object", properties: { deleted: { type: "boolean" } } },
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


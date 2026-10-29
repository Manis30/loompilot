/**
 * OpenAPI 3.0.3 Paths for User Management
 */
export const userPaths = {
  "/api/v1/users": {
    get: {
      tags: ["User Management"],
      summary: "List users in tenant",
      description: "Lists all users in the authenticated tenant. Permitted roles: `owner`, `manager`.",
      operationId: "listUsers",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "List of users.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/User" },
                  },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        403: {
          description: "Forbidden. Role not permitted.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },

    post: {
      tags: ["User Management"],
      summary: "Create new user in tenant",
      description: "Creates a new user in the authenticated tenant. Permitted role: `owner` only.",
      operationId: "createUser",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password", "name", "role"],
              properties: {
                email: { type: "string", format: "email" },
                password: { type: "string", minLength: 8 },
                name: { type: "string" },
                role: {
                  type: "string",
                  enum: ["owner", "manager", "sales", "store", "accounts"],
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "User created successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/User" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: {
          description: "Validation error.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
        },
        401: {
          description: "Unauthorized.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        403: {
          description: "Forbidden. Non-owner cannot create users.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        409: {
          description: "Email already exists in tenant.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/users/{id}": {
    patch: {
      tags: ["User Management"],
      summary: "Update user profile, role, or active status",
      description: "Updates an existing user. Permitted role: `owner` only. An owner cannot deactivate or demote themselves if they are the last active owner of the tenant.",
      operationId: "updateUser",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: {
                  type: "string",
                  enum: ["owner", "manager", "sales", "store", "accounts"],
                },
                isActive: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "User updated successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/User" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: {
          description: "Validation error.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
        },
        401: {
          description: "Unauthorized.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        403: {
          description: "Forbidden. Cannot deactivate or demote last active owner.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        404: {
          description: "User not found.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/users/{id}/reset-password": {
    post: {
      tags: ["User Management"],
      summary: "Reset user password",
      description: "Triggers password reset for a user in the caller's tenant. Returns a temporary password if none supplied. Permitted role: `owner` only.",
      operationId: "resetUserPassword",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "User ID",
        },
      ],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                newPassword: { type: "string", minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Password reset successful.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      temporaryPassword: { type: "string" },
                    },
                  },
                  message: { type: "string", example: "Password reset successfully" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        403: {
          description: "Forbidden. Non-owner cannot reset passwords.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        404: {
          description: "User not found.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },
};


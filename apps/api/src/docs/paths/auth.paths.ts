/**
 * OpenAPI 3.0.3 Paths for Authentication & User Management
 */
export const authPaths = {
  "/api/v1/auth/login": {
    post: {
      tags: ["Authentication"],
      summary: "User login and session establishment",
      description: "Authenticates tenant user credentials, returns a short-lived JWT access token in response body, and sets an HTTP-only refresh token cookie (`loompilot_refresh_token`). Public endpoint.",
      operationId: "loginUser",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/LoginRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Login successful; access token and user profile returned.",
          headers: {
            "Set-Cookie": {
              schema: { type: "string", example: "loompilot_refresh_token=eyJ...; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800" },
              description: "HTTP-only 7-day refresh token cookie.",
            },
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/LoginResponse" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: {
          description: "Invalid email, password, or tenantId format.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
        },
        401: {
          description: "Invalid credentials or inactive user.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/auth/refresh": {
    post: {
      tags: ["Authentication"],
      summary: "Rotate access and refresh tokens",
      description: "Rotates refresh token and issues a new access token. Reads refresh token from HTTP-only cookie `loompilot_refresh_token` (or fallback request body `refreshToken`). Implements strict token reuse detection.",
      operationId: "refreshToken",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RefreshTokenRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "New access token returned and rotated refresh token cookie set.",
          headers: {
            "Set-Cookie": {
              schema: { type: "string", example: "loompilot_refresh_token=eyJ...; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800" },
            },
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      accessToken: { type: "string", example: "eyJhbGciOi..." },
                    },
                  },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: {
          description: "Missing, expired, revoked, or reused refresh token.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/auth/register": {
    post: {
      tags: ["Authentication"],
      summary: "Register new user in tenant",
      description: "Creates a new user within caller's tenant. Caller must be an authenticated `owner` of that tenant.",
      operationId: "registerUser",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RegisterUserRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "User registered successfully.",
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
          description: "Validation error (e.g. invalid role, weak password).",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
        },
        401: {
          description: "Unauthorized. Missing or invalid Bearer JWT.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        403: {
          description: "Forbidden. Caller is not an owner.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
        409: {
          description: "Conflict. Email already registered in this tenant.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/auth/logout-all": {
    post: {
      tags: ["Authentication"],
      summary: "Log out from all sessions",
      description: "Revokes all refresh tokens across all sessions for the authenticated user and clears the cookie.",
      operationId: "logoutAllSessions",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Logged out from all sessions successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Successfully logged out from all sessions" },
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
      },
    },
  },

  "/api/v1/auth/change-password": {
    post: {
      tags: ["Authentication"],
      summary: "Change own password",
      description: "Allows an authenticated user to change their own password by providing current and new passwords.",
      operationId: "changePassword",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["currentPassword", "newPassword"],
              properties: {
                currentPassword: { type: "string" },
                newPassword: { type: "string", minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Password changed successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Password changed successfully" },
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
          description: "Current password incorrect or unauthorized.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/auth/logout": {
    post: {
      tags: ["Authentication"],
      summary: "Log out current user",
      description: "Invalidates the current session's refresh token and clears the `loompilot_refresh_token` HTTP cookie. Requires valid access token.",
      operationId: "logoutUser",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Logged out successfully and cookie cleared.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Logged out successfully" },
                    },
                  },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized. Missing or invalid Bearer JWT.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },

  "/api/v1/auth/me": {
    get: {
      tags: ["Authentication"],
      summary: "Get current authenticated user info",
      description: "Returns decoded identity claims (userId, email, role, tenantId) from the authenticated access token. Accessible to all roles.",
      operationId: "getCurrentUser",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "User profile claims.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/AuthMeResponse" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: {
          description: "Unauthorized. Missing or expired access token.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } },
        },
      },
    },
  },
};


/**
 * OpenAPI 3.0.3 Paths for Production Processes
 */
export const processPaths = {
  "/api/v1/processes": {
    get: {
      tags: ["Processes"],
      summary: "List production processes",
      description: "Returns all manufacturing processes ordered sequentially by `sequence` (e.g. Warping, Sizing, Weaving, Inspection). Accessible to all roles.",
      operationId: "listProcesses",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "List of processes.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Process" } },
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
      tags: ["Processes"],
      summary: "Create process definition",
      description: "Configures a new process step with standard wastage % and hourly output metrics. Permitted roles: `owner`, `manager`.",
      operationId: "createProcess",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateProcessRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Process created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Process" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        409: { description: "Conflict. Process name already exists in this tenant.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/processes/{id}": {
    get: {
      tags: ["Processes"],
      summary: "Get process by ID",
      description: "Retrieves a single process by its ObjectId. Accessible to all roles.",
      operationId: "getProcessById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Process ObjectId" },
      ],
      responses: {
        200: {
          description: "Process details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Process" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Process not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


/**
 * OpenAPI 3.0.3 Paths for Quotations
 */
export const quotationPaths = {
  "/api/quotations": {
    get: {
      tags: ["Quotations"],
      summary: "List quotations",
      description: "Returns paginated list of quotations. **Role Restriction**: Cost breakdowns and margins are masked for the `store` role.",
      operationId: "listQuotations",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        200: {
          description: "Paginated quotations list.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Quotation" } },
                  total: { type: "integer", example: 10 },
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
  },

  "/api/quotations/draft": {
    post: {
      tags: ["Quotations"],
      summary: "Request quotation draft from enquiry",
      description: "Creates an initial draft quotation and invokes the AI agent service. In production wiring prior to Stage 4, transitions to `generation_failed` to prevent hung requests while allowing user retry. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "requestQuotationDraft",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RequestQuotationDraftRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Quotation draft created.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Quotation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/quotations/{id}": {
    get: {
      tags: ["Quotations"],
      summary: "Get quotation by ID",
      description: "Retrieves complete quotation details. **Role Restriction**: Cost and margin fields are omitted for the `store` role.",
      operationId: "getQuotationById",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Quotation ObjectId" },
      ],
      responses: {
        200: {
          description: "Quotation details.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Quotation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Quotation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/quotations/{id}/recalculate": {
    post: {
      tags: ["Quotations"],
      summary: "Recalculate quotation upon user edits",
      description: "Recomputes costs, wastage, buffer, and final price when line items or margin % are edited. Delegates recalculation to the Python agents service (`/v1/quotations/recalculate`). Node contains zero calculation formulas. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "recalculateQuotation",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Quotation ObjectId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecalculateQuotationRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Quotation recalculated with updated prices and ETA.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Quotation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Agents client unavailable or invalid recalculation input.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Quotation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/quotations/{id}/approve": {
    post: {
      tags: ["Quotations"],
      summary: "Human review approval of quotation",
      description: "Transitions quotation status from `draft` to `approved`. Rejects approval if already confirmed into an order. Permitted roles: `owner`, `manager`.",
      operationId: "approveQuotation",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Quotation ObjectId" },
      ],
      responses: {
        200: {
          description: "Quotation approved.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Quotation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Quotation already confirmed.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Quotation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/quotations/{id}/send": {
    post: {
      tags: ["Quotations"],
      summary: "Mark quotation as sent to customer",
      description: "Generates quotation PDF via `pdfmake`, updates quotation status to `sent`, and logs the action in the audit trail. Does not send external messages. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "sendQuotation",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Quotation ObjectId" },
      ],
      responses: {
        200: {
          description: "Quotation marked as sent.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Quotation" },
                  message: { type: "string", example: "Quotation marked as sent and PDF generated" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Quotation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/quotations/{id}/pdf": {
    get: {
      tags: ["Quotations"],
      summary: "Download quotation PDF",
      description: "Generates and streams the formal quotation PDF attachment containing itemized BOM, buffer percentages, and manufacturing explanation. Returns `application/pdf` binary stream. Accessible to all roles.",
      operationId: "downloadQuotationPdf",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Quotation ObjectId" },
      ],
      responses: {
        200: {
          description: "Quotation PDF document binary buffer.",
          headers: {
            "Content-Type": { schema: { type: "string", example: "application/pdf" } },
            "Content-Disposition": { schema: { type: "string", example: "attachment; filename=\"QT-00001.pdf\"" } },
          },
          content: {
            "application/pdf": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Quotation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/quotations/{id}/confirm": {
    post: {
      tags: ["Quotations"],
      summary: "Confirm quotation into production order (Atomic Transaction)",
      description: "Executes atomic MongoDB replica-set transaction: reserves raw materials in stock, writes stock ledger entries, generates staged production plan across processes, creates `ProductionOrder`, and updates quotation status to `confirmed`. Permitted roles: `owner`, `manager`.",
      operationId: "confirmQuotationOrder",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Quotation ObjectId" },
      ],
      responses: {
        201: {
          description: "Order confirmed and production order plan initialized.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/ProductionOrder" },
                  message: { type: "string", example: "Quotation confirmed. Stock reserved and production order plan initialized." },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Quotation is already confirmed.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Quotation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};


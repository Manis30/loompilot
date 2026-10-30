import { describe, it, expect } from "vitest";
import { paiseField } from "../../src/models/common/paise-schema.js";
import { OrderModel, MaterialModel } from "../../src/models/index.js";

describe("Strict Integer Paise Validation (Floats Prohibited)", () => {
  it("rejects non-integer float (1.5) in paiseField validator", () => {
    const field = paiseField({ required: true });
    expect(field.validate.validator(100)).toBe(true);
    expect(field.validate.validator(0)).toBe(true);
    expect(field.validate.validator(1.5)).toBe(false);
    expect(field.validate.validator(10.0001)).toBe(false);
    expect(field.validate.validator(-10)).toBe(false);
  });

  it("permits negative values only when allowSigned is explicitly true", () => {
    const signedField = paiseField({ required: true, allowSigned: true });
    expect(signedField.validate.validator(100)).toBe(true);
    expect(signedField.validate.validator(-50)).toBe(true);
    expect(signedField.validate.validator(-1.5)).toBe(false);
  });

  it("fails Mongoose validation when saving or validating a document with float paise (1.5)", async () => {
    const invalidMaterial = new MaterialModel({
      tenantId: "test_tenant",
      materialName: "Invalid Cotton Yarn",
      type: "yarn",
      unit: "kg",
      currentRatePaise: 1.5, // Invalid float!
    });

    const err = invalidMaterial.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors["currentRatePaise"]).toBeDefined();
    expect(err?.errors["currentRatePaise"].message).toContain(
      "is not a valid integer paise amount"
    );
  });

  it("fails Mongoose validation when saving an Order with float quotation.totalPaise (100.50)", async () => {
    const invalidOrder = new OrderModel({
      tenantId: "test_tenant",
      orderNumber: "ORD-INVALID-PAISE",
      clientId: "60c72b2f9b1d8b2bad000001",
      quantity: 100,
      deliveryDeadline: "2026-12-31",
      quotation: {
        totalPaise: 100.5, // Invalid float!
      },
    });

    const err = invalidOrder.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors["quotation.totalPaise"]).toBeDefined();
  });
});


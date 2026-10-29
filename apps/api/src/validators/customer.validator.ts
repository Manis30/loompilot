import { z } from "zod";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  contactPerson: z.string().min(1, "Contact person is required"),
  email: z.string().email(),
  phone: z.string().min(6),
  address: z.string().optional(),
  creditPeriodDays: z.number().int().nonnegative().default(30),
  gstin: z.string().regex(GSTIN_REGEX, "Invalid GSTIN format").optional(),
  preferredChannel: z.enum(["whatsapp", "email", "sms"]).default("whatsapp").optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true).optional(),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  address: z.string().optional(),
  creditPeriodDays: z.number().int().nonnegative().optional(),
  gstin: z.string().regex(GSTIN_REGEX, "Invalid GSTIN format").optional(),
  preferredChannel: z.enum(["whatsapp", "email", "sms"]).optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

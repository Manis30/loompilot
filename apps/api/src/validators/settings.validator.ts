import { z } from "zod";

export const UpdateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  address: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format").optional(),
  currency: z.string().default("INR").optional(),
  timezone: z.string().default("Asia/Kolkata").optional(),
  workingDays: z.array(z.number().min(0).max(6)).optional(),
  workingHoursPerDay: z.number().positive().max(24).optional(),
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Cutoff time must be HH:MM").optional(),
  defaultRiskBufferPct: z.number().nonnegative().optional(),
  defaultWastagePct: z.number().nonnegative().optional(),
  defaultPaymentTermsDays: z.number().int().positive().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const CreateHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  name: z.string().min(1, "Holiday name is required"),
  processId: z.string().optional(),
  isOptional: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type CreateHolidayInput = z.infer<typeof CreateHolidaySchema>;

import { z } from "zod";
import { ProcessName } from "@loompilot/shared";

export const CreateProcessSchema = z.object({
  name: z.nativeEnum(ProcessName),
  sequence: z.number().int().positive(),
  standardWastagePct: z.number().nonnegative().optional().default(2.0),
  avgOutputPerWorkerHour: z.number().positive().optional().default(10),
  unit: z.string().optional().default("meters"),
});

export const UpdateProcessSchema = z.object({
  sequence: z.number().int().positive().optional(),
  standardWastagePct: z.number().nonnegative().optional(),
  avgOutputPerWorkerHour: z.number().positive().optional(),
  unit: z.string().optional(),
  costPerUnitPaise: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export type CreateProcessInput = z.infer<typeof CreateProcessSchema>;
export type UpdateProcessInput = z.infer<typeof UpdateProcessSchema>;


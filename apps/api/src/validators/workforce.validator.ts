import { z } from "zod";

export const CreateWorkerSchema = z.object({
  workerCode: z.string().min(1, "workerCode is required"),
  name: z.string().min(1, "name is required"),
  skillLevel: z.enum(["unskilled", "semi_skilled", "skilled"]).optional().default("semi_skilled"),
  hourlyRatePaise: z.number().int().positive().optional().default(12000),
  assignedProcessId: z.string().optional(),
});

export const UpdateWorkerSchema = z.object({
  name: z.string().min(1).optional(),
  skillLevel: z.enum(["unskilled", "semi_skilled", "skilled"]).optional(),
  hourlyRatePaise: z.number().int().positive().optional(),
  assignedProcessId: z.string().optional(),
  active: z.boolean().optional(),
});

export const RecordAttendanceSchema = z.object({
  records: z.array(
    z.object({
      workerId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
      processId: z.string().optional(),
      shift: z.enum(["morning", "evening", "night"]).optional().default("morning"),
      status: z.enum(["present", "absent", "half_day", "on_leave"]).optional().default("present"),
      isPresent: z.boolean().optional(),
      hoursWorked: z.number().min(0).max(24).optional().default(8),
    })
  ),
});

export const DailyOutputEntryInputSchema = z.object({
  workerId: z.string().min(1),
  hoursWorked: z.number().min(0).max(24),
  quantityProduced: z.number().nonnegative(),
  quantityDefective: z.number().nonnegative().optional().default(0),
  hourlyRatePaiseSnapshot: z.number().int().nonnegative().optional(),
});

export const RecordDailyOutputSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  processId: z.string().min(1, "processId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  quantityProduced: z.number().nonnegative().optional(),
  quantityDefective: z.number().nonnegative().optional().default(0),
  entries: z.array(DailyOutputEntryInputSchema).optional(),
  operatorId: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const UpdateDailyOutputSchema = z.object({
  quantityProduced: z.number().nonnegative().optional(),
  quantityDefective: z.number().nonnegative().optional(),
  entries: z.array(DailyOutputEntryInputSchema).optional(),
  notes: z.string().optional(),
  reason: z.string().min(1, "reason is required to update recorded daily output"),
});

export type CreateWorkerInput = z.infer<typeof CreateWorkerSchema>;
export type UpdateWorkerInput = z.infer<typeof UpdateWorkerSchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceSchema>;
export type RecordDailyOutputInput = z.infer<typeof RecordDailyOutputSchema>;
export type UpdateDailyOutputInput = z.infer<typeof UpdateDailyOutputSchema>;


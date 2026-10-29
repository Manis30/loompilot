import { z } from "zod";

export const CreateWorkerSchema = z.object({
  workerCode: z.string().min(1, "workerCode is required"),
  name: z.string().min(1, "name is required"),
  skillLevel: z.enum(["unskilled", "semi_skilled", "skilled"]).optional().default("semi_skilled"),
  hourlyRatePaise: z.number().int().positive().optional().default(12000),
  assignedProcessId: z.string().optional(),
});

export const RecordAttendanceSchema = z.object({
  records: z.array(
    z.object({
      workerId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
      isPresent: z.boolean(),
      hoursWorked: z.number().min(0).max(24).optional().default(8),
    })
  ),
});

export const RecordDailyOutputSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  processId: z.string().min(1, "processId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  quantityProduced: z.number().nonnegative(),
  quantityDefective: z.number().nonnegative().optional().default(0),
  operatorId: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type CreateWorkerInput = z.infer<typeof CreateWorkerSchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceSchema>;
export type RecordDailyOutputInput = z.infer<typeof RecordDailyOutputSchema>;


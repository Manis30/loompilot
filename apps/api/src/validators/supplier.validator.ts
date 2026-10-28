import { z } from "zod";

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, "name is required"),
  contactPerson: z.string().min(1, "contactPerson is required"),
  email: z.string().email(),
  phone: z.string().min(5),
  leadTimeDays: z.number().int().positive().optional().default(7),
  rating: z.number().min(1).max(5).optional().default(4.5),
  suppliedMaterials: z.array(z.string()).optional(),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

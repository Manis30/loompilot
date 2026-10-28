import { z } from "zod";

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  contactPerson: z.string().min(1, "Contact person is required"),
  email: z.string().email(),
  phone: z.string().min(6),
  address: z.string().optional(),
  creditPeriodDays: z.number().int().nonnegative().default(30),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;


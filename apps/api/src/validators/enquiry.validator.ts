import { z } from "zod";

export const CreateEnquirySchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  customerName: z.string().min(1, "customerName is required"),
  rawText: z.string().min(1, "rawText is required"),
  parsedRequirements: z
    .object({
      productName: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().default("meters"),
      targetDeliveryDate: z.string().optional(),
      specialInstructions: z.string().optional(),
    })
    .optional(),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquirySchema>;

import { z } from "zod";

export const EnquirySpecsSchema = z.object({
  width: z.string().optional(),
  gsm: z.number().positive().optional(),
  weaveType: z.string().optional(),
  colorOrPantone: z.string().optional(),
  finishRequirements: z.string().optional(),
  packaging: z.string().optional(),
});

export const CreateEnquirySchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  customerName: z.string().min(1, "customerName is required"),
  rawText: z.string().min(1, "rawText is required"),
  specs: EnquirySpecsSchema.optional(),
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

export const UpdateEnquirySchema = z.object({
  rawText: z.string().min(1).optional(),
  specs: EnquirySpecsSchema.optional(),
  parsedRequirements: z
    .object({
      productName: z.string().min(1).optional(),
      quantity: z.number().positive().optional(),
      unit: z.string().optional(),
      targetDeliveryDate: z.string().optional(),
      specialInstructions: z.string().optional(),
    })
    .optional(),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquirySchema>;
export type UpdateEnquiryInput = z.infer<typeof UpdateEnquirySchema>;



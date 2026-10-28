import { z } from "zod";
import { UserRole } from "@loompilot/shared";

export const LoginSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterUserSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole).default(UserRole.SALES),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;


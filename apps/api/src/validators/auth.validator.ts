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

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;


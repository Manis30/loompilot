import { z } from "zod";
import { UserRole } from "@loompilot/shared";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.nativeEnum(UserRole).default(UserRole.SALES),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;


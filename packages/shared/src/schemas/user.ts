import { z } from "zod";
import { UserRole } from "../enums.js";

export const UserSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1, "tenantId is required"),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantId: z.string().min(1),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.nativeEnum(UserRole),
    tenantId: z.string(),
  }),
});

export type UserDto = z.infer<typeof UserSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;


import { Router } from "express";
import { CustomerController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const customersRouter = Router();

customersRouter.use(authMiddleware);

customersRouter.get("/", CustomerController.list);
customersRouter.get("/:id", CustomerController.getById);
customersRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
  CustomerController.create
);


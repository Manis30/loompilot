import { Router } from "express";
import { ProcessController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const processesRouter = Router();

processesRouter.use(authMiddleware);

processesRouter.get("/", ProcessController.list);
processesRouter.get("/:id", ProcessController.getById);
processesRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  ProcessController.create
);

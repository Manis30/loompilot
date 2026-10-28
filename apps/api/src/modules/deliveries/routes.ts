import { Router } from "express";
import { DeliveryController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const deliveriesRouter = Router();

deliveriesRouter.use(authMiddleware);

deliveriesRouter.get("/", DeliveryController.list);
deliveriesRouter.get("/:id", DeliveryController.getById);
deliveriesRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
  DeliveryController.recordDelivery
);


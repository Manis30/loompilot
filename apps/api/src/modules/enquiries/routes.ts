import { Router } from "express";
import { EnquiryController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const enquiriesRouter = Router();

enquiriesRouter.use(authMiddleware);

enquiriesRouter.get("/", EnquiryController.list);
enquiriesRouter.get("/:id", EnquiryController.getById);
enquiriesRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
  EnquiryController.create
);

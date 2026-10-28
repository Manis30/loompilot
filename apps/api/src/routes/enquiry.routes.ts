import { Router } from "express";
import { EnquiryController } from "../controllers/enquiry.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { CreateEnquirySchema } from "../validators/enquiry.validator.js";
import { UserRole } from "@loompilot/shared";

export function createEnquiryRoutes(controller: EnquiryController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    validate(CreateEnquirySchema),
    controller.create
  );

  return router;
}


import { Router } from "express";
import { ClientAccountController } from "../controllers/client-account.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const clientAccountRouter: Router = Router();

clientAccountRouter.use(authenticate);

clientAccountRouter.get(
  "/",
  authorize("GET /api/v1/client-accounts"),
  ClientAccountController.list
);

clientAccountRouter.post(
  "/invite",
  authorize("POST /api/v1/client-accounts/invite"),
  ClientAccountController.invite
);

clientAccountRouter.post(
  "/:id/reinvite",
  authorize("POST /api/v1/client-accounts/:id/reinvite"),
  ClientAccountController.reinvite
);

clientAccountRouter.post(
  "/:id/lock",
  authorize("POST /api/v1/client-accounts/:id/lock"),
  ClientAccountController.lock
);

clientAccountRouter.post(
  "/:id/unlock",
  authorize("POST /api/v1/client-accounts/:id/unlock"),
  ClientAccountController.unlock
);

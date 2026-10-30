import { Router } from "express";
import { ClientAccountController } from "../controllers/client-account.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const clientPortalRouter: Router = Router();

clientPortalRouter.use(authenticate);

clientPortalRouter.post(
  "/:id/portal/invite",
  authorize("POST /api/v1/clients/:id/portal/invite"),
  ClientAccountController.invite
);

clientPortalRouter.post(
  "/:id/portal/re-invite",
  authorize("POST /api/v1/clients/:id/portal/re-invite"),
  ClientAccountController.reinvite
);

// Alias without hyphen if requested
clientPortalRouter.post(
  "/:id/portal/reinvite",
  authorize("POST /api/v1/clients/:id/portal/re-invite"),
  ClientAccountController.reinvite
);

clientPortalRouter.post(
  "/:id/portal/accept",
  authorize("POST /api/v1/clients/:id/portal/accept"),
  ClientAccountController.accept
);

clientPortalRouter.post(
  "/:id/portal/lock",
  authorize("POST /api/v1/clients/:id/portal/lock"),
  ClientAccountController.lock
);

clientPortalRouter.post(
  "/:id/portal/unlock",
  authorize("POST /api/v1/clients/:id/portal/unlock"),
  ClientAccountController.unlock
);


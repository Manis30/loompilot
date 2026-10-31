import { Router } from "express";
import { ClientPortalController } from "../controllers/client-portal.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const clientPortalRouter: Router = Router();

clientPortalRouter.use(authenticate);

clientPortalRouter.post(
  "/:id/portal/invite",
  authorize("POST /api/v1/clients/:id/portal/invite"),
  ClientPortalController.invite
);

clientPortalRouter.post(
  "/:id/portal/re-invite",
  authorize("POST /api/v1/clients/:id/portal/re-invite"),
  ClientPortalController.reinvite
);

// Alias without hyphen if requested
clientPortalRouter.post(
  "/:id/portal/reinvite",
  authorize("POST /api/v1/clients/:id/portal/re-invite"),
  ClientPortalController.reinvite
);

clientPortalRouter.post(
  "/:id/portal/lock",
  authorize("POST /api/v1/clients/:id/portal/lock"),
  ClientPortalController.lock
);

clientPortalRouter.post(
  "/:id/portal/unlock",
  authorize("POST /api/v1/clients/:id/portal/unlock"),
  ClientPortalController.unlock
);


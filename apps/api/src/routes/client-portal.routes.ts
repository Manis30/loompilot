import { Router } from "express";
import { ClientPortalController } from "../controllers/client-portal.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  IdParamSchema,
  ClientPortalInviteSchema,
} from "../validators/index.js";

export const clientPortalRouter: Router = Router();

clientPortalRouter.use(authenticate);

clientPortalRouter.post(
  "/:id/portal/invite",
  authorize("POST /api/v1/clients/:id/portal/invite"),
  validateParams(IdParamSchema),
  validateBody(ClientPortalInviteSchema),
  ClientPortalController.invite
);

clientPortalRouter.post(
  "/:id/portal/re-invite",
  authorize("POST /api/v1/clients/:id/portal/re-invite"),
  validateParams(IdParamSchema),
  ClientPortalController.reinvite
);

// Alias without hyphen if requested
clientPortalRouter.post(
  "/:id/portal/reinvite",
  authorize("POST /api/v1/clients/:id/portal/re-invite"),
  validateParams(IdParamSchema),
  ClientPortalController.reinvite
);

clientPortalRouter.post(
  "/:id/portal/lock",
  authorize("POST /api/v1/clients/:id/portal/lock"),
  validateParams(IdParamSchema),
  ClientPortalController.lock
);

clientPortalRouter.post(
  "/:id/portal/unlock",
  authorize("POST /api/v1/clients/:id/portal/unlock"),
  validateParams(IdParamSchema),
  ClientPortalController.unlock
);


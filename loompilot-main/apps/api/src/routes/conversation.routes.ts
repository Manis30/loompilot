import { Router } from "express";
import { ConversationController } from "../controllers/conversation.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { AppContainer } from "../container.js";

export function createConversationRouter(_container?: AppContainer): Router {
  const router = Router();
  const controller = new ConversationController();

  // 1. Client chat endpoints
  router.get(
    "/api/v1/client/orders/:id/messages",
    authenticate,
    authorize("GET /api/v1/client/orders/:id/messages"),
    controller.getClientMessages
  );

  router.post(
    "/api/v1/client/orders/:id/chat",
    authenticate,
    authorize("POST /api/v1/client/orders/:id/chat"),
    controller.postClientChat
  );

  // 2. Admin conversation endpoints
  router.get(
    "/api/v1/orders/:id/messages",
    authenticate,
    authorize("GET /api/v1/orders/:id/messages"),
    controller.getAdminMessages
  );

  router.post(
    "/api/v1/orders/:id/chat",
    authenticate,
    authorize("POST /api/v1/orders/:id/chat"),
    controller.postAdminChat
  );

  router.post(
    "/api/v1/orders/:id/escalation/resolve",
    authenticate,
    authorize("POST /api/v1/orders/:id/escalation/resolve"),
    controller.resolveEscalation
  );

  return router;
}

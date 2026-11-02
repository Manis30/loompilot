import { Router } from "express";
import { ConversationController } from "../controllers/conversation.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { AppContainer } from "../container.js";

export function createConversationRouter(container: AppContainer): Router {
  const router = Router();
  const controller = new ConversationController(container.agentsClient);

  // 1. Client chat endpoints
  router.get(
    "/api/v1/client/orders/:id/chat",
    authenticate,
    authorize("GET /api/v1/client/orders/:id/chat"),
    controller.getClientOrderChat
  );

  router.post(
    "/api/v1/client/orders/:id/chat",
    authenticate,
    authorize("POST /api/v1/client/orders/:id/chat"),
    controller.sendClientOrderMessage
  );

  // 2. Admin conversation endpoints
  router.get(
    "/api/v1/conversations",
    authenticate,
    authorize("GET /api/v1/conversations"),
    controller.getAdminConversations
  );

  router.get(
    "/api/v1/conversations/:id",
    authenticate,
    authorize("GET /api/v1/conversations/:id"),
    controller.getConversationById
  );

  router.post(
    "/api/v1/conversations/:id/messages",
    authenticate,
    authorize("POST /api/v1/conversations/:id/messages"),
    controller.sendAdminMessage
  );

  router.post(
    "/api/v1/conversations/:id/escalations/resolve",
    authenticate,
    authorize("POST /api/v1/conversations/:id/escalations/resolve"),
    controller.resolveAdminEscalation
  );

  return router;
}

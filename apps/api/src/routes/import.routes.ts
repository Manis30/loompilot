import express, { Router } from "express";
import { ImportController } from "../controllers/import.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export function createImportRoutes(controller: ImportController): Router {
  const router = Router();

  const csvBodyParser = express.text({
    type: ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"],
    limit: "10mb",
  });

  router.use(authMiddleware);

  router.get("/templates/:type", controller.getTemplate);

  router.post(
    "/customers",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    csvBodyParser,
    controller.importCustomers
  );

  router.post(
    "/suppliers",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    csvBodyParser,
    controller.importSuppliers
  );

  router.post(
    "/materials",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    csvBodyParser,
    controller.importMaterials
  );

  return router;
}


import { Router } from "express";
import multer from "multer";
import { ImportController } from "../controllers/import.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import {
  validateBody,
  ImportDryRunSchema,
  ImportCommitSchema,
} from "../validators/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export const importRouter: Router = Router();
const controller = new ImportController();

importRouter.use(authenticate);

importRouter.post(
  "/dry-run",
  authorize("POST /api/v1/imports/dry-run"),
  upload.single("file"),
  validateBody(ImportDryRunSchema),
  controller.dryRun
);

importRouter.post(
  "/commit",
  idempotencyMiddleware,
  authorize("POST /api/v1/imports/commit"),
  upload.single("file"),
  validateBody(ImportCommitSchema),
  controller.commit
);


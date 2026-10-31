import { Router } from "express";
import multer from "multer";
import { FileController } from "../controllers/file.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validateParams, IdParamSchema } from "../validators/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const fileRouter: Router = Router();
const controller = new FileController();

fileRouter.use(authenticate);

fileRouter.post(
  "/",
  authorize("POST /api/v1/files"),
  upload.single("file"),
  controller.uploadFile
);

fileRouter.get(
  "/:id",
  authorize("GET /api/v1/files/:id"),
  validateParams(IdParamSchema),
  controller.downloadFile
);


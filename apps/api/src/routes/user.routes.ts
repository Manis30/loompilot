import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const userRouter: Router = Router();

userRouter.use(authenticate);

userRouter.get(
  "/",
  authorize("GET /api/v1/users"),
  UserController.list
);

userRouter.post(
  "/",
  authorize("POST /api/v1/users"),
  UserController.create
);

userRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/users/:id"),
  UserController.update
);

userRouter.post(
  "/:id/lock",
  authorize("POST /api/v1/users/:id/lock"),
  UserController.lock
);

userRouter.post(
  "/:id/unlock",
  authorize("POST /api/v1/users/:id/unlock"),
  UserController.unlock
);

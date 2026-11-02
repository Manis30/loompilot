import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  IdParamSchema,
  UserCreateSchema,
  UserUpdateSchema,
  UserQuerySchema,
} from "../validators/index.js";

export const userRouter: Router = Router();

userRouter.use(authenticate);

userRouter.get(
  "/",
  authorize("GET /api/v1/users"),
  validateQuery(UserQuerySchema),
  UserController.list
);

userRouter.post(
  "/",
  authorize("POST /api/v1/users"),
  validateBody(UserCreateSchema),
  UserController.create
);

userRouter.get(
  "/:id",
  authorize("GET /api/v1/users/:id"),
  validateParams(IdParamSchema),
  UserController.getById
);

userRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/users/:id"),
  validateParams(IdParamSchema),
  validateBody(UserUpdateSchema),
  UserController.update
);

userRouter.post(
  "/:id/lock",
  authorize("POST /api/v1/users/:id/lock"),
  validateParams(IdParamSchema),
  UserController.lock
);

userRouter.post(
  "/:id/unlock",
  authorize("POST /api/v1/users/:id/unlock"),
  validateParams(IdParamSchema),
  UserController.unlock
);

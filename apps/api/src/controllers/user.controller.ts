import { Request, Response } from "express";
import { UserService } from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toUserResponse } from "../mappers/user.mapper.js";
import { Actor } from "../utils/actor.js";

export class UserController {
  constructor(private readonly service: UserService) {}

  private getActor(req: Request): Actor {
    return {
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const users = await this.service.list(actor);
    res.json({
      data: users.map(toUserResponse),
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const user = await this.service.create(actor, req.body);
    res.status(201).json({
      data: toUserResponse(user),
      requestId: req.requestId,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const updated = await this.service.update(actor, req.params.id as string, req.body);
    res.json({
      data: toUserResponse(updated),
      requestId: req.requestId,
    });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const result = await this.service.resetPassword(
      actor,
      req.params.id as string,
      req.body
    );
    res.json({
      data: result,
      message: "Password reset successfully",
      requestId: req.requestId,
    });
  });
}


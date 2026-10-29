import { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toUserResponse } from "../mappers/user.mapper.js";
import { UnauthorizedError } from "../errors/index.js";

const REFRESH_COOKIE_NAME = "loompilot_refresh_token";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.login(req.body, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      data: {
        accessToken: result.accessToken,
        user: toUserResponse(result.user),
      },
      requestId: req.requestId,
    });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (!token) {
      throw new UnauthorizedError("Refresh token is missing");
    }

    const result = await this.service.refresh(token, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      data: {
        accessToken: result.accessToken,
      },
      requestId: req.requestId,
    });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (req.user && token) {
      await this.service.logout(req.user.tenantId, req.user.userId, token);
    }

    res.clearCookie(REFRESH_COOKIE_NAME);
    res.json({
      message: "Successfully logged out",
      requestId: req.requestId,
    });
  });

  logoutAll = asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await this.service.logoutAll(req.user.tenantId, req.user.userId);
    }

    res.clearCookie(REFRESH_COOKIE_NAME);
    res.json({
      message: "Successfully logged out from all sessions",
      requestId: req.requestId,
    });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const actor = {
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };

    await this.service.changePassword(
      actor,
      req.body.currentPassword,
      req.body.newPassword
    );

    res.json({
      message: "Password changed successfully",
      requestId: req.requestId,
    });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    res.json({
      data: req.user,
      requestId: req.requestId,
    });
  });

  register = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user
      ? {
          tenantId: req.user.tenantId,
          userId: req.user.userId,
          role: req.user.role,
          email: req.user.email,
        }
      : undefined;

    // Must be restricted to caller's tenant
    const input = {
      ...req.body,
      tenantId: req.user?.tenantId || req.body.tenantId,
    };

    const user = await this.service.register(input, actor);
    res.status(201).json({
      data: toUserResponse(user),
      requestId: req.requestId,
    });
  });
}

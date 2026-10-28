import { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toUserResponse } from "../mappers/user.mapper.js";
import { UnauthorizedError } from "../errors/index.js";

const REFRESH_COOKIE_NAME = "loompilot_refresh_token";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.login(req.body);

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

    const result = await this.service.refresh(token);

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
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (req.user && token) {
      await this.service.logout(req.user.tenantId, req.user.userId, token);
    }

    res.clearCookie(REFRESH_COOKIE_NAME);
    res.json({
      message: "Successfully logged out",
      requestId: req.requestId,
    });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    res.json({
      data: req.user,
      requestId: req.requestId,
    });
  });
}


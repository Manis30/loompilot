import { Request, Response } from "express";
import { AuthService } from "./service.js";

const REFRESH_COOKIE_NAME = "loompilot_refresh_token";

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    const { tenantId, email, password } = req.body;
    const authResult = await AuthService.authenticate(tenantId, email, password);

    if (!authResult) {
      res.status(401).json({
        error: "AuthenticationFailed",
        message: "Invalid email, password, or tenant ID",
        requestId: req.requestId,
      });
      return;
    }

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_COOKIE_NAME, authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      data: {
        accessToken: authResult.accessToken,
        user: {
          id: authResult.user._id,
          email: authResult.user.email,
          name: authResult.user.name,
          role: authResult.user.role,
          tenantId: authResult.user.tenantId,
        },
      },
      requestId: req.requestId,
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Refresh token is missing",
        requestId: req.requestId,
      });
      return;
    }

    const result = await AuthService.refresh(token);
    if (!result) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired refresh token",
        requestId: req.requestId,
      });
      return;
    }

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
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (req.user && token) {
      await AuthService.logout(req.user.userId, token);
    }

    res.clearCookie(REFRESH_COOKIE_NAME);
    res.json({
      message: "Successfully logged out",
      requestId: req.requestId,
    });
  }

  static async me(req: Request, res: Response): Promise<void> {
    res.json({
      data: req.user,
      requestId: req.requestId,
    });
  }
}

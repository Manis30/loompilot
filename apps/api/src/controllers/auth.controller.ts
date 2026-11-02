import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { getEnv } from "../config/env.js";

const authService = new AuthService();

function getCookieOptions(path = "/", httpOnly = false) {
  const env = getEnv();
  return {
    httpOnly,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

function clearAllAuthCookies(res: Response) {
  const paths = ["/", "/api/v1", "/api/v1/auth", "/api/v1/client/auth"];
  const cookieNames = [
    "access_token",
    "loompilot_token",
    "loompilot_role",
    "refreshToken",
    "refreshToken_global",
    "accessToken",
  ];
  for (const name of cookieNames) {
    for (const path of paths) {
      res.clearCookie(name, { path });
    }
  }
}

export class AuthController {
  static async loginUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.body.tenantId || getEnv().TENANT_DEFAULT_ID;
      const { email, password } = req.body;

      const result = await authService.loginUser({
        tenantId,
        email,
        password,
        ip: req.ip,
        requestId: (req as any).id,
      });

      // Set HTTP-only refresh tokens
      res.cookie("refreshToken", result.rawRefreshToken, getCookieOptions("/api/v1/auth", true));
      res.cookie("refreshToken_global", result.rawRefreshToken, getCookieOptions("/", true));

      // Set access token & role cookies (sent for all API requests and accessible to client)
      res.cookie("access_token", result.accessToken, getCookieOptions("/", false));
      res.cookie("loompilot_token", result.accessToken, getCookieOptions("/", false));
      res.cookie("loompilot_role", result.user.role, getCookieOptions("/", false));

      res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async loginClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.body.tenantId || getEnv().TENANT_DEFAULT_ID;
      const { email, password } = req.body;

      const result = await authService.loginClient({
        tenantId,
        email,
        password,
        ip: req.ip,
        requestId: (req as any).id,
      });

      // Set HTTP-only refresh tokens
      res.cookie("refreshToken", result.rawRefreshToken, getCookieOptions("/api/v1/client/auth", true));
      res.cookie("refreshToken_global", result.rawRefreshToken, getCookieOptions("/", true));

      // Set access token & role cookies (sent for all API requests and accessible to client)
      res.cookie("access_token", result.accessToken, getCookieOptions("/", false));
      res.cookie("loompilot_token", result.accessToken, getCookieOptions("/", false));
      res.cookie("loompilot_role", "client", getCookieOptions("/", false));

      res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        clientAccount: result.clientAccount,
      });
    } catch (err) {
      next(err);
    }
  }

  static async refreshUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.cookies?.refreshToken_global || req.body?.refreshToken;

      const result = await authService.refresh({
        rawRefreshToken,
        expectedRealm: "user",
        origin: req.headers.origin,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.cookie("refreshToken", result.newRawRefreshToken, getCookieOptions("/api/v1/auth", true));
      res.cookie("refreshToken_global", result.newRawRefreshToken, getCookieOptions("/", true));
      res.cookie("access_token", result.accessToken, getCookieOptions("/", false));
      res.cookie("loompilot_token", result.accessToken, getCookieOptions("/", false));

      res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      });
    } catch (err) {
      next(err);
    }
  }

  static async refreshClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.cookies?.refreshToken_global || req.body?.refreshToken;

      const result = await authService.refresh({
        rawRefreshToken,
        expectedRealm: "client",
        origin: req.headers.origin,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.cookie("refreshToken", result.newRawRefreshToken, getCookieOptions("/api/v1/client/auth", true));
      res.cookie("refreshToken_global", result.newRawRefreshToken, getCookieOptions("/", true));
      res.cookie("access_token", result.accessToken, getCookieOptions("/", false));
      res.cookie("loompilot_token", result.accessToken, getCookieOptions("/", false));

      res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      });
    } catch (err) {
      next(err);
    }
  }

  static async logoutUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.cookies?.refreshToken_global || req.body?.refreshToken;

      await authService.logout({
        rawRefreshToken,
        origin: req.headers.origin,
        ip: req.ip,
        requestId: (req as any).id,
      });

      clearAllAuthCookies(res);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async logoutClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.cookies?.refreshToken_global || req.body?.refreshToken;

      await authService.logout({
        rawRefreshToken,
        origin: req.headers.origin,
        ip: req.ip,
        requestId: (req as any).id,
      });

      clearAllAuthCookies(res);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;

      await authService.logoutAll({
        tenantId: actor.tenantId,
        realm: actor.realm,
        subjectId: actor.subjectId,
        ip: req.ip,
        requestId: (req as any).id,
      });

      clearAllAuthCookies(res);
      res.status(200).json({ success: true, message: "All sessions terminated" });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword({
        tenantId: actor.tenantId,
        realm: actor.realm,
        subjectId: actor.subjectId,
        currentPassword,
        newPassword,
        ip: req.ip,
        requestId: (req as any).id,
      });

      clearAllAuthCookies(res);
      res.status(200).json({ success: true, message: "Password changed successfully. All other sessions terminated." });
    } catch (err) {
      next(err);
    }
  }

  static async acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password, tenantId } = req.body;

      const result = await authService.acceptInvite({
        token,
        password,
        tenantId,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@loompilot/shared";
import { UserModel, IUser } from "./model.js";
import { env } from "../../config/env.js";

export class AuthService {
  static async createUser(data: {
    tenantId: string;
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }): Promise<IUser> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    return UserModel.create({
      tenantId: data.tenantId,
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role,
    });
  }

  static async authenticate(
    tenantId: string,
    email: string,
    password: string
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string } | null> {
    const user = await UserModel.findOne({ tenantId, email, isActive: true });
    if (!user) return null;

    const isValid = await user.comparePassword(password);
    if (!isValid) return null;

    const accessToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { userId: user._id.toString(), tenantId: user.tenantId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) {
      user.refreshTokens.shift(); // Keep at most 5 active refresh tokens
    }
    await user.save();

    return { user, accessToken, refreshToken };
  }

  static async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        userId: string;
        tenantId: string;
      };

      const user = await UserModel.findOne({
        _id: decoded.userId,
        tenantId: decoded.tenantId,
        refreshTokens: refreshToken,
        isActive: true,
      });

      if (!user) return null;

      // Rotate token: remove old, generate new
      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);

      const newAccessToken = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as any }
      );

      const newRefreshToken = jwt.sign(
        { userId: user._id.toString(), tenantId: user.tenantId },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
      );

      user.refreshTokens.push(newRefreshToken);
      await user.save();

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      return null;
    }
  }

  static async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: refreshToken } }
    );
  }
}

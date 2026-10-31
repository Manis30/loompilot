import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IUser, UserModel } from "../models/identity/user.model.js";

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(tenantId: string, email: string): Promise<IUser | null> {
    return this.model
      .findOne({
        tenantId,
        email: email.toLowerCase().trim(),
      })
      .select("+passwordHash");
  }

  async countActiveAdmins(tenantId: string): Promise<number> {
    return this.model.countDocuments({
      tenantId,
      role: "admin",
      status: "active",
    });
  }

  async incrementFailedLogin(
    tenantId: string,
    userId: Types.ObjectId | string,
    maxAttempts = 5,
    lockoutDurationMinutes = 15
  ): Promise<{ user: IUser | null; lockedNow: boolean }> {
    const objId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
    const user = await this.model.findOne({ tenantId, _id: objId });
    if (!user) return { user: null, lockedNow: false };

    const newFailedCount = (user.lockout?.failedCount || 0) + 1;
    let newStatus = user.status;
    let lockedUntil = user.lockout?.lockedUntil;
    let lockedNow = false;

    if (newFailedCount >= maxAttempts) {
      newStatus = "locked";
      lockedUntil = new Date(Date.now() + lockoutDurationMinutes * 60 * 1000);
      lockedNow = true;
    }

    const updated = await this.model.findOneAndUpdate(
      { tenantId, _id: objId },
      {
        $set: {
          status: newStatus,
          "lockout.failedCount": newFailedCount,
          "lockout.lockedUntil": lockedUntil,
        },
      },
      { new: true }
    );

    return { user: updated, lockedNow };
  }

  async resetLockout(
    tenantId: string,
    userId: Types.ObjectId | string
  ): Promise<IUser | null> {
    const objId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
    return this.model.findOneAndUpdate(
      { tenantId, _id: objId },
      {
        $set: {
          status: "active",
          "lockout.failedCount": 0,
          "lockout.lockedUntil": null,
        },
      },
      { new: true }
    );
  }

  async updateStatus(
    tenantId: string,
    userId: Types.ObjectId | string,
    status: "active" | "locked"
  ): Promise<IUser | null> {
    const objId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
    const update: any = { status };
    if (status === "active") {
      update["lockout.failedCount"] = 0;
      update["lockout.lockedUntil"] = null;
    }
    return this.model.findOneAndUpdate(
      { tenantId, _id: objId },
      { $set: update },
      { new: true }
    );
  }

  async isProcessAreaUsed(tenantId: string, area: string): Promise<boolean> {
    const count = await this.model.countDocuments({
      tenantId,
      processAreas: area,
    });
    return count > 0;
  }
}

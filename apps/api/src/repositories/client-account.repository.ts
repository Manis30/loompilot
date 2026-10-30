import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  IClientAccount,
  ClientAccountModel,
} from "../models/identity/client-account.model.js";

export class ClientAccountRepository extends BaseRepository<IClientAccount> {
  constructor() {
    super(ClientAccountModel);
  }

  async findByEmail(
    tenantId: string,
    email: string
  ): Promise<IClientAccount | null> {
    return this.model.findOne({
      tenantId,
      email: email.toLowerCase().trim(),
    });
  }

  async createAccount(
    tenantId: string,
    data: {
      clientId: string;
      email: string;
      name: string;
      phone?: string;
      status: "invited" | "active" | "locked";
      invitedBy: string;
      invitedAt: Date;
    }
  ): Promise<IClientAccount> {
    const [created] = await this.model.create([
      {
        ...data,
        tenantId,
        clientId: new Types.ObjectId(data.clientId),
        invitedBy: new Types.ObjectId(data.invitedBy),
        version: 1,
      },
    ]);
    if (!created) {
      throw new Error("Failed to create client account");
    }
    return created;
  }

  async incrementFailedLogin(
    tenantId: string,
    accountId: Types.ObjectId | string,
    maxAttempts = 5,
    lockoutDurationMinutes = 15
  ): Promise<{ account: IClientAccount | null; lockedNow: boolean }> {
    const objId = typeof accountId === "string" ? new Types.ObjectId(accountId) : accountId;
    const account = await this.model.findOne({ tenantId, _id: objId });
    if (!account) return { account: null, lockedNow: false };

    const newFailedCount = (account.lockout?.failedCount || 0) + 1;
    let newStatus = account.status;
    let lockedUntil = account.lockout?.lockedUntil;
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

    return { account: updated, lockedNow };
  }

  async resetLockout(
    tenantId: string,
    accountId: Types.ObjectId | string
  ): Promise<IClientAccount | null> {
    const objId = typeof accountId === "string" ? new Types.ObjectId(accountId) : accountId;
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
    accountId: Types.ObjectId | string,
    status: "invited" | "active" | "locked"
  ): Promise<IClientAccount | null> {
    const objId = typeof accountId === "string" ? new Types.ObjectId(accountId) : accountId;
    const update: any = { status };
    if (status === "active" || status === "invited") {
      update["lockout.failedCount"] = 0;
      update["lockout.lockedUntil"] = null;
    }
    return this.model.findOneAndUpdate(
      { tenantId, _id: objId },
      { $set: update },
      { new: true }
    );
  }
}

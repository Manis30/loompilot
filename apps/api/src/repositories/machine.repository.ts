import { BaseRepository } from "./base.repository.js";
import { IMachine, MachineModel } from "../models/catalog/machine.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class MachineRepository extends BaseRepository<IMachine> {
  constructor() {
    super(MachineModel);
  }

  async isProcessAreaUsed(tenantId: string, area: string): Promise<boolean> {
    const count = await this.model.countDocuments({
      tenantId,
      processArea: area,
      currentStatus: { $ne: "inactive" },
    });
    return count > 0;
  }

  async updateMachineStatus(
    tenantId: string,
    machineId: string,
    currentStatus: "available" | "maint" | "breakdown" | "inactive",
    tx?: TxContext
  ): Promise<IMachine | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: machineId },
        { $set: { currentStatus }, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMachine>()
      .exec();
  }
}


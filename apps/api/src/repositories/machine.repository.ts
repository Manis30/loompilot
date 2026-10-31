import { BaseRepository } from "./base.repository.js";
import { IMachine, MachineModel } from "../models/catalog/machine.model.js";

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
}


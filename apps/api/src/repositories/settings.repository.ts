import { BaseRepository } from "./base.repository.js";
import { ISettings, SettingsModel } from "../models/identity/settings.model.js";

export class SettingsRepository extends BaseRepository<ISettings> {
  constructor() {
    super(SettingsModel);
  }

  async getSettings(tenantId: string): Promise<ISettings | null> {
    return this.model.findOne({ tenantId }).lean();
  }
}


import {
  ISettingsRepository,
  Settings,
  Holiday,
  NewHoliday,
  CompanyProfile,
} from "../interfaces/settings.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { SettingsModel, HolidayModel } from "../models/settings.model.js";
import { VersionConflictError } from "../errors/index.js";

export class MongoSettingsRepository implements ISettingsRepository {
  private toSettingsEntity(doc: any): Settings {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      companyProfile: doc.companyProfile,
      version: doc.version || 1,
      updatedAt: doc.updatedAt,
    };
  }

  private toHolidayEntity(doc: any): Holiday {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      date: doc.date,
      name: doc.name,
      processId: doc.processId,
      createdAt: doc.createdAt,
    };
  }

  async getSettings(tenantId: string, tx?: TxContext): Promise<Settings> {
    let doc = await SettingsModel.findOne({ tenantId }).session(tx?.session || null);
    if (!doc) {
      doc = await SettingsModel.create([{ tenantId }], { session: tx?.session || null }).then(
        (docs) => docs[0]!
      );
    }
    return this.toSettingsEntity(doc);
  }

  async updateSettings(
    tenantId: string,
    updates: Partial<CompanyProfile>,
    expectedVersion?: number,
    tx?: TxContext
  ): Promise<Settings> {
    const current = await this.getSettings(tenantId, tx);

    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new VersionConflictError(
        `Settings version mismatch. Expected version ${expectedVersion} but found ${current.version}`
      );
    }

    const mergedProfile = {
      ...current.companyProfile,
      ...updates,
    };

    const updated = await SettingsModel.findOneAndUpdate(
      { tenantId, version: current.version },
      {
        $set: { companyProfile: mergedProfile },
        $inc: { version: 1 },
      },
      { new: true, session: tx?.session || null }
    ).lean();

    if (!updated) {
      throw new VersionConflictError("Concurrent update detected on settings. Please refresh and retry.");
    }

    return this.toSettingsEntity(updated);
  }

  async listHolidays(tenantId: string): Promise<Holiday[]> {
    const docs = await HolidayModel.find({ tenantId }).sort({ date: 1 }).lean();
    return docs.map((d: any) => this.toHolidayEntity(d));
  }

  async createHoliday(data: NewHoliday, tx?: TxContext): Promise<Holiday> {
    const docs = await HolidayModel.create([data], { session: tx?.session || null });
    return this.toHolidayEntity(docs[0]!);
  }

  async deleteHoliday(tenantId: string, id: string, tx?: TxContext): Promise<boolean> {
    const result = await HolidayModel.deleteOne({ _id: id, tenantId }, { session: tx?.session || null });
    return result.deletedCount > 0;
  }
}

import {
  ISettingsRepository,
  Settings,
  Holiday,
} from "../interfaces/settings.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import {
  UpdateSettingsInput,
  CreateHolidayInput,
} from "../validators/settings.validator.js";
import { invalidateHolidayCache } from "../utils/dates.js";
import { NotFoundError } from "../errors/index.js";

export class SettingsService {
  constructor(
    private readonly repo: ISettingsRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async getSettings(actor: Actor): Promise<Settings> {
    return this.repo.getSettings(actor.tenantId);
  }

  async updateSettings(
    actor: Actor,
    input: UpdateSettingsInput
  ): Promise<Settings> {
    const current = await this.repo.getSettings(actor.tenantId);
    const beforeSnapshot = { ...current.companyProfile, version: current.version };

    const { expectedVersion, ...updates } = input;
    const updated = await this.repo.updateSettings(
      actor.tenantId,
      updates,
      expectedVersion
    );

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "SETTINGS_UPDATED",
        entityType: "settings",
        entityId: updated.id,
        before: beforeSnapshot,
        after: { ...updated.companyProfile, version: updated.version },
      });
    }

    return updated;
  }

  async listHolidays(actor: Actor): Promise<Holiday[]> {
    return this.repo.listHolidays(actor.tenantId);
  }

  async createHoliday(
    actor: Actor,
    input: CreateHolidayInput
  ): Promise<Holiday> {
    const holiday = await this.repo.createHoliday({
      tenantId: actor.tenantId,
      date: input.date,
      name: input.name,
      processId: input.processId,
    });

    invalidateHolidayCache(actor.tenantId);

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "HOLIDAY_CREATED",
        entityType: "holiday",
        entityId: holiday.id,
        after: { date: holiday.date, name: holiday.name },
      });
    }

    return holiday;
  }

  async deleteHoliday(actor: Actor, id: string): Promise<void> {
    const success = await this.repo.deleteHoliday(actor.tenantId, id);
    if (!success) {
      throw new NotFoundError("Holiday not found");
    }

    invalidateHolidayCache(actor.tenantId);

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "HOLIDAY_DELETED",
        entityType: "holiday",
        entityId: id,
      });
    }
  }
}

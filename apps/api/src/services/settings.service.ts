import { SettingsRepository } from "../repositories/settings.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { MachineRepository } from "../repositories/machine.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { ISettings, IProcessConfig } from "../models/identity/settings.model.js";
import { AuditService } from "./audit.service.js";
import { AppError, VersionConflictError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { DEFAULT_SETTINGS } from "../config/tenant-defaults.js";

export class SettingsService {
  constructor(
    private readonly settingsRepo = new SettingsRepository(),
    private readonly productRepo = new ProductRepository(),
    private readonly userRepo = new UserRepository(),
    private readonly machineRepo = new MachineRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async getSettings(tenantId: string): Promise<ISettings> {
    let settings = await this.settingsRepo.getSettings(tenantId);
    if (!settings) {
      settings = (await this.settingsRepo.create(tenantId, {
        ...DEFAULT_SETTINGS,
        tenantId,
        version: 1,
      })) as ISettings;
    }

    // Sanitize market sources: remove any secrets if present
    if (settings.marketSources) {
      settings.marketSources = settings.marketSources.map((s) => {
        const { config, ...rest } = s;
        // Keep non-sensitive config like secretRef name only
        const sanitizedConfig = config ? { secretRef: config.secretRef } : undefined;
        return { ...rest, config: sanitizedConfig };
      });
    }

    return settings;
  }

  async updateSettings(params: {
    tenantId: string;
    updates: Partial<ISettings>;
    currentVersion: number;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<ISettings> {
    const { tenantId, updates, currentVersion, actor } = params;

    // Validation: weeklyOffs (integers 0-6, not all 7)
    if (updates.weeklyOffs !== undefined) {
      if (
        !Array.isArray(updates.weeklyOffs) ||
        updates.weeklyOffs.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
      ) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "weeklyOffs must be an array of integers between 0 (Sunday) and 6 (Saturday)",
          400
        );
      }
      const uniqueDays = new Set(updates.weeklyOffs);
      if (uniqueDays.size >= 7) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "weeklyOffs cannot include all 7 days of the week",
          400
        );
      }
    }

    // Validation: holidays (valid unique YYYY-MM-DD)
    if (updates.holidays !== undefined) {
      if (!Array.isArray(updates.holidays)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "holidays must be an array of dates", 400);
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const seenHolidays = new Set<string>();
      for (const h of updates.holidays) {
        if (typeof h !== "string" || !dateRegex.test(h) || isNaN(Date.parse(h))) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Invalid holiday date format: '${h}'. Expected YYYY-MM-DD`,
            400
          );
        }
        if (seenHolidays.has(h)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Duplicate holiday date '${h}' in holidays list`,
            400
          );
        }
        seenHolidays.add(h);
      }
    }

    // Validation: quoteReminderDays (positive integers)
    if (updates.quoteReminderDays !== undefined) {
      if (
        !Array.isArray(updates.quoteReminderDays) ||
        updates.quoteReminderDays.some((d) => !Number.isInteger(d) || d <= 0)
      ) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "quoteReminderDays must be an array of positive integers",
          400
        );
      }
    }

    // Validation: marketSources config may hold only secretRef and non-secret settings; keys like key, secret, token, password rejected
    if (updates.marketSources !== undefined) {
      if (!Array.isArray(updates.marketSources)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "marketSources must be an array", 400);
      }
      const forbiddenPatterns = [/key/i, /secret/i, /token/i, /password/i];
      for (const s of updates.marketSources) {
        if (s.config && typeof s.config === "object") {
          for (const k of Object.keys(s.config)) {
            if (k === "secretRef") continue;
            for (const pat of forbiddenPatterns) {
              if (pat.test(k)) {
                throw new AppError(
                  ErrorCode.VALIDATION_FAILED,
                  `marketSources config may not contain sensitive key '${k}'. Use secretRef to reference environment variables.`,
                  400
                );
              }
            }
          }
        }
      }
    }

    const before = await this.getSettings(tenantId);

    // Validation: processConfig
    if (updates.processConfig !== undefined) {
      if (!Array.isArray(updates.processConfig) || updates.processConfig.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "processConfig must contain at least one valid process area",
          400
        );
      }
      for (const p of updates.processConfig as IProcessConfig[]) {
        if (!p.area || typeof p.hours !== "number" || p.hours <= 0) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Process config for area '${p.area}' must specify positive hours`,
            400
          );
        }
      }

      const oldAreas = (before.processConfig || []).map((p: any) => p.area);
      const newAreas = (updates.processConfig as IProcessConfig[]).map((p) => p.area);
      const removedAreas = oldAreas.filter((a) => !newAreas.includes(a));

      for (const area of removedAreas) {
        if (await this.productRepo.isProcessAreaUsed(tenantId, area)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Cannot remove process area '${area}' because it is in use by an active product routing`,
            400
          );
        }
        if (await this.userRepo.isProcessAreaUsed(tenantId, area)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Cannot remove process area '${area}' because it is assigned to a user`,
            400
          );
        }
        if (await this.machineRepo.isProcessAreaUsed(tenantId, area)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Cannot remove process area '${area}' because it is assigned to a machine`,
            400
          );
        }
        if (await this.ordersRepo.isProcessAreaUsedInActiveOrders(tenantId, area)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Cannot remove process area '${area}' because it is in use by an active order plan`,
            400
          );
        }
      }
    }

    const updated = await this.settingsRepo.updateWithVersion(
      tenantId,
      String(before._id),
      currentVersion,
      updates as any
    );

    if (!updated) {
      throw new VersionConflictError(`Settings version conflict. Current version does not match ${currentVersion}`);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "SETTINGS_UPDATED",
      entity: { collection: "settings", id: String(updated._id) },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }
}

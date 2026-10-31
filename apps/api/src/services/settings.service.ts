import { SettingsRepository } from "../repositories/settings.repository.js";
import { ISettings, IProcessConfig } from "../models/identity/settings.model.js";
import { AuditService } from "./audit.service.js";
import { AppError, VersionConflictError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { DEFAULT_SETTINGS } from "../config/tenant-defaults.js";

export class SettingsService {
  constructor(
    private readonly settingsRepo = new SettingsRepository(),
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

    // Validation: weeklyOffs
    if (updates.weeklyOffs !== undefined) {
      if (!Array.isArray(updates.weeklyOffs) || updates.weeklyOffs.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "weeklyOffs must be an array of integers between 0 (Sunday) and 6 (Saturday)", 400);
      }
    }

    // Validation: processConfig
    if (updates.processConfig !== undefined) {
      if (!Array.isArray(updates.processConfig) || updates.processConfig.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "processConfig must contain at least one valid process area", 400);
      }
      for (const p of updates.processConfig as IProcessConfig[]) {
        if (!p.area || typeof p.hours !== "number" || p.hours <= 0) {
          throw new AppError(ErrorCode.VALIDATION_FAILED, `Process config for area '${p.area}' must specify positive hours`, 400);
        }
      }
    }

    // Ensure secrets are never passed or stored in marketSources config
    if (updates.marketSources) {
      updates.marketSources = updates.marketSources.map((s) => {
        if (s.config && (s.config.secret || s.config.apiKey || s.config.password)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            "Market source secrets must be stored in environment variables, referenced by secretRef name only",
            400
          );
        }
        return s;
      });
    }

    const before = await this.getSettings(tenantId);

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

    return updated as ISettings;
  }
}

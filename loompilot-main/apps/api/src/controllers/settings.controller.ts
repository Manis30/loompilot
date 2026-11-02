import { Request, Response } from "express";
import { SettingsService } from "../services/settings.service.js";

export class SettingsController {
  constructor(private readonly settingsService = new SettingsService()) {}

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const settings = await this.settingsService.getSettings(actor.tenantId);
    res.json({ data: settings });
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const currentVersion = Number(req.body.version ?? 1);
    const updates = { ...req.body };
    delete updates.version;

    const updated = await this.settingsService.updateSettings({
      tenantId: actor.tenantId,
      updates,
      currentVersion,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });

    res.json({ data: updated });
  };
}

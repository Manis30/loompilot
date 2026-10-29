import { Request, Response } from "express";
import { SettingsService } from "../services/settings.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Actor } from "../utils/actor.js";

export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  private getActor(req: Request): Actor {
    return {
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
  }

  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const settings = await this.service.getSettings(actor);
    res.json({
      data: {
        ...settings,
        ...settings.companyProfile,
        companyName: settings.companyProfile.name,
      },
      requestId: req.requestId,
    });
  });

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const updated = await this.service.updateSettings(actor, {
      ...req.body,
      name: req.body.name || req.body.companyName,
    });
    res.json({
      data: {
        ...updated,
        ...updated.companyProfile,
        companyName: updated.companyProfile.name,
      },
      requestId: req.requestId,
    });
  });

  listHolidays = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const holidays = await this.service.listHolidays(actor);
    res.json({
      data: holidays,
      requestId: req.requestId,
    });
  });

  createHoliday = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const holiday = await this.service.createHoliday(actor, req.body);
    res.status(201).json({
      data: holiday,
      requestId: req.requestId,
    });
  });

  deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    await this.service.deleteHoliday(actor, req.params.id as string);
    res.json({
      data: { deleted: true },
      message: "Holiday deleted successfully",
      requestId: req.requestId,
    });
  });
}

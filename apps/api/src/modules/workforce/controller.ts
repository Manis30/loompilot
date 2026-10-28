import { Request, Response } from "express";
import { WorkforceService } from "./service.js";

export class WorkforceController {
  static async listWorkers(req: Request, res: Response): Promise<void> {
    const workers = await WorkforceService.listWorkers(req.user!.tenantId);
    res.json({ data: workers, requestId: req.requestId });
  }

  static async createWorker(req: Request, res: Response): Promise<void> {
    const worker = await WorkforceService.createWorker({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: worker, requestId: req.requestId });
  }

  static async recordAttendance(req: Request, res: Response): Promise<void> {
    const records = await WorkforceService.recordAttendance(
      req.user!.tenantId,
      req.body.records
    );
    res.status(200).json({ data: records, requestId: req.requestId });
  }

  static async getAttendance(req: Request, res: Response): Promise<void> {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0]!;
    const records = await WorkforceService.getAttendance(req.user!.tenantId, date);
    res.json({ data: records, requestId: req.requestId });
  }

  static async recordDailyOutput(req: Request, res: Response): Promise<void> {
    const output = await WorkforceService.recordDailyOutput({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: output, requestId: req.requestId });
  }

  static async getOutputsForOrder(req: Request, res: Response): Promise<void> {
    const outputs = await WorkforceService.getOutputsForOrder(req.user!.tenantId, req.params.orderId!);
    res.json({ data: outputs, requestId: req.requestId });
  }
}

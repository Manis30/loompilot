import { Request, Response } from "express";
import { WorkforceService } from "../services/workforce.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { todayInTz } from "../utils/dates.js";
import {
  toWorkerResponse,
  toAttendanceResponse,
  toDailyOutputResponse,
} from "../mappers/workforce.mapper.js";

export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  listWorkers = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.listWorkers(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toWorkerResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  createWorker = asyncHandler(async (req: Request, res: Response) => {
    const worker = await this.service.createWorker(actorFrom(req), req.body);
    res.status(201).json({
      data: toWorkerResponse(worker),
      requestId: req.requestId,
    });
  });

  recordAttendance = asyncHandler(async (req: Request, res: Response) => {
    const records = await this.service.recordAttendance(actorFrom(req), req.body);
    res.status(200).json({
      data: records.map(toAttendanceResponse),
      requestId: req.requestId,
    });
  });

  getAttendance = asyncHandler(async (req: Request, res: Response) => {
    const date = (req.query.date as string) || todayInTz();
    const records = await this.service.getAttendance(actorFrom(req), date);
    res.json({
      data: records.map(toAttendanceResponse),
      requestId: req.requestId,
    });
  });

  recordDailyOutput = asyncHandler(async (req: Request, res: Response) => {
    const output = await this.service.recordDailyOutput(actorFrom(req), req.body);
    res.status(201).json({
      data: toDailyOutputResponse(output),
      requestId: req.requestId,
    });
  });

  getOutputsForOrder = asyncHandler(async (req: Request, res: Response) => {
    const outputs = await this.service.getOutputsForOrder(actorFrom(req), req.params.orderId!);
    res.json({
      data: outputs.map(toDailyOutputResponse),
      requestId: req.requestId,
    });
  });
}


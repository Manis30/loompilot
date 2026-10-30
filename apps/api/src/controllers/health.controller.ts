import { Request, Response } from "express";
import { HealthService } from "../services/health.service.js";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth = (_req: Request, res: Response): void => {
    const health = this.healthService.getHealth();
    res.status(200).json(health);
  };

  getReadiness = (_req: Request, res: Response): void => {
    const readiness = this.healthService.getReadiness();
    const statusCode = readiness.status === "ready" ? 200 : 503;
    res.status(statusCode).json(readiness);
  };
}


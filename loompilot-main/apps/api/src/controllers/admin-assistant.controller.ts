import { Request, Response, NextFunction } from "express";
import { AdminAssistantService } from "../services/admin-assistant.service.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class AdminAssistantController {
  private service: AdminAssistantService;

  constructor(agentsClient?: IAgentsClient) {
    this.service = new AdminAssistantService(
      undefined,
      undefined,
      undefined,
      agentsClient
    );
  }

  ask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const userId = actor.subjectId;
      const { query, prompt } = req.body;

      const userQuery = query || prompt;
      if (!userQuery || typeof userQuery !== "string") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Field 'query' string is required", 400);
      }

      const reply = await this.service.ask(tenantId, userId, userQuery.trim());
      res.status(200).json({ success: true, data: reply });
    } catch (err) {
      next(err);
    }
  };
}

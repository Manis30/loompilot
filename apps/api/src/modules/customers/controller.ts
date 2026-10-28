import { Request, Response } from "express";
import { CustomerService } from "./service.js";

export class CustomerController {
  static async list(req: Request, res: Response): Promise<void> {
    const customers = await CustomerService.list(req.user!.tenantId);
    res.json({ data: customers, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const customer = await CustomerService.getById(req.user!.tenantId, req.params.id!);
    if (!customer) {
      res.status(404).json({ error: "NotFound", message: "Customer not found", requestId: req.requestId });
      return;
    }
    res.json({ data: customer, requestId: req.requestId });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const customer = await CustomerService.create({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: customer, requestId: req.requestId });
  }
}

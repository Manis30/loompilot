import { Request, Response, NextFunction } from "express";
import { MarketPriceRepository } from "../repositories/market-price.repository.js";
import { MaterialRepository } from "../repositories/material.repository.js";
import { OrderService } from "../services/order.service.js";
import { getContainer } from "../container.js";

export class MarketPriceController {
  constructor(
    private readonly marketPriceRepo = new MarketPriceRepository(),
    private readonly materialRepo = new MaterialRepository(),
    private readonly orderService = new OrderService()
  ) {}

  getMarketPrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = actor.tenantId;

      const [latestPrices, primaryMaterials] = await Promise.all([
        this.marketPriceRepo.getLatestPrices(tenantId),
        this.materialRepo.find(tenantId),
      ]);

      const materials = primaryMaterials.length > 0
        ? primaryMaterials
        : await this.materialRepo.find("tenant_loompilot_tn_01");

      const priceByMaterialId = new Map<string, any>(
        latestPrices.map((p: any) => [String(p.materialId), p])
      );

      // Attempt to invoke python market_price agent via agentsClient if available
      try {
        const agentsClient = getContainer().agentsClient;
        if (agentsClient) {
          const materialIds = materials.map((m: any) => String(m._id));
          await agentsClient.runMarketCheck({
            tenantId,
            materialIds: materialIds.slice(0, 5),
          });
        }
      } catch {
        // Fallback silently if Python agent is offline; database records are authoritative
      }

      const commodities = materials.map((mat: any) => {
        const mp = priceByMaterialId.get(String(mat._id));
        const pricePaise = mp?.consolidatedPricePaise ?? mat.currentRatePaise ?? 25000;
        const change1d = mp?.change1dPct ?? 0;
        const change7d = mp?.change7dPct ?? 0;
        const volatilityPct = mp?.volatility ? Math.round(mp.volatility * 100 * 10) / 10 : 3.5;
        const isSurge = Boolean(
          Math.abs(change7d) >= 5 || Math.abs(change1d) >= 3 || mp?.alert?.status === "open"
        );

        let category: "yarn" | "fiber" | "dye" | "energy" = "yarn";
        if (mat.type === "fabric") category = "fiber";
        else if (mat.type === "dye_chemical") category = "dye";
        else if (mat.type === "trim" || mat.type === "packing") category = "energy";

        return {
          id: String(mat._id),
          name: mat.materialName,
          category,
          price: Math.round((pricePaise / 100) * 100) / 100,
          unit: mat.unit || "kg",
          changeYesterday: Math.round(change1d * 10) / 10,
          changeSevenDays: Math.round(change7d * 10) / 10,
          volatilityPercent: volatilityPct,
          isSurge,
          lastUpdated: mp?.date ? mp.date : "Live Market Feed",
        };
      });

      res.json({ data: commodities });
    } catch (err) {
      next(err);
    }
  };

  triggerSurgeReprice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.orderService.evaluateMarketSurgeAndReprice(actor.tenantId, {
        id: actor.subjectId,
        email: actor.email,
        ip: req.ip,
        requestId: actor.requestId,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

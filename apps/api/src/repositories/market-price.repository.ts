import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  IMarketPrice,
  IMarketPriceObservation,
  MarketPriceModel,
} from "../models/catalog/market-price.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class MarketPriceRepository extends BaseRepository<IMarketPrice> {
  constructor() {
    super(MarketPriceModel);
  }

  async appendObservation(
    tenantId: string,
    materialId: string,
    date: string,
    observation: IMarketPriceObservation,
    tx?: TxContext
  ): Promise<IMarketPrice> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, materialId: new Types.ObjectId(materialId), date },
        {
          $setOnInsert: {
            tenantId,
            materialId: new Types.ObjectId(materialId),
            date,
            consolidatedPricePaise: observation.unitPricePaise,
          },
          $push: { observations: observation },
          $inc: { version: 1 },
        },
        { upsert: true, new: true, session: session ?? null }
      )
      .lean<IMarketPrice>()
      .exec();
  }
}


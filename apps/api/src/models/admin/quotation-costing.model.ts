import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IMaterialCost {
  materialId: Types.ObjectId;
  qty: number;
  ratePaise: number;
  paise: number;
}

export interface IProcessingCost {
  stage: string;
  costing: "stitch" | "dye" | "other" | string;
  paise: number;
}

export interface ICostingRevision {
  revisionId: Types.ObjectId;
  costDrivers: any;
  deltaPaise: number;
}

export interface IQuotationCosting extends BaseEntity {
  quotationId: Types.ObjectId;
  materialCosts: IMaterialCost[];
  processingCosts: IProcessingCost[];
  wastagePaise: number;
  riskBufferPaise: number;
  overheadPaise: number;
  totalCostPaise: number;
  marginPct: number;
  marginPaise: number;
  formulaVersion: string;
  revisions: ICostingRevision[];
  agentRunId?: Types.ObjectId;
}

const QuotationCostingSchema = new Schema<IQuotationCosting>(
  {
    tenantId: { type: String, required: true, index: true },
    quotationId: { type: Schema.Types.ObjectId, required: true, ref: "Quotation" },
    materialCosts: [
      {
        _id: false,
        materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
        qty: { type: Number, required: true },
        ratePaise: paiseField({ required: true }),
        paise: paiseField({ required: true }),
      },
    ],
    processingCosts: [
      {
        _id: false,
        stage: { type: String, required: true },
        costing: { type: String, required: true },
        paise: paiseField({ required: true }),
      },
    ],
    wastagePaise: paiseField({ default: 0 }),
    riskBufferPaise: paiseField({ default: 0 }),
    overheadPaise: paiseField({ default: 0 }),
    totalCostPaise: paiseField({ required: true }),
    marginPct: { type: Number, required: true },
    marginPaise: paiseField({ required: true }),
    formulaVersion: { type: String, default: "v3" },
    revisions: [
      {
        _id: false,
        revisionId: { type: Schema.Types.ObjectId, required: true, ref: "QuotationRevision" },
        costDrivers: { type: Schema.Types.Mixed },
        deltaPaise: paiseField({ required: true, allowSigned: true }),
      },
    ],
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

QuotationCostingSchema.index({ tenantId: 1, quotationId: 1 }, { unique: true });

export const QuotationCostingModel =
  mongoose.models.QuotationCosting ||
  mongoose.model<IQuotationCosting>("QuotationCosting", QuotationCostingSchema);

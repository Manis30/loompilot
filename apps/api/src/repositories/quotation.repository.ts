import {
  IQuotationRepository,
  Quotation,
  NewQuotation,
  QuotationLineItem,
} from "../interfaces/quotation.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { QuotationModel } from "../models/quotation.model.js";
import { getNextDocumentNumber } from "../models/counter.model.js";

export class MongoQuotationRepository implements IQuotationRepository {
  private toEntity(doc: any): Quotation {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      enquiryId: doc.enquiryId.toString(),
      customerId: doc.customerId.toString(),
      quotationNumber: doc.quotationNumber,
      lineItems: (doc.lineItems || []).map((li: any): QuotationLineItem => ({
        materialId: li.materialId.toString(),
        materialName: li.materialName,
        requiredQty: li.requiredQty,
        unit: li.unit,
        onHandQty: li.onHandQty,
        reservedQty: li.reservedQty,
        toPurchaseQty: li.toPurchaseQty,
        unitCostPaise: li.unitCostPaise,
        totalCostPaise: li.totalCostPaise,
        supplierLeadDays: li.supplierLeadDays,
      })),
      materialCostPaise: doc.materialCostPaise,
      processingCostPaise: doc.processingCostPaise,
      overheadCostPaise: doc.overheadCostPaise,
      wastagePct: doc.wastagePct,
      wastageCostPaise: doc.wastageCostPaise,
      riskBufferPct: doc.riskBufferPct,
      riskBufferCostPaise: doc.riskBufferCostPaise,
      subtotalCostPaise: doc.subtotalCostPaise,
      marginPct: doc.marginPct,
      profitPaise: doc.profitPaise,
      finalPricePaise: doc.finalPricePaise,
      etaDate: doc.etaDate,
      validUntil: doc.validUntil,
      status: doc.status,
      explanation: doc.explanation,
      assumptions: doc.assumptions || [],
      inputsSnapshot: doc.inputsSnapshot || {},
      generationError: doc.generationError,
      approvedBy: doc.approvedBy?.toString(),
      approvedAt: doc.approvedAt,
      sentAt: doc.sentAt,
      version: doc.version || 1,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewQuotation, tx?: TxContext): Promise<Quotation> {
    const quotationNumber =
      data.quotationNumber ||
      (await getNextDocumentNumber(data.tenantId, "quotation", "QT", 5, tx?.session));

    const docs = await QuotationModel.create(
      [
        {
          ...data,
          quotationNumber,
        },
      ],
      { session: tx?.session || null }
    );
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<Quotation | null> {
    const doc = await QuotationModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByQuotationNumber(
    tenantId: string,
    quotationNumber: string,
    tx?: TxContext
  ): Promise<Quotation | null> {
    const doc = await QuotationModel.findOne({ tenantId, quotationNumber })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Quotation>,
    tx?: TxContext
  ): Promise<Quotation | null> {
    const doc = await QuotationModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Quotation>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      QuotationModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuotationModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }

  async count(tenantId: string, tx?: TxContext): Promise<number> {
    return QuotationModel.countDocuments({ tenantId }).session(tx?.session || null);
  }
}


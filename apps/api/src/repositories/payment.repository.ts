import mongoose from "mongoose";
import {
  IPaymentRepository,
  Payment,
  NewPayment,
  PaymentReminderDraft,
  NewReminderDraft,
} from "../interfaces/payment.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { PaymentModel } from "../models/payment.model.js";

export class MongoPaymentRepository implements IPaymentRepository {
  private toEntity(doc: any): Payment {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      deliveryId: doc.deliveryId.toString(),
      orderId: doc.orderId.toString(),
      customerId: doc.customerId.toString(),
      invoiceNumber: doc.invoiceNumber,
      totalInvoicePaise: doc.totalInvoicePaise,
      amountReceivedPaise: doc.amountReceivedPaise,
      balancePaise: doc.balancePaise,
      dueDate: doc.dueDate,
      status: doc.status,
      paymentTerms: doc.paymentTerms,
      reminders: (doc.reminders || []).map((r: any): PaymentReminderDraft => ({
        id: r._id ? r._id.toString() : r.id,
        reminderNumber: r.reminderNumber,
        channel: r.channel,
        recipient: r.recipient,
        subject: r.subject,
        messageBody: r.messageBody,
        scheduledDate: r.scheduledDate,
        status: r.status,
        approvedBy: r.approvedBy?.toString(),
        approvedAt: r.approvedAt,
        sentAt: r.sentAt,
        failureReason: r.failureReason,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewPayment, tx?: TxContext): Promise<Payment> {
    const docs = await PaymentModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<Payment | null> {
    const doc = await PaymentModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByInvoiceNumber(
    tenantId: string,
    invoiceNumber: string,
    tx?: TxContext
  ): Promise<Payment | null> {
    const doc = await PaymentModel.findOne({ tenantId, invoiceNumber })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async addReminderDraft(
    tenantId: string,
    paymentId: string,
    draft: NewReminderDraft,
    tx?: TxContext
  ): Promise<Payment | null> {
    const doc = await PaymentModel.findOneAndUpdate(
      { _id: paymentId, tenantId },
      { $push: { reminders: draft } },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async updateReminder(
    tenantId: string,
    paymentId: string,
    reminderId: string,
    update: Partial<PaymentReminderDraft>,
    tx?: TxContext
  ): Promise<Payment | null> {
    const setFields: Record<string, any> = {};
    if (update.status) setFields["reminders.$.status"] = update.status;
    if (update.approvedBy) setFields["reminders.$.approvedBy"] = new mongoose.Types.ObjectId(update.approvedBy);
    if (update.approvedAt) setFields["reminders.$.approvedAt"] = update.approvedAt;
    if (update.sentAt) setFields["reminders.$.sentAt"] = update.sentAt;
    if (update.failureReason) setFields["reminders.$.failureReason"] = update.failureReason;

    const doc = await PaymentModel.findOneAndUpdate(
      { _id: paymentId, tenantId, "reminders._id": reminderId },
      { $set: setFields },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Payment>,
    tx?: TxContext
  ): Promise<Payment | null> {
    const doc = await PaymentModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Payment>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      PaymentModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }

  async count(tenantId: string, tx?: TxContext): Promise<number> {
    return PaymentModel.countDocuments({ tenantId }).session(tx?.session || null);
  }
}


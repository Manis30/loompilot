import mongoose from "mongoose";
import { PaymentModel, IPayment, IPaymentReminderDraft } from "./model.js";
import { ReminderStatus, PaymentStatus } from "@loompilot/shared";

export class PaymentService {
  static async list(tenantId: string): Promise<IPayment[]> {
    return PaymentModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async getById(tenantId: string, id: string): Promise<IPayment | null> {
    return PaymentModel.findOne({ _id: id, tenantId });
  }

  static async createFollowup(data: Partial<IPayment> & { tenantId: string }): Promise<IPayment> {
    const balancePaise = data.balancePaise ?? (data.totalInvoicePaise ?? 0) - (data.amountReceivedPaise ?? 0);
    return PaymentModel.create({
      ...data,
      balancePaise,
    });
  }

  static async addReminderDraft(
    tenantId: string,
    paymentId: string,
    draft: Omit<IPaymentReminderDraft, "_id">
  ): Promise<IPayment | null> {
    const payment = await PaymentModel.findOne({ _id: paymentId, tenantId });
    if (!payment) throw new Error("Payment record not found");

    payment.reminders.push(draft as any);
    await payment.save();
    return payment;
  }

  static async approveReminder(
    tenantId: string,
    paymentId: string,
    reminderId: string,
    userId: string,
    action: "approve" | "reject",
    rejectionReason?: string
  ): Promise<IPayment> {
    const payment = await PaymentModel.findOne({ _id: paymentId, tenantId });
    if (!payment) throw new Error("Payment record not found");

    const reminder = payment.reminders.find((r: any) => r._id?.toString() === reminderId);
    if (!reminder) throw new Error("Reminder draft not found");

    if (action === "approve") {
      reminder.status = ReminderStatus.APPROVED;
      reminder.approvedBy = new mongoose.Types.ObjectId(userId);
      reminder.approvedAt = new Date();
    } else {
      reminder.status = ReminderStatus.CANCELLED;
      reminder.failureReason = rejectionReason || "Rejected by accounts";
    }

    await payment.save();
    return payment;
  }

  static async recordReceipt(
    tenantId: string,
    paymentId: string,
    amountPaise: number
  ): Promise<IPayment> {
    const payment = await PaymentModel.findOne({ _id: paymentId, tenantId });
    if (!payment) throw new Error("Payment record not found");

    payment.amountReceivedPaise += amountPaise;
    payment.balancePaise = Math.max(0, payment.totalInvoicePaise - payment.amountReceivedPaise);

    if (payment.balancePaise === 0) {
      payment.status = PaymentStatus.RECEIVED;
    } else {
      payment.status = PaymentStatus.PARTIAL;
    }

    await payment.save();
    return payment;
  }
}


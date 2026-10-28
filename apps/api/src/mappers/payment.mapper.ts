import { Payment, PaymentReminderDraft } from "../interfaces/payment.repository.js";

export function toReminderDraftResponse(reminder: PaymentReminderDraft) {
  return {
    id: reminder.id,
    _id: reminder.id,
    reminderNumber: reminder.reminderNumber,
    channel: reminder.channel,
    recipient: reminder.recipient,
    subject: reminder.subject,
    messageBody: reminder.messageBody,
    scheduledDate: reminder.scheduledDate,
    status: reminder.status,
    approvedBy: reminder.approvedBy,
    approvedAt: reminder.approvedAt,
    sentAt: reminder.sentAt,
    failureReason: reminder.failureReason,
  };
}

export function toPaymentResponse(payment: Payment) {
  return {
    id: payment.id,
    _id: payment.id,
    tenantId: payment.tenantId,
    deliveryId: payment.deliveryId,
    orderId: payment.orderId,
    customerId: payment.customerId,
    invoiceNumber: payment.invoiceNumber,
    totalInvoicePaise: payment.totalInvoicePaise,
    amountReceivedPaise: payment.amountReceivedPaise,
    balancePaise: payment.balancePaise,
    dueDate: payment.dueDate,
    status: payment.status,
    paymentTerms: payment.paymentTerms,
    reminders: payment.reminders.map(toReminderDraftResponse),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}


export enum UserRole {
  ADMIN = "admin",
  SUPERVISOR = "supervisor",
}

export enum Realm {
  USER = "user",
  CLIENT = "client",
}

export enum QuotationStatus {
  GENERATING = "generating",
  GENERATION_FAILED = "generation_failed",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  SENT = "sent",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  REJECTED = "rejected",
  EXPIRED = "expired",
  SUPERSEDED = "superseded",
}

export enum OrderStatus {
  SUBMITTED = "submitted",
  ANALYZING = "analyzing",
  ANALYSIS_FAILED = "analysis_failed",
  AWAITING_ADMIN_DECISION = "awaiting_admin_decision",
  QUOTATION_DRAFTING = "quotation_drafting",
  QUOTATION_PENDING_APPROVAL = "quotation_pending_approval",
  QUOTATION_SENT = "quotation_sent",
  CLIENT_ACCEPTED = "client_accepted",
  ASSIGNED = "assigned",
  IN_PRODUCTION = "in_production",
  READY_FOR_DELIVERY = "ready_for_delivery",
  PARTIALLY_DELIVERED = "partially_delivered",
  DELIVERED = "delivered",
  COMPLETED = "completed",
  DECLINED_BY_CLIENT = "declined_by_client",
  REJECTED_BY_ADMIN = "rejected_by_admin",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
  ON_HOLD = "on_hold",
}

export type ClientOrderStatus =
  | "received"
  | "under_review"
  | "quotation_ready"
  | "confirmed"
  | "in_production"
  | "ready"
  | "delivered"
  | "closed"
  | "declined";

/**
 * Maps the internal 19-state OrderStatus machine to the 9 client-facing statuses.
 */
export function toClientOrderStatus(status: OrderStatus | string): ClientOrderStatus {
  switch (status) {
    case OrderStatus.SUBMITTED:
    case "submitted":
      return "received";

    case OrderStatus.ANALYZING:
    case "analyzing":
    case OrderStatus.ANALYSIS_FAILED:
    case "analysis_failed":
    case OrderStatus.AWAITING_ADMIN_DECISION:
    case "awaiting_admin_decision":
    case OrderStatus.QUOTATION_DRAFTING:
    case "quotation_drafting":
    case OrderStatus.QUOTATION_PENDING_APPROVAL:
    case "quotation_pending_approval":
      return "under_review";

    case OrderStatus.QUOTATION_SENT:
    case "quotation_sent":
      return "quotation_ready";

    case OrderStatus.CLIENT_ACCEPTED:
    case "client_accepted":
    case OrderStatus.ASSIGNED:
    case "assigned":
      return "confirmed";

    case OrderStatus.IN_PRODUCTION:
    case "in_production":
    case OrderStatus.ON_HOLD:
    case "on_hold":
      return "in_production";

    case OrderStatus.READY_FOR_DELIVERY:
    case "ready_for_delivery":
    case OrderStatus.PARTIALLY_DELIVERED:
    case "partially_delivered":
      return "ready";

    case OrderStatus.DELIVERED:
    case "delivered":
      return "delivered";

    case OrderStatus.COMPLETED:
    case "completed":
      return "closed";

    case OrderStatus.DECLINED_BY_CLIENT:
    case "declined_by_client":
    case OrderStatus.REJECTED_BY_ADMIN:
    case "rejected_by_admin":
    case OrderStatus.EXPIRED:
    case "expired":
    case OrderStatus.CANCELLED:
    case "cancelled":
      return "declined";

    default:
      throw new Error(`Unknown or unmapped order status: ${status}`);
  }
}


export enum ProcessName {
  SPINNING = "spinning",
  WEAVING = "weaving",
  DYEING = "dyeing",
  FINISHING = "finishing",
  PACKING = "packing",
}

export enum MaterialType {
  YARN = "yarn",
  GREY_FABRIC = "grey_fabric",
  DYES = "dyes",
  CHEMICALS = "chemicals",
  PACKAGING = "packaging",
  ACCESSORIES = "accessories",
}

export enum StockMovementType {
  RECEIPT = "receipt",
  CONSUME = "consume",
  RESERVE = "reserve",
  RELEASE = "release",
  ADJUST = "adjust",
  OPENING = "opening",
}

export enum AlertType {
  DELAY_WARNING = "delay_warning",
  MATERIAL_SHORTAGE = "material_shortage",
  WORKER_DEFICIT = "worker_deficit",
  QUALITY_DEFECT = "quality_defect",
}

export enum AlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum RecommendationStatus {
  PROPOSED = "proposed",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export enum DeliveryStatus {
  SCHEDULED = "scheduled",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  PARTIALLY_DELIVERED = "partially_delivered",
}

export enum PaymentStatus {
  PENDING = "pending",
  PARTIAL = "partial",
  RECEIVED = "received",
  OVERDUE = "overdue",
}

export enum ReminderStatus {
  DRAFT = "draft",
  APPROVED = "approved",
  SENT = "sent",
  CANCELLED = "cancelled",
}

export enum NotificationChannel {
  WHATSAPP = "whatsapp",
  SMS = "sms",
  EMAIL = "email",
}


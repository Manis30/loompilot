export enum UserRole {
  OWNER = "owner",
  MANAGER = "manager",
  SALES = "sales",
  STORE = "store",
  ACCOUNTS = "accounts",
}

export enum QuotationStatus {
  DRAFT = "draft",
  GENERATION_FAILED = "generation_failed",
  APPROVED = "approved",
  SENT = "sent",
  WON = "won",
  LOST = "lost",
  CONFIRMED = "confirmed",
}

export enum OrderStatus {
  PLANNED = "planned",
  IN_PROGRESS = "in_progress",
  DELAYED = "delayed",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
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
  ISSUE = "issue",
  RESERVATION = "reservation",
  RELEASE = "release",
  ADJUSTMENT = "adjustment",
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

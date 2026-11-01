/**
 * LoomPilot — TypeScript Domain Models & Interfaces
 */

export type OrderStatus = 'Awaiting Quotation' | 'In Production' | 'Delivered' | 'Cancelled' | 'Quote Accepted';

export type StageStatus = 'completed' | 'active' | 'upcoming' | 'delayed';

export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue';

export interface ClientProfile {
  id: string;
  company: string;
  brand: string;
  clientCode: string;
  gstin: string;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingPlant: string;
  accountTier: string;
  creditLimit: string;
  availableCredit: string;
  relationshipManager: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  categoryCode: 'cotton' | 'woven' | 'blended' | 'knitted' | 'poly' | 'custom';
  gsm: number;
  yarnCount: string;
  weave: string;
  construction: string;
  widthInches: number;
  widthCm: number;
  moq: number;
  leadTimeWeeks: string;
  basePriceRange: string;
  image: string;
  description: string;
  features: string[];
  colors: string[];
}

export interface ProductionStage {
  step: number;
  key?: string;
  name: string;
  status: StageStatus;
  date: string;
  notes: string;
  desc?: string;
}

export interface DailyProductionLog {
  day: string;
  metres: number;
  target: number;
  looms?: number;
  efficiency?: string;
}

export interface OrderMilestone {
  id: string;
  phase: string;
  amount: number;
  status: 'paid' | 'pending' | 'upcoming';
  invoiceId: string;
  paidDate?: string;
  dueDate?: string;
}

export interface FabricSpecs {
  gsm: number;
  width: string;
  yarnCount: string;
  weave: string;
  finish: string;
  packaging: string;
}

export interface Order {
  id: string;
  backendId?: string;
  productId: string;
  productName: string;
  category: string;
  colorway: string;
  orderedMetres: number;
  producedMetres: number;
  remainingMetres: number;
  progressPercent: number;
  unitPrice: number;
  originalUnitPrice?: number;
  totalValue: number;
  originalTotalValue?: number;
  orderDate: string;
  expectedDelivery: string;
  currentStageNumber: number;
  currentStageName: string;
  status: OrderStatus;
  spotlight?: boolean;
  specifications: FabricSpecs;
  deliveryAddress: string;
  stages: ProductionStage[];
  dailyProduction?: DailyProductionLog[];
  milestones: OrderMilestone[];
}

export interface Invoice {
  invoiceNumber: string;
  orderId: string;
  backendOrderId?: string;
  milestoneIndex?: number;
  productName: string;
  milestonePhase: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  paidDate?: string;
  pdfUrl?: string;
}

export interface PaymentTransaction {
  paymentId: string;
  invoiceNumber: string;
  orderId: string;
  paymentDate: string;
  amount: number;
  method: string;
  transactionRef: string;
  status: 'Success' | 'Failed' | 'Processing';
  downloadReceipt?: string;
}

export interface QuoteRevisionData {
  originalRate: string;
  newRate: string;
  savings: string;
  newTotal: string;
  status: string;
  actionRequired?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'admin';
  senderName: string;
  avatar: 'user' | 'ai' | 'admin';
  time: string;
  text: string;
  type?: 'system_quote' | 'quote_revision' | 'text';
  badge?: string;
  revisedData?: QuoteRevisionData;
  data?: {
    rate: string;
    total: string;
    leadTime: string;
    validity: string;
  };
}

export interface ChatThread {
  orderId: string;
  productName: string;
  orderQuantity: string;
  quotedPrice: string;
  totalQuote: string;
  validity: string;
  deliveryDate: string;
  status: string;
  unread: boolean;
  messages: ChatMessage[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  category: 'quotation' | 'production' | 'payment' | 'order';
  read: boolean;
  targetRoute: string;
  orderId?: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  desc: string;
  time: string;
  badge: string;
  badgeClass: string;
}

export interface DashboardMetrics {
  activeOrders: number;
  totalOrders: number;
  productionInProgressMetres: number;
  pendingPaymentsAmount: number;
}


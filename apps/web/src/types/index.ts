/**
 * LoomPilot Admin Portal - Data Types & Models
 * Conforming to LoomPilot Workflow & Architecture Specifications
 */

export type OrderLifecycleStatus =
  | 'submitted'
  | 'analyzing'
  | 'awaiting_admin_decision'
  | 'quotation_drafting'
  | 'quotation_pending_approval'
  | 'quotation_sent'
  | 'client_accepted'
  | 'assigned'
  | 'in_production'
  | 'ready_for_delivery'
  | 'partially_delivered'
  | 'delivered'
  | 'completed'
  | 'declined_by_client'
  | 'rejected_by_admin'
  | 'on_hold'
  | 'cancelled';

export type FeasibilityVerdict = 'feasible' | 'at_risk' | 'not_feasible';

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface RecoveryOption {
  type: 'buy_materials' | 'propose_alternative' | 'overtime' | 'partial_shipment';
  title: string;
  description: string;
  supplier?: string;
  leadTimeDays?: number;
  estimatedCost?: number;
  newEta?: string;
}

export interface FeasibilityReport {
  id: string;
  orderId: string;
  verdict: FeasibilityVerdict;
  eta: string;
  bottleneckProcess: string;
  riskFactors: RiskFactor[];
  recoveryOptions: RecoveryOption[];
  llmSummary: string;
  createdAt: string;
}

export interface BillOfMaterialsItem {
  name: string;
  quantity: string;
  rate: number;
  total: number;
}

export interface Quotation {
  id: string;
  orderId: string;
  version: number;
  materialCost: number;
  wastagePercent: number;
  processingCost: number;
  overheadCost: number;
  priceRiskBuffer: number;
  marginPercent: number;
  pricePerUnit: number;
  totalPrice: number;
  validUntil: string;
  etaBasis: string;
  adminApproved: boolean;
  status: 'drafting' | 'pending_approval' | 'approved' | 'sent' | 'accepted' | 'declined' | 'rejected';
  rejectionReason?: string;
  bomItems: BillOfMaterialsItem[];
  explanation: string;
}

export interface PriceRevision {
  id: string;
  orderId: string;
  quotationId: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  costDrivers: string[];
  clientFriendlyReason: string;
  adminApproved: boolean;
  status: 'proposed' | 'approved' | 'sent' | 'accepted' | 'declined' | 'rejected_by_admin';
  createdAt: string;
}

export interface MarketCommodity {
  id: string;
  name: string;
  category: 'yarn' | 'fiber' | 'dye' | 'energy';
  price: number;
  unit: string;
  changeYesterday: number;
  changeSevenDays: number;
  volatilityPercent: number;
  isSurge: boolean;
  lastUpdated: string;
}

export interface SupervisorDailyReport {
  id: string;
  date: string;
  supervisorId: string;
  supervisorName: string;
  shift: string;
  workersPresent: number;
  workersAbsent: number;
  machinesAvailable: number;
  machinesBreakdown: number;
  metersProduced: number;
  scrapMeters: number;
  issuesRaised?: string;
  status: 'submitted' | 'verified' | 'flagged';
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'assistant' | 'admin';
  senderName: string;
  timestamp: string;
  content: string;
  isInternalContext?: boolean;
}

export interface DiscountEscalation {
  id: string;
  orderId: string;
  clientName: string;
  requestedDiscountPercent: number;
  requestedPrice: number;
  currentPrice: number;
  currentMarginPercent: number;
  status: 'open' | 'in_progress' | 'resolved' | 'declined';
  clientMessage: string;
  createdAt: string;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  date: string;
  quantityMeters: number;
  invoiceNumber: string;
  carrier: string;
  deliveryType: 'partial' | 'full';
  status: 'dispatched' | 'delivered';
  invoiceAmount?: number;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  invoiceNumber: string;
  amount: number;
  date: string;
  type: 'advance_30' | 'mid_progress_40' | 'final_balance_30' | string;
  status: 'pending' | 'received' | 'overdue' | 'partial';
  milestoneIndex?: number;
  milestoneName?: string;
  dueAmount?: number;
  receivedAmount?: number;
  ref?: string;
  method?: string;
}

export interface ProductionTimelineStage {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'pending';
  dateOrDetails: string;
  notes?: string;
}

export interface OrderItemProduct {
  id: string;
  name: string;
  designCode: string;
  category: string;
  quantityPieces: number;
  progressPercent: number;
  imageUrl?: string;
  riskStatus?: 'on_track' | 'at_risk' | 'delayed';
  riskReason?: string;
  timeline: ProductionTimelineStage[];
}

export interface Order {
  id: string;
  backendId?: string;
  clientName: string;
  clientEmail: string;
  productName: string;
  category: string;
  specs: {
    yarnCount: string;
    gsm: number;
    width: string;
    weave: string;
    finishing: string;
  };
  quantityMeters: number;
  producedMeters: number;
  submittedDate: string;
  deadlineDate: string;
  currentPhase: string;
  status: OrderLifecycleStatus;
  riskStatus?: 'on_track' | 'at_risk' | 'early_production' | 'just_started';
  riskReason?: string;
  items?: OrderItemProduct[];
  feasibility?: FeasibilityReport;
  quotation?: Quotation;
  priceRevision?: PriceRevision;
  assignedSupervisorId?: string;
  assignedSupervisorName?: string;
  handoverDate?: string;
  productionPlanConfirmed?: boolean;
  deliveredMeters?: number;
  financials?: {
    totalAmountPaise?: number;
    totalPaidPaise?: number;
    amountDuePaise?: number;
    advanceReceivedPaise?: number;
    milestones?: Array<{
      milestone: string;
      trigger: string;
      stage?: string;
      amountPaise: number;
      dueDate?: string;
      status: string;
      receivedPaise?: number;
      duePaise?: number;
      invoiceNo?: string;
    }>;
  };
  deliveries: DeliveryRecord[];
  payments: PaymentRecord[];
  dailyReports: SupervisorDailyReport[];
  discountEscalation?: DiscountEscalation;
}

export type UserRole = 'admin' | 'supervisor' | 'client';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  departmentOrCompany: string;
  status: 'active' | 'invited' | 'suspended';
  invitedAt?: string;
  joinedAt?: string;
  avatar?: string;
}

export interface UserInvite {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentOrCompany: string;
  inviteToken: string;
  inviteLink: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  title: string;
  unit: string;
  avatar: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  orderId?: string;
  details: string;
}

export interface AgentRun {
  id: string;
  agentName: 'Feasibility Agent' | 'Quotation Agent' | 'Market Price Agent' | 'Client Assistant' | 'Monitoring Agent';
  status: 'SUCCESS' | 'RUNNING' | 'ALERT';
  durationMs: number;
  orderId?: string;
  summary: string;
  timestamp: string;
}

export interface MaterialRequirement {
  id: string;
  materialName: string;
  category: 'fiber' | 'yarn' | 'dye' | 'trims';
  requiredQuantity: number;
  availableQuantity: number;
  unit: string;
  shortageQuantity: number;
  affectedOrderId: string;
  affectedProductName: string;
  supplierName: string;
  supplierPrice: number;
  moq: number;
  leadTimeDays: number;
  expectedArrival: string;
  status: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
}

export type AdminNavTab =
  | 'dashboard'
  | 'orders'
  | 'quotations'
  | 'procurement'
  | 'production'
  | 'supervisors'
  | 'priceCentre'
  | 'chat'
  | 'deliveries'
  | 'aiAgents'
  | 'users'
  | 'audit';




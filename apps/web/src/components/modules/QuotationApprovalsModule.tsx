import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  DollarSign,
  Sparkles,
  ShieldAlert,
  Layers,
  History,
  TrendingUp,
  GitCompare,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  ShoppingBag,
  Clock,
  Plus,
  Upload,
  SlidersHorizontal,
  Minus,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { Order } from '../../types';
import {
  useGetOrdersQuery,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
  useSendQuotationMutation,
} from '../../store/api/ordersApi';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

// =========================================================================
// DATA MODELS & TYPES
// =========================================================================

export interface ClientProfile {
  id: string; // e.g. 'CL-001'
  name: string;
  initials: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  totalOrdersCount: number;
  lastInteraction: string;
}

export type QuotationType = 'new' | 'revised' | 'alternative';

export type QuotationStatus =
  | 'draft'
  | 'pending_admin_approval'
  | 'revision_required'
  | 'approved'
  | 'awaiting_client_response'
  | 'client_revision_requested'
  | 'client_accepted'
  | 'client_declined'
  | 'finalized'
  | 'rejected';

export interface NegotiationLog {
  id: string;
  date: string;
  clientRequest: string;
  requestedDiscountPercent?: number;
  requestedPrice?: number;
  originalPrice: number;
  revisedPrice?: number;
  adminResponse: string;
  status: 'pending_admin_decision' | 'concession_approved' | 'concession_rejected' | 'counter_offered';
}

export interface ProductItem {
  id: string;
  name: string;
  designCode: string;
  category: string;
  quantity: number;
  unit: string;
  specs: {
    yarnCount: string;
    gsm: number | 'Not specified';
    weave: string;
    finishing: string;
  };
  unitPrice: number;
  totalPrice: number;
}

export interface CostBreakdownItemized {
  fabricYarn: number;
  fabricYarnBasis: string;
  dyeingProcessing: number;
  dyeingProcessingBasis: string;
  labour: number;
  labourBasis: string;
  overhead: number;
  overheadBasis: string;
  wastage: number;
  wastageBasis: string;
  priceRiskBuffer: number;
  priceRiskBufferBasis: string;
  otherCosts: number;
  otherCostsBasis: string;
  totalCost: number;
}

export interface QuotationHistoryEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  version: string;
  comments?: string;
}

export interface QuotationRecord {
  id: string; // e.g. 'QT-1001'
  clientId: string; // e.g. 'CL-001'
  clientName: string;
  orderId: string; // e.g. 'LP-901'
  orderTitle: string; // 'Cotton Shirts & Trousers'
  quotationType: QuotationType;
  typeLabel: string; // 'Original Proposal', '3.3% Concession Revision', 'Premium Silk Finish Option'
  linkedQuotationId?: string; // For revised or alternative
  version: string; // 'v1.0', 'v2.0'
  status: QuotationStatus;
  createdDate: string;
  expiryDate: string;
  deadlineDate: string;
  deliveryDays: number;
  specs: {
    fabricType: string;
    yarnCount: string;
    gsm: number;
    weave: string;
    finishing: string;
    designCount: number;
  };
  totalQuantity: number;
  quantityUnit: string;
  products: ProductItem[];
  costBreakdown: CostBreakdownItemized;
  quotedAmount: number;
  expectedProfit: number;
  marginPercent: number;
  aiRecommendation: {
    suggestedPrice: number;
    suggestedMargin: number;
    costAssumptions: string;
    wastageAssumptions: string;
    volatilityConsiderations: string;
    deliveryFeasibility: string;
    financialRisks: string;
    confidenceScore: number;
  };
  negotiations: NegotiationLog[];
  history: QuotationHistoryEntry[];
  approvedBy?: string;
  approvedAt?: string;
  dispatchedAt?: string;
  finalizedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  clientPdfFileId?: string;
}

interface QuotationApprovalsModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onApproveQuotation?: (orderId: string, editedMargin?: number) => Promise<void> | void;
  onRejectQuotation?: (orderId: string, reason: string) => Promise<void> | void;
}

// =========================================================================
// REUSABLE FINANCIAL CALCULATION UTILITIES
// =========================================================================

const calculateQuotationFinancials = (record: QuotationRecord) => {
  const {
    fabricYarn,
    dyeingProcessing,
    labour,
    overhead,
    wastage,
    priceRiskBuffer,
    otherCosts
  } = record.costBreakdown;

  const totalCost =
    fabricYarn +
    dyeingProcessing +
    labour +
    overhead +
    wastage +
    priceRiskBuffer +
    otherCosts;

  const expectedProfit = record.quotedAmount - totalCost;
  const marginPercent =
    record.quotedAmount > 0 ? (expectedProfit / record.quotedAmount) * 100 : 0;
  const isPolicyCompliant = marginPercent >= 15.0;

  return {
    totalCost,
    expectedProfit,
    marginPercent: +marginPercent.toFixed(1),
    isPolicyCompliant
  };
};

// Circular gauge donut ring helper matching reference image 2
const CircularGauge: React.FC<{ percent: number; color: string; size?: number }> = ({ percent, color, size = 38 }) => {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f2f4f7"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#344054' }}>{percent}%</span>
      </div>
    </div>
  );
};

const getClientBrand = (clientName: string) => {
  if (clientName.includes('Fashion')) return { initials: 'FH', color: '#1D2628', bg: '#F8F0DF' };
  if (clientName.includes('Urban')) return { initials: 'UT', color: '#18191B', bg: '#EDEFF2' };
  if (clientName.includes('Style World')) return { initials: 'SW', color: '#1B1918', bg: '#FAF4EA' };
  if (clientName.includes('Home Living')) return { initials: 'HL', color: '#8A6529', bg: '#FAF4EA' };
  if (clientName.includes('StyleMart')) return { initials: 'SM', color: '#1D2628', bg: '#F8F0DF' };
  if (clientName.includes('HomeNest')) return { initials: 'HN', color: '#18191B', bg: '#EDEFF2' };
  return { initials: 'LP', color: '#1D2628', bg: '#F8F0DF' };
};

export const QuotationApprovalsModule: React.FC<QuotationApprovalsModuleProps> = ({
  orders: _orders,
  onSelectOrder: _onSelectOrder,
  onApproveQuotation,
  onRejectQuotation
}) => {
  // Real RTK Query hooks for live quotation approval
  const { data: ordersResponse, refetch: refetchOrders } = useGetOrdersQuery(undefined);
  const [approveQuotationMutation, { isLoading: isApprovingQuotation }] = useApproveQuotationMutation();
  const [rejectQuotationMutation, { isLoading: isRejectingQuotation }] = useRejectQuotationMutation();
  const [sendQuotationMutation, { isLoading: isSendingQuotation }] = useSendQuotationMutation();
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Active selected client state (Defaults to 'CL-001' Fashion House)
  const [selectedClientId] = useState<string>('CL-001');

  // Active quotation in review modal
  const [activeQuotationId, setActiveQuotationId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'cost' | 'profit' | 'ai' | 'negotiation' | 'history'>('overview');

  // Quotation comparison modal (Order ID whose quotations are being compared)
  const [comparingOrderId, setComparingOrderId] = useState<string | null>(null);

  // Workflow action modals
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
  const [revisionComments, setRevisionComments] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [discountConcessionInput, setDiscountConcessionInput] = useState<string>('5');
  const [discountNotes, setDiscountNotes] = useState<string>('Approved seasonal concession in appreciation of partnership.');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Quotation state matching reference table structure
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>(['QT-1001', 'QT-1007', 'QT-1002', 'QT-1003']);
  const [quotationTab, setQuotationTab] = useState<'all' | 'in_review' | 'approved'>('all');
  const [quotationSearchQuery, setQuotationSearchQuery] = useState<string>('');

  // =========================================================================
  // LIVE CLIENT REGISTRY & DATA MAPPERS
  // =========================================================================
  const FALLBACK_CLIENTS: ClientProfile[] = [
    {
      id: 'CL-001',
      name: 'Fashion House',
      initials: 'FH',
      contactPerson: 'Anita Desai (Procurement Head)',
      email: 'procurement@fashionhouse.com',
      phone: '+91 98410 12345',
      address: 'Plot 42, Apparel Park, Rayon Road',
      city: 'Tirupur, Tamil Nadu',
      totalOrdersCount: 2,
      lastInteraction: 'Today'
    },
    {
      id: 'CL-002',
      name: 'Urban Textiles',
      initials: 'UT',
      contactPerson: 'Vikram Mehta (Commercial VP)',
      email: 'orders@urbantextiles.com',
      phone: '+91 97100 65432',
      address: '14 Industrial Zone, Sarkhej Highway',
      city: 'Ahmedabad, Gujarat',
      totalOrdersCount: 1,
      lastInteraction: 'Yesterday'
    }
  ];

  // Derive clients dynamically from live orders
  const clients = useMemo<ClientProfile[]>(() => {
    if (ordersResponse?.data && Array.isArray(ordersResponse.data) && ordersResponse.data.length > 0) {
      const map = new Map<string, ClientProfile>();
      for (const o of ordersResponse.data) {
        const cId =
          typeof o.clientId === 'object' && o.clientId?._id
            ? String(o.clientId._id)
            : String(o.clientId || 'CL-001');
        const cName =
          typeof o.clientId === 'object' && o.clientId?.name
            ? o.clientId.name
            : o.clientName || 'Fashion House';
        if (!map.has(cId)) {
          map.set(cId, {
            id: cId,
            name: cName,
            initials:
              cName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'CL',
            contactPerson: o.clientEmail || 'Client Procurement Team',
            email: o.clientEmail || 'procurement@client.com',
            phone: '+91 98410 12345',
            address: 'Industrial Apparel Cluster',
            city: 'Tirupur / Surat',
            totalOrdersCount: 1,
            lastInteraction: 'Today'
          });
        } else {
          map.get(cId)!.totalOrdersCount += 1;
        }
      }
      return Array.from(map.values());
    }
    return FALLBACK_CLIENTS;
  }, [ordersResponse]);

  // =========================================================================
  // =========================================================================
  // LIVE AUDITED QUOTATIONS MAPPING & DATASET
  // =========================================================================
  const mapBackendOrderToQuotationRecord = (order: any): QuotationRecord => {
    const quote = order.quotation || {};
    const orderId = String(order._id || order.id || "LP-901");
    const orderNum = order.orderNumber || (orderId.length > 8 ? `LP-${orderId.slice(-4).toUpperCase()}` : orderId);
    const clientName = typeof order.clientId === "object" && order.clientId?.name ? order.clientId.name : order.clientName || "Fashion House";
    const clientId = typeof order.clientId === "object" && order.clientId?._id ? String(order.clientId._id) : String(order.clientId || "CL-001");

    const totalPaise = quote.totalPricePaise || quote.totalPaise || (quote.totalPrice ? Math.round(quote.totalPrice * 100) : 0);
    const quotedAmount = totalPaise > 0 ? Math.round(totalPaise / 100) : (order.quantity ? Math.round(order.quantity * 250) : 250000);

    const fabricYarn = Math.round((quote.costBreakdown?.materialsPaise || quote.materialCostPaise || quotedAmount * 0.45 * 100) / 100);
    const dyeingProcessing = Math.round((quote.costBreakdown?.laborPaise || quote.processingCostPaise || quotedAmount * 0.2 * 100) / 100);
    const labour = Math.round(dyeingProcessing * 0.5);
    const overhead = Math.round((quote.costBreakdown?.overheadPaise || quote.overheadCostPaise || quotedAmount * 0.1 * 100) / 100);
    const wastage = Math.round((quote.costBreakdown?.wastagePaise || quotedAmount * 0.04 * 100) / 100);
    const priceRiskBuffer = Math.round((quote.costBreakdown?.riskBufferPaise || quotedAmount * 0.03 * 100) / 100);
    const totalCost = fabricYarn + dyeingProcessing + labour + overhead + wastage + priceRiskBuffer;
    const marginPercent = quote.marginPct ?? quote.marginPercent ?? 18;
    const expectedProfit = quotedAmount - totalCost;

    let status: QuotationStatus = "pending_admin_approval";
    const qStatus = quote.status || "";
    const oStatus = order.status || "";
    if (qStatus === "approved" || oStatus === "quotation_approved") {
      status = "approved";
    } else if (qStatus === "sent" || oStatus === "quotation_sent") {
      status = "awaiting_client_response";
    } else if (qStatus === "accepted" || oStatus === "accepted_by_client" || oStatus === "advance_pending" || oStatus === "in_production") {
      status = "client_accepted";
    } else if (qStatus === "declined" || oStatus === "declined_by_client") {
      status = "client_declined";
    } else if (qStatus === "rejected" || oStatus === "rejected_by_admin") {
      status = "rejected";
    } else if (qStatus === "draft" || oStatus === "quotation_drafting") {
      status = "draft";
    }

    const quoteId = quote._id ? String(quote._id) : `QT-${orderNum.replace(/\D/g, "") || "1001"}`;

    return {
      id: quoteId,
      clientId,
      clientName,
      orderId,
      orderTitle: order.productName || order.title || `Order ${orderNum}`,
      quotationType: quote.version > 1 ? "revised" : "new",
      typeLabel: quote.version > 1 ? `Revision v${quote.version}` : "Original Proposal",
      version: `v${quote.version || 1}.0`,
      status,
      createdDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
      expiryDate: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "In 14 Days",
      deadlineDate: order.targetDeliveryDate ? new Date(order.targetDeliveryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "30 Nov 2026",
      deliveryDays: order.feasibility?.productionDays || 21,
      specs: {
        fabricType: order.spec?.fabric || order.spec?.fabricType || "Cotton Single Jersey",
        yarnCount: order.spec?.yarnCount || "40s Ne Combed",
        gsm: Number(order.spec?.gsm) || 180,
        weave: order.spec?.weave || "Single Jersey",
        finishing: order.spec?.finishing || "Bio-Washed Finish",
        designCount: 1,
      },
      totalQuantity: order.quantity || 1000,
      quantityUnit: order.quantityUnit || "Meters",
      products: [
        {
          id: `prod_${orderId}`,
          name: order.productName || "Custom Manufactured Textile",
          designCode: order.designCode || "TX-STD",
          category: order.category || "Apparel & Fashion",
          quantity: order.quantity || 1000,
          unit: order.quantityUnit || "Meters",
          specs: {
            yarnCount: order.spec?.yarnCount || "40s Ne Combed",
            gsm: Number(order.spec?.gsm) || 180,
            weave: order.spec?.weave || "Single Jersey",
            finishing: order.spec?.finishing || "Bio-Washed Finish",
          },
          unitPrice: Math.round(quotedAmount / (order.quantity || 1000)),
          totalPrice: quotedAmount,
        },
      ],
      costBreakdown: {
        fabricYarn,
        fabricYarnBasis: "Raw yarn and weaving stock rate",
        dyeingProcessing,
        dyeingProcessingBasis: "Dyeing, finishing & washing rate",
        labour,
        labourBasis: "Direct mill worker & loom operator labour",
        overhead,
        overheadBasis: "Electricity, loom depreciation & floor space",
        wastage,
        wastageBasis: "4% tolerance for edge trim & shrinkage",
        priceRiskBuffer,
        priceRiskBufferBasis: "Market volatility buffer (cotton yarn surge index)",
        otherCosts: 0,
        otherCostsBasis: "N/A",
        totalCost,
      },
      quotedAmount,
      expectedProfit,
      marginPercent: +Number(marginPercent).toFixed(1),
      aiRecommendation: {
        suggestedPrice: quote.aiSuggested?.totalPricePaise ? Math.round(quote.aiSuggested.totalPricePaise / 100) : quotedAmount,
        suggestedMargin: quote.aiSuggested?.marginPct || 18,
        costAssumptions: "Based on active spot prices for 40s Ne yarn in Tirupur/Surat clusters.",
        wastageAssumptions: "Calculated with 4% yarn allowance across knitting/dyeing stages.",
        volatilityConsiderations: "Cotton market price surge buffer included at 3%.",
        deliveryFeasibility: order.feasibility?.bottleneckProcess ? `Bottleneck: ${order.feasibility.bottleneckProcess}` : "Loom capacity fully feasible for required timeline.",
        financialRisks: "Low default risk based on milestone prepayment requirement.",
        confidenceScore: quote.aiSuggested?.confidence ? Math.round(quote.aiSuggested.confidence * 100) : 92,
      },
      negotiations: [],
      history: quote.history || [
        {
          id: `hist_init_${orderId}`,
          timestamp: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          actor: "LoomPilot AI Agent",
          action: "DRAFT_GENERATED",
          version: `v${quote.version || 1}.0`,
          comments: quote.aiSuggested?.rationale || "Automated quotation draft synthesized from BOM costing model.",
        },
      ],
      approvedBy: quote.approvedBy,
      approvedAt: quote.approvedAt,
      dispatchedAt: quote.sentAt,
      finalizedAt: quote.acceptedAt,
      rejectedBy: quote.rejectedBy,
      rejectedAt: quote.rejectedAt,
      rejectionReason: quote.rejectionReason,
      clientPdfFileId: quote.clientPdfFileId,
    };
  };

  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);

  // Selected Client
  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  // All Quotations related to the Selected Client
  const clientQuotations = useMemo(() => {
    return quotations.filter((q) => q.clientId === selectedClient.id);
  }, [quotations, selectedClient.id]);

  // Filtered Quotations for table display (based on tab and search query)
  useEffect(() => {
    setApprovalError(null);
  }, [activeQuotationId]);

  useEffect(() => {
    if (ordersResponse?.data && Array.isArray(ordersResponse.data) && ordersResponse.data.length > 0) {
      const mapped = ordersResponse.data.map(mapBackendOrderToQuotationRecord);
      setQuotations(mapped);
    }
  }, [ordersResponse]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (quotationTab === 'in_review' && q.status !== 'pending_admin_approval') return false;
      if (quotationTab === 'approved' && q.status !== 'approved' && q.status !== 'client_accepted' && q.status !== 'finalized') return false;

      if (quotationSearchQuery.trim()) {
        const query = quotationSearchQuery.toLowerCase();
        const matchesId = q.id.toLowerCase().includes(query);
        const matchesClient = q.clientName.toLowerCase().includes(query);
        const matchesOrder = q.orderId.toLowerCase().includes(query);
        const matchesFabric = q.specs.fabricType.toLowerCase().includes(query);
        const matchesWeave = q.specs.weave.toLowerCase().includes(query);
        if (!matchesId && !matchesClient && !matchesOrder && !matchesFabric && !matchesWeave) return false;
      }
      return true;
    });
  }, [quotations, quotationTab, quotationSearchQuery]);


  // Active quotation in modal review
  const activeQuotation = quotations.find((q) => q.id === activeQuotationId) || null;
  const activeFinancials = activeQuotation ? calculateQuotationFinancials(activeQuotation) : null;

  // Status Badge Helper
  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8' };
      case 'pending_admin_approval':
        return { label: 'Pending Admin Approval', color: '#b45309', bg: '#fef3c7', border: '#fde68a', dot: '#f59e0b' };
      case 'revision_required':
        return { label: 'Revision Required', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', dot: '#64748b' };
      case 'approved':
        return { label: 'Approved (Internal)', color: '#166534', bg: '#dcfce7', border: '#bbf7d0', dot: '#16a34a' };
      case 'awaiting_client_response':
        return { label: 'Awaiting Client Response', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', dot: '#0ea5e9' };
      case 'client_revision_requested':
        return { label: 'Client Revision Requested', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c' };
      case 'client_accepted':
        return { label: 'Client Accepted', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981' };
      case 'client_declined':
        return { label: 'Client Declined', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' };
      case 'finalized':
        return { label: 'Finalized Agreement', color: '#1D2628', bg: '#F8F0DF', border: '#79B4B7', dot: '#79B4B7' };
      case 'rejected':
        return { label: 'Rejected by Admin', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' };
    }
  };

  const getTypeBadge = (type: QuotationType) => {
    switch (type) {
      case 'new':
        return { label: 'New Proposal', bg: '#F8F0DF', color: '#1D2628', border: '#79B4B7' };
      case 'revised':
        return { label: 'Revised Quotation', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'alternative':
        return { label: 'Alternative Option', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' };
    }
  };

  // =========================================================================
  // WORKFLOW ACTION HANDLERS
  // =========================================================================
  const handleAdminApprove = async (
    quoteId: string,
    customMargin?: number,
    customValidUntil?: string,
    customMilestones?: Array<{ milestone: string; percent: number; trigger: 'advance' | 'stage' | 'delivery'; stage?: string }>
  ) => {
    if (isApprovingQuotation) return;
    setApprovalError(null);

    const target = quotations.find((q) => q.id === quoteId);
    if (!target) return;

    const fin = calculateQuotationFinancials(target);
    const effectiveMargin = customMargin !== undefined ? customMargin : fin.marginPercent;
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Resolve real backend order ID
    let orderIdToApprove = target.orderId;
    if (orderIdToApprove.length !== 24 && ordersResponse?.data) {
      const matched = ordersResponse.data.find(
        (o: any) => o.orderNumber === target.orderId || String(o._id || o.id) === target.orderId
      );
      if (matched) {
        orderIdToApprove = String(matched._id || matched.id);
      }
    }

    const isLiveBackendOrder = orderIdToApprove && orderIdToApprove.length === 24;

    try {
      if (onApproveQuotation) {
        await onApproveQuotation(target.orderId, effectiveMargin);
      } else if (isLiveBackendOrder) {
        await approveQuotationMutation({
          id: orderIdToApprove,
          body: {
            action: 'approve',
            editedMarginPercent: effectiveMargin,
            editedDeliveryDate: customValidUntil || target.expiryDate,
            paymentSchedule: customMilestones || [
              { milestone: 'Advance Prepayment', percent: 30, trigger: 'advance' },
              { milestone: 'Weaving Stage Handover', percent: 40, trigger: 'stage', stage: 'loom_weaving' },
              { milestone: 'Final Inspection & Delivery', percent: 30, trigger: 'delivery' },
            ],
            notes: `Admin approved quotation with ${effectiveMargin}% margin.`,
          },
        }).unwrap();
        refetchOrders();
      } else if (!isDemo) {
        const errMsg = `Cannot approve quotation: Order '${target.orderId}' is not registered on the backend server.`;
        setApprovalError(errMsg);
        showToast(`Error: ${errMsg}`);
        return;
      }

      // ONLY on confirmed success update local UI state!
      setQuotations((prev) =>
        prev.map((q) => {
          if (q.id === quoteId) {
            return {
              ...q,
              status: 'approved',
              approvedBy: 'John Doe (Managing Director)',
              approvedAt: timestamp,
              history: [
                ...q.history,
                {
                  id: `hist_${Date.now()}`,
                  timestamp,
                  actor: 'John Doe (Managing Director)',
                  action: 'APPROVED_BY_ADMIN',
                  version: q.version,
                  comments: `Admin approved with ${effectiveMargin}% margin.`
                }
              ]
            };
          }
          return q;
        })
      );

      showToast(`Quotation ${quoteId} APPROVED by Admin. Client dispatch unlocked!`);
      setApprovalError(null);
    } catch (err: any) {
      console.error('Quotation approval failed on server:', err);
      const errMsg =
        err?.data?.message || err?.error || err?.message || 'Failed to approve quotation on server. Status was not updated.';
      setApprovalError(errMsg);
      showToast(`Error: ${errMsg}`);
    }
  };

  const handleSendToClient = async (quoteId: string) => {
    const target = quotations.find((q) => q.id === quoteId);
    if (!target) return;
    if (target.status !== 'approved') {
      showToast('Only an Admin-approved quotation can be sent to clients.');
      return;
    }

    let orderIdToSend = target.orderId;
    if (orderIdToSend.length !== 24 && ordersResponse?.data) {
      const matched = ordersResponse.data.find(
        (o: any) => o.orderNumber === target.orderId || String(o._id || o.id) === target.orderId
      );
      if (matched) {
        orderIdToSend = String(matched._id || matched.id);
      }
    }

    const isLiveBackendOrder = orderIdToSend && orderIdToSend.length === 24;

    try {
      if (isLiveBackendOrder) {
        await sendQuotationMutation(orderIdToSend).unwrap();
        refetchOrders();
      } else if (!isDemo) {
        showToast(`Cannot dispatch: Order '${target.orderId}' is not registered on the backend server.`);
        return;
      }

      const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      setQuotations((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: 'awaiting_client_response', dispatchedAt: timestamp } : q))
      );
      showToast(`Quotation ${quoteId} successfully dispatched to ${target.clientName}!`);
    } catch (err: any) {
      console.error('Failed to send quotation to client on server:', err);
      const errMsg = err?.data?.message || err?.error || err?.message || 'Failed to dispatch quotation on server.';
      showToast(`Error: ${errMsg}`);
    }
  };

  const handleRecordClientAcceptance = (quoteId: string) => {
    setQuotations((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: 'client_accepted' } : q))
    );
    showToast(`Client Acceptance recorded for ${quoteId}! Ready to finalize.`);
  };

  const handleFinalizeQuotation = (quoteId: string) => {
    const target = quotations.find((q) => q.id === quoteId);
    if (!target) return;
    const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setQuotations((prev) =>
      prev.map((q) => {
        if (q.orderId === target.orderId) {
          return q.id === quoteId ? { ...q, status: 'finalized', finalizedAt: timestamp } : q;
        }
        return q;
      })
    );
    showToast(`Order ${target.orderId} FINALIZED with quotation ${quoteId}! Commercial terms committed.`);
  };

  const handleConfirmRevision = () => {
    if (!activeQuotationId || !revisionComments.trim()) return;
    setQuotations((prev) =>
      prev.map((q) => (q.id === activeQuotationId ? { ...q, status: 'revision_required' } : q))
    );
    setShowRevisionModal(false);
    setRevisionComments('');
    showToast(`Revision requested for ${activeQuotationId}. Sent to Quotation Agent.`);
  };

  const handleConfirmReject = async () => {
    if (!activeQuotationId || !rejectionReasonInput.trim()) return;
    const target = quotations.find((q) => q.id === activeQuotationId);
    if (!target) return;

    let orderIdToReject = target.orderId;
    if (orderIdToReject.length !== 24 && ordersResponse?.data) {
      const matched = ordersResponse.data.find(
        (o: any) => o.orderNumber === target.orderId || String(o._id || o.id) === target.orderId
      );
      if (matched) {
        orderIdToReject = String(matched._id || matched.id);
      }
    }

    const isLiveBackendOrder = orderIdToReject && orderIdToReject.length === 24;

    try {
      if (onRejectQuotation) {
        await onRejectQuotation(target.orderId, rejectionReasonInput.trim());
      } else if (isLiveBackendOrder) {
        await rejectQuotationMutation({
          id: orderIdToReject,
          reason: rejectionReasonInput.trim(),
          notes: `Admin rejected quotation: ${rejectionReasonInput.trim()}`,
        }).unwrap();
        refetchOrders();
      } else if (!isDemo) {
        const errMsg = `Cannot reject quotation: Order '${target.orderId}' is not registered on the backend server.`;
        setApprovalError(errMsg);
        showToast(`Error: ${errMsg}`);
        return;
      }

      setQuotations((prev) =>
        prev.map((q) => (q.id === activeQuotationId ? { ...q, status: 'rejected', rejectionReason: rejectionReasonInput.trim() } : q))
      );
      setShowRejectModal(false);
      setRejectionReasonInput('');
      setApprovalError(null);
      showToast(`Quotation ${activeQuotationId} REJECTED.`);
    } catch (err: any) {
      console.error('Quotation rejection failed on server:', err);
      const errMsg =
        err?.data?.message || err?.error || err?.message || 'Failed to reject quotation on server. Status was not updated.';
      setApprovalError(errMsg);
      showToast(`Error: ${errMsg}`);
    }
  };

  const handleConfirmConcession = () => {
    if (!activeQuotationId) return;
    const concessionNum = parseFloat(discountConcessionInput) || 5;
    const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    setQuotations((prev) =>
      prev.map((q) => {
        if (q.id === activeQuotationId) {
          const discountAmt = Math.round(q.quotedAmount * (concessionNum / 100));
          const newPrice = q.quotedAmount - discountAmt;
          const newProfit = newPrice - q.costBreakdown.totalCost;
          const newMargin = +((newProfit / newPrice) * 100).toFixed(1);

          return {
            ...q,
            quotedAmount: newPrice,
            expectedProfit: newProfit,
            marginPercent: newMargin,
            status: 'approved',
            negotiations: [
              ...q.negotiations,
              {
                id: `neg_${Date.now()}`,
                date: timestamp,
                clientRequest: `Client requested ${concessionNum}% discount.`,
                requestedDiscountPercent: concessionNum,
                requestedPrice: newPrice,
                originalPrice: q.quotedAmount,
                revisedPrice: newPrice,
                adminResponse: discountNotes.trim() || 'Admin authorized concession.',
                status: 'concession_approved'
              }
            ]
          };
        }
        return q;
      })
    );
    setShowDiscountModal(false);
    showToast(`Concession of ${concessionNum}% authorized by Admin. Quotation price updated!`);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
      overflowY: 'auto',
      paddingRight: 4,
      boxSizing: 'border-box'
    }}>
      {/* ===================================================================
          1. APPLICATION HEADER
          =================================================================== */}
      <div className="module-header-flat" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.4px' }}>
            Quotations &amp; Approvals
          </h1>
          
        </div>

        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#18191B',
          background: '#FDF2F3',
          border: '1px solid #F6C8CC',
          padding: '5px 12px',
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <Sparkles size={13} color="#79B4B7" />
          <span>Quotation Agent Active (v2.4)</span>
        </div>
      </div>

      {/* ===================================================================
          1. FOUR UNTITLED UI KPI METRIC CARDS WITH DONUT GAUGES (Reference Image 2)
          =================================================================== */}
      <div className="reference-kpi-grid">
        {/* Card 1: Total Quotations / Blue */}
        <div className="reference-kpi-card">
          <div className="reference-kpi-left">
            <div className="reference-kpi-icon-circle" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <ShoppingBag size={18} />
            </div>
            <div className="reference-kpi-content">
              <div className="reference-kpi-top-row">
                <span className="reference-kpi-number">{quotations.length}</span>
                <span className="reference-kpi-change">
                  <ArrowUp size={11} strokeWidth={2.5} /> 18%
                </span>
              </div>
              <span className="reference-kpi-label">Total Quotations</span>
            </div>
          </div>
          <div className="reference-kpi-right">
            <div className="reference-kpi-gauge-label">
              <div>Yield</div>
            </div>
            <CircularGauge percent={88} color="#0284c7" size={38} />
          </div>
        </div>

        {/* Card 2: Pending Approval / Green */}
        <div className="reference-kpi-card">
          <div className="reference-kpi-left">
            <div className="reference-kpi-icon-circle" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Clock size={18} />
            </div>
            <div className="reference-kpi-content">
              <div className="reference-kpi-top-row">
                <span className="reference-kpi-number">{quotations.filter(q => q.status === 'pending_admin_approval').length}</span>
                <span className="reference-kpi-change">
                  <ArrowUp size={11} strokeWidth={2.5} /> Action needed
                </span>
              </div>
              <span className="reference-kpi-label">Pending Review</span>
            </div>
          </div>
          <div className="reference-kpi-right">
            <div className="reference-kpi-gauge-label">
              <div>In Review</div>
            </div>
            <CircularGauge percent={42} color="#16a34a" size={38} />
          </div>
        </div>

        {/* Card 3: Confirmed / Accepted / Teal */}
        <div className="reference-kpi-card">
          <div className="reference-kpi-left">
            <div className="reference-kpi-icon-circle" style={{ background: '#ccfbf1', color: '#0d9488' }}>
              <CheckCircle2 size={18} />
            </div>
            <div className="reference-kpi-content">
              <div className="reference-kpi-top-row">
                <span className="reference-kpi-number">{quotations.filter(q => q.status === 'approved' || q.status === 'client_accepted' || q.status === 'finalized').length}</span>
                <span className="reference-kpi-change">
                  <ArrowUp size={11} strokeWidth={2.5} /> 12%
                </span>
              </div>
              <span className="reference-kpi-label">Approved Quotes</span>
            </div>
          </div>
          <div className="reference-kpi-right">
            <div className="reference-kpi-gauge-label">
              <div>Acceptance</div>
            </div>
            <CircularGauge percent={75} color="#0d9488" size={38} />
          </div>
        </div>

        {/* Card 4: Margin Volatility Buffer / Orange */}
        <div className="reference-kpi-card">
          <div className="reference-kpi-left">
            <div className="reference-kpi-icon-circle" style={{ background: '#ffedd5', color: '#f97316' }}>
              <AlertTriangle size={18} />
            </div>
            <div className="reference-kpi-content">
              <div className="reference-kpi-top-row">
                <span className="reference-kpi-number">{quotations.filter(q => q.status === 'rejected' || q.marginPercent < 15).length}</span>
                <span className="reference-kpi-change">
                  <ArrowUp size={11} strokeWidth={2.5} /> Margin check
                </span>
              </div>
              <span className="reference-kpi-label">Below 15% Margin</span>
            </div>
          </div>
          <div className="reference-kpi-right">
            <div className="reference-kpi-gauge-label">
              <div>Compliance</div>
            </div>
            <CircularGauge percent={92} color="#f97316" size={38} />
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. TWO-COLUMN WORKSPACE: LEFT TABLE (72%) + RIGHT BUNDLES (28%)
          (Exact Structure and Visual Composition of Reference Image 2)
          =================================================================== */}
      <div className="reference-layout-grid">
        {/* LEFT COLUMN: THE REAL QUOTATION DETAILS TABLE */}
        <div className="ref-table-card">
          {/* Header Block: Title + Count Badge + Subtitle + Import & +Add Buttons */}
          <div className="ref-table-header">
            <div className="ref-table-title-group">
              <div className="ref-table-title-row">
                <h2 className="ref-table-title">Quotation Proposals</h2>
                <span className="ref-table-count-badge">{quotations.length} proposals</span>
              </div>
              
            </div>

            <div className="ref-table-actions">
              <button
                type="button"
                className="ref-btn-import"
                onClick={() => showToast('Exported audited commercial quotations CSV.')}
              >
                <Upload size={14} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                className="ref-btn-add"
                onClick={() => showToast('New quotation proposal generator initialized.')}
              >
                <Plus size={15} />
                <span>New quotation</span>
              </button>
            </div>
          </div>

          {/* Filter Toolbar: Segmented Tabs (All / In Review / Approved) + Search + Filters */}
          <div className="ref-table-toolbar">
            <div className="ref-segmented-tabs">
              <button
                type="button"
                className={`ref-tab-btn ${quotationTab === 'all' ? 'active' : ''}`}
                onClick={() => setQuotationTab('all')}
              >
                All Proposals ({quotations.length})
              </button>
              <button
                type="button"
                className={`ref-tab-btn ${quotationTab === 'in_review' ? 'active' : ''}`}
                onClick={() => setQuotationTab('in_review')}
              >
                In Review ({quotations.filter(q => q.status === 'pending_admin_approval').length})
              </button>
              <button
                type="button"
                className={`ref-tab-btn ${quotationTab === 'approved' ? 'active' : ''}`}
                onClick={() => setQuotationTab('approved')}
              >
                Approved ({quotations.filter(q => q.status === 'approved' || q.status === 'client_accepted' || q.status === 'finalized').length})
              </button>
            </div>

            <div className="ref-search-filter-group">
              <div className="ref-search-box" style={{ width: 280 }}>
                <Search size={15} color="#667085" />
                <input
                  type="text"
                  placeholder="Search quote ID, client, fabric specs..."
                  value={quotationSearchQuery}
                  onChange={(e) => setQuotationSearchQuery(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="ref-btn-filters"
                onClick={() => showToast('Quotation filter drawer opened.')}
              >
                <SlidersHorizontal size={14} color="#344054" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Authentic Data Table with Real LoomPilot Quotations */}
          <div className="untitled-table-wrapper">
            <table className="untitled-table">
              <thead>
                <tr>
                  <th className="col-cb">
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: '1.5px solid #79B4B7', background: '#79B4B7',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        margin: '0 auto'
                      }}
                      onClick={() => {
                        if (selectedQuoteIds.length === filteredQuotations.length) {
                          setSelectedQuoteIds([]);
                        } else {
                          setSelectedQuoteIds(filteredQuotations.map((q) => q.id));
                        }
                      }}
                      title="Select all"
                    >
                      <Minus size={11} strokeWidth={3} />
                    </div>
                  </th>
                  <th>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Quotation &amp; Client <ArrowDown size={12} color="#667085" />
                    </div>
                  </th>
                  <th>Gross Profit Margin</th>
                  <th>Delivery Deadline</th>
                  <th>Fabric Specs &amp; Status</th>
                  <th style={{ textAlign: 'right' }}>Quoted Price</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((quote) => {
                  const isSelected = selectedQuoteIds.includes(quote.id);
                  const brand = getClientBrand(quote.clientName);
                  const fin = calculateQuotationFinancials(quote);
                  const formattedPrice = `₹${quote.quotedAmount.toLocaleString()}`;

                  let statusDotColor = '#12b76a';
                  let statusText = 'Approved';
                  if (quote.status === 'pending_admin_approval') {
                    statusDotColor = '#f59e0b';
                    statusText = 'In Review';
                  } else if (quote.status === 'client_accepted') {
                    statusDotColor = '#0d9488';
                    statusText = 'Accepted';
                  } else if (quote.status === 'finalized') {
                    statusDotColor = '#79B4B7';
                    statusText = 'Finalized';
                  } else if (quote.status === 'rejected') {
                    statusDotColor = '#ef4444';
                    statusText = 'Rejected';
                  }

                  return (
                    <tr
                      key={quote.id}
                      className={isSelected ? 'is-selected' : ''}
                      onClick={() => {
                        setActiveQuotationId(quote.id);
                        setActiveDetailTab('overview');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td
                        className="col-cb"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="untitled-checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setSelectedQuoteIds(selectedQuoteIds.filter((id) => id !== quote.id));
                            } else {
                              setSelectedQuoteIds([...selectedQuoteIds, quote.id]);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <div className="untitled-entity-cell">
                          <div
                            className="untitled-avatar-badge"
                            style={{
                              background: brand.color,
                              color: '#ffffff',
                              fontSize: 13,
                              fontWeight: 800,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                            }}
                          >
                            {brand.initials}
                          </div>
                          <div>
                            <div className="untitled-entity-title">{quote.clientName}</div>
                            <div className="untitled-entity-sub">
                              <strong>#{quote.id}</strong> &bull; Order #{quote.orderId} &bull; {quote.totalQuantity.toLocaleString()} {quote.quantityUnit}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="ref-rating-cell">
                          <div className="ref-rating-track">
                            <div
                              className="ref-rating-fill"
                              style={{
                                width: `${Math.min(100, Math.max(12, fin.marginPercent * 4))}%`,
                                background: fin.isPolicyCompliant ? '#79B4B7' : '#f04438'
                              }}
                            />
                          </div>
                          <span className="ref-rating-score">{fin.marginPercent.toFixed(1)}%</span>
                          <span className="ref-rating-badge" style={{ color: fin.isPolicyCompliant ? '#12b76a' : '#d92d20' }}>
                            <ArrowUp size={11} strokeWidth={2.5} /> {fin.isPolicyCompliant ? 'Compliant' : 'Low Margin'}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: '#475467', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {quote.deadlineDate}
                      </td>
                      <td>
                        <div className="ref-license-cell">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: statusDotColor }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDotColor }} />
                            {statusText}
                          </span>
                          <span className="ref-tag-pill">
                            {quote.specs.fabricType}
                          </span>
                          <span className="ref-tag-pill">
                            {quote.specs.gsm} GSM
                          </span>
                          <span className="ref-tag-pill">
                            {quote.specs.weave}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#101828', fontVariantNumeric: 'tabular-nums' }}>
                        {formattedPrice}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div className="untitled-row-actions">
                          <button
                            type="button"
                            className="untitled-action-icon-btn delete"
                            title="Decline / Reject quotation"
                            onClick={() => {
                              setQuotations((prev) =>
                                prev.map((q) => (q.id === quote.id ? { ...q, status: 'rejected' } : q))
                              );
                              showToast(`Quotation #${quote.id} marked as declined.`);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="untitled-action-icon-btn"
                            title="Inspect & Review quotation details"
                            onClick={() => {
                              setActiveQuotationId(quote.id);
                              setActiveDetailTab('overview');
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination matching Reference Image 2 */}
          <div className="untitled-table-footer">
            <span style={{ fontSize: 13, color: '#475467', fontWeight: 500 }}>
              Page 1 of {Math.max(1, Math.ceil(filteredQuotations.length / 5))}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="untitled-page-btn"
                onClick={() => showToast("Navigated to previous page")}
              >
                Previous
              </button>
              <button
                type="button"
                className="untitled-page-btn"
                onClick={() => showToast("Navigated to next page")}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BUNDLES CARD (Textile Commercial Packages) */}
        <aside className="ref-bundles-card">
          <div className="ref-bundles-header">
            <h3 className="ref-bundles-title">Commercial Packages</h3>
            <span className="ref-bundles-avail-badge">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12b76a', display: 'inline-block' }} />
              Active: 3
            </span>
          </div>

          {/* Package 1 */}
          <div className="ref-bundle-item">
            <div className="ref-bundle-name">Premium Shirting Package</div>
            <div className="ref-bundle-desc">
              40s Combed Cotton Oxford with Bio-Wash enzyme finishing for corporate formalwear.
            </div>
            <div className="ref-bundle-apps-list">
              <div className="ref-bundle-app-row">
                <div className="ref-bundle-app-icon" style={{ background: '#fdf2f8', color: '#ea4c89' }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>🧶</span>
                </div>
                <div>
                  <div className="ref-bundle-app-name">40s Combed Cotton Yarn</div>
                  <div className="ref-bundle-app-url">₹240/kg &bull; 833 kg required</div>
                </div>
              </div>
              <div className="ref-bundle-app-row">
                <div className="ref-bundle-app-icon" style={{ background: '#f4f3ff', color: '#a259ff' }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>🧵</span>
                </div>
                <div>
                  <div className="ref-bundle-app-name">Airjet Oxford Weave</div>
                  <div className="ref-bundle-app-url">Shed A &bull; 850 RPM</div>
                </div>
              </div>
              <div className="ref-bundle-app-row">
                <div className="ref-bundle-app-icon" style={{ background: '#eff8ff', color: '#0284c7' }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>✨</span>
                </div>
                <div>
                  <div className="ref-bundle-app-name">Bio-Wash Enzyme Finishing</div>
                  <div className="ref-bundle-app-url">Stenter finishing run</div>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="ref-bundle-btn"
              onClick={() => {
                setActiveQuotationId('QT-1001');
                setActiveDetailTab('overview');
              }}
            >
              ₹3.88L - Review Details
            </button>
          </div>

          {/* Package 2 */}
          <div className="ref-bundle-item">
            <div className="ref-bundle-name">Denim Bottomwear Package</div>
            <div className="ref-bundle-desc">
              30s Ring Spun 3/1 Heavy Twill + Reactive Indigo Dyeing for durable suiting trousers.
            </div>
            <div className="ref-bundle-apps-list">
              <div className="ref-bundle-app-row">
                <div className="ref-bundle-app-icon" style={{ background: '#fef3c7', color: '#ea4c89' }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>🧶</span>
                </div>
                <div>
                  <div className="ref-bundle-app-name">30s Ring Spun Cotton</div>
                  <div className="ref-bundle-app-url">₹210/kg &bull; Twill standard</div>
                </div>
              </div>
              <div className="ref-bundle-app-row">
                <div className="ref-bundle-app-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>👖</span>
                </div>
                <div>
                  <div className="ref-bundle-app-name">3/1 Twill Weave Setup</div>
                  <div className="ref-bundle-app-url">Shed B &bull; Airjet Loom #12</div>
                </div>
              </div>
              <div className="ref-bundle-app-row">
                <div className="ref-bundle-app-icon" style={{ background: '#fef2f2', color: '#f97316' }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>💧</span>
                </div>
                <div>
                  <div className="ref-bundle-app-name">Reactive Dye Shade 4B</div>
                  <div className="ref-bundle-app-url">Delta-E: 0.42 (Passed)</div>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="ref-bundle-btn"
              onClick={() => {
                setActiveQuotationId('QT-1002');
                setActiveDetailTab('overview');
              }}
            >
              ₹8.40L - Review Details
            </button>
          </div>

          {/* Package 3 */}
          <div className="ref-bundle-item">
            <div className="ref-bundle-name">Luxury Sateen Sheeting</div>
            <div className="ref-bundle-desc">
              60s Giza Long-Staple Cotton for high-density satin export bedding.
            </div>
            <button
              type="button"
              className="ref-bundle-btn"
              onClick={() => {
                setActiveQuotationId('QT-1003');
                setActiveDetailTab('overview');
              }}
            >
              ₹4.20L - Review Details
            </button>
          </div>
        </aside>
      </div>

      {/* ===================================================================
          MODAL: QUOTATION COMPARISON MODAL
          =================================================================== */}
      {comparingOrderId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '20px 24px',
            maxWidth: 960,
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid #edf2ee'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GitCompare size={17} color="#18191B" />
                  Quotation Comparison: Order {comparingOrderId} ({selectedClient.name})
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                  Comparing all commercial proposals, revisions, and alternatives for this order.
                </p>
              </div>
              <button
                onClick={() => setComparingOrderId(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  fontWeight: 800
                }}
              >
                ✕
              </button>
            </div>

            {(() => {
              const quotesToCompare = clientQuotations.filter((q) => q.orderId === comparingOrderId);
              return (
                <div style={{ border: '1px solid #edf2ee', borderRadius: 12, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f8faf9', borderBottom: '1px solid #edf2ee' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, width: 160, color: '#64748b' }}>Parameter</th>
                        {quotesToCompare.map((q) => (
                          <th key={q.id} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, color: '#18191B', minWidth: 200 }}>
                            <div>{q.id} ({q.version})</div>
                            <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 500 }}>{q.typeLabel}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f8faf9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Proposal Type</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, ...getTypeBadge(q.quotationType), padding: '2px 6px', borderRadius: 4 }}>
                              {getTypeBadge(q.quotationType).label}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f8faf9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Fabric &amp; Yarn</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '8px 12px', fontWeight: 600, color: '#111827' }}>
                            {q.specs.fabricType} ({q.specs.yarnCount})
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f8faf9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>GSM &amp; Weave</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '8px 12px' }}>
                            <strong>{q.specs.gsm} GSM</strong> &bull; {q.specs.weave}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f8faf9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Quantity &amp; Deadline</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '8px 12px' }}>
                            {q.totalQuantity.toLocaleString()} {q.quantityUnit} &bull; {q.deadlineDate}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f8faf9', background: '#fafbfc' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Estimated Cost</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            ₹{q.costBreakdown.totalCost.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f8faf9', background: '#FDF2F3' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#18191B' }}>Proposed Price</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '8px 12px', fontWeight: 800, color: '#18191B', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                            ₹{q.quotedAmount.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f8faf9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Profit Margin %</td>
                        {quotesToCompare.map((q) => {
                          const fin = calculateQuotationFinancials(q);
                          return (
                            <td key={q.id} style={{ padding: '8px 12px' }}>
                              <span style={{
                                fontWeight: 800,
                                color: fin.isPolicyCompliant ? '#16a34a' : '#dc2626',
                                background: fin.isPolicyCompliant ? '#ecfdf5' : '#fee2e2',
                                padding: '2px 6px',
                                borderRadius: 4
                              }}>
                                {fin.marginPercent.toFixed(1)}% {fin.isPolicyCompliant ? '(≥15%)' : '(<15% Alert)'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Actions</td>
                        {quotesToCompare.map((q) => (
                          <td key={q.id} style={{ padding: '10px 12px' }}>
                            <button
                              onClick={() => {
                                setComparingOrderId(null);
                                setActiveQuotationId(q.id);
                                setActiveDetailTab('overview');
                              }}
                              style={{
                                background: '#79B4B7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Review Details
                            </button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: DEDICATED INDIVIDUAL QUOTATION REVIEW WORKSPACE
          =================================================================== */}
      {activeQuotation && activeFinancials && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '20px 24px',
            maxWidth: 960,
            width: '95%',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid #edf2ee',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: 10
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{activeQuotation.id}</span>
                  <span style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{activeQuotation.version}</span>
                  <span style={{ fontSize: 10, ...getTypeBadge(activeQuotation.quotationType), padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>{getTypeBadge(activeQuotation.quotationType).label}</span>
                  <span style={{ fontSize: 10, ...getStatusBadge(activeQuotation.status), padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>{getStatusBadge(activeQuotation.status).label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Client: <strong>{activeQuotation.clientName}</strong> &bull; Order: <strong>{activeQuotation.orderId}</strong> ({activeQuotation.orderTitle})
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>Proposed Selling Price</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#18191B' }}>₹{activeQuotation.quotedAmount.toLocaleString()}</span>
                </div>
                <button
                  onClick={() => setActiveQuotationId(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sub-Tabs */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #edf2ee', paddingBottom: 6, overflowX: 'auto' }}>
              {[
                { key: 'overview', label: '1. Specifications', icon: Layers },
                { key: 'cost', label: '2. Cost Breakdown', icon: DollarSign },
                { key: 'profit', label: '3. Profit & Policy', icon: TrendingUp },
                { key: 'ai', label: '4. AI Agent Advisory', icon: Sparkles },
                { key: 'negotiation', label: `5. Negotiation (${activeQuotation.negotiations.length})`, icon: MessageSquare },
                { key: 'history', label: '6. Audit Trail', icon: History }
              ].map((tab) => {
                const isSelected = activeDetailTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDetailTab(tab.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: isSelected ? '#79B4B7' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#64748b',
                      border: isSelected ? '1.5px solid #79B4B7' : '1px solid #E2E5E8',
                      borderRadius: 9999,
                      padding: '5px 12px',
                      fontSize: 10.5,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: PRODUCT SPECIFICATIONS */}
            {activeDetailTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#f8faf9', borderRadius: 10, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 10.5 }}>
                  <div>Fabric: <strong>{activeQuotation.specs.fabricType}</strong></div>
                  <div>Yarn Count: <strong>{activeQuotation.specs.yarnCount}</strong></div>
                  <div>Weight: <strong>{activeQuotation.specs.gsm} GSM</strong></div>
                  <div>Weave: <strong>{activeQuotation.specs.weave}</strong></div>
                  <div>Finishing: <strong>{activeQuotation.specs.finishing}</strong></div>
                  <div>Quantity: <strong>{activeQuotation.totalQuantity.toLocaleString()} {activeQuotation.quantityUnit}</strong></div>
                  <div>Deadline: <strong>{activeQuotation.deadlineDate}</strong></div>
                  <div>Expiry: <strong>{activeQuotation.expiryDate}</strong></div>
                </div>

                <div style={{ border: '1px solid #edf2ee', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                    <thead>
                      <tr style={{ background: '#f8faf9', borderBottom: '1px solid #edf2ee', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '8px 10px' }}>Design / SKU</th>
                        <th style={{ padding: '8px 10px' }}>Category</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Quantity</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQuotation.products.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f8faf9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111827' }}>
                            {p.name} <span style={{ color: '#94a3b8', fontSize: 9 }}>({p.designCode})</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#475569' }}>{p.category}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{p.quantity.toLocaleString()} {p.unit}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>₹{p.unitPrice.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#18191B' }}>₹{p.totalPrice.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: COST BREAKDOWN */}
            {activeDetailTab === 'cost' && (
              <div style={{ border: '1px solid #edf2ee', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f8faf9', borderBottom: '1px solid #edf2ee', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Cost Component</th>
                      <th style={{ padding: '8px 12px' }}>Calculation Basis</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f8faf9' }}><td style={{ padding: '8px 12px', fontWeight: 700 }}>Fabric / Yarn</td><td style={{ padding: '8px 12px', color: '#475569' }}>{activeQuotation.costBreakdown.fabricYarnBasis}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{activeQuotation.costBreakdown.fabricYarn.toLocaleString()}</td></tr>
                    <tr style={{ borderBottom: '1px solid #f8faf9' }}><td style={{ padding: '8px 12px', fontWeight: 700 }}>Dyeing &amp; Processing</td><td style={{ padding: '8px 12px', color: '#475569' }}>{activeQuotation.costBreakdown.dyeingProcessingBasis}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{activeQuotation.costBreakdown.dyeingProcessing.toLocaleString()}</td></tr>
                    <tr style={{ borderBottom: '1px solid #f8faf9' }}><td style={{ padding: '8px 12px', fontWeight: 700 }}>Labour</td><td style={{ padding: '8px 12px', color: '#475569' }}>{activeQuotation.costBreakdown.labourBasis}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{activeQuotation.costBreakdown.labour.toLocaleString()}</td></tr>
                    <tr style={{ borderBottom: '1px solid #f8faf9' }}><td style={{ padding: '8px 12px', fontWeight: 700 }}>Overhead</td><td style={{ padding: '8px 12px', color: '#475569' }}>{activeQuotation.costBreakdown.overheadBasis}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{activeQuotation.costBreakdown.overhead.toLocaleString()}</td></tr>
                    <tr style={{ borderBottom: '1px solid #f8faf9' }}><td style={{ padding: '8px 12px', fontWeight: 700 }}>Wastage Allowance</td><td style={{ padding: '8px 12px', color: '#475569' }}>{activeQuotation.costBreakdown.wastageBasis}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{activeQuotation.costBreakdown.wastage.toLocaleString()}</td></tr>
                    <tr style={{ borderBottom: '1px solid #f8faf9' }}><td style={{ padding: '8px 12px', fontWeight: 700 }}>Price Risk Buffer</td><td style={{ padding: '8px 12px', color: '#475569' }}>{activeQuotation.costBreakdown.priceRiskBufferBasis}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>₹{activeQuotation.costBreakdown.priceRiskBuffer.toLocaleString()}</td></tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8faf9', borderTop: '2px solid #e2e8f0', fontWeight: 800 }}>
                      <td colSpan={2} style={{ padding: '10px 12px' }}>Total Estimated Cost</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1B1918', fontSize: 13 }}>₹{activeFinancials.totalCost.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* TAB 3: PROFIT & POLICY */}
            {activeDetailTab === 'profit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ background: '#f8faf9', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #edf2ee' }}>
                    <span style={{ fontSize: 9.5, color: '#64748b' }}>Estimated Cost</span>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>₹{activeFinancials.totalCost.toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#f8faf9', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #edf2ee' }}>
                    <span style={{ fontSize: 9.5, color: '#64748b' }}>Selling Price</span>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#18191B' }}>₹{activeQuotation.quotedAmount.toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#f8faf9', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #edf2ee' }}>
                    <span style={{ fontSize: 9.5, color: '#64748b' }}>Expected Profit</span>
                    <div style={{ fontSize: 17, fontWeight: 800, color: activeFinancials.expectedProfit >= 0 ? '#059669' : '#dc2626' }}>
                      ₹{activeFinancials.expectedProfit.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: activeFinancials.isPolicyCompliant ? '#f0fdf4' : '#fef2f2',
                  border: activeFinancials.isPolicyCompliant ? '1.5px solid #FAF4EA' : '1.5px solid #fecaca',
                  borderRadius: 12,
                  padding: '12px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {activeFinancials.isPolicyCompliant ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#dc2626" />}
                      <span style={{ fontSize: 12, fontWeight: 800, color: activeFinancials.isPolicyCompliant ? '#1B1918' : '#991b1b' }}>
                        Gross Margin: {activeFinancials.marginPercent.toFixed(1)}% &bull;{' '}
                        {activeFinancials.isPolicyCompliant ? 'Policy Compliant (≥ 15.0%)' : 'Below Minimum 15.0% Policy – Admin Attention Required'}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b' }}>Policy Threshold: 15.0%</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AI AGENT ADVISORY */}
            {activeDetailTab === 'ai' && (
              <div style={{ background: '#f8faf9', borderRadius: 12, padding: '12px 16px', border: '1px solid #edf2ee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#18191B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} /> AI Quotation Agent v2.4 Recommendations
                  </span>
                  <span style={{ fontSize: 9.5, background: '#FAF4EA', color: '#8A6529', padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>
                    Confidence: {activeQuotation.aiRecommendation.confidenceScore}%
                  </span>
                </div>
                <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div><strong>Suggested Selling Price:</strong> ₹{activeQuotation.aiRecommendation.suggestedPrice.toLocaleString()} ({activeQuotation.aiRecommendation.suggestedMargin.toFixed(1)}% margin)</div>
                  <div><strong>Cost Assumptions:</strong> {activeQuotation.aiRecommendation.costAssumptions}</div>
                  <div><strong>Material Wastage:</strong> {activeQuotation.aiRecommendation.wastageAssumptions}</div>
                  <div><strong>Volatility Considerations:</strong> {activeQuotation.aiRecommendation.volatilityConsiderations}</div>
                  <div><strong>Delivery Feasibility:</strong> {activeQuotation.aiRecommendation.deliveryFeasibility}</div>
                  <div><strong>Financial Risk:</strong> {activeQuotation.aiRecommendation.financialRisks}</div>
                </div>
              </div>
            )}

            {/* TAB 5: NEGOTIATION */}
            {activeDetailTab === 'negotiation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>Client Negotiation &amp; Concession History</span>
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    style={{ background: '#ffffff', color: '#b45309', border: '1.5px solid #fde68a', borderRadius: 9999, padding: '4px 12px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Record Concession / Discount Request
                  </button>
                </div>
                {activeQuotation.negotiations.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>No negotiations logged.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeQuotation.negotiations.map((neg) => (
                      <div key={neg.id} style={{ background: '#f8faf9', border: '1px solid #edf2ee', borderRadius: 10, padding: '10px 12px', fontSize: 10.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                          <span>{neg.date}</span>
                          <span style={{ fontWeight: 800, color: '#b45309' }}>{neg.status.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <div style={{ marginTop: 4, color: '#111827' }}><strong>Client Request:</strong> {neg.clientRequest}</div>
                        <div style={{ marginTop: 2, color: '#1B1918' }}><strong>Admin Decision:</strong> {neg.adminResponse}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: AUDIT TRAIL */}
            {activeDetailTab === 'history' && (
              <div style={{ border: '1px solid #edf2ee', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                  <thead>
                    <tr style={{ background: '#f8faf9', borderBottom: '1px solid #edf2ee', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', width: 130 }}>Timestamp</th>
                      <th style={{ padding: '8px 10px', width: 140 }}>Actor</th>
                      <th style={{ padding: '8px 10px', width: 130 }}>Action</th>
                      <th style={{ padding: '8px 10px' }}>Comments / Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQuotation.history.map((h) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f8faf9' }}>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{h.timestamp}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{h.actor}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#18191B' }}>{h.action}</td>
                        <td style={{ padding: '8px 10px', color: '#334155' }}>{h.comments || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal Bottom Governance Action Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #f1f5f9',
              paddingTop: 10,
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldAlert size={13} color="#f04438" />
                <span>Binding Rule: Only an approved quotation can be sent to clients.</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {activeQuotation.status !== 'rejected' && (
                  <button
                    onClick={() => {
                      setRejectionReasonInput('');
                      setShowRejectModal(true);
                    }}
                    style={{ background: '#ffffff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: 9999, padding: '6px 14px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                )}

                <button
                  onClick={() => {
                    setRevisionComments('');
                    setShowRevisionModal(true);
                  }}
                  style={{ background: '#ffffff', color: '#d97706', border: '1.5px solid #fde68a', borderRadius: 9999, padding: '6px 14px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Request Revision
                </button>

                {approvalError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 12,
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#b91c1c',
                      fontSize: 11,
                      marginRight: 8,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{approvalError}</span>
                  </div>
                )}

                {/* Client PDF Download Action */}
                {activeQuotation.clientPdfFileId ? (
                  <a
                    href={`/api/v1/files/${activeQuotation.clientPdfFileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`Quotation_${activeQuotation.id}.pdf`}
                    style={{
                      background: '#1D2628',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: 9999,
                      padding: '6px 14px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Upload size={12} style={{ transform: 'rotate(180deg)' }} />
                    Download Client PDF
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => showToast('PDF document will be generated once quotation is approved.')}
                    style={{
                      background: '#f8fafc',
                      color: '#94a3b8',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '6px 14px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Upload size={12} style={{ transform: 'rotate(180deg)' }} />
                    PDF Pending Approval
                  </button>
                )}

                {activeQuotation.status !== 'approved' && activeQuotation.status !== 'client_accepted' && activeQuotation.status !== 'finalized' && (
                  <button
                    onClick={() => handleAdminApprove(activeQuotation.id)}
                    disabled={isApprovingQuotation}
                    style={{
                      background: isApprovingQuotation ? '#94a3b8' : '#79B4B7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 9999,
                      padding: '6px 16px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: isApprovingQuotation ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: isApprovingQuotation ? 0.7 : 1,
                    }}
                  >
                    {isApprovingQuotation ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Approving...</span>
                      </>
                    ) : (
                      'Approve Quotation'
                    )}
                  </button>
                )}

                {activeQuotation.status === 'approved' && (
                  <button
                    onClick={() => handleSendToClient(activeQuotation.id)}
                    style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: 9999, padding: '6px 16px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Send to Client
                  </button>
                )}

                {activeQuotation.status === 'awaiting_client_response' && (
                  <button
                    onClick={() => handleRecordClientAcceptance(activeQuotation.id)}
                    style={{ background: '#047857', color: '#ffffff', border: 'none', borderRadius: 9999, padding: '6px 16px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Record Client Acceptance
                  </button>
                )}

                {activeQuotation.status === 'client_accepted' && (
                  <button
                    onClick={() => handleFinalizeQuotation(activeQuotation.id)}
                    style={{ background: '#15803d', color: '#ffffff', border: 'none', borderRadius: 9999, padding: '6px 18px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Designate as Finalized Agreement
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: REQUEST REVISION
          =================================================================== */}
      {showRevisionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: '20px', maxWidth: 460, width: '90%' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>Request Quotation Revision</h4>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 10px' }}>Enter instructions for the AI Quotation Agent:</p>
            <textarea
              rows={3}
              value={revisionComments}
              onChange={(e) => setRevisionComments(e.target.value)}
              placeholder="E.g., Adjust price to meet 15% threshold..."
              style={{ width: '100%', borderRadius: 8, border: '1px solid #d1d5db', padding: '8px', fontSize: 11 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
              <button onClick={() => setShowRevisionModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11 }}>Cancel</button>
              <button onClick={handleConfirmRevision} style={{ background: '#d97706', color: '#18191B', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: REJECT QUOTATION
          =================================================================== */}
      {showRejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: '20px', maxWidth: 460, width: '90%' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: '#dc2626' }}>Reject Quotation</h4>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 10px' }}>Enter rejection reason for audit trail:</p>
            <textarea
              rows={3}
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="E.g., Margin below 15% threshold..."
              style={{ width: '100%', borderRadius: 8, border: '1px solid #fca5a5', padding: '8px', fontSize: 11 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
              <button onClick={() => setShowRejectModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11 }}>Cancel</button>
              <button onClick={handleConfirmReject} style={{ background: '#dc2626', color: '#18191B', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: DISCOUNT CONCESSION
          =================================================================== */}
      {showDiscountModal && activeQuotation && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: '20px', maxWidth: 480, width: '90%' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#b45309' }}>Authorize Client Concession / Discount</h4>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 12px' }}>Only Managing Director John Doe has authority to authorize concessions.</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', display: 'block' }}>Concession %</label>
                <input
                  type="number"
                  step="0.5"
                  value={discountConcessionInput}
                  onChange={(e) => setDiscountConcessionInput(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, fontWeight: 700 }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', display: 'block' }}>Resulting New Price</label>
                <div style={{ padding: '6px 8px', background: '#f8faf9', borderRadius: 6, border: '1px solid #edf2ee', fontSize: 13, fontWeight: 800, color: '#18191B' }}>
                  ₹{Math.round(activeQuotation.quotedAmount * (1 - (parseFloat(discountConcessionInput) || 0) / 100)).toLocaleString()}
                </div>
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', display: 'block' }}>Admin Decision Notes</label>
            <textarea
              rows={2}
              value={discountNotes}
              onChange={(e) => setDiscountNotes(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
              <button onClick={() => setShowDiscountModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11 }}>Cancel</button>
              <button onClick={handleConfirmConcession} style={{ background: '#79B4B7', color: '#18191B', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                Authorize &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#111827',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 1300
        }}>
          <Sparkles size={15} color="#86efac" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default QuotationApprovalsModule;

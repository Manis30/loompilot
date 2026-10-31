import React, { useState, useMemo } from 'react';
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
  Minus
} from 'lucide-react';
import type { Order } from '../../types';

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
}

interface QuotationApprovalsModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onApproveQuotation: (orderId: string, editedMargin?: number) => void;
  onRejectQuotation: (orderId: string, reason: string) => void;
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
  // CLIENT REGISTRY
  // =========================================================================
  const [clients] = useState<ClientProfile[]>([
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
      lastInteraction: '29 Oct 2026, 04:30 PM'
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
      lastInteraction: '28 Oct 2026, 03:40 PM'
    },
    {
      id: 'CL-003',
      name: 'Style World',
      initials: 'SW',
      contactPerson: 'Priya Sharma (Senior Merchandiser)',
      email: 'style@styleworld.com',
      phone: '+91 98840 98765',
      address: '88 Textile Tower, Electronic City',
      city: 'Bengaluru, Karnataka',
      totalOrdersCount: 1,
      lastInteraction: '29 Oct 2026, 04:30 PM'
    },
    {
      id: 'CL-004',
      name: 'Home Living',
      initials: 'HL',
      contactPerson: 'Rajesh Verma (Sourcing Director)',
      email: 'procure@homeliving.com',
      phone: '+91 94440 22110',
      address: '5B Mill Compound, Pollachi Road',
      city: 'Coimbatore, Tamil Nadu',
      totalOrdersCount: 1,
      lastInteraction: '29 Oct 2026, 03:20 PM'
    },
    {
      id: 'CL-005',
      name: 'StyleMart',
      initials: 'SM',
      contactPerson: 'Sunita Patel (Purchase Officer)',
      email: 'buyers@stylemart.com',
      phone: '+91 91234 56780',
      address: '22 Ring Road Market, Ring Road',
      city: 'Surat, Gujarat',
      totalOrdersCount: 1,
      lastInteraction: '28 Oct 2026, 05:00 PM'
    },
    {
      id: 'CL-006',
      name: 'HomeNest',
      initials: 'HN',
      contactPerson: 'Rohan Nair (Brand Director)',
      email: 'orders@homenest.com',
      phone: '+91 98765 43210',
      address: '102 Guindy Industrial Estate',
      city: 'Chennai, Tamil Nadu',
      totalOrdersCount: 1,
      lastInteraction: '28 Oct 2026, 02:30 PM'
    }
  ]);

  // =========================================================================
  // COMPLETE AUDITED QUOTATIONS DATASET
  // =========================================================================
  const [quotations, setQuotations] = useState<QuotationRecord[]>([
    // ---------------------------------------------------------------------
    // CLIENT CL-001 (Fashion House) · ORDER LP-901
    // ---------------------------------------------------------------------
    {
      id: 'QT-1001',
      clientId: 'CL-001',
      clientName: 'Fashion House',
      orderId: 'LP-901',
      orderTitle: 'Cotton Shirts & Trousers (5,000 pcs)',
      quotationType: 'new',
      typeLabel: 'Original Proposal',
      version: 'v1.0',
      status: 'pending_admin_approval',
      createdDate: '29 Oct 2026, 09:30 AM',
      expiryDate: '12 Nov 2026',
      deadlineDate: '05 Nov 2026',
      deliveryDays: 7,
      specs: {
        fabricType: 'Combed Cotton / Twill Blend',
        yarnCount: '40s Combed & 30s Ring Spun',
        gsm: 185,
        weave: 'Oxford & Twill',
        finishing: 'Bio-Washed Silk Finish',
        designCount: 3
      },
      totalQuantity: 5000,
      quantityUnit: 'pieces',
      products: [
        { id: 'LP-901-A', name: 'Formal Shirt — Design A', designCode: 'FS-A-01', category: 'Formalwear', quantity: 2000, unit: 'pieces', specs: { yarnCount: '40s Combed', gsm: 185, weave: 'Oxford Weave', finishing: 'Bio-Wash' }, unitPrice: 77.6, totalPrice: 155200 },
        { id: 'LP-901-B', name: 'Formal Pants — Design B', designCode: 'FP-B-02', category: 'Trousers', quantity: 1500, unit: 'pieces', specs: { yarnCount: '30s Ring Spun', gsm: 220, weave: 'Twill Weave', finishing: 'Bio-Enzyme' }, unitPrice: 80.0, totalPrice: 120000 },
        { id: 'LP-901-C', name: 'Casual Shirt — Design C', designCode: 'CS-C-03', category: 'Casualwear', quantity: 1500, unit: 'pieces', specs: { yarnCount: '40s Combed', gsm: 175, weave: 'Poplin Weave', finishing: 'Silicone Softener' }, unitPrice: 75.2, totalPrice: 112800 }
      ],
      costBreakdown: {
        fabricYarn: 200000,
        fabricYarnBasis: '40s Combed cotton yarn @ ₹240/kg, 833 kg required',
        dyeingProcessing: 45000,
        dyeingProcessingBasis: 'Reactive eco-dyeing & bio-wash finishing @ ₹45/kg',
        labour: 30000,
        labourBasis: 'Airjet loom weaving & stitching',
        overhead: 20000,
        overheadBasis: 'Plant power & inspection line',
        wastage: 11025,
        wastageBasis: '4.5% allowance on fabric & dyeing costs',
        priceRiskBuffer: 15975,
        priceRiskBufferBasis: 'Cotton yarn market volatility hedge',
        otherCosts: 0,
        otherCostsBasis: 'None',
        totalCost: 322000
      },
      quotedAmount: 388000,
      expectedProfit: 66000,
      marginPercent: 17.0,
      aiRecommendation: {
        suggestedPrice: 388000,
        suggestedMargin: 17.0,
        costAssumptions: 'Based on 40s Combed yarn spot rate ₹240/kg + 4.5% dyeing buffer.',
        wastageAssumptions: '4.5% cutting allowance.',
        volatilityConsiderations: 'Raw cotton price surge expected; buffer hedges margin.',
        deliveryFeasibility: 'Shed A has 4 airjet looms ready.',
        financialRisks: 'Low default risk; client maintains prompt settlement.',
        confidenceScore: 94.6
      },
      negotiations: [],
      history: [
        { id: 'hist_1001_1', timestamp: '29 Oct 2026, 09:30 AM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Initial commercial proposal generated.' }
      ]
    },
    {
      id: 'QT-1007',
      clientId: 'CL-001',
      clientName: 'Fashion House',
      orderId: 'LP-901',
      orderTitle: 'Cotton Shirts & Trousers (5,000 pcs)',
      quotationType: 'revised',
      typeLabel: '3.3% Concession Revision',
      linkedQuotationId: 'QT-1001',
      version: 'v2.0',
      status: 'awaiting_client_response',
      createdDate: '29 Oct 2026, 01:15 PM',
      expiryDate: '12 Nov 2026',
      deadlineDate: '05 Nov 2026',
      deliveryDays: 7,
      specs: {
        fabricType: 'Combed Cotton / Twill Blend',
        yarnCount: '40s Combed & 30s Ring Spun',
        gsm: 185,
        weave: 'Oxford & Twill',
        finishing: 'Bio-Washed Silk Finish',
        designCount: 3
      },
      totalQuantity: 5000,
      quantityUnit: 'pieces',
      products: [
        { id: 'LP-901-A2', name: 'Formal Shirt — Design A', designCode: 'FS-A-01', category: 'Formalwear', quantity: 2000, unit: 'pieces', specs: { yarnCount: '40s Combed', gsm: 185, weave: 'Oxford', finishing: 'Bio-Wash' }, unitPrice: 75.0, totalPrice: 150000 },
        { id: 'LP-901-B2', name: 'Formal Pants — Design B', designCode: 'FP-B-02', category: 'Trousers', quantity: 1500, unit: 'pieces', specs: { yarnCount: '30s Ring Spun', gsm: 220, weave: 'Twill', finishing: 'Bio-Enzyme' }, unitPrice: 77.33, totalPrice: 116000 },
        { id: 'LP-901-C2', name: 'Casual Shirt — Design C', designCode: 'CS-C-03', category: 'Casualwear', quantity: 1500, unit: 'pieces', specs: { yarnCount: '40s Combed', gsm: 175, weave: 'Poplin', finishing: 'Softener' }, unitPrice: 72.67, totalPrice: 109000 }
      ],
      costBreakdown: {
        fabricYarn: 198000,
        fabricYarnBasis: 'Yarn volume rebate negotiated at ₹237/kg',
        dyeingProcessing: 45000,
        dyeingProcessingBasis: 'Reactive eco-dyeing & bio-wash finishing',
        labour: 30000,
        labourBasis: 'Standard assembly operations',
        overhead: 19000,
        overheadBasis: 'Optimized batch machine scheduling',
        wastage: 10000,
        wastageBasis: '4.1% allowance',
        priceRiskBuffer: 16000,
        priceRiskBufferBasis: 'Market volatility buffer retained',
        otherCosts: 0,
        otherCostsBasis: 'Standard packing',
        totalCost: 318000
      },
      quotedAmount: 375000,
      expectedProfit: 57000,
      marginPercent: 15.2,
      aiRecommendation: {
        suggestedPrice: 375000,
        suggestedMargin: 15.2,
        costAssumptions: 'Accommodates client 3.3% concession while securing volume.',
        wastageAssumptions: '4.1% cut waste.',
        volatilityConsiderations: 'Protected by ₹16,000 risk buffer.',
        deliveryFeasibility: 'On track for 05 Nov shipment.',
        financialRisks: 'Margin remains compliant with company policy (15.2% ≥ 15.0%).',
        confidenceScore: 92.4
      },
      negotiations: [
        {
          id: 'neg_1',
          date: '29 Oct 2026, 11:00 AM',
          clientRequest: 'Client requested a 3.3% concession to ₹3,75,000 citing bulk seasonal volume commitments.',
          requestedDiscountPercent: 3.3,
          requestedPrice: 375000,
          originalPrice: 388000,
          revisedPrice: 375000,
          adminResponse: 'Admin approved concession. Proposal dispatched to client.',
          status: 'concession_approved'
        }
      ],
      history: [
        { id: 'hist_1007_1', timestamp: '29 Oct 2026, 01:15 PM', actor: 'John Doe (Managing Director)', action: 'APPROVED_AND_SENT', version: 'v2.0', comments: 'Approved 3.3% concession. Dispatched to client via portal.' }
      ],
      approvedBy: 'John Doe (Managing Director)',
      approvedAt: '29 Oct 2026, 01:15 PM',
      dispatchedAt: '29 Oct 2026, 01:20 PM'
    },
    {
      id: 'QT-1010',
      clientId: 'CL-001',
      clientName: 'Fashion House',
      orderId: 'LP-901',
      orderTitle: 'Cotton Shirts & Trousers (5,000 pcs)',
      quotationType: 'alternative',
      typeLabel: 'Alternative: Egyptian Giza Long-Staple',
      linkedQuotationId: 'QT-1001',
      version: 'v1.0',
      status: 'approved',
      createdDate: '29 Oct 2026, 02:45 PM',
      expiryDate: '15 Nov 2026',
      deadlineDate: '08 Nov 2026',
      deliveryDays: 10,
      specs: {
        fabricType: '100% Giza Long-Staple Cotton',
        yarnCount: '60s Giza Combed',
        gsm: 195,
        weave: 'High-Density Satin Twill',
        finishing: 'Liquid Ammonia Silk Sheen',
        designCount: 3
      },
      totalQuantity: 5000,
      quantityUnit: 'pieces',
      products: [
        { id: 'LP-901-ALT1', name: 'Executive Giza Shirt', designCode: 'EGS-01', category: 'Luxury Formal', quantity: 2000, unit: 'pieces', specs: { yarnCount: '60s Giza', gsm: 195, weave: 'Satin Twill', finishing: 'Liquid Ammonia' }, unitPrice: 84.0, totalPrice: 168000 },
        { id: 'LP-901-ALT2', name: 'Executive Giza Trousers', designCode: 'EGT-02', category: 'Luxury Formal', quantity: 1500, unit: 'pieces', specs: { yarnCount: '40s Giza Twill', gsm: 235, weave: 'Twill Weave', finishing: 'Silk Sheen' }, unitPrice: 86.67, totalPrice: 130000 },
        { id: 'LP-901-ALT3', name: 'Executive Casual Shirt', designCode: 'ECS-03', category: 'Luxury Casual', quantity: 1500, unit: 'pieces', specs: { yarnCount: '60s Giza', gsm: 190, weave: 'Poplin', finishing: 'Liquid Ammonia' }, unitPrice: 81.33, totalPrice: 122000 }
      ],
      costBreakdown: {
        fabricYarn: 215000,
        fabricYarnBasis: '60s Giza Long-Staple yarn @ ₹310/kg',
        dyeingProcessing: 52000,
        dyeingProcessingBasis: 'Liquid ammonia mercerization',
        labour: 32000,
        labourBasis: 'Specialized finishing technicians',
        overhead: 18000,
        overheadBasis: 'Premium line allocation',
        wastage: 6000,
        wastageBasis: '2.2% precision cut waste',
        priceRiskBuffer: 7000,
        priceRiskBufferBasis: 'Import duty volatility hedge',
        otherCosts: 0,
        otherCostsBasis: 'None',
        totalCost: 330000
      },
      quotedAmount: 420000,
      expectedProfit: 90000,
      marginPercent: 21.4,
      aiRecommendation: {
        suggestedPrice: 420000,
        suggestedMargin: 21.4,
        costAssumptions: 'Premium alternative package offering high margin luxury fabric upgrade.',
        wastageAssumptions: 'Low wastage on precision Italian finishing line.',
        volatilityConsiderations: 'Giza yarn in factory warehouse stock.',
        deliveryFeasibility: 'Requires 3 extra days for ammonia treatment (08 Nov delivery).',
        financialRisks: 'Extremely healthy margin (21.4%).',
        confidenceScore: 95.8
      },
      negotiations: [],
      history: [
        { id: 'hist_1010_1', timestamp: '29 Oct 2026, 02:45 PM', actor: 'John Doe (Managing Director)', action: 'APPROVED', version: 'v1.0', comments: 'Approved as premium alternative commercial option.' }
      ],
      approvedBy: 'John Doe (Managing Director)',
      approvedAt: '29 Oct 2026, 03:00 PM'
    },

    // ---------------------------------------------------------------------
    // CLIENT CL-001 (Fashion House) · ORDER LP-905
    // ---------------------------------------------------------------------
    {
      id: 'QT-1012',
      clientId: 'CL-001',
      clientName: 'Fashion House',
      orderId: 'LP-905',
      orderTitle: 'Custom Twill Chinos (2,500 pcs)',
      quotationType: 'new',
      typeLabel: 'Initial Commercial Proposal',
      version: 'v1.0',
      status: 'pending_admin_approval',
      createdDate: '29 Oct 2026, 04:10 PM',
      expiryDate: '14 Nov 2026',
      deadlineDate: '25 Nov 2026',
      deliveryDays: 27,
      specs: {
        fabricType: 'Heavyweight Cotton Twill',
        yarnCount: '20s Heavy Ring Spun',
        gsm: 250,
        weave: '3/1 Right Hand Twill',
        finishing: 'Garment Dye & Sand Wash',
        designCount: 2
      },
      totalQuantity: 2500,
      quantityUnit: 'pieces',
      products: [
        { id: 'LP-905-A', name: 'Classic Khaki Chino', designCode: 'CKC-01', category: 'Pants', quantity: 1500, unit: 'pieces', specs: { yarnCount: '20s Heavy Twill', gsm: 250, weave: '3/1 Twill', finishing: 'Sand Wash' }, unitPrice: 112.0, totalPrice: 168000 },
        { id: 'LP-905-B', name: 'Olive Slim Chino', designCode: 'OSC-02', category: 'Pants', quantity: 1000, unit: 'pieces', specs: { yarnCount: '20s Heavy Twill', gsm: 250, weave: '3/1 Twill', finishing: 'Sand Wash' }, unitPrice: 112.0, totalPrice: 112000 }
      ],
      costBreakdown: {
        fabricYarn: 142000,
        fabricYarnBasis: '20s Heavy ring spun cotton yarn @ ₹210/kg',
        dyeingProcessing: 38000,
        dyeingProcessingBasis: 'Garment piece dyeing & sand washing',
        labour: 25000,
        labourBasis: 'Heavy duty bar-tack stitching',
        overhead: 14000,
        overheadBasis: 'Stitching and washer utility',
        wastage: 5000,
        wastageBasis: '2.8% allowance',
        priceRiskBuffer: 4000,
        priceRiskBufferBasis: 'Standard buffer',
        otherCosts: 0,
        otherCostsBasis: 'Standard trims',
        totalCost: 228000
      },
      quotedAmount: 280000,
      expectedProfit: 52000,
      marginPercent: 18.6,
      aiRecommendation: {
        suggestedPrice: 280000,
        suggestedMargin: 18.6,
        costAssumptions: 'Standard chino production run scheduled for mid-November.',
        wastageAssumptions: '2.8% pattern cutting loss.',
        volatilityConsiderations: 'Stable 20s heavy yarn supply.',
        deliveryFeasibility: 'Ample time before 25 Nov delivery date.',
        financialRisks: 'Comfortable 18.6% margin.',
        confidenceScore: 93.5
      },
      negotiations: [],
      history: [
        { id: 'hist_1012_1', timestamp: '29 Oct 2026, 04:10 PM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Initial draft for second seasonal order LP-905.' }
      ]
    },

    // ---------------------------------------------------------------------
    // CLIENT CL-002 (Urban Textiles) · ORDER LP-902
    // ---------------------------------------------------------------------
    {
      id: 'QT-1002',
      clientId: 'CL-002',
      clientName: 'Urban Textiles',
      orderId: 'LP-902',
      orderTitle: 'Urban Poplin Shirts (8,000 pcs)',
      quotationType: 'new',
      typeLabel: 'Initial Proposal (Below Margin Threshold)',
      version: 'v1.0',
      status: 'revision_required',
      createdDate: '28 Oct 2026, 11:15 AM',
      expiryDate: '11 Nov 2026',
      deadlineDate: '06 Nov 2026',
      deliveryDays: 8,
      specs: {
        fabricType: '100% Cotton Poplin',
        yarnCount: '30s Ring Spun',
        gsm: 190,
        weave: 'Poplin & Oxford',
        finishing: 'Mercerized',
        designCount: 2
      },
      totalQuantity: 8000,
      quantityUnit: 'pieces',
      products: [
        { id: 'LP-902-A', name: 'Urban Cotton Oxford Shirt', designCode: 'UCO-01', category: 'Shirts', quantity: 5000, unit: 'pieces', specs: { yarnCount: '30s Ring Spun', gsm: 190, weave: 'Oxford', finishing: 'Mercerized' }, unitPrice: 68.75, totalPrice: 343750 },
        { id: 'LP-902-B', name: 'Urban Poplin Shirt', designCode: 'UPS-02', category: 'Shirts', quantity: 3000, unit: 'pieces', specs: { yarnCount: '30s Ring Spun', gsm: 190, weave: 'Poplin', finishing: 'Pre-Shrunk' }, unitPrice: 68.75, totalPrice: 206250 }
      ],
      costBreakdown: {
        fabricYarn: 310000,
        fabricYarnBasis: '30s Ring Spun cotton @ ₹215/kg',
        dyeingProcessing: 65000,
        dyeingProcessingBasis: 'Continuous pad steam dyeing',
        labour: 45000,
        labourBasis: 'High-speed airjet weaving',
        overhead: 30000,
        overheadBasis: 'Plant power utility',
        wastage: 15000,
        wastageBasis: '4.0% material loss allowance',
        priceRiskBuffer: 15000,
        priceRiskBufferBasis: 'Supplier lead time variance',
        otherCosts: 0,
        otherCostsBasis: 'Standard packing',
        totalCost: 480000
      },
      quotedAmount: 550000,
      expectedProfit: 70000,
      marginPercent: 12.7,
      aiRecommendation: {
        suggestedPrice: 568000,
        suggestedMargin: 15.5,
        costAssumptions: 'Client insisted on ₹5,50,000 cap yielding 12.7% margin.',
        wastageAssumptions: '4.0% wastage.',
        volatilityConsiderations: 'Dye chemical price surge (+4.5%) increases chemical costs.',
        deliveryFeasibility: 'Tight 06 Nov timeline due to yarn shortage.',
        financialRisks: 'Margin 12.7% fails mandatory 15% threshold policy.',
        confidenceScore: 89.2
      },
      negotiations: [],
      history: [
        { id: 'hist_1002_1', timestamp: '28 Oct 2026, 11:15 AM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Draft prepared with client requested cap.' },
        { id: 'hist_1002_2', timestamp: '28 Oct 2026, 03:40 PM', actor: 'John Doe (Managing Director)', action: 'REVISION_REQUESTED', version: 'v1.0', comments: 'Profit margin 12.7% is below the mandatory 15.0% threshold.' }
      ]
    },
    {
      id: 'QT-1008',
      clientId: 'CL-002',
      clientName: 'Urban Textiles',
      orderId: 'LP-902',
      orderTitle: 'Urban Poplin Shirts (8,000 pcs)',
      quotationType: 'revised',
      typeLabel: 'Recalibrated Revision (15.5% Margin)',
      linkedQuotationId: 'QT-1002',
      version: 'v2.0',
      status: 'pending_admin_approval',
      createdDate: '29 Oct 2026, 10:15 AM',
      expiryDate: '12 Nov 2026',
      deadlineDate: '06 Nov 2026',
      deliveryDays: 8,
      specs: {
        fabricType: '100% Cotton Poplin',
        yarnCount: '30s Ring Spun',
        gsm: 190,
        weave: 'Poplin & Oxford',
        finishing: 'Mercerized',
        designCount: 2
      },
      totalQuantity: 8000,
      quantityUnit: 'pieces',
      products: [
        { id: 'LP-902-A2', name: 'Urban Cotton Oxford Shirt', designCode: 'UCO-01', category: 'Shirts', quantity: 5000, unit: 'pieces', specs: { yarnCount: '30s Ring Spun', gsm: 190, weave: 'Oxford', finishing: 'Mercerized' }, unitPrice: 71.0, totalPrice: 355000 },
        { id: 'LP-902-B2', name: 'Urban Poplin Shirt', designCode: 'UPS-02', category: 'Shirts', quantity: 3000, unit: 'pieces', specs: { yarnCount: '30s Ring Spun', gsm: 190, weave: 'Poplin', finishing: 'Pre-Shrunk' }, unitPrice: 71.0, totalPrice: 213000 }
      ],
      costBreakdown: {
        fabricYarn: 310000,
        fabricYarnBasis: '30s Ring Spun cotton @ ₹215/kg',
        dyeingProcessing: 65000,
        dyeingProcessingBasis: 'Continuous pad steam dyeing',
        labour: 45000,
        labourBasis: 'High-speed airjet weaving',
        overhead: 30000,
        overheadBasis: 'Plant power utility',
        wastage: 15000,
        wastageBasis: '4.0% material loss allowance',
        priceRiskBuffer: 15000,
        priceRiskBufferBasis: 'Supplier lead time variance',
        otherCosts: 0,
        otherCostsBasis: 'Standard packing',
        totalCost: 480000
      },
      quotedAmount: 568000,
      expectedProfit: 88000,
      marginPercent: 15.5,
      aiRecommendation: {
        suggestedPrice: 568000,
        suggestedMargin: 15.5,
        costAssumptions: 'Price adjusted to ₹5,68,000 ensuring 15.5% gross margin.',
        wastageAssumptions: '4.0% wastage retained.',
        volatilityConsiderations: 'Protected against raw greige market spike.',
        deliveryFeasibility: 'Weaving paced to complete by 06 Nov.',
        financialRisks: 'Fully compliant with company policy (15.5% ≥ 15.0%).',
        confidenceScore: 94.0
      },
      negotiations: [],
      history: [
        { id: 'hist_1008_1', timestamp: '29 Oct 2026, 10:15 AM', actor: 'Quotation Agent v2.4', action: 'REVISED_DRAFT_SUBMITTED', version: 'v2.0', comments: 'Recalibrated selling price to ₹5,68,000 to meet 15% threshold policy.' }
      ]
    },

    // ---------------------------------------------------------------------
    // CLIENT CL-003 (Style World) · ORDER LP-903
    // ---------------------------------------------------------------------
    {
      id: 'QT-1003',
      clientId: 'CL-003',
      clientName: 'Style World',
      orderId: 'LP-903',
      orderTitle: 'Printed Bedsheet Sets (3,500 sets)',
      quotationType: 'new',
      typeLabel: 'Commercial Proposal: Satin Weave 210 GSM',
      version: 'v1.0',
      status: 'client_accepted',
      createdDate: '27 Oct 2026, 02:40 PM',
      expiryDate: '10 Nov 2026',
      deadlineDate: '12 Nov 2026',
      deliveryDays: 14,
      specs: {
        fabricType: '100% Combed Compact Cotton',
        yarnCount: '60s Combed Compact',
        gsm: 210,
        weave: 'Satin Weave',
        finishing: 'Peach Soft Brush Finish',
        designCount: 2
      },
      totalQuantity: 3500,
      quantityUnit: 'sets',
      products: [
        { id: 'LP-903-A', name: 'King Size Bedsheet Set', designCode: 'BS-K-01', category: 'Bedding', quantity: 2000, unit: 'sets', specs: { yarnCount: '60s Combed', gsm: 210, weave: 'Satin', finishing: 'Peach Soft' }, unitPrice: 90.0, totalPrice: 180000 },
        { id: 'LP-903-B', name: 'Queen Size Bedsheet Set', designCode: 'BS-Q-02', category: 'Bedding', quantity: 1500, unit: 'sets', specs: { yarnCount: '60s Combed', gsm: 210, weave: 'Satin', finishing: 'Peach Soft' }, unitPrice: 86.67, totalPrice: 130000 }
      ],
      costBreakdown: {
        fabricYarn: 155000,
        fabricYarnBasis: '60s Combed compact cotton yarn, 750 kg',
        dyeingProcessing: 38000,
        dyeingProcessingBasis: 'Rotary screen pigment printing',
        labour: 24000,
        labourBasis: 'Wide-width rapier loom weaving',
        overhead: 14000,
        overheadBasis: 'Wide-width loom floor charges',
        wastage: 7000,
        wastageBasis: '3.6% scrap allowance',
        priceRiskBuffer: 7000,
        priceRiskBufferBasis: 'Volume purchase hedge on premium yarn',
        otherCosts: 0,
        otherCostsBasis: 'Standard packaging included',
        totalCost: 245000
      },
      quotedAmount: 310000,
      expectedProfit: 65000,
      marginPercent: 21.0,
      aiRecommendation: {
        suggestedPrice: 310000,
        suggestedMargin: 21.0,
        costAssumptions: 'Rotary screen printing chemical costs factored with volume rebate.',
        wastageAssumptions: '3.6% fabric waste based on wide width cutting.',
        volatilityConsiderations: 'Compact yarn price stable; inventory reserved.',
        deliveryFeasibility: 'Comfortable 12 Nov deadline.',
        financialRisks: 'Minimal risk; client accepted terms.',
        confidenceScore: 96.5
      },
      negotiations: [],
      history: [
        { id: 'hist_1003_1', timestamp: '27 Oct 2026, 02:40 PM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Initial proposal created.' },
        { id: 'hist_1003_2', timestamp: '29 Oct 2026, 04:30 PM', actor: 'John Doe (Managing Director)', action: 'APPROVED_AND_SENT', version: 'v1.0', comments: 'Approved with 21.0% margin. Sent to client portal.' },
        { id: 'hist_1003_3', timestamp: '30 Oct 2026, 10:15 AM', actor: 'Client: Style World', action: 'CLIENT_ACCEPTED', version: 'v1.0', comments: 'Client accepted commercial terms via portal.' }
      ],
      approvedBy: 'John Doe (Managing Director)',
      approvedAt: '29 Oct 2026, 04:30 PM',
      dispatchedAt: '29 Oct 2026, 04:35 PM'
    },
    {
      id: 'QT-1009',
      clientId: 'CL-003',
      clientName: 'Style World',
      orderId: 'LP-903',
      orderTitle: 'Printed Bedsheet Sets (3,500 sets)',
      quotationType: 'alternative',
      typeLabel: 'Alternative: 300TC Crisp Percale Weave',
      linkedQuotationId: 'QT-1003',
      version: 'v1.0',
      status: 'approved',
      createdDate: '28 Oct 2026, 09:00 AM',
      expiryDate: '12 Nov 2026',
      deadlineDate: '14 Nov 2026',
      deliveryDays: 16,
      specs: {
        fabricType: '100% Organic Percale Cotton',
        yarnCount: '80s Organic Combed',
        gsm: 230,
        weave: '300TC Crisp Percale Weave',
        finishing: 'Zero-Formaldehyde Crisp Finish',
        designCount: 2
      },
      totalQuantity: 3500,
      quantityUnit: 'sets',
      products: [
        { id: 'LP-903-ALT1', name: 'Percale King Size Set', designCode: 'PKS-01', category: 'Bedding', quantity: 2000, unit: 'sets', specs: { yarnCount: '80s Organic', gsm: 230, weave: 'Percale', finishing: 'Crisp' }, unitPrice: 98.0, totalPrice: 196000 },
        { id: 'LP-903-ALT2', name: 'Percale Queen Size Set', designCode: 'PQS-02', category: 'Bedding', quantity: 1500, unit: 'sets', specs: { yarnCount: '80s Organic', gsm: 230, weave: 'Percale', finishing: 'Crisp' }, unitPrice: 96.0, totalPrice: 144000 }
      ],
      costBreakdown: {
        fabricYarn: 168000,
        fabricYarnBasis: '80s Organic Combed compact yarn',
        dyeingProcessing: 42000,
        dyeingProcessingBasis: 'Eco-certified reactive dyeing',
        labour: 26000,
        labourBasis: 'Precision hemming',
        overhead: 15000,
        overheadBasis: 'Organic certification line overhead',
        wastage: 6000,
        wastageBasis: '2.5% cut waste',
        priceRiskBuffer: 6500,
        priceRiskBufferBasis: 'Organic cotton stock buffer',
        otherCosts: 0,
        otherCostsBasis: 'None',
        totalCost: 263500
      },
      quotedAmount: 340000,
      expectedProfit: 76500,
      marginPercent: 22.5,
      aiRecommendation: {
        suggestedPrice: 340000,
        suggestedMargin: 22.5,
        costAssumptions: 'High density 300TC percale package.',
        wastageAssumptions: 'Low wastage.',
        volatilityConsiderations: 'Organic yarn booked.',
        deliveryFeasibility: '14 Nov achievable.',
        financialRisks: 'Exceptional 22.5% margin.',
        confidenceScore: 95.0
      },
      negotiations: [],
      history: [
        { id: 'hist_1009_1', timestamp: '28 Oct 2026, 09:00 AM', actor: 'John Doe (Managing Director)', action: 'APPROVED', version: 'v1.0', comments: 'Approved as alternative organic percale option.' }
      ],
      approvedBy: 'John Doe (Managing Director)',
      approvedAt: '28 Oct 2026, 09:30 AM'
    },

    // ---------------------------------------------------------------------
    // CLIENT CL-004 (Home Living) · ORDER LP-904
    // ---------------------------------------------------------------------
    {
      id: 'QT-1004',
      clientId: 'CL-004',
      clientName: 'Home Living',
      orderId: 'LP-904',
      orderTitle: 'Living Room Curtains (1,200 pairs)',
      quotationType: 'new',
      typeLabel: 'Commercial Proposal: Jacquard & Sheer',
      version: 'v1.0',
      status: 'pending_admin_approval',
      createdDate: '29 Oct 2026, 03:20 PM',
      expiryDate: '12 Nov 2026',
      deadlineDate: '20 Nov 2026',
      deliveryDays: 21,
      specs: {
        fabricType: 'Poly-Cotton Jacquard & Voile',
        yarnCount: '20s/30s Poly-Cotton',
        gsm: 260,
        weave: 'Jacquard Damask & Plain',
        finishing: 'Flame Retardant Chemical Finish',
        designCount: 2
      },
      totalQuantity: 1200,
      quantityUnit: 'pairs',
      products: [
        { id: 'LP-904-A', name: 'Jacquard Drapes (Gold Damask)', designCode: 'JD-GD-01', category: 'Curtains', quantity: 600, unit: 'pairs', specs: { yarnCount: '20s Poly-Cotton', gsm: 260, weave: 'Jacquard', finishing: 'Flame Retardant' }, unitPrice: 120.83, totalPrice: 72500 },
        { id: 'LP-904-B', name: 'Sheer Voile Panels', designCode: 'SVP-02', category: 'Curtains', quantity: 600, unit: 'pairs', specs: { yarnCount: '30s Poly-Cotton', gsm: 140, weave: 'Plain', finishing: 'Soft Finish' }, unitPrice: 120.83, totalPrice: 72500 }
      ],
      costBreakdown: {
        fabricYarn: 72000,
        fabricYarnBasis: '20s/30s Poly-Cotton blend, 580 kg',
        dyeingProcessing: 18000,
        dyeingProcessingBasis: 'Flame retardant formulation & dyeing',
        labour: 12000,
        labourBasis: 'Electronic Jacquard weaving & eyelet stitching',
        overhead: 7000,
        overheadBasis: 'Jacquard punch card programming & power',
        wastage: 3000,
        wastageBasis: '3.3% pattern matching scrap allowance',
        priceRiskBuffer: 3000,
        priceRiskBufferBasis: 'Polyester raw material index buffer',
        otherCosts: 0,
        otherCostsBasis: 'None',
        totalCost: 115000
      },
      quotedAmount: 145000,
      expectedProfit: 30000,
      marginPercent: 20.7,
      aiRecommendation: {
        suggestedPrice: 145000,
        suggestedMargin: 20.7,
        costAssumptions: 'Jacquard card design setup amortized across run.',
        wastageAssumptions: '3.3% cut waste due to pattern repeat.',
        volatilityConsiderations: 'Flame retardant chemical in stock.',
        deliveryFeasibility: 'Shed 3 has immediate open slot starting 01 Nov.',
        financialRisks: 'Low risk; healthy 20.7% margin.',
        confidenceScore: 92.1
      },
      negotiations: [],
      history: [
        { id: 'hist_1004_1', timestamp: '29 Oct 2026, 03:20 PM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Initial draft prepared with FR chemical certification fee included.' }
      ]
    },

    // ---------------------------------------------------------------------
    // CLIENT CL-005 (StyleMart) · ORDER TX-1025
    // ---------------------------------------------------------------------
    {
      id: 'QT-1005',
      clientId: 'CL-005',
      clientName: 'StyleMart',
      orderId: 'TX-1025',
      orderTitle: 'Screen Printed Cotton Yardage (3,000 m)',
      quotationType: 'new',
      typeLabel: 'Initial Proposal (Discount Cap Enforced)',
      version: 'v1.0',
      status: 'rejected',
      createdDate: '26 Oct 2026, 10:00 AM',
      expiryDate: '09 Nov 2026',
      deadlineDate: '18 Nov 2026',
      deliveryDays: 20,
      specs: {
        fabricType: 'Screen Printed Cotton',
        yarnCount: '30s Combed',
        gsm: 160,
        weave: 'Plain Weave',
        finishing: 'Screen Printed Pigment',
        designCount: 1
      },
      totalQuantity: 3000,
      quantityUnit: 'metres',
      products: [
        { id: 'TX-1025-A', name: 'Screen Printed Cotton Yardage', designCode: 'SPC-01', category: 'Fabrics', quantity: 3000, unit: 'metres', specs: { yarnCount: '30s Combed', gsm: 160, weave: 'Plain', finishing: 'Screen Printed' }, unitPrice: 65.0, totalPrice: 195000 }
      ],
      costBreakdown: {
        fabricYarn: 112000,
        fabricYarnBasis: '30s Combed greige fabric procurement @ ₹120/m base',
        dyeingProcessing: 28000,
        dyeingProcessingBasis: 'Screen pigment printing with 3-colour separation',
        labour: 18000,
        labourBasis: 'Airjet weaving & print technician charges',
        overhead: 10000,
        overheadBasis: 'Stenter curing heat & fixed plant utilities',
        wastage: 3500,
        wastageBasis: '2.5% printing edge trimming loss',
        priceRiskBuffer: 3500,
        priceRiskBufferBasis: 'Pigment chemical surcharge buffer',
        otherCosts: 0,
        otherCostsBasis: 'Roll packing',
        totalCost: 175000
      },
      quotedAmount: 195000,
      expectedProfit: 20000,
      marginPercent: 10.3,
      aiRecommendation: {
        suggestedPrice: 208000,
        suggestedMargin: 15.8,
        costAssumptions: 'Client demanded 5% discount below feasible cost.',
        wastageAssumptions: '2.5% edge waste.',
        volatilityConsiderations: 'Screen chemicals up +8.4%; leaves zero cushion.',
        deliveryFeasibility: 'Shed capacity available but unviable at ₹1,95,000.',
        financialRisks: '10.3% margin violates corporate 15% minimum policy.',
        confidenceScore: 84.0
      },
      negotiations: [],
      history: [
        { id: 'hist_1005_1', timestamp: '26 Oct 2026, 10:00 AM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Draft created matching client cap.' },
        { id: 'hist_1005_2', timestamp: '28 Oct 2026, 05:00 PM', actor: 'John Doe (Managing Director)', action: 'REJECTED', version: 'v1.0', comments: 'Rejected by MD. 10.3% margin fails company 15% threshold.' }
      ],
      rejectedBy: 'John Doe (Managing Director)',
      rejectedAt: '28 Oct 2026, 05:00 PM',
      rejectionReason: 'Client requested 5% discount which drops gross margin to 10.3%, below our 15% factory threshold.'
    },
    {
      id: 'QT-1011',
      clientId: 'CL-005',
      clientName: 'StyleMart',
      orderId: 'TX-1025',
      orderTitle: 'Screen Printed Cotton Yardage (5,000 m Bulk)',
      quotationType: 'revised',
      typeLabel: 'Bulk Batch Revision (5,000 m @ ₹65/m)',
      linkedQuotationId: 'QT-1005',
      version: 'v2.0',
      status: 'pending_admin_approval',
      createdDate: '29 Oct 2026, 03:00 PM',
      expiryDate: '12 Nov 2026',
      deadlineDate: '22 Nov 2026',
      deliveryDays: 24,
      specs: {
        fabricType: 'Screen Printed Cotton',
        yarnCount: '30s Combed',
        gsm: 160,
        weave: 'Plain Weave',
        finishing: 'Screen Printed Pigment',
        designCount: 1
      },
      totalQuantity: 5000,
      quantityUnit: 'metres',
      products: [
        { id: 'TX-1025-B', name: 'Screen Printed Cotton Yardage (Bulk)', designCode: 'SPC-01-BULK', category: 'Fabrics', quantity: 5000, unit: 'metres', specs: { yarnCount: '30s Combed', gsm: 160, weave: 'Plain', finishing: 'Screen Printed' }, unitPrice: 65.0, totalPrice: 325000 }
      ],
      costBreakdown: {
        fabricYarn: 180000,
        fabricYarnBasis: 'Bulk greige fabric discount secured at ₹112/m',
        dyeingProcessing: 42000,
        dyeingProcessingBasis: 'Long-run continuous pigment printing economy of scale',
        labour: 26000,
        labourBasis: 'Continuous loom run labour',
        overhead: 14000,
        overheadBasis: 'Fixed stenter setup amortized over 5,000 m',
        wastage: 6500,
        wastageBasis: '2.0% printing waste',
        priceRiskBuffer: 6500,
        priceRiskBufferBasis: 'Chemical index buffer',
        otherCosts: 0,
        otherCostsBasis: 'Roll packing',
        totalCost: 275000
      },
      quotedAmount: 325000,
      expectedProfit: 50000,
      marginPercent: 15.4,
      aiRecommendation: {
        suggestedPrice: 325000,
        suggestedMargin: 15.4,
        costAssumptions: 'Scaled volume to 5,000 metres enables honoring client ₹65/m target while reaching 15.4% margin.',
        wastageAssumptions: '2.0% waste.',
        volatilityConsiderations: 'Backed by greige supplier volume contract.',
        deliveryFeasibility: 'Extended timeline to 22 Nov allows continuous run.',
        financialRisks: 'Margin meets policy requirement (15.4% ≥ 15.0%).',
        confidenceScore: 93.8
      },
      negotiations: [],
      history: [
        { id: 'hist_1011_1', timestamp: '29 Oct 2026, 03:00 PM', actor: 'Quotation Agent v2.4', action: 'BULK_COUNTER_PROPOSAL_CREATED', version: 'v2.0', comments: 'Prepared bulk batch counter-proposal at 5,000 m to satisfy 15.4% margin.' }
      ]
    },

    // ---------------------------------------------------------------------
    // CLIENT CL-006 (HomeNest) · ORDER TX-1026
    // ---------------------------------------------------------------------
    {
      id: 'QT-1006',
      clientId: 'CL-006',
      clientName: 'HomeNest',
      orderId: 'TX-1026',
      orderTitle: 'Tailored Linen Trousers (2,000 pcs)',
      quotationType: 'new',
      typeLabel: 'Final Commercial Agreement (Signed Contract)',
      version: 'v1.0',
      status: 'finalized',
      createdDate: '25 Oct 2026, 04:00 PM',
      expiryDate: '08 Nov 2026',
      deadlineDate: '20 Nov 2026',
      deliveryDays: 26,
      specs: {
        fabricType: 'Linen / Cotton Blend',
        yarnCount: '25s Linen Blend',
        gsm: 220,
        weave: 'Twill Weave',
        finishing: 'Pre-Shrunk Bio-Enzyme Wash',
        designCount: 1
      },
      totalQuantity: 2000,
      quantityUnit: 'pieces',
      products: [
        { id: 'TX-1026-A', name: 'Tailored Linen Trousers', designCode: 'TLT-01', category: 'Apparel', quantity: 2000, unit: 'pieces', specs: { yarnCount: '25s Linen Blend', gsm: 220, weave: 'Twill', finishing: 'Pre-Shrunk' }, unitPrice: 195.0, totalPrice: 390000 }
      ],
      costBreakdown: {
        fabricYarn: 205000,
        fabricYarnBasis: '25s Linen/Cotton blend yarn, 880 kg imported flax',
        dyeingProcessing: 48000,
        dyeingProcessingBasis: 'Bio-enzyme garment washing & tumble drying',
        labour: 32000,
        labourBasis: 'Precision trouser stitching, waistband & pocketing',
        overhead: 18000,
        overheadBasis: 'Stitching unit power and quality assurance line',
        wastage: 6000,
        wastageBasis: '2.4% pattern layout and cutting waste',
        priceRiskBuffer: 6000,
        priceRiskBufferBasis: 'Flax customs clearance rate buffer',
        otherCosts: 0,
        otherCostsBasis: 'Individual polybag garment packaging',
        totalCost: 315000
      },
      quotedAmount: 390000,
      expectedProfit: 75000,
      marginPercent: 19.2,
      aiRecommendation: {
        suggestedPrice: 390000,
        suggestedMargin: 19.2,
        costAssumptions: 'Imported flax yarn batch verified at fixed currency rate.',
        wastageAssumptions: '2.4% automated Gerber cutter waste.',
        volatilityConsiderations: 'Raw inventory locked in port warehouse.',
        deliveryFeasibility: 'Assembly lines ready.',
        financialRisks: 'Contract finalized; client deposit confirmed.',
        confidenceScore: 97.2
      },
      negotiations: [],
      history: [
        { id: 'hist_1006_1', timestamp: '25 Oct 2026, 04:00 PM', actor: 'Quotation Agent v2.4', action: 'DRAFT_CREATED', version: 'v1.0', comments: 'Initial automated draft prepared.' },
        { id: 'hist_1006_2', timestamp: '28 Oct 2026, 02:15 PM', actor: 'John Doe (Managing Director)', action: 'APPROVED_AND_SENT', version: 'v1.0', comments: 'Approved with 19.2% profit margin. Dispatched to HomeNest portal.' },
        { id: 'hist_1006_3', timestamp: '28 Oct 2026, 03:00 PM', actor: 'Client: HomeNest', action: 'CLIENT_ACCEPTED', version: 'v1.0', comments: 'Client signed and accepted proposal via digital agreement.' },
        { id: 'hist_1006_4', timestamp: '28 Oct 2026, 03:15 PM', actor: 'John Doe (Managing Director)', action: 'FINALIZED', version: 'v1.0', comments: 'Commercial agreement finalized. Order TX-1026 entered active manufacturing.' }
      ],
      approvedBy: 'John Doe (Managing Director)',
      approvedAt: '28 Oct 2026, 02:15 PM',
      dispatchedAt: '28 Oct 2026, 02:30 PM',
      finalizedAt: '28 Oct 2026, 03:15 PM'
    }
  ]);

  // Selected Client
  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  // All Quotations related to the Selected Client
  const clientQuotations = useMemo(() => {
    return quotations.filter((q) => q.clientId === selectedClient.id);
  }, [quotations, selectedClient.id]);

  // Filtered Quotations for table display (based on tab and search query)
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
  const handleAdminApprove = (quoteId: string) => {
    const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setQuotations((prev) =>
      prev.map((q) => {
        if (q.id === quoteId) {
          const fin = calculateQuotationFinancials(q);
          return {
            ...q,
            status: 'approved',
            approvedBy: 'John Doe (Managing Director)',
            approvedAt: timestamp,
            history: [
              ...q.history,
              { id: `hist_${Date.now()}`, timestamp, actor: 'John Doe (Managing Director)', action: 'APPROVED_BY_ADMIN', version: q.version, comments: `Admin approved with ${fin.marginPercent}% margin.` }
            ]
          };
        }
        return q;
      })
    );
    const target = quotations.find((q) => q.id === quoteId);
    if (target) {
      onApproveQuotation(target.orderId, calculateQuotationFinancials(target).marginPercent);
    }
    showToast(`Quotation ${quoteId} APPROVED by Admin. Client dispatch unlocked!`);
  };

  const handleSendToClient = (quoteId: string) => {
    const target = quotations.find((q) => q.id === quoteId);
    if (!target) return;
    if (target.status !== 'approved') {
      alert('Only an Admin-approved quotation can be sent to clients.');
      return;
    }
    const timestamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setQuotations((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: 'awaiting_client_response', dispatchedAt: timestamp } : q))
    );
    showToast(`Quotation ${quoteId} successfully dispatched to ${target.clientName}!`);
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

  const handleConfirmReject = () => {
    if (!activeQuotationId || !rejectionReasonInput.trim()) return;
    setQuotations((prev) =>
      prev.map((q) => (q.id === activeQuotationId ? { ...q, status: 'rejected', rejectionReason: rejectionReasonInput.trim() } : q))
    );
    const target = quotations.find((q) => q.id === activeQuotationId);
    if (target) {
      onRejectQuotation(target.orderId, rejectionReasonInput.trim());
    }
    setShowRejectModal(false);
    setRejectionReasonInput('');
    showToast(`Quotation ${activeQuotationId} REJECTED.`);
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

                {activeQuotation.status !== 'approved' && activeQuotation.status !== 'client_accepted' && activeQuotation.status !== 'finalized' && (
                  <button
                    onClick={() => handleAdminApprove(activeQuotation.id)}
                    style={{ background: '#79B4B7', color: '#ffffff', border: 'none', borderRadius: 9999, padding: '6px 16px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Approve Quotation
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

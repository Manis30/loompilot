import React, { useState, useMemo } from 'react';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  Layers,
  X,
  Search,
  ShieldAlert,
  Sparkles,
  Plus,
  Check,
  ClipboardCheck,
  History,
  ArrowRight,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Filter
} from 'lucide-react';
import type { MaterialRequirement, Order } from '../../types';

// =========================================================================
// DATA MODELS & TYPES
// =========================================================================

export type MaterialCategory = 'yarn' | 'fabric' | 'dye' | 'trims' | 'chemicals';
export type MaterialUnit = 'kg' | 'm' | 'pcs' | 'L';

export interface InventoryMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  physicalStock: number;       // Actual physical inventory in mill warehouse
  reservedStock: number;       // Total quantity locked/reserved across committed orders
  unitCost: number;            // Current stock valuation rate in INR
  reorderPoint: number;        // Minimum buffer before shortage warning
  storageLocation: string;     // Mill warehouse bin/aisle
  marketPriceChangePercent?: number; // e.g. +14.2% from Market Price Agent
}

export interface OrderAllocationItem {
  id: string;
  orderId: string;
  clientName: string;
  productName: string;
  materialId: string;
  requiredQuantity: number;
  allocatedQuantity: number;
  unit: MaterialUnit;
  requiredByDate: string;
  status: 'Allocated' | 'Partial Allocation' | 'Shortage' | 'PO Pending';
}

export interface SupplierOffer {
  id: string;
  supplierName: string;
  location: string;
  materialId: string;
  materialName: string;
  unit: MaterialUnit;
  unitPrice: number;
  availableCapacity: number;
  moq: number;
  leadTimeDays: number;
  expectedDeliveryDate: string;
  transportCost: number;
  otherCharges: number;
  qualityRating: number;         // out of 5.0
  qualityHistory: string;        // e.g. '98.5% first-pass yield'
  deliveryPerformance: string;   // e.g. '96% on-time delivery'
  paymentTerms: string;          // e.g. 'Net 30 Days'
  aiRecommendation?: string;     // AI evaluation reason
  isAiRecommended?: boolean;
}

export interface PurchaseOrderItem {
  materialId: string;
  materialName: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  totalItemCost: number;
}

export type PurchaseOrderStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Ordered'
  | 'Partially Received'
  | 'Fully Received'
  | 'Quality Inspection'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export interface PurchaseOrderRecord {
  poNo: string;
  supplierId: string;
  supplierName: string;
  relatedOrderIds: string[];
  items: PurchaseOrderItem[];
  transportCost: number;
  otherCharges: number;
  totalAmount: number;
  orderDate: string;
  expectedDelivery: string;
  status: PurchaseOrderStatus;
  purchaseJustification: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  history: {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    notes: string;
  }[];
}

export interface MaterialReceiptRecord {
  receiptId: string;
  poNo: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  unit: MaterialUnit;
  orderedQuantity: number;
  inwardQuantity: number;
  acceptedQuantity: number;  // ONLY this quantity increases usable physical inventory!
  rejectedQuantity: number;  // Excluded from usable physical inventory
  damagedQuantity: number;
  receivedDate: string;
  batchLotNo: string;
  inspectionResult: 'Passed Full' | 'Passed with Concession' | 'Failed QC';
  inspectionNotes: string;
  inspectorName: string;
}

export interface InventoryTransaction {
  id: string;
  materialId: string;
  materialName: string;
  transactionType:
    | 'Initial Stock'
    | 'Purchase Receipt'
    | 'Material Allocation'
    | 'Material Consumption'
    | 'Stock Adjustment'
    | 'Supplier Return'
    | 'Damaged Stock';
  quantityChange: number;
  unit: MaterialUnit;
  balanceAfter: number;
  relatedRef: string;
  timestamp: string;
  userResponsible: string;
  remarks: string;
}

export interface ProcurementAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type:
    | 'critical_shortage'
    | 'low_stock'
    | 'supplier_delay'
    | 'po_pending_approval'
    | 'qc_inward_pending'
    | 'price_surge';
  materialName: string;
  affectedOrderId?: string;
  issue: string;
  quantityAffected?: string;
  requiredByDate?: string;
  recommendedAction: string;
  actionPayload?: {
    materialId?: string;
    poNo?: string;
    orderId?: string;
  };
}

// =========================================================================
// INITIAL MOCK MASTER DATA
// =========================================================================

const INITIAL_INVENTORY_MATERIALS: InventoryMaterial[] = [
  {
    id: 'mat_cotton_40s',
    name: '40s Combed Cotton Yarn',
    category: 'yarn',
    unit: 'kg',
    physicalStock: 2000,
    reservedStock: 1500, // 800 kg (LP-901) + 700 kg (LP-902). Free = 500 kg. Shortage = 400 kg for LP-903!
    unitCost: 240,
    reorderPoint: 600,
    storageLocation: 'Warehouse Bay Y-02, Rack 4',
    marketPriceChangePercent: 4.5
  },
  {
    id: 'mat_cotton_fabric',
    name: 'Cotton Poplin Fabric (58" / 185 GSM)',
    category: 'fabric',
    unit: 'm',
    physicalStock: 1400,
    reservedStock: 1400, // All reserved for TX-1024. Free = 0 m! Shortage = 600 m
    unitCost: 120,
    reorderPoint: 1000,
    storageLocation: 'Warehouse Bay F-01, Rolls 12-24',
    marketPriceChangePercent: 14.2
  },
  {
    id: 'mat_dye_reactive',
    name: 'Reactive Dyes (Navy / Royal Blue)',
    category: 'dye',
    unit: 'kg',
    physicalStock: 300,
    reservedStock: 300, // Free = 0. Shortage = 50 kg for TX-1025
    unitCost: 180,
    reorderPoint: 150,
    storageLocation: 'Chemical Storage Shed C-03',
    marketPriceChangePercent: 8.4
  },
  {
    id: 'mat_buttons_horn',
    name: 'Natural Horn Buttons (24L / 4-Hole)',
    category: 'trims',
    unit: 'pcs',
    physicalStock: 6200,
    reservedStock: 5000, // Free = 1,200 pcs
    unitCost: 1.5,
    reorderPoint: 2000,
    storageLocation: 'Trims Mezzanine Box T-88'
  },
  {
    id: 'mat_giza_yarn',
    name: '100% Giza Long-Staple Cotton Yarn',
    category: 'yarn',
    unit: 'kg',
    physicalStock: 950,
    reservedStock: 600, // Free = 350 kg
    unitCost: 380,
    reorderPoint: 300,
    storageLocation: 'Warehouse Bay Y-05 (Climate Controlled)'
  },
  {
    id: 'mat_polyester_twill',
    name: 'Polyester Twill Suiting Fabric (60")',
    category: 'fabric',
    unit: 'm',
    physicalStock: 2800,
    reservedStock: 1200, // Free = 1,600 m
    unitCost: 165,
    reorderPoint: 800,
    storageLocation: 'Warehouse Bay F-04'
  },
  {
    id: 'mat_lycra_yarn',
    name: '70D Lycra Spandex Core Yarn',
    category: 'yarn',
    unit: 'kg',
    physicalStock: 450,
    reservedStock: 250, // Free = 200 kg
    unitCost: 410,
    reorderPoint: 150,
    storageLocation: 'Warehouse Bay Y-08'
  },
  {
    id: 'mat_zippers_nylon',
    name: 'YKK Nylon Concealed Zippers (18cm)',
    category: 'trims',
    unit: 'pcs',
    physicalStock: 4200,
    reservedStock: 1500, // Free = 2,700 pcs
    unitCost: 6.8,
    reorderPoint: 1000,
    storageLocation: 'Trims Mezzanine Box Z-14'
  },
  {
    id: 'mat_finishing_softener',
    name: 'Hydrophilic Silicone Softener Finish',
    category: 'chemicals',
    unit: 'L',
    physicalStock: 850,
    reservedStock: 400, // Free = 450 L
    unitCost: 95,
    reorderPoint: 300,
    storageLocation: 'Chemical Storage Drum D-12'
  },
  {
    id: 'mat_viscose_yarn',
    name: '30s Modal Viscose Staple Yarn',
    category: 'yarn',
    unit: 'kg',
    physicalStock: 1100,
    reservedStock: 300, // Free = 800 kg
    unitCost: 260,
    reorderPoint: 400,
    storageLocation: 'Warehouse Bay Y-09'
  }
];

const INITIAL_ORDER_ALLOCATIONS: OrderAllocationItem[] = [
  {
    id: 'omr_101',
    orderId: 'LP-901',
    clientName: 'Fashion House',
    productName: 'Cotton Shirts & Trousers (5,000 pcs)',
    materialId: 'mat_cotton_40s',
    requiredQuantity: 800,
    allocatedQuantity: 800,
    unit: 'kg',
    requiredByDate: '04 Nov 2026',
    status: 'Allocated'
  },
  {
    id: 'omr_102',
    orderId: 'LP-902',
    clientName: 'Urban Textiles',
    productName: 'Cotton Shirts (8,000 pcs)',
    materialId: 'mat_cotton_40s',
    requiredQuantity: 700,
    allocatedQuantity: 700,
    unit: 'kg',
    requiredByDate: '06 Nov 2026',
    status: 'Allocated'
  },
  {
    id: 'omr_103',
    orderId: 'LP-903',
    clientName: 'Style World',
    productName: 'Bedsheets (3,500 pcs)',
    materialId: 'mat_cotton_40s',
    requiredQuantity: 900,
    allocatedQuantity: 500, // Physical = 2000, Reserved = 1500, Free = 500. Shortage = 400 kg!
    unit: 'kg',
    requiredByDate: '12 Nov 2026',
    status: 'Shortage'
  },
  {
    id: 'omr_104',
    orderId: 'TX-1024',
    clientName: 'ABC Garments',
    productName: 'Cotton Shirts (5,000 pcs)',
    materialId: 'mat_cotton_fabric',
    requiredQuantity: 2000,
    allocatedQuantity: 1400,
    unit: 'm',
    requiredByDate: '02 Nov 2026',
    status: 'Shortage'
  },
  {
    id: 'omr_105',
    orderId: 'TX-1024',
    clientName: 'ABC Garments',
    productName: 'Cotton Shirts (5,000 pcs)',
    materialId: 'mat_buttons_horn',
    requiredQuantity: 5000,
    allocatedQuantity: 5000,
    unit: 'pcs',
    requiredByDate: '08 Nov 2026',
    status: 'Allocated'
  },
  {
    id: 'omr_106',
    orderId: 'TX-1025',
    clientName: 'StyleMart',
    productName: 'Printed Fabric (3,000 pcs)',
    materialId: 'mat_dye_reactive',
    requiredQuantity: 350,
    allocatedQuantity: 300,
    unit: 'kg',
    requiredByDate: '05 Nov 2026',
    status: 'Shortage'
  },
  {
    id: 'omr_107',
    orderId: 'LP-904',
    clientName: 'Home Living',
    productName: 'Curtains (1,200 pcs)',
    materialId: 'mat_polyester_twill',
    requiredQuantity: 1200,
    allocatedQuantity: 1200,
    unit: 'm',
    requiredByDate: '20 Nov 2026',
    status: 'Allocated'
  }
];

const INITIAL_SUPPLIER_OFFERS: SupplierOffer[] = [
  {
    id: 'sup_sri_fabric',
    supplierName: 'Sri Textiles',
    location: 'Tirupur Depot, TN',
    materialId: 'mat_cotton_fabric',
    materialName: 'Cotton Poplin Fabric (58" / 185 GSM)',
    unit: 'm',
    unitPrice: 120,
    availableCapacity: 4500,
    moq: 500,
    leadTimeDays: 3,
    expectedDeliveryDate: '02 Nov 2026',
    transportCost: 3500,
    otherCharges: 1200,
    qualityRating: 4.8,
    qualityHistory: '98.5% first-pass inspection yield (last 12 batches)',
    deliveryPerformance: '96% on-time delivery record',
    paymentTerms: 'Net 30 Days',
    aiRecommendation: 'AI Recommended: Fastest delivery (3 days) meets Order TX-1024 deadline.',
    isAiRecommended: true
  },
  {
    id: 'sup_vetri_fabric',
    supplierName: 'Vetri Fabrics',
    location: 'Coimbatore Textile Hub, TN',
    materialId: 'mat_cotton_fabric',
    materialName: 'Cotton Poplin Fabric (58" / 185 GSM)',
    unit: 'm',
    unitPrice: 118,
    availableCapacity: 8000,
    moq: 800,
    leadTimeDays: 5,
    expectedDeliveryDate: '04 Nov 2026',
    transportCost: 4200,
    otherCharges: 1000,
    qualityRating: 4.6,
    qualityHistory: '96.8% yield (2 minor GSM variance logs in Q3)',
    deliveryPerformance: '91% on-time delivery record',
    paymentTerms: '15 Days Credit',
    aiRecommendation: 'Lower unit rate (₹118), but lead time of 5 days misses Order TX-1024 required date (02 Nov).',
    isAiRecommended: false
  },
  {
    id: 'sup_kings_fabric',
    supplierName: 'Kings Textiles',
    location: 'Surat Ring Road, GJ',
    materialId: 'mat_cotton_fabric',
    materialName: 'Cotton Poplin Fabric (58" / 185 GSM)',
    unit: 'm',
    unitPrice: 122,
    availableCapacity: 6000,
    moq: 1000,
    leadTimeDays: 4,
    expectedDeliveryDate: '03 Nov 2026',
    transportCost: 5500,
    otherCharges: 1500,
    qualityRating: 4.9,
    qualityHistory: '99.2% pristine quality history. Pre-shrunk finish.',
    deliveryPerformance: '98% on-time delivery record',
    paymentTerms: 'Net 45 Days',
    aiRecommendation: 'Premium grade finish, but highest landed logistics cost from Surat.',
    isAiRecommended: false
  },
  {
    id: 'sup_vardhman_yarn',
    supplierName: 'Vardhman Textiles Ltd.',
    location: 'Ludhiana Depot & Coimbatore Warehouse',
    materialId: 'mat_cotton_40s',
    materialName: '40s Combed Cotton Yarn',
    unit: 'kg',
    unitPrice: 236,
    availableCapacity: 5000,
    moq: 300,
    leadTimeDays: 3,
    expectedDeliveryDate: '02 Nov 2026',
    transportCost: 2800,
    otherCharges: 900,
    qualityRating: 4.9,
    qualityHistory: 'CSP > 2900, 100% autoconed, zero contamination guarantee.',
    deliveryPerformance: '99% on-time delivery record',
    paymentTerms: 'Net 30 Days',
    aiRecommendation: 'AI Recommended: Optimal CSP tensile strength and rapid 3-day depot dispatch.',
    isAiRecommended: true
  },
  {
    id: 'sup_vetri_yarn',
    supplierName: 'Vetri Fabrics (Yarn Div)',
    location: 'Coimbatore Hub, TN',
    materialId: 'mat_cotton_40s',
    materialName: '40s Combed Cotton Yarn',
    unit: 'kg',
    unitPrice: 240,
    availableCapacity: 3500,
    moq: 200,
    leadTimeDays: 2,
    expectedDeliveryDate: '01 Nov 2026',
    transportCost: 1500,
    otherCharges: 600,
    qualityRating: 4.7,
    qualityHistory: '97.4% yield in warp sizing.',
    deliveryPerformance: '94% on-time delivery record',
    paymentTerms: 'Immediate upon QC clearance',
    aiRecommendation: 'Shortest transit (2 days) with lowest regional haulage cost.',
    isAiRecommended: false
  },
  {
    id: 'sup_vetri_dye',
    supplierName: 'Vetri Fabrics (Chemicals Div)',
    location: 'Coimbatore, TN',
    materialId: 'mat_dye_reactive',
    materialName: 'Reactive Dyes (Navy / Royal Blue)',
    unit: 'kg',
    unitPrice: 180,
    availableCapacity: 800,
    moq: 50,
    leadTimeDays: 5,
    expectedDeliveryDate: '05 Nov 2026',
    transportCost: 800,
    otherCharges: 300,
    qualityRating: 4.7,
    qualityHistory: 'Consistent shade matching index (Delta E < 0.4).',
    deliveryPerformance: '95% on-time delivery record',
    paymentTerms: 'Net 15 Days',
    aiRecommendation: 'AI Recommended: Direct formulation compatibility with airjet dyeing vessels.',
    isAiRecommended: true
  }
];

const INITIAL_PURCHASE_ORDERS_DETAILED: PurchaseOrderRecord[] = [
  {
    poNo: 'PO-1001',
    supplierId: 'sup_sri_fabric',
    supplierName: 'Sri Textiles',
    relatedOrderIds: ['TX-1024', 'LP-902'],
    items: [
      {
        materialId: 'mat_cotton_fabric',
        materialName: 'Cotton Poplin Fabric (58" / 185 GSM)',
        category: 'fabric',
        unit: 'm',
        orderedQuantity: 2000,
        receivedQuantity: 1200,
        remainingQuantity: 800,
        unitPrice: 120,
        totalItemCost: 240000
      }
    ],
    transportCost: 3500,
    otherCharges: 1200,
    totalAmount: 244700,
    orderDate: '28 Oct 2026',
    expectedDelivery: '02 Nov 2026',
    status: 'Partially Received',
    purchaseJustification: 'Shortage of 600m on TX-1024 plus 1,400m inventory replenish for LP-902.',
    createdBy: 'System AI Procurement Agent',
    approvedBy: 'John Doe (Managing Director)',
    approvedAt: '28 Oct 2026 03:15 PM',
    history: [
      {
        id: 'h1',
        timestamp: '28 Oct 2026 03:15 PM',
        actor: 'John Doe (Managing Director)',
        action: 'ADMIN_APPROVED',
        notes: 'Approved PO-1001 with ₹2,44,700 total landed commitment.'
      }
    ]
  },
  {
    poNo: 'PO-1002',
    supplierId: 'sup_vardhman_yarn',
    supplierName: 'Vardhman Textiles Ltd.',
    relatedOrderIds: ['LP-903'],
    items: [
      {
        materialId: 'mat_cotton_40s',
        materialName: '40s Combed Cotton Yarn',
        category: 'yarn',
        unit: 'kg',
        orderedQuantity: 400,
        receivedQuantity: 0,
        remainingQuantity: 400,
        unitPrice: 236,
        totalItemCost: 94400
      }
    ],
    transportCost: 2800,
    otherCharges: 900,
    totalAmount: 98100,
    orderDate: '30 Oct 2026',
    expectedDelivery: '02 Nov 2026',
    status: 'Pending Approval',
    purchaseJustification: '400 kg shortage on Order LP-903 (Style World - Bedsheets).',
    createdBy: 'AI Procurement Advisor (v2.4)',
    history: [
      {
        id: 'h10',
        timestamp: '30 Oct 2026 08:30 AM',
        actor: 'AI Procurement Advisor',
        action: 'PR_CREATED',
        notes: 'Calculated 400 kg yarn shortfall on LP-903 after deducting reserved stock.'
      }
    ]
  },
  {
    poNo: 'PO-1003',
    supplierId: 'sup_vetri_dye',
    supplierName: 'Vetri Fabrics (Chemicals Div)',
    relatedOrderIds: ['TX-1025'],
    items: [
      {
        materialId: 'mat_dye_reactive',
        materialName: 'Reactive Dyes (Navy / Royal Blue)',
        category: 'dye',
        unit: 'kg',
        orderedQuantity: 100,
        receivedQuantity: 0,
        remainingQuantity: 100,
        unitPrice: 180,
        totalItemCost: 18000
      }
    ],
    transportCost: 800,
    otherCharges: 300,
    totalAmount: 19100,
    orderDate: '29 Oct 2026',
    expectedDelivery: '05 Nov 2026',
    status: 'Ordered',
    purchaseJustification: '50 kg direct shortfall on TX-1025 printed fabric run + 50 kg safety buffer.',
    createdBy: 'System AI Procurement Agent',
    approvedBy: 'John Doe (Managing Director)',
    approvedAt: '29 Oct 2026 04:00 PM',
    history: [
      {
        id: 'h20',
        timestamp: '29 Oct 2026 04:00 PM',
        actor: 'John Doe (Managing Director)',
        action: 'ADMIN_APPROVED',
        notes: 'Approved PO for 100 kg dye chemicals to prevent dying vat stoppage.'
      }
    ]
  }
];

const INITIAL_RECEIPTS_HISTORY: MaterialReceiptRecord[] = [
  {
    receiptId: 'REC-8001',
    poNo: 'PO-1001',
    supplierName: 'Sri Textiles',
    materialId: 'mat_cotton_fabric',
    materialName: 'Cotton Poplin Fabric (58" / 185 GSM)',
    unit: 'm',
    orderedQuantity: 2000,
    inwardQuantity: 1200,
    acceptedQuantity: 1100,
    rejectedQuantity: 100,
    damagedQuantity: 0,
    receivedDate: '30 Oct 2026 10:15 AM',
    batchLotNo: 'LOT-ST-2026-881B',
    inspectionResult: 'Passed with Concession',
    inspectionNotes: '100m rejected due to selvedge width and GSM drop. Supplier credit note requested.',
    inspectorName: 'Ramesh Kumar (QC Supervisor)'
  }
];

const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'TXN-901',
    materialId: 'mat_cotton_fabric',
    materialName: 'Cotton Poplin Fabric (58" / 185 GSM)',
    transactionType: 'Purchase Receipt',
    quantityChange: 1100,
    unit: 'm',
    balanceAfter: 1400,
    relatedRef: 'PO-1001 / LOT-ST-2026-881B',
    timestamp: '30 Oct 2026 10:20 AM',
    userResponsible: 'Ramesh Kumar (QC Supervisor)',
    remarks: 'QC Passed inward batch added to physical inventory (100m defective rejected).'
  },
  {
    id: 'TXN-902',
    materialId: 'mat_cotton_40s',
    materialName: '40s Combed Cotton Yarn',
    transactionType: 'Material Allocation',
    quantityChange: -800,
    unit: 'kg',
    balanceAfter: 1200,
    relatedRef: 'Order LP-901',
    timestamp: '25 Oct 2026 09:00 AM',
    userResponsible: 'John Doe (Managing Director)',
    remarks: 'Reserved 800 kg for Fashion House 5,000 pcs shirt production run.'
  },
  {
    id: 'TXN-903',
    materialId: 'mat_cotton_40s',
    materialName: '40s Combed Cotton Yarn',
    transactionType: 'Material Allocation',
    quantityChange: -700,
    unit: 'kg',
    balanceAfter: 500,
    relatedRef: 'Order LP-902',
    timestamp: '26 Oct 2026 11:30 AM',
    userResponsible: 'John Doe (Managing Director)',
    remarks: 'Reserved 700 kg for Urban Textiles 8,000 pcs shirt production run.'
  }
];

const INITIAL_PROCUREMENT_ALERTS: ProcurementAlert[] = [
  {
    id: 'alt_shortage_yarn',
    severity: 'critical',
    type: 'critical_shortage',
    materialName: '40s Combed Cotton Yarn',
    affectedOrderId: 'LP-903',
    issue: 'Critical Shortage: 400 kg shortfall halting Order LP-903. 1,500 kg already reserved for LP-901 and LP-902.',
    quantityAffected: '400 kg',
    requiredByDate: '12 Nov 2026',
    recommendedAction: 'Approve PO-1002 (Vardhman Textiles) to secure 3-day depot dispatch.',
    actionPayload: { materialId: 'mat_cotton_40s', poNo: 'PO-1002', orderId: 'LP-903' }
  },
  {
    id: 'alt_supplier_delay',
    severity: 'warning',
    type: 'supplier_delay',
    materialName: 'Cotton Poplin Fabric',
    affectedOrderId: 'LP-902',
    issue: 'Supplier Transit Delay: Sri Textiles batch #2 (800m) delayed by 2 days. Pushes cutting start to 06 Nov.',
    quantityAffected: '800 m',
    requiredByDate: '06 Nov 2026',
    recommendedAction: 'Re-pace weaving loom schedules or request expedited courier.',
    actionPayload: { materialId: 'mat_cotton_fabric', poNo: 'PO-1001', orderId: 'LP-902' }
  },
  {
    id: 'alt_po_approval',
    severity: 'info',
    type: 'po_pending_approval',
    materialName: '40s Combed Cotton Yarn',
    affectedOrderId: 'LP-903',
    issue: 'PO-1002 awaits Admin Approval (₹98,100 commitment for 400 kg Yarn).',
    quantityAffected: '400 kg',
    requiredByDate: '12 Nov 2026',
    recommendedAction: 'Review supplier comparison and approve purchase order.',
    actionPayload: { poNo: 'PO-1002' }
  }
];

// =========================================================================
// PROPS INTERFACE
// =========================================================================

interface MaterialsProcurementModuleProps {
  materials?: MaterialRequirement[];
  orders?: Order[];
  onRecordPurchaseDecision?: (materialId: string, status: MaterialRequirement['status'], notes?: string) => void;
  onRerunFeasibility?: (orderId: string) => void;
}

export const MaterialsProcurementModule: React.FC<MaterialsProcurementModuleProps> = ({
  onRecordPurchaseDecision,
  onRerunFeasibility
}) => {
  // Master State
  const [inventory, setInventory] = useState<InventoryMaterial[]>(INITIAL_INVENTORY_MATERIALS);
  const [allocations] = useState<OrderAllocationItem[]>(INITIAL_ORDER_ALLOCATIONS);
  const [supplierOffers] = useState<SupplierOffer[]>(INITIAL_SUPPLIER_OFFERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>(INITIAL_PURCHASE_ORDERS_DETAILED);
  const [receipts, setReceipts] = useState<MaterialReceiptRecord[]>(INITIAL_RECEIPTS_HISTORY);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(INITIAL_TRANSACTIONS);
  const [alerts, setAlerts] = useState<ProcurementAlert[]>(INITIAL_PROCUREMENT_ALERTS);

  // Filters on Main Overview
  const [selectedOrderId, setSelectedOrderId] = useState<string>('all');
  const [mrpSearchQuery, setMrpSearchQuery] = useState<string>('');

  // Modals for Detail Workspaces (Eliminating page clutter)
  const [showFullMrpModal, setShowFullMrpModal] = useState<boolean>(false);
  const [showFullPoModal, setShowFullPoModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [selectedSupplierMaterialId, setSelectedSupplierMaterialId] = useState<string>('mat_cotton_40s');
  const [showAllAlertsModal, setShowAllAlertsModal] = useState<boolean>(false);

  // Core Action Modals
  const [showInwardModal, setShowInwardModal] = useState<boolean>(false);
  const [showCreatePrModal, setShowCreatePrModal] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectingPoNo, setRejectingPoNo] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(['mat_cotton_40s']);
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>(['PO-1001']);
  const [showAlertsSection, setShowAlertsSection] = useState<boolean>(true);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Forms
  const [inwardForm, setInwardForm] = useState({
    poNo: 'PO-1001',
    materialId: 'mat_cotton_fabric',
    inwardQuantity: 1200,
    acceptedQuantity: 1100,
    rejectedQuantity: 100,
    damagedQuantity: 0,
    batchLotNo: 'LOT-ST-2026-902C',
    inspectionResult: 'Passed with Concession' as 'Passed Full' | 'Passed with Concession' | 'Failed QC',
    inspectorName: 'Ramesh Kumar (QC Supervisor)',
    notes: '100m selvedge width variance rejected. 1,100m accepted and credited to inventory.'
  });

  const [prForm, setPrForm] = useState({
    supplierId: 'sup_vardhman_yarn',
    materialId: 'mat_cotton_40s',
    relatedOrderId: 'LP-903',
    quantity: 400,
    justification: '400 kg shortage on Order LP-903 after reserving yarn for LP-901 and LP-902.'
  });

  // =========================================================================
  // CALCULATIONS & METRICS
  // =========================================================================

  // Full MRP calculated list
  const mrpCalculatedList = useMemo(() => {
    return inventory.map((mat) => {
      const matAllocations = allocations.filter((a) => a.materialId === mat.id);
      const targetAllocations = selectedOrderId === 'all'
        ? matAllocations
        : matAllocations.filter((a) => a.orderId === selectedOrderId);

      const totalRequired = targetAllocations.reduce((acc, curr) => acc + curr.requiredQuantity, 0);
      const totalAllocated = targetAllocations.reduce((acc, curr) => acc + curr.allocatedQuantity, 0);

      // Formula: Available to Allocate = Physical Stock - Reserved Stock
      const availableToAllocate = Math.max(0, mat.physicalStock - mat.reservedStock);

      // Formula: Shortage = Max(totalRequired - (totalAllocated + availableToAllocate), 0)
      const shortageQuantity = Math.max(0, totalRequired - (totalAllocated + availableToAllocate));

      let status: 'Shortage' | 'Low Stock' | 'Sufficient' = 'Sufficient';
      if (shortageQuantity > 0) {
        status = 'Shortage';
      } else if (availableToAllocate <= mat.reorderPoint) {
        status = 'Low Stock';
      }

      return {
        ...mat,
        requiredQuantity: totalRequired,
        allocatedQuantity: totalAllocated,
        availableToAllocate,
        shortageQuantity,
        mrpStatus: status,
        affectedOrders: targetAllocations.map((a) => a.orderId)
      };
    });
  }, [inventory, allocations, selectedOrderId]);

  // Sort and filter for top 5 materials:
  // Priority: Shortage first, then Low Stock, then Sufficient
  const top5Materials = useMemo(() => {
    let list = [...mrpCalculatedList];
    if (mrpSearchQuery.trim()) {
      const q = mrpSearchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }

    // Sort order: Shortage (shortageQuantity desc) -> Low Stock -> Sufficient
    list.sort((a, b) => {
      if (a.shortageQuantity > 0 && b.shortageQuantity === 0) return -1;
      if (a.shortageQuantity === 0 && b.shortageQuantity > 0) return 1;
      if (a.shortageQuantity > 0 && b.shortageQuantity > 0) return b.shortageQuantity - a.shortageQuantity;
      if (a.mrpStatus === 'Low Stock' && b.mrpStatus !== 'Low Stock') return -1;
      if (a.mrpStatus !== 'Low Stock' && b.mrpStatus === 'Low Stock') return 1;
      return 0;
    });

    return list.slice(0, 5);
  }, [mrpCalculatedList, mrpSearchQuery]);

  // Section 1: Top 4 KPI Indicators
  const totalMaterialTypes = inventory.length;
  const criticalMaterialShortages = mrpCalculatedList.filter((m) => m.shortageQuantity > 0).length;
  const pendingPurchaseApprovals = purchaseOrders.filter((po) => po.status === 'Pending Approval').length;
  const availableStockTypes = mrpCalculatedList.filter((m) => m.mrpStatus === 'Sufficient').length;

  // Latest 3 POs for the recent list
  const recentPurchaseOrders = useMemo(() => {
    return purchaseOrders.slice(0, 3);
  }, [purchaseOrders]);

  // Top 2-3 most important alerts
  const topAlerts = useMemo(() => {
    return alerts.slice(0, 3);
  }, [alerts]);

  // Primary Pending PO for the approval widget
  const primaryPendingPo = useMemo(() => {
    return purchaseOrders.find((p) => p.status === 'Pending Approval');
  }, [purchaseOrders]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleAdminApprovePo = (poNo: string) => {
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.poNo === poNo) {
          return {
            ...po,
            status: 'Ordered',
            approvedBy: 'John Doe (Managing Director)',
            approvedAt: timestamp,
            history: [
              ...po.history,
              {
                id: `h_${Date.now()}`,
                timestamp,
                actor: 'John Doe (Managing Director)',
                action: 'ADMIN_APPROVED',
                notes: `Authorized commitment of ₹${po.totalAmount.toLocaleString('en-IN')}. Supplier dispatch released.`
              }
            ]
          };
        }
        return po;
      })
    );

    setAlerts((prev) => prev.filter((a) => a.actionPayload?.poNo !== poNo || a.type !== 'po_pending_approval'));
    if (onRecordPurchaseDecision) {
      onRecordPurchaseDecision(poNo, 'approved', `Admin approved ${poNo}`);
    }

    showToast(`Purchase Order ${poNo} APPROVED by Admin. Supplier dispatch order sent!`);
    setShowApprovalModal(false);
  };

  const handleAdminRejectPo = () => {
    if (!rejectingPoNo) return;
    if (!rejectionReason.trim()) {
      alert('A valid business justification is required when rejecting a purchase request.');
      return;
    }

    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.poNo === rejectingPoNo) {
          return {
            ...po,
            status: 'Rejected',
            rejectedReason: rejectionReason,
            history: [
              ...po.history,
              {
                id: `h_${Date.now()}`,
                timestamp,
                actor: 'John Doe (Managing Director)',
                action: 'ADMIN_REJECTED',
                notes: `Rejected by Admin: ${rejectionReason}`
              }
            ]
          };
        }
        return po;
      })
    );

    showToast(`Purchase Order ${rejectingPoNo} REJECTED.`);
    setShowRejectModal(false);
    setRejectingPoNo(null);
    setRejectionReason('');
    setShowApprovalModal(false);
  };

  const handleSubmitInwardReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const po = purchaseOrders.find((p) => p.poNo === inwardForm.poNo);
    const mat = inventory.find((m) => m.id === inwardForm.materialId);
    if (!po || !mat) return;

    const inwardQty = Number(inwardForm.inwardQuantity);
    const acceptedQty = Number(inwardForm.acceptedQuantity);
    const rejectedQty = Number(inwardForm.rejectedQuantity);
    const damagedQty = Number(inwardForm.damagedQuantity);

    if (acceptedQty + rejectedQty + damagedQty !== inwardQty) {
      alert('Sum of Accepted, Rejected, and Damaged quantities must equal total Inward quantity.');
      return;
    }

    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. Record receipt
    const newReceipt: MaterialReceiptRecord = {
      receiptId: `REC-${8000 + receipts.length + 1}`,
      poNo: po.poNo,
      supplierName: po.supplierName,
      materialId: mat.id,
      materialName: mat.name,
      unit: mat.unit,
      orderedQuantity: po.items.find((i) => i.materialId === mat.id)?.orderedQuantity || inwardQty,
      inwardQuantity: inwardQty,
      acceptedQuantity: acceptedQty, // ONLY THIS goes to inventory!
      rejectedQuantity: rejectedQty,
      damagedQuantity: damagedQty,
      receivedDate: timestamp,
      batchLotNo: inwardForm.batchLotNo,
      inspectionResult: inwardForm.inspectionResult,
      inspectionNotes: inwardForm.notes,
      inspectorName: inwardForm.inspectorName
    };
    setReceipts((prev) => [newReceipt, ...prev]);

    // 2. ONLY ACCEPTED QUANTITY INCREASES PHYSICAL STOCK
    setInventory((prev) =>
      prev.map((item) => (item.id === mat.id ? { ...item, physicalStock: item.physicalStock + acceptedQty } : item))
    );

    // 3. Update PO remaining
    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (p.poNo === po.poNo) {
          const updatedItems = p.items.map((item) => {
            if (item.materialId === mat.id) {
              const newReceived = item.receivedQuantity + inwardQty;
              return {
                ...item,
                receivedQuantity: newReceived,
                remainingQuantity: Math.max(0, item.orderedQuantity - newReceived)
              };
            }
            return item;
          });
          const totalOrdered = updatedItems.reduce((acc, i) => acc + i.orderedQuantity, 0);
          const totalReceived = updatedItems.reduce((acc, i) => acc + i.receivedQuantity, 0);
          return {
            ...p,
            items: updatedItems,
            status: totalReceived >= totalOrdered ? 'Fully Received' : 'Partially Received'
          };
        }
        return p;
      })
    );

    // 4. Log Transaction
    const newTxn: InventoryTransaction = {
      id: `TXN-${900 + transactions.length + 1}`,
      materialId: mat.id,
      materialName: mat.name,
      transactionType: 'Purchase Receipt',
      quantityChange: acceptedQty,
      unit: mat.unit,
      balanceAfter: mat.physicalStock + acceptedQty,
      relatedRef: `${po.poNo} / ${inwardForm.batchLotNo}`,
      timestamp,
      userResponsible: inwardForm.inspectorName,
      remarks: `QC Inward approved ${acceptedQty} ${mat.unit} (${rejectedQty} ${mat.unit} rejected/quarantined).`
    };
    setTransactions((prev) => [newTxn, ...prev]);

    if (onRerunFeasibility && po.relatedOrderIds[0]) {
      onRerunFeasibility(po.relatedOrderIds[0]);
    }

    showToast(`QC Inward logged: +${acceptedQty} ${mat.unit} added to stock.`);
    setShowInwardModal(false);
  };

  const handleCreatePurchaseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = supplierOffers.find((s) => s.id === prForm.supplierId);
    const material = inventory.find((m) => m.id === prForm.materialId);
    if (!supplier || !material) return;

    const reqQty = Number(prForm.quantity);
    if (reqQty <= 0) return;

    const materialCost = Math.round(reqQty * supplier.unitPrice);
    const totalAmount = materialCost + supplier.transportCost + supplier.otherCharges;
    const newPoNo = `PO-${1000 + purchaseOrders.length + 1}`;
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const newPo: PurchaseOrderRecord = {
      poNo: newPoNo,
      supplierId: supplier.id,
      supplierName: supplier.supplierName,
      relatedOrderIds: [prForm.relatedOrderId],
      items: [
        {
          materialId: material.id,
          materialName: material.name,
          category: material.category,
          unit: material.unit,
          orderedQuantity: reqQty,
          receivedQuantity: 0,
          remainingQuantity: reqQty,
          unitPrice: supplier.unitPrice,
          totalItemCost: materialCost
        }
      ],
      transportCost: supplier.transportCost,
      otherCharges: supplier.otherCharges,
      totalAmount,
      orderDate: timestamp,
      expectedDelivery: supplier.expectedDeliveryDate,
      status: 'Pending Approval',
      purchaseJustification: prForm.justification,
      createdBy: 'John Doe (Admin Portal)',
      history: [
        {
          id: `h_${Date.now()}`,
          timestamp,
          actor: 'John Doe (Admin)',
          action: 'PR_CREATED',
          notes: `Requisition initiated for ${reqQty} ${material.unit}. Landed commitment: ₹${totalAmount.toLocaleString('en-IN')}`
        }
      ]
    };

    setPurchaseOrders((prev) => [newPo, ...prev]);
    showToast(`Requisition ${newPoNo} created. Status: Pending Admin Approval.`);
    setShowCreatePrModal(false);
  };

  const getPoStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'Pending Approval':
        return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'Approved':
      case 'Ordered':
        return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
      case 'Partially Received':
        return { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' };
      case 'Fully Received':
      case 'Completed':
        return { bg: '#F8F0DF', color: '#18191B', border: '#edf2ee' };
      case 'Rejected':
      case 'Cancelled':
        return { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* =========================================================================
          1. CLEAN EXECUTIVE PAGE HEADER
          ========================================================================= */}
      <div className="module-header-flat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0d10', letterSpacing: '-0.02em', margin: 0 }}>
            Materials & Procurement
          </h1>
          
        </div>

        {/* Essential Action Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowAuditModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 9999,
              padding: '6px 13px',
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <History size={13} color="#18191B" />
            Stock Ledger & Audit
          </button>

          <button
            onClick={() => setShowInwardModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#ffffff',
              border: '1px solid #edf2ee',
              borderRadius: 9999,
              padding: '6px 13px',
              fontSize: 11,
              fontWeight: 700,
              color: '#18191B',
              cursor: 'pointer'
            }}
          >
            <ClipboardCheck size={13} color="#18191B" />
            Record QC Inward
          </button>

          <button
            className="admin-btn-primary"
            onClick={() => setShowCreatePrModal(true)}
            style={{ padding: '6px 14px', fontSize: 11, borderRadius: 9999 }}
          >
            <Plus size={13} />
            New Purchase Request
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. FOUR UNTITLED UI KPI METRIC CARDS (Exact match to Reference Image 1)
          ========================================================================= */}
      <div className="untitled-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* KPI 1: Total Material Types */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Total Material Types</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{totalMaterialTypes}</span>
            <span className="untitled-kpi-badge neutral">Active items</span>
          </div>
        </div>

        {/* KPI 2: Critical Material Shortages */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Critical Material Shortages</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value" style={{ color: criticalMaterialShortages > 0 ? '#b42318' : '#101828' }}>
              {criticalMaterialShortages}
            </span>
            <span className={`untitled-kpi-badge ${criticalMaterialShortages > 0 ? 'danger' : 'success'}`}>
              {criticalMaterialShortages > 0 ? 'Action needed' : 'All clear'}
            </span>
          </div>
        </div>

        {/* KPI 3: Pending Purchase Approvals */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Pending Purchase Approvals</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{pendingPurchaseApprovals}</span>
            <span className="untitled-kpi-badge warning">Awaiting Admin</span>
          </div>
        </div>

        {/* KPI 4: Available Stock Types */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Available Stock Types</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{availableStockTypes}</span>
            <span className="untitled-kpi-badge success"><ArrowUp size={11} strokeWidth={2.5} /> Sufficient buffer</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. CLEAN TWO-COLUMN MAIN CONTENT (Requirement: Left wider, Right compact)
          ========================================================================= */}
      {/* =========================================================================
          3. FULL-WIDTH MATERIALS & PROCUREMENT WORKSPACE
          ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* COMPACT TOP ALERTS STRIP (Small place in UI for quick triage) */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #eaecf0',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#fef3f2',
              color: '#b42318',
              padding: '4px 10px',
              borderRadius: 9999,
              fontSize: 11.5,
              fontWeight: 700
            }}>
              <AlertTriangle size={14} color="#dc2626" />
              <span>{alerts.length} Active Alerts</span>
            </div>

            {criticalMaterialShortages > 0 && (
              <span style={{ fontSize: 12, color: '#344054' }}>
                &bull; <strong>{criticalMaterialShortages} Critical Shortage{criticalMaterialShortages > 1 ? 's' : ''}</strong> (e.g. 400 kg shortfall halting LP-903)
              </span>
            )}

            {pendingPurchaseApprovals > 0 && primaryPendingPo && (
              <span style={{ fontSize: 12, color: '#344054' }}>
                &bull; <strong>{pendingPurchaseApprovals} Pending PO</strong> ({primaryPendingPo.poNo} &bull; ₹{primaryPendingPo.totalAmount.toLocaleString('en-IN')})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {primaryPendingPo && (
              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="admin-btn-secondary"
                style={{
                  padding: '5px 12px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#18191B',
                  background: '#F8F0DF',
                  border: '1px solid #79B4B7',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                Review {primaryPendingPo.poNo}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAllAlertsModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#18191B',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              View All Alerts &rarr;
            </button>

            <button
              type="button"
              className={`untitled-filter-pill ${showAlertsSection ? 'active' : ''}`}
              onClick={() => setShowAlertsSection(!showAlertsSection)}
              style={{ fontWeight: 600, color: '#18191B' }}
            >
              {showAlertsSection ? 'Hide Alert Cards' : 'Show Alert Cards'}
            </button>
          </div>
        </div>

        {/* FULL-WIDTH CARD 1: MATERIAL REQUIREMENTS */}
        <div className="untitled-table-card" style={{ width: '100%' }}>
          {/* Table Toolbar */}
          <div className="untitled-table-toolbar">
            <div className="untitled-toolbar-filters">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                <Boxes size={18} color="#18191B" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#101828', margin: 0 }}>
                  Material Requirements
                </h3>
              </div>

              <button
                type="button"
                className={`untitled-filter-pill ${selectedOrderId === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedOrderId('all')}
              >
                All orders
              </button>
              {['LP-901', 'TX-1024'].map(oid => (
                <button
                  key={oid}
                  type="button"
                  className={`untitled-filter-pill ${selectedOrderId === oid ? 'active' : ''}`}
                  onClick={() => setSelectedOrderId(selectedOrderId === oid ? 'all' : oid)}
                >
                  {oid} {selectedOrderId === oid && <span className="untitled-filter-remove">&times;</span>}
                </button>
              ))}
              <button
                type="button"
                className="untitled-filter-pill"
                onClick={() => setShowFullMrpModal(true)}
              >
                <Filter size={12} /> More filters
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="untitled-search-input-wrap">
                <Search size={14} color="#667085" />
                <input
                  type="text"
                  className="untitled-search-input"
                  placeholder="Search materials..."
                  value={mrpSearchQuery}
                  onChange={(e) => setMrpSearchQuery(e.target.value)}
                />
                {mrpSearchQuery && (
                  <button
                    type="button"
                    className="untitled-filter-remove"
                    onClick={() => setMrpSearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFullMrpModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#18191B',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                View All &rarr;
              </button>
            </div>
          </div>

          {/* Untitled UI Data Table */}
          <div className="untitled-table-wrapper">
            <table className="untitled-table">
              <thead>
                <tr>
                  <th className="col-cb">
                    <input
                      type="checkbox"
                      className="untitled-checkbox"
                      checked={top5Materials.length > 0 && top5Materials.every(m => selectedMaterialIds.includes(m.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMaterialIds(Array.from(new Set([...selectedMaterialIds, ...top5Materials.map(m => m.id)])));
                        } else {
                          const curIds = new Set(top5Materials.map(m => m.id));
                          setSelectedMaterialIds(selectedMaterialIds.filter(id => !curIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Material <ArrowDown size={12} color="#667085" />
                    </div>
                  </th>
                  <th>Category</th>
                  <th style={{ width: 160 }}>Stock Coverage</th>
                  <th style={{ textAlign: 'right' }}>Required</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th style={{ textAlign: 'right' }}>Shortage</th>
                  <th>Status</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {top5Materials.map((item) => {
                  const isSelected = selectedMaterialIds.includes(item.id);
                  const isShortage = item.shortageQuantity > 0;
                  const isLow = item.mrpStatus === 'Low Stock';
                  const coveragePercent = Math.min(100, Math.round((item.availableToAllocate / Math.max(1, item.requiredQuantity)) * 100));

                  let pillClass = 'success';
                  let statusLabel = 'Fulfilled';
                  if (isShortage) {
                    pillClass = 'danger';
                    statusLabel = 'Shortage';
                  } else if (isLow) {
                    pillClass = 'warning';
                    statusLabel = 'Low Stock';
                  }

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'is-selected' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedSupplierMaterialId(item.id);
                        setShowSupplierModal(true);
                      }}
                    >
                      <td className="col-cb" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="untitled-checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setSelectedMaterialIds(selectedMaterialIds.filter(id => id !== item.id));
                            } else {
                              setSelectedMaterialIds([...selectedMaterialIds, item.id]);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#101828', fontSize: 13.5 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Unit: {item.unit}
                        </div>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: '#475467', fontWeight: 500 }}>
                        {item.category}
                      </td>
                      <td>
                        <div className="untitled-progress-wrap">
                          <div className="untitled-progress-track">
                            <div
                              className="untitled-progress-fill"
                              style={{
                                width: `${coveragePercent}%`,
                                background: isShortage ? '#f04438' : isLow ? '#f79009' : '#12b76a'
                              }}
                            />
                          </div>
                          <span className="untitled-progress-percent">{coveragePercent}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#101828', fontVariantNumeric: 'tabular-nums' }}>
                        {item.requiredQuantity.toLocaleString()} {item.unit}
                      </td>
                      <td style={{ textAlign: 'right', color: '#475467', fontVariantNumeric: 'tabular-nums' }}>
                        {item.availableToAllocate.toLocaleString()} {item.unit}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isShortage ? '#b42318' : '#98a2b3', fontVariantNumeric: 'tabular-nums' }}>
                        {isShortage ? `${item.shortageQuantity.toLocaleString()} ${item.unit}` : '-'}
                      </td>
                      <td>
                        <span className={`untitled-status-pill ${pillClass}`}>
                          <span className="dot" />
                          <span>{statusLabel}</span>
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{
                            padding: '6px 14px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: '#18191B',
                            background: '#F8F0DF',
                            border: '1px solid #79B4B7',
                            borderRadius: 8,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedSupplierMaterialId(item.id);
                            setShowSupplierModal(true);
                          }}
                        >
                          Suppliers
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="untitled-table-footer">
            <button type="button" className="untitled-page-btn" onClick={() => {}}>Previous</button>
            <span className="untitled-page-info">Page 1 of {Math.max(1, Math.ceil(top5Materials.length / 5))}</span>
            <button type="button" className="untitled-page-btn" onClick={() => {}}>Next</button>
          </div>
        </div>

        {/* FULL-WIDTH CARD 2: RECENT PURCHASE ORDERS */}
        <div className="untitled-table-card" style={{ width: '100%' }}>
          <div className="untitled-table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} color="#18191B" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#101828', margin: 0 }}>
                Recent Purchase Orders
              </h3>
            </div>
            <button
              onClick={() => setShowFullPoModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#18191B',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0
              }}
            >
              View All Purchase Orders &rarr;
            </button>
          </div>

          <div className="untitled-table-wrapper">
            <table className="untitled-table">
              <thead>
                <tr>
                  <th className="col-cb">
                    <input
                      type="checkbox"
                      className="untitled-checkbox"
                      checked={recentPurchaseOrders.length > 0 && recentPurchaseOrders.every(p => selectedPoIds.includes(p.poNo))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPoIds(Array.from(new Set([...selectedPoIds, ...recentPurchaseOrders.map(p => p.poNo)])));
                        } else {
                          const curIds = new Set(recentPurchaseOrders.map(p => p.poNo));
                          setSelectedPoIds(selectedPoIds.filter(id => !curIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th style={{ width: 140 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      PO Number <ArrowDown size={12} color="#667085" />
                    </div>
                  </th>
                  <th>Supplier</th>
                  <th>Material &amp; Scope</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th>Status</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchaseOrders.map((po) => {
                  const isSelected = selectedPoIds.includes(po.poNo);
                  let pillClass = 'warning';
                  let statusText = 'Pending';
                  if (po.status === 'Fully Received') {
                    pillClass = 'success';
                    statusText = 'Fulfilled';
                  } else if (po.status === 'Ordered' || po.status === 'Approved') {
                    pillClass = 'indigo';
                    statusText = 'Confirmed';
                  } else if (po.status === 'Partially Received' || po.status === 'Quality Inspection') {
                    pillClass = 'warning';
                    statusText = 'In Inspection';
                  } else if (po.status === 'Rejected' || po.status === 'Cancelled') {
                    pillClass = 'danger';
                    statusText = 'Cancelled';
                  }

                  return (
                    <tr
                      key={po.poNo}
                      className={isSelected ? 'is-selected' : ''}
                      onClick={() => setShowFullPoModal(true)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="col-cb" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="untitled-checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setSelectedPoIds(selectedPoIds.filter(id => id !== po.poNo));
                            } else {
                              setSelectedPoIds([...selectedPoIds, po.poNo]);
                            }
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: '#101828', whiteSpace: 'nowrap' }}>
                        #{po.poNo}
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                          {po.relatedOrderIds && po.relatedOrderIds.length > 0 ? `Orders: ${po.relatedOrderIds.join(', ')}` : 'Stock Buffer'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#101828' }}>
                        {po.supplierName}
                      </td>
                      <td>
                        <div style={{ color: '#344054', fontWeight: 500 }}>
                          {po.items[0]?.materialName || 'Raw Material'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {po.items.length} item{po.items.length > 1 ? 's' : ''} &bull; Expected: {po.expectedDelivery}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#101828', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{po.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`untitled-status-pill ${pillClass}`}>
                          <span className="dot" />
                          <span>{statusText}</span>
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{
                            padding: '6px 14px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: '#18191B',
                            background: '#F8F0DF',
                            border: '1px solid #79B4B7',
                            borderRadius: 8,
                            cursor: 'pointer'
                          }}
                          onClick={() => setShowFullPoModal(true)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="untitled-table-footer">
            <button type="button" className="untitled-page-btn" onClick={() => {}}>Previous</button>
            <span className="untitled-page-info">Page 1 of 1</span>
            <button type="button" className="untitled-page-btn" onClick={() => {}}>Next</button>
          </div>
        </div>

        {/* LOWER SECTION: PROCUREMENT ALERTS & PURCHASE APPROVALS (Compact 2-Column Row below tables) */}
        {showAlertsSection && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
            {/* CARD 1: PROCUREMENT ALERTS */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #eaecf0',
              padding: 18,
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} color="#dc2626" />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#101828', margin: 0 }}>
                    Procurement Alerts
                  </h3>
                </div>
                <button
                  onClick={() => setShowAllAlertsModal(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#18191B',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  View All Alerts ({alerts.length}) &rarr;
                </button>
              </div>

              {/* Top 3 alerts in compact row list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    style={{
                      background: alt.severity === 'critical' ? '#fef2f2' : alt.severity === 'warning' ? '#fffbeb' : '#F8F0DF',
                      border: `1px solid ${alt.severity === 'critical' ? '#fecaca' : alt.severity === 'warning' ? '#fde68a' : '#edf2ee'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: alt.severity === 'critical' ? '#dc2626' : alt.severity === 'warning' ? '#b45309' : '#18191B'
                      }}>
                        {alt.type.replace(/_/g, ' ')}
                      </span>
                      {alt.affectedOrderId && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: '#475569', background: '#ffffff', padding: '1px 6px', borderRadius: 4 }}>
                          {alt.affectedOrderId}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11, color: '#1e293b', fontWeight: 600 }}>
                      {alt.issue}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        Required by: <strong>{alt.requiredByDate || 'Immediate'}</strong>
                      </span>
                      <button
                        onClick={() => {
                          if (alt.actionPayload?.poNo) {
                            setShowApprovalModal(true);
                          } else if (alt.actionPayload?.materialId) {
                            setSelectedSupplierMaterialId(alt.actionPayload.materialId);
                            setShowSupplierModal(true);
                          } else {
                            setShowAllAlertsModal(true);
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#18191B',
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Resolve &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 2: PURCHASE APPROVALS */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #eaecf0',
              padding: 18,
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color="#18191B" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#101828', margin: 0 }}>
                  Purchase Approvals
                </h3>
              </div>

              {primaryPendingPo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Status banner */}
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                  }}>
                    <ShieldAlert size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>
                        {pendingPurchaseApprovals} Purchase Requisition Awaiting Approval
                      </div>
                      <div style={{ fontSize: 10.5, color: '#78350f', marginTop: 2 }}>
                        <strong>{primaryPendingPo.poNo}</strong> &bull; {primaryPendingPo.supplierName} &bull; <strong>₹{primaryPendingPo.totalAmount.toLocaleString('en-IN')}</strong>
                      </div>
                      <div style={{ fontSize: 10, color: '#92400e', marginTop: 2 }}>
                        Resolves shortage on Order {primaryPendingPo.relatedOrderIds.join(', ')}.
                      </div>
                    </div>
                  </div>

                  {/* Primary Review Action */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowApprovalModal(true)}
                      className="admin-btn-primary"
                      style={{ flex: 1, padding: '9px 12px', fontSize: 11, justifyContent: 'center', color: '#18191B' }}
                    >
                      <span>Review Requests</span>
                      <ArrowRight size={13} />
                    </button>

                    <button
                      onClick={() => handleAdminApprovePo(primaryPendingPo.poNo)}
                      style={{
                        background: '#F8F0DF',
                        color: '#18191B',
                        border: '1px solid #79B4B7',
                        borderRadius: 8,
                        padding: '9px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      1-Click Approve
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: 12,
                  border: '1px dashed #cbd5e1',
                  fontSize: 11,
                  color: '#64748b'
                }}>
                  <CheckCircle2 size={22} color="#16a34a" style={{ margin: '0 auto 4px' }} />
                  <div>Zero pending purchase requests.</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>All PO commitments are up to date.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          DETAIL MODAL 1: FULL MATERIAL REQUIREMENTS & ALLOCATION DIRECTORY
          ========================================================================= */}
      {showFullMrpModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 860, borderRadius: 28, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Full Material Requirement Planning & Allocation Directory
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Factory-wide inventory, committed order reservations, and anti-double-booking governance.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowFullMrpModal(false)}>
                <X size={15} />
              </button>
            </div>

            {/* Data Table */}
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>Material</th>
                    <th style={{ padding: '8px 6px' }}>Physical Stock</th>
                    <th style={{ padding: '8px 6px' }}>Reserved</th>
                    <th style={{ padding: '8px 6px' }}>Free to Allocate</th>
                    <th style={{ padding: '8px 6px' }}>Committed Demand</th>
                    <th style={{ padding: '8px 6px' }}>Shortage</th>
                    <th style={{ padding: '8px 6px' }}>Status</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mrpCalculatedList.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700, color: '#0a0d10' }}>
                        {item.name}
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                          {item.storageLocation} &bull; Unit: {item.unit}
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px' }}>{item.physicalStock.toLocaleString()} {item.unit}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{item.reservedStock.toLocaleString()} {item.unit}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 700, color: '#18191B' }}>{item.availableToAllocate.toLocaleString()} {item.unit}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{item.requiredQuantity.toLocaleString()} {item.unit}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 800, color: item.shortageQuantity > 0 ? '#dc2626' : '#94a3b8' }}>
                        {item.shortageQuantity > 0 ? `${item.shortageQuantity.toLocaleString()} ${item.unit}` : '-'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: 9999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: item.shortageQuantity > 0 ? '#fee2e2' : item.mrpStatus === 'Low Stock' ? '#fef3c7' : '#F8F0DF',
                          color: item.shortageQuantity > 0 ? '#dc2626' : item.mrpStatus === 'Low Stock' ? '#b45309' : '#18191B'
                        }}>
                          {item.mrpStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedSupplierMaterialId(item.id);
                            setShowFullMrpModal(false);
                            setShowSupplierModal(true);
                          }}
                          style={{
                            background: '#F8F0DF',
                            border: '1px solid #edf2ee',
                            color: '#18191B',
                            borderRadius: 9999,
                            padding: '3px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Compare Suppliers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 2: SUPPLIER COMPARISON WORKSPACE
          ========================================================================= */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 740, borderRadius: 28, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Supplier Comparison & Landed Cost Evaluation
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Evaluating vendor offers for: <strong>{inventory.find((m) => m.id === selectedSupplierMaterialId)?.name}</strong>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSupplierModal(false)}>
                <X size={15} />
              </button>
            </div>

            {/* Supplier Offers Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {supplierOffers
                .filter((s) => s.materialId === selectedSupplierMaterialId)
                .map((sup) => {
                  const sampleQty = 500;
                  const totalLandedCost = (sup.unitPrice * sampleQty) + sup.transportCost + sup.otherCharges;

                  return (
                    <div
                      key={sup.id}
                      style={{
                        border: sup.isAiRecommended ? '2px solid #edf2ee' : '1px solid #e2e8f0',
                        borderRadius: 18,
                        background: sup.isAiRecommended ? '#f8fdfa' : '#ffffff',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        position: 'relative'
                      }}
                    >
                      {sup.isAiRecommended && (
                        <div style={{
                          position: 'absolute',
                          top: -9,
                          right: 14,
                          background: '#79B4B7', color: '#18191B',
                          borderRadius: 9999,
                          padding: '1px 8px',
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3
                        }}>
                          <Sparkles size={10} />
                          AI BEST MATCH
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#0a0d10' }}>{sup.supplierName}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            {sup.location} &bull; Terms: {sup.paymentTerms} &bull; QC Score: <strong>{sup.qualityRating} / 5.0</strong>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#18191B' }}>₹{sup.unitPrice}</span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>/{sup.unit}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, color: '#475569' }}>
                        <span>
                          Lead Time: <strong>{sup.leadTimeDays} Days</strong> (ETA: {sup.expectedDeliveryDate}) &bull; Freight: ₹{sup.transportCost.toLocaleString()}
                        </span>
                        <span>
                          Total Landed ({sampleQty} {sup.unit}): <strong>₹{totalLandedCost.toLocaleString('en-IN')}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: sup.isAiRecommended ? '#18191B' : '#64748b', fontStyle: 'italic' }}>
                          {sup.aiRecommendation}
                        </div>

                        <button
                          onClick={() => {
                            setPrForm((prev) => ({
                              ...prev,
                              supplierId: sup.id,
                              materialId: sup.materialId,
                              quantity: sup.moq
                            }));
                            setShowSupplierModal(false);
                            setShowCreatePrModal(true);
                          }}
                          className="admin-btn-primary"
                          style={{ padding: '5px 12px', fontSize: 10.5, borderRadius: 9999 }}
                        >
                          Select & Create PO
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 3: FULL PURCHASE ORDERS DIRECTORY
          ========================================================================= */}
      {showFullPoModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 840, borderRadius: 28, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Purchase Orders Directory & Delivery Tracking
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Tracking multi-material line items, partial receipts, and vendor commitments.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowFullPoModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>PO No.</th>
                    <th style={{ padding: '8px 6px' }}>Supplier</th>
                    <th style={{ padding: '8px 6px' }}>Item & Ordered</th>
                    <th style={{ padding: '8px 6px' }}>Received</th>
                    <th style={{ padding: '8px 6px' }}>Outstanding</th>
                    <th style={{ padding: '8px 6px' }}>Total Amount</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => {
                    const statusBadge = getPoStatusBadge(po.status);
                    const item = po.items[0];
                    return (
                      <tr key={po.poNo} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0a0d10' }}>{po.poNo}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{po.supplierName}</td>
                        <td style={{ padding: '8px 6px' }}>{item?.materialName} ({item?.orderedQuantity.toLocaleString()} {item?.unit})</td>
                        <td style={{ padding: '8px 6px', color: '#18191B', fontWeight: 700 }}>{item?.receivedQuantity.toLocaleString()} {item?.unit}</td>
                        <td style={{ padding: '8px 6px', color: item?.remainingQuantity ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                          {item?.remainingQuantity ? `${item?.remainingQuantity.toLocaleString()} ${item?.unit}` : '0'}
                        </td>
                        <td style={{ padding: '8px 6px', fontWeight: 800 }}>₹{po.totalAmount.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontSize: 10,
                            fontWeight: 700,
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            border: `1px solid ${statusBadge.border}`
                          }}>
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 4: PURCHASE APPROVAL REVIEW WORKSPACE (Requirement 4)
          ========================================================================= */}
      {showApprovalModal && primaryPendingPo && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Review Purchase Requisition: {primaryPendingPo.poNo}
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Managing Director Executive Authority. AI agents cannot independently authorize purchases.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowApprovalModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {/* Landed Cost Breakdown */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 11
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Supplier:</span>
                  <span style={{ fontWeight: 700, color: '#0a0d10' }}>{primaryPendingPo.supplierName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Related Order(s):</span>
                  <span style={{ fontWeight: 700, color: '#18191B' }}>{primaryPendingPo.relatedOrderIds.join(', ')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Material Item:</span>
                  <span>{primaryPendingPo.items[0]?.materialName} &bull; {primaryPendingPo.items[0]?.orderedQuantity.toLocaleString()} {primaryPendingPo.items[0]?.unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Freight & Logistics:</span>
                  <span>₹{primaryPendingPo.transportCost.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 6, fontWeight: 800 }}>
                  <span style={{ color: '#0a0d10' }}>Total Landed Commitment:</span>
                  <span style={{ color: '#18191B', fontSize: 14 }}>₹{primaryPendingPo.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ fontSize: 10.5, color: '#475569' }}>
                <strong>Justification:</strong> {primaryPendingPo.purchaseJustification}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => handleAdminApprovePo(primaryPendingPo.poNo)}
                  className="admin-btn-primary"
                  style={{ flex: 1.2, padding: '10px 16px', fontSize: 12, justifyContent: 'center' }}
                >
                  <Check size={14} />
                  <span>Approve & Authorize Dispatch</span>
                </button>

                <button
                  onClick={() => {
                    setRejectingPoNo(primaryPendingPo.poNo);
                    setShowRejectModal(true);
                  }}
                  style={{
                    flex: 0.8,
                    background: '#ffffff',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    borderRadius: 9999,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 5: ALL PROCUREMENT ALERTS
          ========================================================================= */}
      {showAllAlertsModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 580, borderRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                All Active Procurement Alerts ({alerts.length})
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAllAlertsModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {alerts.map((alt) => (
                <div
                  key={alt.id}
                  style={{
                    background: alt.severity === 'critical' ? '#fef2f2' : alt.severity === 'warning' ? '#fffbeb' : '#F8F0DF',
                    border: `1px solid ${alt.severity === 'critical' ? '#fecaca' : alt.severity === 'warning' ? '#fde68a' : '#edf2ee'}`,
                    borderRadius: 14,
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: alt.severity === 'critical' ? '#dc2626' : '#b45309' }}>
                      {alt.type.replace(/_/g, ' ')}
                    </span>
                    {alt.affectedOrderId && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#475569', background: '#ffffff', padding: '1px 6px', borderRadius: 4 }}>
                        {alt.affectedOrderId}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#1e293b', fontWeight: 600, marginTop: 4 }}>
                    {alt.issue}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    Recommended: <strong>{alt.recommendedAction}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 6: RECORD QC INWARD SHIPMENT
          ========================================================================= */}
      {showInwardModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540, borderRadius: 28, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Gate Inward & Quality Inspection Receipt
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Crucial Governance: ONLY accepted quantity increases physical usable warehouse stock.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowInwardModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmitInwardReceipt} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Target Purchase Order
                </label>
                <select
                  className="admin-form-input"
                  value={inwardForm.poNo}
                  onChange={(e) => {
                    const sel = purchaseOrders.find((p) => p.poNo === e.target.value);
                    setInwardForm((prev) => ({
                      ...prev,
                      poNo: e.target.value,
                      materialId: sel?.items[0]?.materialId || prev.materialId
                    }));
                  }}
                >
                  {purchaseOrders
                    .filter((p) => p.status !== 'Completed' && p.status !== 'Rejected')
                    .map((p) => (
                      <option key={p.poNo} value={p.poNo}>
                        {p.poNo} &bull; {p.supplierName} &bull; {p.items[0]?.materialName}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Material Received
                  </label>
                  <select
                    className="admin-form-input"
                    value={inwardForm.materialId}
                    onChange={(e) => setInwardForm({ ...inwardForm, materialId: e.target.value })}
                  >
                    {inventory.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Supplier Batch / Lot #
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={inwardForm.batchLotNo}
                    onChange={(e) => setInwardForm({ ...inwardForm, batchLotNo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0a0d10', marginBottom: 8 }}>
                  Inward Quantity Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>Inward Total</label>
                    <input
                      type="number"
                      className="admin-form-input"
                      value={inwardForm.inwardQuantity}
                      onChange={(e) => setInwardForm({ ...inwardForm, inwardQuantity: +e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#18191B', fontWeight: 700, display: 'block', marginBottom: 2 }}>Accepted (Usable)</label>
                    <input
                      type="number"
                      className="admin-form-input"
                      style={{ border: '2px solid #edf2ee', background: '#F8F0DF' }}
                      value={inwardForm.acceptedQuantity}
                      onChange={(e) => setInwardForm({ ...inwardForm, acceptedQuantity: +e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, display: 'block', marginBottom: 2 }}>Rejected</label>
                    <input
                      type="number"
                      className="admin-form-input"
                      value={inwardForm.rejectedQuantity}
                      onChange={(e) => setInwardForm({ ...inwardForm, rejectedQuantity: +e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>Damaged</label>
                    <input
                      type="number"
                      className="admin-form-input"
                      value={inwardForm.damagedQuantity}
                      onChange={(e) => setInwardForm({ ...inwardForm, damagedQuantity: +e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Inspector / Receiver Name
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={inwardForm.inspectorName}
                  onChange={(e) => setInwardForm({ ...inwardForm, inspectorName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, justifyContent: 'center' }}
                >
                  <Check size={14} />
                  <span>Verify QC & Commit Usable Inventory</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 9999,
                    padding: '10px 16px',
                    fontSize: 12,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 7: CREATE PURCHASE REQUEST
          ========================================================================= */}
      {showCreatePrModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Initiate New Purchase Request
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Generates an approval requisition. AI cannot authorize dispatch.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCreatePrModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Target Material
                </label>
                <select
                  className="admin-form-input"
                  value={prForm.materialId}
                  onChange={(e) => setPrForm({ ...prForm, materialId: e.target.value })}
                >
                  {inventory.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Selected Supplier Vendor
                </label>
                <select
                  className="admin-form-input"
                  value={prForm.supplierId}
                  onChange={(e) => setPrForm({ ...prForm, supplierId: e.target.value })}
                >
                  {supplierOffers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplierName} &bull; ₹{s.unitPrice}/{s.unit} &bull; {s.leadTimeDays}d lead
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Related Production Order
                  </label>
                  <select
                    className="admin-form-input"
                    value={prForm.relatedOrderId}
                    onChange={(e) => setPrForm({ ...prForm, relatedOrderId: e.target.value })}
                  >
                    <option value="LP-901">Order LP-901</option>
                    <option value="LP-902">Order LP-902</option>
                    <option value="LP-903">Order LP-903</option>
                    <option value="TX-1024">Order TX-1024</option>
                    <option value="TX-1025">Order TX-1025</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Purchase Quantity
                  </label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={prForm.quantity}
                    onChange={(e) => setPrForm({ ...prForm, quantity: +e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Business Justification
                </label>
                <textarea
                  className="admin-form-input"
                  rows={2}
                  value={prForm.justification}
                  onChange={(e) => setPrForm({ ...prForm, justification: e.target.value })}
                  style={{ borderRadius: 12, resize: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, justifyContent: 'center' }}
                >
                  <Plus size={14} />
                  <span>Submit Requisition (Pending Admin Review)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreatePrModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 9999,
                    padding: '10px 16px',
                    fontSize: 12,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 8: REJECT REQUISITION MODAL
          ========================================================================= */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 440, borderRadius: 28, padding: 22 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>
                Reject Purchase Requisition {rejectingPoNo}
              </h2>
              <button className="modal-close-btn" onClick={() => setShowRejectModal(false)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 11, color: '#64748b', marginTop: -6, marginBottom: 12 }}>
              A mandatory business justification is required for the audit log.
            </p>

            <textarea
              className="admin-form-input"
              rows={3}
              placeholder="e.g. Quotation rate exceeds budget threshold. Alternative supplier with lower MOQ requested..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{ borderRadius: 12, resize: 'none', marginBottom: 12 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAdminRejectPo}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  color: '#18191B',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '9px 14px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 9999,
                  padding: '9px 14px',
                  fontSize: 11.5,
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 9: STOCK AUDIT LEDGER
          ========================================================================= */}
      {showAuditModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760, borderRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Inventory Movement Ledger & Audit History
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Immutable log of all material receipts, reservations, and consumptions.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAuditModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>Txn ID</th>
                    <th style={{ padding: '8px 6px' }}>Material</th>
                    <th style={{ padding: '8px 6px' }}>Type</th>
                    <th style={{ padding: '8px 6px' }}>Change</th>
                    <th style={{ padding: '8px 6px' }}>Balance</th>
                    <th style={{ padding: '8px 6px' }}>Reference</th>
                    <th style={{ padding: '8px 6px' }}>Timestamp</th>
                    <th style={{ padding: '8px 6px' }}>Responsible</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0a0d10' }}>{tx.id}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{tx.materialName}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{
                          background: tx.quantityChange > 0 ? '#F8F0DF' : '#f1f5f9',
                          color: tx.quantityChange > 0 ? '#18191B' : '#475569',
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontSize: 9.5,
                          fontWeight: 700
                        }}>
                          {tx.transactionType}
                        </span>
                      </td>
                      <td style={{
                        padding: '8px 6px',
                        fontWeight: 800,
                        color: tx.quantityChange > 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange} {tx.unit}
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{tx.balanceAfter} {tx.unit}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{tx.relatedRef}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{tx.timestamp}</td>
                      <td style={{ padding: '8px 6px', color: '#0a0d10', fontWeight: 600 }}>{tx.userResponsible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOAST NOTIFICATION
          ========================================================================= */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#79B4B7', color: '#18191B',
          borderRadius: 14,
          padding: '10px 18px',
          fontSize: 11.5,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 9999
        }}>
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

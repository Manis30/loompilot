import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Layers,
  ChevronRight,
  Search,
  Plus,
  History,
  AlertCircle,
  Check,
  X,
  SlidersHorizontal,
  MoreVertical,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import type { Order, AppUser } from '../../types';

// =========================================================================
// DATA MODELS & TYPES
// =========================================================================

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'delayed' | 'blocked';

export interface ProductionStageDetail {
  id: string;
  stageNumber: number; // 1 to 6
  name: string;        // 'Yarn Inward', 'Warping & Sizing', 'Loom Weaving', 'Dyeing & Finishing', 'Quality Inspection', 'Dispatch'
  department: string;
  status: StageStatus;
  plannedStartDate: string;
  actualStartDate: string;
  plannedCompletionDate: string;
  actualCompletionDate: string;
  targetQuantity: number;
  producedQuantity: number;
  rejectedQuantity: number;
  remainingQuantity: number;
  assignedSupervisor: string;
  assignedMachine: string;
  workersCount: number;
  dailyTarget: number;
  dailyActual: number;
  delayReason?: string;
  recoveryAction?: string;
  notes?: string;
}

export interface ProductProductionItem {
  id: string; // e.g. 'LP-901-A'
  name: string; // 'Formal Shirt - Design A'
  designCode: string; // 'FS-A-01'
  category: string;
  quantity: number; // pieces
  completedQuantity: number;
  rejectedQuantity: number;
  remainingQuantity: number;
  currentStage: string;
  progressPercent: number;
  riskStatus: 'on_track' | 'at_risk' | 'delayed' | 'completed';
  riskReason?: string;
  stages: ProductionStageDetail[];
}

export interface ProductionOrderWithProducts {
  id: string; // e.g. 'LP-901'
  clientName: string;
  clientEmail: string;
  productCategory: string;
  totalQuantity: number; // Sum of product quantities
  orderDate: string;
  committedDeliveryDate: string;
  forecastDeliveryDate: string;
  status: 'not_started' | 'in_production' | 'at_risk' | 'delayed' | 'completed';
  riskStatus: 'on_track' | 'at_risk' | 'delayed';
  riskReason?: string;
  assignedSupervisorId: string;
  assignedSupervisorName: string;
  products: ProductProductionItem[];
}

export interface SupervisorShiftReport {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  stageName: string;
  machineId: string;
  workersAssigned: number;
  dailyTargetQuantity: number;
  actualProducedQuantity: number;
  rejectedQuantity: number;
  machineDowntimeMinutes: number;
  delayReason?: string;
  remarks: string;
  submittedBy: string;
  timestamp: string;
}

export interface ProductionRiskAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  alertType:
    | 'material_shortage'
    | 'supplier_delay'
    | 'machine_downtime'
    | 'worker_shortage'
    | 'below_target'
    | 'quality_spike';
  affectedOrderId: string;
  affectedProductId: string;
  affectedProductName: string;
  affectedStage: string;
  reason: string;
  businessImpact: string;
  detectedTime: string;
  suggestedAction: string;
}

// =========================================================================
// DEFAULT 6-STAGE FACTORY TEMPLATE
// =========================================================================

const generateSixStages = (
  productId: string,
  productQuantity: number,
  targetStageNum: number, // Which stage is current (1 to 6)
  supervisor: string,
  isAtRisk: boolean = false
): ProductionStageDetail[] => {
  const stageDefs = [
    { num: 1, name: 'Yarn Inward', dept: 'Raw Material Bay & Cone Lab', machine: 'Zellweger Uster Yarn Tester #2' },
    { num: 2, name: 'Warping & Sizing', dept: 'Warping Hall B', machine: 'Karl Mayer Direct Warper & Sucker Sizing Line' },
    { num: 3, name: 'Loom Weaving', dept: 'Airjet Weaving Shed 1', machine: 'Toyota JAT810 Airjet Looms #12-16' },
    { num: 4, name: 'Dyeing & Finishing', dept: 'Continuous Finishing Shed C', machine: 'Monforts 8-Chamber Stenter & Jigger #4' },
    { num: 5, name: 'Quality Inspection', dept: 'Fabric & Garment QA Bay', machine: 'Daro 4-Point Illuminated QA Table #1' },
    { num: 6, name: 'Dispatch', dept: 'Automated Cartoning & Export Bay', machine: 'Strapping & Barcode Verification Unit' }
  ];

  return stageDefs.map((def) => {
    let status: StageStatus = 'pending';
    let progress = 0;
    let produced = 0;
    let rejected = 0;
    let actualStart = 'Pending';
    let actualEnd = 'Pending';

    if (def.num < targetStageNum) {
      status = 'completed';
      progress = 100;
      produced = productQuantity;
      rejected = Math.round(productQuantity * 0.008); // 0.8% normal variance
      actualStart = 'Oct 2026';
      actualEnd = 'Oct 2026';
    } else if (def.num === targetStageNum) {
      status = isAtRisk ? 'delayed' : 'in_progress';
      progress = isAtRisk ? 42 : 80;
      produced = Math.round(productQuantity * (progress / 100));
      rejected = Math.round(produced * 0.015);
      actualStart = '28 Oct 2026';
      actualEnd = 'Ongoing';
    }

    const remaining = Math.max(0, productQuantity - produced);
    const dailyTarget = Math.round(productQuantity / 4) || 500;
    const dailyActual = status === 'completed' ? dailyTarget : (isAtRisk ? Math.round(dailyTarget * 0.65) : Math.round(dailyTarget * 0.95));

    return {
      id: `${productId}_stg_${def.num}`,
      stageNumber: def.num,
      name: def.name,
      department: def.dept,
      status,
      plannedStartDate: '24 Oct 2026',
      actualStartDate: actualStart,
      plannedCompletionDate: '05 Nov 2026',
      actualCompletionDate: actualEnd,
      targetQuantity: productQuantity,
      producedQuantity: produced,
      rejectedQuantity: rejected,
      remainingQuantity: remaining,
      assignedSupervisor: supervisor,
      assignedMachine: def.machine,
      workersCount: def.num === 3 ? 18 : (def.num === 4 ? 12 : 8),
      dailyTarget,
      dailyActual,
      delayReason: isAtRisk && def.num === targetStageNum ? 'Raw material deficit & loom pace below daily target' : undefined,
      recoveryAction: isAtRisk && def.num === targetStageNum ? 'Authorize 2-hour shift overtime and expedite PO dispatch' : undefined,
      notes: `${def.name} operations on ${def.machine}`
    };
  });
};

// =========================================================================
// INITIAL MOCK MASTER PRODUCTION ORDERS (With Multi-Product Breakdown)
// =========================================================================

const INITIAL_PRODUCTION_ORDERS: ProductionOrderWithProducts[] = [
  // Order LP-901: Fashion House (5,000 pcs across 3 distinct designs)
  {
    id: 'LP-901',
    clientName: 'Fashion House',
    clientEmail: 'procurement@fashionhouse.com',
    productCategory: 'Apparel (Formalwear & Trousers)',
    totalQuantity: 5000,
    orderDate: '20 Oct 2026',
    committedDeliveryDate: '05 Nov 2026',
    forecastDeliveryDate: '04 Nov 2026', // On track
    status: 'in_production',
    riskStatus: 'on_track',
    riskReason: 'Almost completed · Quality inspection underway',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar (Floor Supervisor)',
    products: [
      {
        id: 'LP-901-A',
        name: 'Formal Shirt - Design A',
        designCode: 'FS-A-01',
        category: 'Formalwear',
        quantity: 2000,
        completedQuantity: 1800,
        rejectedQuantity: 20,
        remainingQuantity: 200,
        currentStage: 'Quality Inspection',
        progressPercent: 90,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-901-A', 2000, 5, 'Ramesh Kumar')
      },
      {
        id: 'LP-901-B',
        name: 'Formal Pants - Design B',
        designCode: 'FP-B-02',
        category: 'Trousers',
        quantity: 1500,
        completedQuantity: 1275,
        rejectedQuantity: 15,
        remainingQuantity: 225,
        currentStage: 'Quality Inspection',
        progressPercent: 85,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-901-B', 1500, 5, 'Ramesh Kumar')
      },
      {
        id: 'LP-901-C',
        name: 'Casual Shirt - Design C',
        designCode: 'CS-C-03',
        category: 'Casualwear',
        quantity: 1500,
        completedQuantity: 1200,
        rejectedQuantity: 10,
        remainingQuantity: 300,
        currentStage: 'Dyeing & Finishing',
        progressPercent: 80,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-901-C', 1500, 4, 'Ramesh Kumar')
      }
    ]
  },

  // Order LP-902: Urban Textiles (8,000 pcs across 2 products - AT RISK)
  {
    id: 'LP-902',
    clientName: 'Urban Textiles',
    clientEmail: 'orders@urbantextiles.com',
    productCategory: 'Apparel (Shirts)',
    totalQuantity: 8000,
    orderDate: '22 Oct 2026',
    committedDeliveryDate: '06 Nov 2026',
    forecastDeliveryDate: '09 Nov 2026', // 3-day forecast delay!
    status: 'at_risk',
    riskStatus: 'at_risk',
    riskReason: 'Material shortage (600m raw fabric) & weaving paced 35% below daily target',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar (Floor Supervisor)',
    products: [
      {
        id: 'LP-902-A',
        name: 'Urban Cotton Oxford Shirt',
        designCode: 'UCO-01',
        category: 'Shirts',
        quantity: 5000,
        completedQuantity: 2100,
        rejectedQuantity: 35,
        remainingQuantity: 2900,
        currentStage: 'Loom Weaving',
        progressPercent: 42,
        riskStatus: 'at_risk',
        riskReason: 'Awaiting raw fabric batch PO-1001 arrival from Sri Textiles',
        stages: generateSixStages('LP-902-A', 5000, 3, 'Ramesh Kumar', true)
      },
      {
        id: 'LP-902-B',
        name: 'Urban Poplin Shirt',
        designCode: 'UPS-02',
        category: 'Shirts',
        quantity: 3000,
        completedQuantity: 1260,
        rejectedQuantity: 25,
        remainingQuantity: 1740,
        currentStage: 'Loom Weaving',
        progressPercent: 42,
        riskStatus: 'at_risk',
        riskReason: 'Weaving paced below daily target (650 vs 1,000 pcs/day)',
        stages: generateSixStages('LP-902-B', 3000, 3, 'Ramesh Kumar', true)
      }
    ]
  },

  // Order LP-903: Style World (3,500 pcs - Bedsheets)
  {
    id: 'LP-903',
    clientName: 'Style World',
    clientEmail: 'procurement@styleworld.com',
    productCategory: 'Home Living (Bedding)',
    totalQuantity: 3500,
    orderDate: '24 Oct 2026',
    committedDeliveryDate: '12 Nov 2026',
    forecastDeliveryDate: '12 Nov 2026',
    status: 'in_production',
    riskStatus: 'on_track',
    riskReason: 'Warping & sizing cleared on schedule',
    assignedSupervisorId: 'usr_sup_2',
    assignedSupervisorName: 'Murugan K. (Warping Supervisor)',
    products: [
      {
        id: 'LP-903-A',
        name: 'King Size Bedsheet Set (300 TC)',
        designCode: 'BS-K-01',
        category: 'Bedding',
        quantity: 2000,
        completedQuantity: 500,
        rejectedQuantity: 8,
        remainingQuantity: 1500,
        currentStage: 'Warping & Sizing',
        progressPercent: 25,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-903-A', 2000, 2, 'Murugan K.')
      },
      {
        id: 'LP-903-B',
        name: 'Queen Size Bedsheet Set (300 TC)',
        designCode: 'BS-Q-02',
        category: 'Bedding',
        quantity: 1500,
        completedQuantity: 375,
        rejectedQuantity: 5,
        remainingQuantity: 1125,
        currentStage: 'Warping & Sizing',
        progressPercent: 25,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-903-B', 1500, 2, 'Murugan K.')
      }
    ]
  },

  // Order LP-904: Home Living (1,200 pcs - Curtains)
  {
    id: 'LP-904',
    clientName: 'Home Living',
    clientEmail: 'orders@homeliving.com',
    productCategory: 'Drapes & Curtains',
    totalQuantity: 1200,
    orderDate: '26 Oct 2026',
    committedDeliveryDate: '20 Nov 2026',
    forecastDeliveryDate: '20 Nov 2026',
    status: 'in_production',
    riskStatus: 'on_track',
    riskReason: 'Yarn inward verified. Warping preparation active.',
    assignedSupervisorId: 'usr_sup_2',
    assignedSupervisorName: 'Murugan K. (Warping Supervisor)',
    products: [
      {
        id: 'LP-904-A',
        name: 'Blackout Curtains - Gold Jacquard',
        designCode: 'CUR-BJ-01',
        category: 'Drapes',
        quantity: 700,
        completedQuantity: 70,
        rejectedQuantity: 2,
        remainingQuantity: 630,
        currentStage: 'Yarn Inward',
        progressPercent: 10,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-904-A', 700, 1, 'Murugan K.')
      },
      {
        id: 'LP-904-B',
        name: 'Sheer Linen Drapes - Ivory',
        designCode: 'CUR-SL-02',
        category: 'Drapes',
        quantity: 500,
        completedQuantity: 50,
        rejectedQuantity: 1,
        remainingQuantity: 450,
        currentStage: 'Yarn Inward',
        progressPercent: 10,
        riskStatus: 'on_track',
        stages: generateSixStages('LP-904-B', 500, 1, 'Murugan K.')
      }
    ]
  },

  // Order TX-1024: ABC Garments (5,000 pcs)
  {
    id: 'TX-1024',
    clientName: 'ABC Garments',
    clientEmail: 'orders@abcgarments.com',
    productCategory: 'Shirts',
    totalQuantity: 5000,
    orderDate: '18 Oct 2026',
    committedDeliveryDate: '15 Nov 2026',
    forecastDeliveryDate: '14 Nov 2026',
    status: 'in_production',
    riskStatus: 'on_track',
    riskReason: 'Loom weaving completed; dyeing active',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar (Floor Supervisor)',
    products: [
      {
        id: 'TX-1024-A',
        name: 'Cotton Oxford Shirt',
        designCode: 'COS-01',
        category: 'Shirts',
        quantity: 3000,
        completedQuantity: 1950,
        rejectedQuantity: 25,
        remainingQuantity: 1050,
        currentStage: 'Dyeing & Finishing',
        progressPercent: 65,
        riskStatus: 'on_track',
        stages: generateSixStages('TX-1024-A', 3000, 4, 'Ramesh Kumar')
      },
      {
        id: 'TX-1024-B',
        name: 'Twill Formal Shirt',
        designCode: 'TFS-02',
        category: 'Shirts',
        quantity: 2000,
        completedQuantity: 1240,
        rejectedQuantity: 18,
        remainingQuantity: 760,
        currentStage: 'Loom Weaving',
        progressPercent: 62,
        riskStatus: 'on_track',
        stages: generateSixStages('TX-1024-B', 2000, 3, 'Ramesh Kumar')
      }
    ]
  },

  // Order TX-1025: StyleMart (3,000 pcs - AT RISK)
  {
    id: 'TX-1025',
    clientName: 'StyleMart',
    clientEmail: 'orders@stylemart.com',
    productCategory: 'Printed Fabric',
    totalQuantity: 3000,
    orderDate: '21 Oct 2026',
    committedDeliveryDate: '18 Nov 2026',
    forecastDeliveryDate: '21 Nov 2026', // 3-day forecast delay!
    status: 'at_risk',
    riskStatus: 'at_risk',
    riskReason: 'Reactive chemical dye deficit (50 kg) blocking continuous dyeing',
    assignedSupervisorId: 'usr_sup_3',
    assignedSupervisorName: 'Priya Sharma (Dyeing Chemist)',
    products: [
      {
        id: 'TX-1025-A',
        name: 'Indigo Block Printed Fabric (60")',
        designCode: 'PRT-IND-01',
        category: 'Fabric',
        quantity: 3000,
        completedQuantity: 1050,
        rejectedQuantity: 40,
        remainingQuantity: 1950,
        currentStage: 'Dyeing & Finishing',
        progressPercent: 35,
        riskStatus: 'at_risk',
        riskReason: 'Awaiting chemical shipment PO-1003 delivery',
        stages: generateSixStages('TX-1025-A', 3000, 4, 'Priya Sharma', true)
      }
    ]
  },

  // Order TX-1026: HomeNest (2,000 pcs - COMPLETED)
  {
    id: 'TX-1026',
    clientName: 'HomeNest',
    clientEmail: 'orders@homenest.com',
    productCategory: 'Apparel (Trousers)',
    totalQuantity: 2000,
    orderDate: '12 Oct 2026',
    committedDeliveryDate: '20 Nov 2026',
    forecastDeliveryDate: '28 Oct 2026', // Completed early!
    status: 'completed',
    riskStatus: 'on_track',
    riskReason: '100% produced, inspected and cartoned for dispatch',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar (Floor Supervisor)',
    products: [
      {
        id: 'TX-1026-A',
        name: 'Casual Linen Chinos',
        designCode: 'LCN-01',
        category: 'Trousers',
        quantity: 2000,
        completedQuantity: 2000,
        rejectedQuantity: 14,
        remainingQuantity: 0,
        currentStage: 'Dispatch',
        progressPercent: 100,
        riskStatus: 'completed',
        stages: generateSixStages('TX-1026-A', 2000, 7, 'Ramesh Kumar')
      }
    ]
  },

  // Order TX-1027: TechCart (4,500 pcs - NOT STARTED)
  {
    id: 'TX-1027',
    clientName: 'TechCart',
    clientEmail: 'orders@techcart.com',
    productCategory: 'Apparel (Polo)',
    totalQuantity: 4500,
    orderDate: '28 Oct 2026',
    committedDeliveryDate: '22 Nov 2026',
    forecastDeliveryDate: '22 Nov 2026',
    status: 'not_started',
    riskStatus: 'on_track',
    riskReason: 'Production planning scheduled; yarn lot scheduled for receipt',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar (Floor Supervisor)',
    products: [
      {
        id: 'TX-1027-A',
        name: 'Classic Pique Polo T-Shirt',
        designCode: 'POL-01',
        category: 'Polos',
        quantity: 4500,
        completedQuantity: 0,
        rejectedQuantity: 0,
        remainingQuantity: 4500,
        currentStage: 'Yarn Inward',
        progressPercent: 0,
        riskStatus: 'on_track',
        stages: generateSixStages('TX-1027-A', 4500, 1, 'Ramesh Kumar')
      }
    ]
  }
];

const INITIAL_RISK_ALERTS: ProductionRiskAlert[] = [
  {
    id: 'pra_1',
    severity: 'critical',
    alertType: 'material_shortage',
    affectedOrderId: 'LP-902',
    affectedProductId: 'LP-902-A',
    affectedProductName: 'Urban Cotton Oxford Shirt',
    affectedStage: 'Loom Weaving',
    reason: '600m raw cotton fabric shortfall halting Airjet Loom #12-14.',
    businessImpact: 'Forecast delivery slips from 06 Nov to 09 Nov (3 days late).',
    detectedTime: '15 mins ago',
    suggestedAction: 'Release expedited supplier PO-1001 with Sri Textiles.'
  },
  {
    id: 'pra_2',
    severity: 'critical',
    alertType: 'material_shortage',
    affectedOrderId: 'TX-1025',
    affectedProductId: 'TX-1025-A',
    affectedProductName: 'Indigo Block Printed Fabric',
    affectedStage: 'Dyeing & Finishing',
    reason: '50 kg reactive chemical dye deficit halting dye vats.',
    businessImpact: '3-day finishing stall pushing delivery to 21 Nov.',
    detectedTime: '45 mins ago',
    suggestedAction: 'Authorize emergency regional chemical transfer.'
  },
  {
    id: 'pra_3',
    severity: 'warning',
    alertType: 'below_target',
    affectedOrderId: 'LP-902',
    affectedProductId: 'LP-902-B',
    affectedProductName: 'Urban Poplin Shirt',
    affectedStage: 'Loom Weaving',
    reason: 'Actual weaving pace is 650 pcs/day vs committed target of 1,000 pcs/day (35% shortfall).',
    businessImpact: 'Daily variance -350 pcs accumulating schedule deficit.',
    detectedTime: '2 hours ago',
    suggestedAction: 'Deploy 2-hour supervisor overtime on Shift B.'
  },
  {
    id: 'pra_4',
    severity: 'info',
    alertType: 'machine_downtime',
    affectedOrderId: 'LP-901',
    affectedProductId: 'LP-901-C',
    affectedProductName: 'Casual Shirt - Design C',
    affectedStage: 'Dyeing & Finishing',
    reason: 'Stenter line chamber #3 temperature sensor recalibrated (30 mins downtime).',
    businessImpact: 'Negligible; buffered within finishing shift.',
    detectedTime: '3 hours ago',
    suggestedAction: 'Preventative sensor check scheduled for weekend maintenance.'
  }
];

const INITIAL_SHIFT_REPORTS: SupervisorShiftReport[] = [
  {
    id: 'rep_101',
    orderId: 'LP-901',
    productId: 'LP-901-A',
    productName: 'Formal Shirt - Design A',
    stageName: 'Quality Inspection',
    machineId: 'Daro 4-Point QA Table #1',
    workersAssigned: 8,
    dailyTargetQuantity: 500,
    actualProducedQuantity: 480,
    rejectedQuantity: 8,
    machineDowntimeMinutes: 15,
    remarks: '480 pieces passed 4-point visual inspection with 98.4% first-pass yield.',
    submittedBy: 'Ramesh Kumar (Floor Supervisor)',
    timestamp: '30 Oct 2026 11:30 AM'
  },
  {
    id: 'rep_102',
    orderId: 'LP-902',
    productId: 'LP-902-B',
    productName: 'Urban Poplin Shirt',
    stageName: 'Loom Weaving',
    machineId: 'Toyota JAT810 Airjet Looms #14',
    workersAssigned: 12,
    dailyTargetQuantity: 1000,
    actualProducedQuantity: 650,
    rejectedQuantity: 25,
    machineDowntimeMinutes: 45,
    delayReason: 'Weft yarn breakage & waiting for spare spool replenishment.',
    remarks: 'Paced below daily target. Air pressure adjusted; shift overtime advised.',
    submittedBy: 'Ramesh Kumar (Floor Supervisor)',
    timestamp: '30 Oct 2026 09:15 AM'
  }
];

// =========================================================================
// PROPS INTERFACE (Preserving existing contract)
// =========================================================================

interface ProductionTrackingModuleProps {
  orders?: Order[];
  supervisors?: AppUser[];
  onSelectOrder?: (orderId: string) => void;
  onOpenOrderModal?: (order: Order) => void;
  onUpdateClientProgressView?: (orderId: string) => void;
  onInvestigateDelay?: (orderId: string) => void;
}

export const ProductionTrackingModule: React.FC<ProductionTrackingModuleProps> = ({
  onSelectOrder,
  onOpenOrderModal: _onOpenOrderModal,
  onInvestigateDelay: _onInvestigateDelay
}) => {
  // Master Production Orders State
  const [productionOrders, setProductionOrders] = useState<ProductionOrderWithProducts[]>(INITIAL_PRODUCTION_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('LP-901');
  const [selectedProductId, setSelectedProductId] = useState<string>('LP-901-A');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWorkspace, setShowWorkspace] = useState<boolean>(true);

  // Alerts & Shift Reports State
  const [riskAlerts] = useState<ProductionRiskAlert[]>(INITIAL_RISK_ALERTS);
  const [shiftReports, setShiftReports] = useState<SupervisorShiftReport[]>(INITIAL_SHIFT_REPORTS);

  // Modals & Dedicated Workspaces
  const [showTimelineModal, setShowTimelineModal] = useState<boolean>(false);
  const [showShiftUpdateModal, setShowShiftUpdateModal] = useState<boolean>(false);
  const [showShiftHistoryModal, setShowShiftHistoryModal] = useState<boolean>(false);
  const [showAllAlertsModal, setShowAllAlertsModal] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Shift Log Form State
  const [shiftForm, setShiftForm] = useState({
    orderId: 'LP-901',
    productId: 'LP-901-A',
    stageName: 'Quality Inspection',
    machineId: 'Daro 4-Point QA Table #1',
    workersAssigned: 8,
    dailyTargetQuantity: 500,
    actualProducedQuantity: 480,
    rejectedQuantity: 8,
    machineDowntimeMinutes: 0,
    delayReason: '',
    remarks: 'Shift completed with 98.4% first-pass inspection yield.',
    submittedBy: 'Ramesh Kumar (Floor Supervisor)'
  });

  // =========================================================================
  // DYNAMIC CALCULATIONS & METRICS (Section 2 & 4)
  // =========================================================================

  // Helper to calculate exact Quantity-Weighted Order Progress (Section 4 formula)
  const calculateQuantityWeightedProgress = (order: ProductionOrderWithProducts): number => {
    if (!order.products || order.products.length === 0) return 0;
    const totalQty = order.products.reduce((acc, p) => acc + p.quantity, 0);
    if (totalQty === 0) return 0;
    const weightedSum = order.products.reduce((acc, p) => acc + (p.quantity * p.progressPercent), 0);
    return Math.round(weightedSum / totalQty);
  };

  // Enrich orders with calculated weighted progress
  const enrichedOrders = useMemo(() => {
    return productionOrders.map((ord) => ({
      ...ord,
      weightedProgress: calculateQuantityWeightedProgress(ord)
    }));
  }, [productionOrders]);

  // Section 2: Four Key KPIs (Calculated dynamically)
  const activeOrdersCount = enrichedOrders.filter(
    (o) => o.weightedProgress > 0 && o.weightedProgress < 100
  ).length;

  const atRiskOrdersCount = enrichedOrders.filter(
    (o) => o.riskStatus === 'at_risk' || o.status === 'at_risk'
  ).length;

  const completedOrdersCount = enrichedOrders.filter(
    (o) => o.weightedProgress === 100 || o.status === 'completed'
  ).length;

  const onTimeDeliveryPercent = useMemo(() => {
    const totalFinishedOrCommitted = enrichedOrders.filter((o) => o.weightedProgress > 0).length;
    if (totalFinishedOrCommitted === 0) return 100;
    const onTimeCount = enrichedOrders.filter(
      (o) => o.weightedProgress > 0 && o.riskStatus === 'on_track'
    ).length;
    return Math.round((onTimeCount / totalFinishedOrCommitted) * 100);
  }, [enrichedOrders]);

  // Filtered Orders List (Section 3)
  const filteredOrders = useMemo(() => {
    return enrichedOrders.filter((o) => {
      // Filter by status tab
      if (orderStatusFilter === 'in_production' && (o.weightedProgress === 0 || o.weightedProgress === 100)) return false;
      if (orderStatusFilter === 'at_risk' && o.riskStatus !== 'at_risk') return false;
      if (orderStatusFilter === 'completed' && o.weightedProgress !== 100) return false;
      if (orderStatusFilter === 'not_started' && o.weightedProgress !== 0) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesClient = o.clientName.toLowerCase().includes(q);
        const matchesProduct = o.products.some((p) => p.name.toLowerCase().includes(q));
        if (!matchesId && !matchesClient && !matchesProduct) return false;
      }

      return true;
    });
  }, [enrichedOrders, orderStatusFilter, searchQuery]);

  // Active Selected Order
  const currentOrder = useMemo(() => {
    return enrichedOrders.find((o) => o.id === selectedOrderId) || enrichedOrders[0];
  }, [enrichedOrders, selectedOrderId]);

  // Active Selected Product
  const currentProduct = useMemo(() => {
    const found = currentOrder.products.find((p) => p.id === selectedProductId);
    return found || currentOrder.products[0];
  }, [currentOrder, selectedProductId]);

  // Active Production Stage of the current product
  const currentActiveStage = useMemo(() => {
    const inProg = currentProduct.stages.find((s) => s.status === 'in_progress' || s.status === 'delayed');
    return inProg || currentProduct.stages[currentProduct.stages.length - 1];
  }, [currentProduct]);

  // Planned vs Actual Performance Metrics for the active stage (Section 6)
  const dailyTarget = currentActiveStage.dailyTarget || 1000;
  const dailyActual = currentActiveStage.dailyActual || 750;
  const dailyVariance = dailyActual - dailyTarget;
  const dailyAchievementPercent = Math.round((dailyActual / (dailyTarget || 1)) * 100);

  // Top 3 alerts for overview (Section 7)
  const topAlerts = useMemo(() => {
    return riskAlerts.slice(0, 3);
  }, [riskAlerts]);

  // =========================================================================
  // ACTIONS & STAGE PROGRESSION RULES (Section 8 & 9)
  // =========================================================================

  // Handle Order Selection
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = enrichedOrders.find((o) => o.id === orderId);
    if (ord && ord.products.length > 0) {
      setSelectedProductId(ord.products[0].id);
    }
    if (onSelectOrder) {
      onSelectOrder(orderId);
    }
  };

  // Submit Supervisor Daily Shift Report (Section 8)
  const handleSubmitShiftReport = (e: React.FormEvent) => {
    e.preventDefault();

    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newReportId = `REP-${100 + shiftReports.length + 1}`;

    const newReport: SupervisorShiftReport = {
      id: newReportId,
      orderId: shiftForm.orderId,
      productId: shiftForm.productId,
      productName: currentProduct.name,
      stageName: shiftForm.stageName,
      machineId: shiftForm.machineId,
      workersAssigned: Number(shiftForm.workersAssigned),
      dailyTargetQuantity: Number(shiftForm.dailyTargetQuantity),
      actualProducedQuantity: Number(shiftForm.actualProducedQuantity),
      rejectedQuantity: Number(shiftForm.rejectedQuantity),
      machineDowntimeMinutes: Number(shiftForm.machineDowntimeMinutes),
      delayReason: shiftForm.delayReason || undefined,
      remarks: shiftForm.remarks,
      submittedBy: shiftForm.submittedBy,
      timestamp
    };

    // 1. Append immutable audit history
    setShiftReports((prev) => [newReport, ...prev]);

    // 2. Update the target product's active stage produced & rejected quantities
    setProductionOrders((prevOrders) =>
      prevOrders.map((ord) => {
        if (ord.id === shiftForm.orderId) {
          const updatedProducts = ord.products.map((prod) => {
            if (prod.id === shiftForm.productId) {
              const updatedStages = prod.stages.map((stg) => {
                if (stg.name === shiftForm.stageName) {
                  const newProduced = stg.producedQuantity + Number(shiftForm.actualProducedQuantity);
                  const newRejected = stg.rejectedQuantity + Number(shiftForm.rejectedQuantity);
                  const isStageComplete = newProduced >= stg.targetQuantity;

                  return {
                    ...stg,
                    producedQuantity: newProduced,
                    rejectedQuantity: newRejected,
                    remainingQuantity: Math.max(0, stg.targetQuantity - newProduced),
                    dailyActual: Number(shiftForm.actualProducedQuantity),
                    status: isStageComplete ? ('completed' as StageStatus) : stg.status
                  };
                }
                return stg;
              });

              // Recalculate product progress
              const totalCompletedPieces = updatedStages[updatedStages.length - 1].producedQuantity;
              const newProgress = Math.min(100, Math.round((totalCompletedPieces / prod.quantity) * 100));

              return {
                ...prod,
                completedQuantity: totalCompletedPieces,
                rejectedQuantity: prod.rejectedQuantity + Number(shiftForm.rejectedQuantity),
                remainingQuantity: Math.max(0, prod.quantity - totalCompletedPieces),
                progressPercent: newProgress,
                stages: updatedStages
              };
            }
            return prod;
          });

          return {
            ...ord,
            products: updatedProducts
          };
        }
        return ord;
      })
    );

    showToast(`Shift Report ${newReportId} logged! +${shiftForm.actualProducedQuantity} pcs committed to ${shiftForm.stageName}.`);
    setShowShiftUpdateModal(false);
  };

  // Section 9: Logical Stage Progression (Completing a stage and advancing)
  const handleAdvanceStage = (orderId: string, productId: string, currentStageNumber: number) => {
    // Stage rule check: Cannot skip stages; Dispatch requires Quality Inspection passed!
    if (currentStageNumber >= 6) {
      alert('Product is already in the final Dispatch stage.');
      return;
    }

    setProductionOrders((prevOrders) =>
      prevOrders.map((ord) => {
        if (ord.id === orderId) {
          const updatedProducts = ord.products.map((prod) => {
            if (prod.id === productId) {
              const updatedStages = prod.stages.map((stg) => {
                if (stg.stageNumber === currentStageNumber) {
                  return {
                    ...stg,
                    status: 'completed' as StageStatus,
                    actualCompletionDate: '30 Oct 2026'
                  };
                }
                if (stg.stageNumber === currentStageNumber + 1) {
                  return {
                    ...stg,
                    status: 'in_progress' as StageStatus,
                    actualStartDate: '30 Oct 2026'
                  };
                }
                return stg;
              });

              const nextStageName = updatedStages.find((s) => s.stageNumber === currentStageNumber + 1)?.name || prod.currentStage;

              return {
                ...prod,
                currentStage: nextStageName,
                stages: updatedStages
              };
            }
            return prod;
          });

          return {
            ...ord,
            products: updatedProducts
          };
        }
        return ord;
      })
    );

    showToast(`Stage ${currentStageNumber} verified & completed! Advanced product to Stage ${currentStageNumber + 1}.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* =========================================================================
          1. CLEAN PAGE HEADER
          ========================================================================= */}
      <div className="module-header-flat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a0d10', letterSpacing: '-0.02em', margin: 0 }}>
            Production Tracking
          </h1>
          
        </div>

        {/* Global Module Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowShiftHistoryModal(true)}
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
            Shift Log History
          </button>

          <button
            className="admin-btn-primary"
            onClick={() => {
              setShiftForm((prev) => ({
                ...prev,
                orderId: currentOrder.id,
                productId: currentProduct.id,
                stageName: currentActiveStage.name
              }));
              setShowShiftUpdateModal(true);
            }}
            style={{ padding: '6px 14px', fontSize: 11, borderRadius: 9999 }}
          >
            <Plus size={13} />
            Log Shift Update
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. FOUR UNTITLED UI KPI METRIC CARDS (Exact match to Reference Image 1)
          ========================================================================= */}
      <div className="untitled-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* KPI 1: Active Orders */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Active Orders</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{activeOrdersCount}</span>
            <span className="untitled-kpi-badge indigo">In manufacturing</span>
          </div>
        </div>

        {/* KPI 2: At-Risk Orders */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">At-Risk Orders</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value" style={{ color: atRiskOrdersCount > 0 ? '#b42318' : '#101828' }}>
              {atRiskOrdersCount}
            </span>
            <span className={`untitled-kpi-badge ${atRiskOrdersCount > 0 ? 'danger' : 'success'}`}>
              {atRiskOrdersCount > 0 ? 'Action needed' : 'All on track'}
            </span>
          </div>
        </div>

        {/* KPI 3: Completed Orders */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Completed Orders</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{completedOrdersCount}</span>
            <span className="untitled-kpi-badge success"><ArrowUp size={11} strokeWidth={2.5} /> 100% dispatched</span>
          </div>
        </div>

        {/* KPI 4: On-Time Delivery */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">On-Time Delivery</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{onTimeDeliveryPercent}%</span>
            <span className="untitled-kpi-badge success">Target: 95%</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN CONTENT: FULL-WIDTH PRODUCTION ORDERS TABLE + ORDER WORKSPACE
          ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* FULL-WIDTH Production Orders (Untitled UI Modern Table Card) */}
        <div className="untitled-table-card" style={{ width: '100%' }}>
          {/* Table Toolbar */}
          <div className="untitled-table-toolbar">
            <div className="untitled-toolbar-filters">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                <Layers size={18} color="#18191B" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#101828', margin: 0 }}>
                  Production Orders
                </h3>
              </div>

              <button
                type="button"
                className={`untitled-filter-pill ${orderStatusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('all')}
              >
                All orders
              </button>
              <button
                type="button"
                className={`untitled-filter-pill ${orderStatusFilter === 'in_production' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('in_production')}
              >
                In Production
              </button>
              <button
                type="button"
                className={`untitled-filter-pill ${orderStatusFilter === 'at_risk' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('at_risk')}
              >
                At Risk {orderStatusFilter === 'at_risk' && <span className="untitled-filter-remove">&times;</span>}
              </button>
              <button
                type="button"
                className={`untitled-filter-pill ${orderStatusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter('completed')}
              >
                Completed
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search input */}
              <div className="untitled-search-input-wrap">
                <Search size={14} color="#667085" />
                <input
                  type="text"
                  className="untitled-search-input"
                  placeholder="Search order, client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="untitled-filter-remove"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Workspace Toggle */}
              <button
                type="button"
                className={`untitled-filter-pill ${showWorkspace ? 'active' : ''}`}
                onClick={() => setShowWorkspace(!showWorkspace)}
                style={{ fontWeight: 600, color: '#18191B' }}
              >
                {showWorkspace ? 'Hide Order Workspace' : 'Show Order Workspace'}
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
                      checked={filteredOrders.length > 0 && selectedOrderId === filteredOrders[0].id}
                      onChange={() => {}}
                    />
                  </th>
                  <th style={{ width: 120 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Order # <ArrowDown size={12} color="#667085" />
                    </div>
                  </th>
                  <th>Client / Company</th>
                  <th>Products &amp; Volume</th>
                  <th>Current Stage</th>
                  <th style={{ width: 160 }}>Progress</th>
                  <th>Delivery Due</th>
                  <th>Status</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#667085' }}>
                      No production orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
                    const isSelected = ord.id === selectedOrderId;
                    const isAtRisk = ord.riskStatus === 'at_risk';

                    let pillClass = 'indigo';
                    let statusText = 'In Production';
                    if (ord.status === 'completed' || ord.weightedProgress >= 95) {
                      pillClass = 'success';
                      statusText = 'Completed';
                    } else if (isAtRisk) {
                      pillClass = 'danger';
                      statusText = 'At Risk';
                    }

                    return (
                      <tr
                        key={ord.id}
                        className={isSelected ? 'is-selected' : ''}
                        onClick={() => handleSelectOrder(ord.id)}
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
                            onChange={() => handleSelectOrder(ord.id)}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: '#101828', whiteSpace: 'nowrap' }}>
                          #{ord.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#101828' }}>{ord.clientName}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{ord.productCategory}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#101828' }}>
                            {ord.totalQuantity.toLocaleString()} pcs
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {ord.products.length} Design{ord.products.length > 1 ? 's' : ''}
                          </div>
                        </td>
                        <td style={{ color: '#344054', fontWeight: 500 }}>
                          {ord.products[0]?.currentStage || 'Yarn Inward'}
                        </td>
                        <td>
                          <div className="untitled-progress-wrap">
                            <div className="untitled-progress-track">
                              <div
                                className="untitled-progress-fill"
                                style={{
                                  width: `${ord.weightedProgress}%`,
                                  background: isAtRisk ? '#f04438' : ord.weightedProgress >= 95 ? '#12b76a' : '#79B4B7'
                                }}
                              />
                            </div>
                            <span className="untitled-progress-percent">{ord.weightedProgress}%</span>
                          </div>
                        </td>
                        <td style={{ color: '#344054', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {ord.committedDeliveryDate}
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
                            onClick={() => {
                              handleSelectOrder(ord.id);
                              setShowTimelineModal(true);
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="untitled-table-footer">
            <button type="button" className="untitled-page-btn" onClick={() => {}}>Previous</button>
            <span className="untitled-page-info">
              Page 1 of {Math.max(1, Math.ceil(filteredOrders.length / 5))}
            </span>
            <button type="button" className="untitled-page-btn" onClick={() => {}}>Next</button>
          </div>
        </div>

        {/* SELECTED ORDER WORKSPACE: Appears cleanly below full-width table */}
        {showWorkspace && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* CARD 1: ORDER SUMMARY & MULTI-PRODUCT LIST */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #eaecf0',
              padding: 20,
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Selected Order Workspace
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#101828', margin: '4px 0 2px' }}>
                    #{currentOrder.id} &bull; {currentOrder.clientName}
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {currentOrder.productCategory} &bull; Total: <strong>{currentOrder.totalQuantity.toLocaleString()} pcs</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      background: currentOrder.riskStatus === 'at_risk' ? '#fee2e2' : '#F8F0DF',
                      color: currentOrder.riskStatus === 'at_risk' ? '#dc2626' : '#18191B',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      {currentOrder.riskStatus === 'at_risk' ? 'At Risk' : 'On Track'}
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Committed: {currentOrder.committedDeliveryDate}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowTimelineModal(true)}
                    className="admin-btn-primary"
                    style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#18191B' }}
                  >
                    <span>Inspect 6-Stage Timeline ({currentProduct.designCode})</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Quantity-Weighted Progress Bar */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  <span>Quantity-Weighted Progress:</span>
                  <span style={{ color: currentOrder.riskStatus === 'at_risk' ? '#b45309' : '#18191B' }}>
                    {currentOrder.weightedProgress}% Complete
                  </span>
                </div>
                <div style={{ height: 8, width: '100%', background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${currentOrder.weightedProgress}%`,
                      height: '100%',
                      background: currentOrder.riskStatus === 'at_risk' ? '#f59e0b' : '#79B4B7',
                      borderRadius: 9999
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  <span>Supervisor: {currentOrder.assignedSupervisorName}</span>
                  <span>Forecast Delivery: <strong>{currentOrder.forecastDeliveryDate}</strong></span>
                </div>
              </div>

              {/* Multi-Product Independent Progress List in Responsive Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#101828' }}>
                  Products / Designs in this Order ({currentOrder.products.length}):
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: currentOrder.products.length > 2 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                  gap: 12
                }}>
                  {currentOrder.products.map((prod) => {
                    const isSelected = prod.id === selectedProductId;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => setSelectedProductId(prod.id)}
                        style={{
                          border: isSelected ? '1.5px solid #79B4B7' : '1px solid #edf1f5',
                          background: isSelected ? '#f8fdfa' : '#ffffff',
                          borderRadius: 12,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#0a0d10' }}>
                            {prod.name} <span style={{ fontSize: 10, color: '#94a3b8' }}>({prod.designCode})</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#18191B' }}>
                            {prod.progressPercent}%
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b' }}>
                          <span>Stage: <strong>{prod.currentStage}</strong></span>
                          <span>Produced: {prod.completedQuantity.toLocaleString()} / {prod.quantity.toLocaleString()} pcs</span>
                        </div>

                        <div style={{ height: 6, width: '100%', background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${prod.progressPercent}%`,
                              height: '100%',
                              background: prod.riskStatus === 'at_risk' ? '#f59e0b' : '#79B4B7'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LOWER ROW: CARDS 2 & 3 SIDE-BY-SIDE */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
              {/* CARD 2: PLANNED VS ACTUAL PERFORMANCE */}
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
                    <SlidersHorizontal size={16} color="#18191B" />
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#101828', margin: 0 }}>
                      Planned vs Actual Shift Performance
                    </h3>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Stage: {currentActiveStage.name}
                  </span>
                </div>

                {/* Target vs Actual Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '12px 14px',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Daily Target</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0a0d10', marginTop: 2 }}>
                      {dailyTarget.toLocaleString()} pcs
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Actual Output</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: dailyAchievementPercent >= 90 ? '#16a34a' : '#b45309', marginTop: 2 }}>
                      {dailyActual.toLocaleString()} pcs
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Achievement</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: dailyAchievementPercent >= 90 ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                      {dailyAchievementPercent}%
                    </div>
                  </div>
                </div>

                {/* Variance indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b' }}>
                  <span>
                    Daily Variance: <strong style={{ color: dailyVariance >= 0 ? '#16a34a' : '#dc2626' }}>
                      {dailyVariance >= 0 ? `+${dailyVariance}` : dailyVariance} pcs
                    </strong>
                  </span>
                  <span>
                    Rejected: <strong style={{ color: '#dc2626' }}>{currentActiveStage.rejectedQuantity} pcs</strong>
                  </span>
                  <span>Machine: {currentActiveStage.assignedMachine.split(' ')[0]}</span>
                </div>
              </div>

              {/* CARD 3: PRODUCTION RISK ALERTS */}
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
                    <AlertCircle size={16} color="#dc2626" />
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#101828', margin: 0 }}>
                      Production Risk Alerts ({riskAlerts.length})
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
                    View All &rarr;
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topAlerts.map((alt) => (
                    <div
                      key={alt.id}
                      style={{
                        background: alt.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${alt.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: alt.severity === 'critical' ? '#dc2626' : '#b45309' }}>
                          {alt.alertType.replace(/_/g, ' ')} &bull; {alt.affectedOrderId}
                        </span>
                        <span style={{ fontSize: 9.5, color: '#94a3b8' }}>{alt.detectedTime}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
                        {alt.reason}
                      </div>
                      <div style={{ fontSize: 10, color: '#475569' }}>
                        Action: <strong>{alt.suggestedAction}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          DETAIL MODAL 1: SIX-STAGE PRODUCTION TIMELINE WORKSPACE (Section 5 & 9)
          ========================================================================= */}
      {showTimelineModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 880, borderRadius: 28, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  6-Stage Production Lifecycle &bull; {currentProduct.name} ({currentProduct.designCode})
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Order: <strong>{currentOrder.id}</strong> ({currentOrder.clientName}) &bull; Target: <strong>{currentProduct.quantity.toLocaleString()} pieces</strong>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowTimelineModal(false)}>
                <X size={15} />
              </button>
            </div>

            {/* Stepper Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 8,
              marginTop: 14,
              marginBottom: 16,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '12px 14px'
            }}>
              {currentProduct.stages.map((stg) => {
                const isComplete = stg.status === 'completed';
                const isInProg = stg.status === 'in_progress' || stg.status === 'delayed';

                return (
                  <div key={stg.id} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isComplete ? '#F8F0DF' : isInProg ? '#79B4B7' : '#f1f5f9',
                      color: isComplete ? '#18191B' : isInProg ? '#18191B' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      margin: '0 auto 4px'
                    }}>
                      {isComplete ? <Check size={13} /> : stg.stageNumber}
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0a0d10' }}>
                      {stg.name}
                    </div>
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: isComplete ? '#16a34a' : isInProg ? '#0369a1' : '#94a3b8',
                      marginTop: 2
                    }}>
                      {stg.status}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 6 Stage Operational Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentProduct.stages.map((stg) => {
                const isComplete = stg.status === 'completed';
                const isInProg = stg.status === 'in_progress' || stg.status === 'delayed';

                return (
                  <div
                    key={stg.id}
                    style={{
                      border: isInProg ? '1.5px solid #79B4B7' : '1px solid #e2e8f0',
                      borderRadius: 16,
                      background: isInProg ? '#fafdfb' : '#ffffff',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: isComplete ? '#F8F0DF' : isInProg ? '#79B4B7' : '#f1f5f9',
                          color: isComplete ? '#18191B' : isInProg ? '#18191B' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10.5,
                          fontWeight: 800
                        }}>
                          {isComplete ? <Check size={12} /> : stg.stageNumber}
                        </span>
                        <strong style={{ fontSize: 12.5, color: '#0a0d10' }}>
                          Stage {stg.stageNumber}: {stg.name}
                        </strong>
                        <span style={{ fontSize: 10, color: '#64748b' }}>&bull; {stg.department}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#0a0d10' }}>
                          {stg.producedQuantity.toLocaleString()} / {stg.targetQuantity.toLocaleString()} pcs
                        </span>

                        {isInProg && (
                          <button
                            onClick={() => handleAdvanceStage(currentOrder.id, currentProduct.id, stg.stageNumber)}
                            style={{
                              background: '#79B4B7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 9999,
                              padding: '3px 10px',
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Verify & Advance Stage &rarr;
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Operational Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 8,
                      background: '#f8fafc',
                      borderRadius: 10,
                      padding: '6px 10px',
                      fontSize: 10.5
                    }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Machine: </span>
                        <strong>{stg.assignedMachine.split(' ')[0]}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Supervisor: </span>
                        <strong>{stg.assignedSupervisor.split(' ')[0]}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Rejected: </span>
                        <strong style={{ color: stg.rejectedQuantity > 0 ? '#dc2626' : '#64748b' }}>
                          {stg.rejectedQuantity} pcs
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Daily Pace: </span>
                        <strong>{stg.dailyActual} / {stg.dailyTarget} pcs</strong>
                      </div>
                    </div>

                    {stg.delayReason && (
                      <div style={{
                        background: '#fffbeb',
                        borderLeft: '3px solid #f59e0b',
                        padding: '6px 10px',
                        fontSize: 10.5,
                        color: '#92400e',
                        borderRadius: '0 8px 8px 0'
                      }}>
                        <strong>Delay Warning:</strong> {stg.delayReason} &bull; <em>Recovery: {stg.recoveryAction}</em>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 2: LOG SUPERVISOR SHIFT UPDATE (Section 8)
          ========================================================================= */}
      {showShiftUpdateModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520, borderRadius: 28, padding: 24 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Log Daily Shift Production Update
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Appends to immutable shift ledger. Does not overwrite past production history.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowShiftUpdateModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmitShiftReport} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {/* Order & Product Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Order
                  </label>
                  <select
                    className="admin-form-input"
                    value={shiftForm.orderId}
                    onChange={(e) => {
                      const selOrd = productionOrders.find((o) => o.id === e.target.value);
                      setShiftForm((prev) => ({
                        ...prev,
                        orderId: e.target.value,
                        productId: selOrd?.products[0]?.id || prev.productId
                      }));
                    }}
                  >
                    {productionOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} ({o.clientName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Product / Design
                  </label>
                  <select
                    className="admin-form-input"
                    value={shiftForm.productId}
                    onChange={(e) => setShiftForm({ ...shiftForm, productId: e.target.value })}
                  >
                    {currentOrder.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.designCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stage & Machine */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Production Stage
                  </label>
                  <select
                    className="admin-form-input"
                    value={shiftForm.stageName}
                    onChange={(e) => setShiftForm({ ...shiftForm, stageName: e.target.value })}
                  >
                    <option value="Yarn Inward">1. Yarn Inward</option>
                    <option value="Warping & Sizing">2. Warping & Sizing</option>
                    <option value="Loom Weaving">3. Loom Weaving</option>
                    <option value="Dyeing & Finishing">4. Dyeing & Finishing</option>
                    <option value="Quality Inspection">5. Quality Inspection</option>
                    <option value="Dispatch">6. Dispatch</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Machine Unit
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={shiftForm.machineId}
                    onChange={(e) => setShiftForm({ ...shiftForm, machineId: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Produced, Rejected, Target */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '10px 12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8
              }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>Daily Target</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={shiftForm.dailyTargetQuantity}
                    onChange={(e) => setShiftForm({ ...shiftForm, dailyTargetQuantity: +e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: '#18191B', fontWeight: 700, display: 'block', marginBottom: 2 }}>Produced Output</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    style={{ border: '2px solid #edf2ee', background: '#F8F0DF' }}
                    value={shiftForm.actualProducedQuantity}
                    onChange={(e) => setShiftForm({ ...shiftForm, actualProducedQuantity: +e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, display: 'block', marginBottom: 2 }}>Rejected</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    style={{ border: '1px solid #fecaca' }}
                    value={shiftForm.rejectedQuantity}
                    onChange={(e) => setShiftForm({ ...shiftForm, rejectedQuantity: +e.target.value })}
                  />
                </div>
              </div>

              {/* Supervisor & Downtime */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Supervisor Submitter
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={shiftForm.submittedBy}
                    onChange={(e) => setShiftForm({ ...shiftForm, submittedBy: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    Downtime (Mins)
                  </label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={shiftForm.machineDowntimeMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, machineDowntimeMinutes: +e.target.value })}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                  Shift Remarks & Observations
                </label>
                <textarea
                  className="admin-form-input"
                  rows={2}
                  value={shiftForm.remarks}
                  onChange={(e) => setShiftForm({ ...shiftForm, remarks: e.target.value })}
                  style={{ borderRadius: 12, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, justifyContent: 'center' }}
                >
                  <Check size={14} />
                  <span>Commit Shift Log</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowShiftUpdateModal(false)}
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
          DETAIL MODAL 3: SUPERVISOR SHIFT REPORT AUDIT TRAIL (Section 8)
          ========================================================================= */}
      {showShiftHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760, borderRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                  Supervisor Daily Shift Reports & Audit History
                </h2>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Immutable log of daily production updates submitted by shift supervisors.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowShiftHistoryModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>Report ID</th>
                    <th style={{ padding: '8px 6px' }}>Order & Product</th>
                    <th style={{ padding: '8px 6px' }}>Stage</th>
                    <th style={{ padding: '8px 6px' }}>Output</th>
                    <th style={{ padding: '8px 6px' }}>Rejected</th>
                    <th style={{ padding: '8px 6px' }}>Machine</th>
                    <th style={{ padding: '8px 6px' }}>Supervisor</th>
                    <th style={{ padding: '8px 6px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftReports.map((rep) => (
                    <tr key={rep.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0a0d10' }}>{rep.id}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{rep.orderId} &bull; {rep.productName.split('-')[0]}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {rep.stageName}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: 800, color: '#16a34a' }}>
                        +{rep.actualProducedQuantity} pcs
                      </td>
                      <td style={{ padding: '8px 6px', color: rep.rejectedQuantity > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                        {rep.rejectedQuantity} pcs
                      </td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{rep.machineId.split(' ')[0]}</td>
                      <td style={{ padding: '8px 6px', color: '#0a0d10' }}>{rep.submittedBy.split(' ')[0]}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{rep.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DETAIL MODAL 4: ALL PRODUCTION RISK ALERTS (Section 7)
          ========================================================================= */}
      {showAllAlertsModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 640, borderRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: 16, fontWeight: 800, color: '#0a0d10', margin: 0 }}>
                All Active Production Risk Alerts ({riskAlerts.length})
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAllAlertsModal(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {riskAlerts.map((alt) => (
                <div
                  key={alt.id}
                  style={{
                    background: alt.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${alt.severity === 'critical' ? '#fecaca' : '#fde68a'}`,
                    borderRadius: 14,
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: alt.severity === 'critical' ? '#dc2626' : '#b45309' }}>
                      {alt.alertType.replace(/_/g, ' ')} &bull; {alt.affectedOrderId}
                    </span>
                    <span style={{ fontSize: 9.5, color: '#94a3b8' }}>{alt.detectedTime}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                    {alt.reason}
                  </div>
                  <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>
                    <strong>Impact:</strong> {alt.businessImpact}
                  </div>
                  <div style={{ fontSize: 10, color: '#18191B', marginTop: 2 }}>
                    <strong>Recommended:</strong> {alt.suggestedAction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOAST FEEDBACK
          ========================================================================= */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#79B4B7',
          color: '#ffffff',
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

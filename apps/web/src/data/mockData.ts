import type { Order, MarketCommodity, AdminUser, AuditEntry, AgentRun, ChatMessage, AppUser, UserInvite, MaterialRequirement } from '../types';

export const INITIAL_ADMIN_USER: AdminUser = {
  id: 'admin_1',
  name: 'John Doe',
  email: 'admin@loompilot.com',
  role: 'admin',
  title: 'Managing Director & Operations Head',
  unit: 'LoomPilot Textile Mills',
  avatar: '/assets/avatar.svg'
};

export const INITIAL_COMMODITIES: MarketCommodity[] = [
  {
    id: 'comm_cotton',
    name: 'Cotton Fabric (Greige)',
    category: 'fiber',
    price: 120.00,
    unit: 'm',
    changeYesterday: 2.50,
    changeSevenDays: 14.2,
    volatilityPercent: 4.8,
    isSurge: true,
    lastUpdated: '10 mins ago'
  },
  {
    id: 'comm_yarn',
    name: 'Cotton Yarn 40s Combed',
    category: 'yarn',
    price: 240.00,
    unit: 'kg',
    changeYesterday: 1.20,
    changeSevenDays: 2.1,
    volatilityPercent: 1.8,
    isSurge: false,
    lastUpdated: '1 hour ago'
  },
  {
    id: 'comm_dye',
    name: 'Dyeing Chemicals (Reactive Eco-Dye)',
    category: 'dye',
    price: 180.00,
    unit: 'kg',
    changeYesterday: 4.50,
    changeSevenDays: 8.4,
    volatilityPercent: 3.6,
    isSurge: true,
    lastUpdated: '25 mins ago'
  },
  {
    id: 'comm_trims',
    name: 'Buttons & Trims',
    category: 'energy',
    price: 1.50,
    unit: 'pc',
    changeYesterday: 0.0,
    changeSevenDays: 0.5,
    volatilityPercent: 0.5,
    isSurge: false,
    lastUpdated: 'Today'
  }
];

export const INITIAL_ORDERS: Order[] = [
  // LP-901 · Fashion House · Cotton Shirts & Pants (On track - 85% weighted progress, Almost completed)
  {
    id: 'LP-901',
    clientName: 'Fashion House',
    clientEmail: 'procurement@fashionhouse.com',
    productName: 'Cotton Shirts',
    category: 'Apparel',
    specs: {
      yarnCount: '40s Combed',
      gsm: 185,
      width: '58 inches',
      weave: 'Oxford & Twill',
      finishing: 'Bio-Washed Silk Finish'
    },
    quantityMeters: 5000,
    producedMeters: 4250,
    submittedDate: '2026-10-20',
    deadlineDate: '05 Nov 2026',
    currentPhase: 'Quality Inspection',
    status: 'in_production',
    riskStatus: 'on_track',
    riskReason: 'Almost completed · Due 05 Nov',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar',
    handoverDate: '2026-10-22',
    productionPlanConfirmed: true,
    items: [
      {
        id: 'LP-901-A',
        name: 'Formal Shirt — Design A',
        designCode: 'FS-A-01',
        category: 'Formalwear',
        quantityPieces: 2000,
        progressPercent: 90,
        imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Material received · 24 Oct', notes: '40s combed cotton yarn approved' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 25 Oct', notes: 'Beam sizing verified' },
          { id: 't3', name: 'Loom Weaving', status: 'completed', dateOrDetails: '2,000 metres produced · 27 Oct', notes: 'Airjet Loom #12 run completed' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'completed', dateOrDetails: 'Completed · 29 Oct', notes: 'Shade matching batch verified' },
          { id: 't5', name: 'Quality Inspection', status: 'in_progress', dateOrDetails: 'Current stage · 4-point inspection', notes: '98.5% first pass yield' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 04 Nov', notes: 'Cartoning queued' }
        ]
      },
      {
        id: 'LP-901-B',
        name: 'Formal Pants — Design B',
        designCode: 'FP-B-02',
        category: 'Trousers',
        quantityPieces: 1500,
        progressPercent: 85,
        imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Material received · 25 Oct' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 26 Oct' },
          { id: 't3', name: 'Loom Weaving', status: 'completed', dateOrDetails: 'Completed · 28 Oct' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'completed', dateOrDetails: 'Completed · 30 Oct' },
          { id: 't5', name: 'Quality Inspection', status: 'in_progress', dateOrDetails: 'Current stage · Batch inspection' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 04 Nov' }
        ]
      },
      {
        id: 'LP-901-C',
        name: 'Casual Shirt — Design C',
        designCode: 'CS-C-03',
        category: 'Casualwear',
        quantityPieces: 1500,
        progressPercent: 80,
        imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Material received · 25 Oct' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 26 Oct' },
          { id: 't3', name: 'Loom Weaving', status: 'completed', dateOrDetails: 'Completed · 28 Oct' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'in_progress', dateOrDetails: 'Current stage · Final finishing stenter' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 02 Nov' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 05 Nov' }
        ]
      }
    ],
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // LP-902 · Urban Textiles · Cotton Shirts (At risk - 42% progress, Material Shortage)
  {
    id: 'LP-902',
    clientName: 'Urban Textiles',
    clientEmail: 'orders@urbantextiles.com',
    productName: 'Cotton Shirts',
    category: 'Apparel',
    specs: {
      yarnCount: '30s Ring Spun',
      gsm: 190,
      width: '60 inches',
      weave: 'Poplin',
      finishing: 'Mercerized'
    },
    quantityMeters: 8000,
    producedMeters: 3360,
    submittedDate: '2026-10-22',
    deadlineDate: '06 Nov 2026',
    currentPhase: 'Loom Weaving',
    status: 'awaiting_admin_decision',
    riskStatus: 'at_risk',
    riskReason: 'Material shortage · Due 06 Nov',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar',
    handoverDate: '2026-10-23',
    productionPlanConfirmed: true,
    items: [
      {
        id: 'LP-902-A',
        name: 'Urban Cotton Oxford Shirt',
        designCode: 'UCO-01',
        category: 'Shirts',
        quantityPieces: 5000,
        progressPercent: 42,
        imageUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'at_risk',
        riskReason: '600m raw cotton fabric shortfall awaiting supplier PO-1001',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Completed · 23 Oct', notes: 'Shortage flagged on yarn lot #2' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 25 Oct', notes: 'Processed available 1,400m warp' },
          { id: 't3', name: 'Loom Weaving', status: 'in_progress', dateOrDetails: 'Current stage · Held for yarn', notes: 'Loom #7 awaiting expedited yarn delivery' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Awaiting weaving completion', notes: 'Vat dyeing recipe prepared' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Pending', notes: 'Inspection team notified of expedite' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Pending', notes: 'Air express shipping pending' }
        ]
      },
      {
        id: 'LP-902-B',
        name: 'Urban Poplin Shirt',
        designCode: 'UPS-02',
        category: 'Shirts',
        quantityPieces: 3000,
        progressPercent: 42,
        imageUrl: 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'at_risk',
        riskReason: 'Weaving paced below planned run speed',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Completed · 24 Oct', notes: 'Greige yarn received' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 26 Oct', notes: 'Warp beam ready' },
          { id: 't3', name: 'Loom Weaving', status: 'in_progress', dateOrDetails: 'Current stage · Weaving at 380 ppm', notes: 'Loom speed recalibration required' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Pending', notes: 'Scheduled post-weaving' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Pending', notes: 'Pending' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Pending', notes: 'Pending' }
        ]
      }
    ],
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // LP-903 · Style World · Bedsheets (Early production - 25% progress)
  {
    id: 'LP-903',
    clientName: 'Style World',
    clientEmail: 'style@styleworld.com',
    productName: 'Bedsheets',
    category: 'Home Textiles',
    specs: {
      yarnCount: '60s Combed',
      gsm: 210,
      width: '108 inches',
      weave: 'Satin Weave',
      finishing: 'Peach Soft'
    },
    quantityMeters: 3500,
    producedMeters: 875,
    submittedDate: '2026-10-24',
    deadlineDate: '12 Nov 2026',
    currentPhase: 'Warping & Sizing',
    status: 'in_production',
    riskStatus: 'early_production',
    riskReason: 'Early production · Due 12 Nov',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar',
    handoverDate: '2026-10-25',
    productionPlanConfirmed: true,
    items: [
      {
        id: 'LP-903-A',
        name: 'King Size Bedsheet Set',
        designCode: 'BS-K-01',
        category: 'Bedding',
        quantityPieces: 2000,
        progressPercent: 25,
        imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Completed · 25 Oct', notes: '60s combed compact yarn approved' },
          { id: 't2', name: 'Warping & Sizing', status: 'in_progress', dateOrDetails: 'Current stage · High density beam', notes: '108 inch wide warping underway' },
          { id: 't3', name: 'Loom Weaving', status: 'pending', dateOrDetails: 'Scheduled 31 Oct', notes: 'Wide width airjet loom #1' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Scheduled 04 Nov', notes: 'Rotary printing planned' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 08 Nov', notes: 'Shrinkage & pilling test' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 11 Nov', notes: 'Retail box packing' }
        ]
      },
      {
        id: 'LP-903-B',
        name: 'Queen Size Bedsheet Set',
        designCode: 'BS-Q-02',
        category: 'Bedding',
        quantityPieces: 1500,
        progressPercent: 25,
        imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Completed · 25 Oct', notes: 'Verified yarn test report' },
          { id: 't2', name: 'Warping & Sizing', status: 'in_progress', dateOrDetails: 'Current stage · Beam 2', notes: 'Beam loading' },
          { id: 't3', name: 'Loom Weaving', status: 'pending', dateOrDetails: 'Scheduled 01 Nov', notes: 'Wide width loom #2' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Scheduled 05 Nov', notes: 'Continuous dyeing range' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 09 Nov', notes: 'Standard inspection' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 12 Nov', notes: 'Export packing' }
        ]
      }
    ],
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // LP-904 · Home Living · Curtains (Just started - 10% progress)
  {
    id: 'LP-904',
    clientName: 'Home Living',
    clientEmail: 'procure@homeliving.com',
    productName: 'Curtains',
    category: 'Home Textiles',
    specs: {
      yarnCount: '20s Poly-Cotton',
      gsm: 260,
      width: '54 inches',
      weave: 'Jacquard Weave',
      finishing: 'Flame Retardant'
    },
    quantityMeters: 1200,
    producedMeters: 120,
    submittedDate: '2026-10-26',
    deadlineDate: '20 Nov 2026',
    currentPhase: 'Yarn Inward',
    status: 'submitted',
    riskStatus: 'just_started',
    riskReason: 'Just started · Due 20 Nov',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar',
    handoverDate: '2026-10-27',
    productionPlanConfirmed: false,
    items: [
      {
        id: 'LP-904-A',
        name: 'Blackout Curtains - Gold Jacquard',
        designCode: 'CUR-BJ-01',
        category: 'Drapes',
        quantityPieces: 800,
        progressPercent: 10,
        imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'in_progress', dateOrDetails: 'Current stage · Yarn delivery inward', notes: 'Jacquard filament yarn arrival' },
          { id: 't2', name: 'Warping & Sizing', status: 'pending', dateOrDetails: 'Scheduled 02 Nov', notes: 'Card punch setup' },
          { id: 't3', name: 'Loom Weaving', status: 'pending', dateOrDetails: 'Scheduled 06 Nov', notes: 'Jacquard loom #3' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Scheduled 11 Nov', notes: 'FR coating application' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 15 Nov', notes: 'Light transmission test' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 19 Nov', notes: 'Grommet eyelet packing' }
        ]
      },
      {
        id: 'LP-904-B',
        name: 'Sheer Curtains - Linen White',
        designCode: 'CUR-SL-02',
        category: 'Drapes',
        quantityPieces: 400,
        progressPercent: 10,
        imageUrl: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=400&q=80',
        riskStatus: 'on_track',
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'in_progress', dateOrDetails: 'Current stage · Quality check', notes: 'Fine linen yarn inspection' },
          { id: 't2', name: 'Warping & Sizing', status: 'pending', dateOrDetails: 'Scheduled 03 Nov', notes: 'Delicate sizing' },
          { id: 't3', name: 'Loom Weaving', status: 'pending', dateOrDetails: 'Scheduled 07 Nov', notes: 'Airjet loom #6' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Scheduled 12 Nov', notes: 'Optical whitening finish' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 16 Nov', notes: 'Weight & drape test' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 19 Nov', notes: 'Fold & label' }
        ]
      }
    ],
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // 1. Order TX-1024 · Cotton Shirts · ABC Garments (In Production - 65%)
  {
    id: 'TX-1024',
    clientName: 'ABC Garments',
    clientEmail: 'contact@abcgarments.com',
    productName: 'Cotton Shirts',
    category: 'Apparel',
    specs: {
      yarnCount: '40s Combed',
      gsm: 180,
      width: '58 inches',
      weave: 'Plain Weave',
      finishing: 'Bio-Washed Soft'
    },
    quantityMeters: 5000,
    producedMeters: 3250,
    submittedDate: '2026-10-28',
    deadlineDate: '15 Nov 2026',
    currentPhase: 'Stitching',
    status: 'in_production',
    riskStatus: 'on_track',
    riskReason: 'In production · Due 15 Nov',
    assignedSupervisorId: 'usr_sup_1',
    assignedSupervisorName: 'Ramesh Kumar',
    handoverDate: '2026-10-29',
    productionPlanConfirmed: true,
    items: [
      {
        id: 'TX-1024-A',
        name: 'Cotton Oxford Shirt',
        designCode: 'COS-01',
        category: 'Shirts',
        quantityPieces: 3000,
        progressPercent: 70,
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Completed · 26 Oct' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 27 Oct' },
          { id: 't3', name: 'Loom Weaving', status: 'completed', dateOrDetails: 'Completed · 29 Oct' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'in_progress', dateOrDetails: 'Current stage · 1,800m done' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 05 Nov' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 12 Nov' }
        ]
      },
      {
        id: 'TX-1024-B',
        name: 'Cotton Twill Shirt',
        designCode: 'CTS-02',
        category: 'Shirts',
        quantityPieces: 2000,
        progressPercent: 55,
        timeline: [
          { id: 't1', name: 'Yarn Inward', status: 'completed', dateOrDetails: 'Completed · 26 Oct' },
          { id: 't2', name: 'Warping & Sizing', status: 'completed', dateOrDetails: 'Completed · 27 Oct' },
          { id: 't3', name: 'Loom Weaving', status: 'in_progress', dateOrDetails: 'Current stage · 1,100m done' },
          { id: 't4', name: 'Dyeing & Finishing', status: 'pending', dateOrDetails: 'Scheduled 04 Nov' },
          { id: 't5', name: 'Quality Inspection', status: 'pending', dateOrDetails: 'Scheduled 08 Nov' },
          { id: 't6', name: 'Dispatch', status: 'pending', dateOrDetails: 'Scheduled 14 Nov' }
        ]
      }
    ],
    feasibility: {
      id: 'feas_1024',
      orderId: 'TX-1024',
      verdict: 'feasible',
      eta: '15 Nov 2026',
      bottleneckProcess: 'Stitching & Dyeing',
      riskFactors: [
        { name: 'Material Shortage', severity: 'medium', description: 'Cotton Fabric shortage of 600 m (1,400 m available vs 2,000 m required).' }
      ],
      recoveryOptions: [
        {
          type: 'buy_materials',
          title: 'Procure 600 m Cotton Fabric from Sri Textiles',
          description: '3-day dispatch lead time at ₹120/m covers shortfall without missing Nov 15 deadline.',
          supplier: 'Sri Textiles',
          leadTimeDays: 3,
          estimatedCost: 72000,
          newEta: '15 Nov 2026'
        }
      ],
      llmSummary: 'On track to meet deadline. 65% completed. 600 m Cotton Fabric shortage detected; purchase order PO-1001 queued for Sri Textiles.',
      createdAt: '2026-10-29 08:30 AM'
    },
    quotation: {
      id: 'QT-1001',
      orderId: 'TX-1024',
      version: 1,
      materialCost: 110000,
      wastagePercent: 4.5,
      processingCost: 95000,
      overheadCost: 60000,
      priceRiskBuffer: 20000,
      marginPercent: 18.0,
      pricePerUnit: 70.0,
      totalPrice: 350000,
      validUntil: '29 Oct 2026',
      etaBasis: '15 Nov 2026',
      adminApproved: false,
      status: 'pending_approval',
      bomItems: [
        { name: 'Cotton Fabric', quantity: '2,000 m', rate: 55, total: 110000 },
        { name: 'Labour (Cutting & Stitching)', quantity: '180 hrs', rate: 527.7, total: 95000 },
        { name: 'Dyeing & Chemicals', quantity: '350 kg', rate: 171.4, total: 60000 },
        { name: 'Buttons & Others', quantity: '5,000 pcs', rate: 4, total: 20000 }
      ],
      explanation: 'Cotton price may increase by 5–8% next week. Proposed selling price ₹ 3,50,000 against ₹ 2,85,000 total cost yields 18% margin.'
    },
    deliveries: [
      {
        id: 'del_1024_1',
        orderId: 'TX-1024',
        date: '2026-10-28',
        quantityMeters: 2000,
        invoiceNumber: 'INV-1001',
        carrier: 'VRL Logistics Freight',
        deliveryType: 'partial',
        status: 'delivered'
      }
    ],
    payments: [
      {
        id: 'pay_1024_1',
        orderId: 'TX-1024',
        invoiceNumber: 'INV-1001',
        amount: 105000,
        date: '2026-10-28',
        type: 'advance_30',
        status: 'received'
      },
      {
        id: 'pay_1024_2',
        orderId: 'TX-1024',
        invoiceNumber: 'INV-1002',
        amount: 140000,
        date: '2026-10-29',
        type: 'mid_progress_40',
        status: 'received'
      },
      {
        id: 'pay_1024_3',
        orderId: 'TX-1024',
        invoiceNumber: 'INV-1003',
        amount: 105000,
        date: '2026-11-15',
        type: 'final_balance_30',
        status: 'pending'
      }
    ],
    dailyReports: [
      {
        id: 'rep_1024_1',
        date: '2026-10-29',
        supervisorId: 'usr_sup_1',
        supervisorName: 'Ramesh Kumar',
        shift: 'Day Shift (Shed A)',
        workersPresent: 24,
        workersAbsent: 1,
        machinesAvailable: 19,
        machinesBreakdown: 0,
        metersProduced: 1280,
        scrapMeters: 12,
        issuesRaised: 'Stitching stage active at 65%. Loom #7 warp thread sensor recalibrated.',
        status: 'verified'
      }
    ],
    discountEscalation: {
      id: 'esc_1024',
      orderId: 'TX-1024',
      clientName: 'ABC Garments',
      requestedDiscountPercent: 4.5,
      requestedPrice: 66.85,
      currentPrice: 70.0,
      currentMarginPercent: 18.0,
      status: 'open',
      clientMessage: 'Can you offer a 4.5% discount for this order quantity (5,000 pcs)?',
      createdAt: '2026-10-29 09:05 AM'
    }
  },

  // 2. Order TX-1025 · Printed Fabric · StyleMart (At Risk - 35%)
  {
    id: 'TX-1025',
    clientName: 'StyleMart',
    clientEmail: 'sourcing@stylemart.com',
    productName: 'Printed Fabric',
    category: 'Textiles',
    specs: {
      yarnCount: '30s Cotton',
      gsm: 160,
      width: '48 inches',
      weave: 'Plain Print',
      finishing: 'Reactive Rotary Print'
    },
    quantityMeters: 3000,
    producedMeters: 1050,
    submittedDate: '2026-10-27',
    deadlineDate: '18 Nov 2026',
    currentPhase: 'Dyeing',
    status: 'awaiting_admin_decision',
    assignedSupervisorId: 'usr_sup_2',
    assignedSupervisorName: 'Murugan K.',
    feasibility: {
      id: 'feas_1025',
      orderId: 'TX-1025',
      verdict: 'at_risk',
      eta: '18 Nov 2026',
      bottleneckProcess: 'Reactive Dyeing Bath',
      riskFactors: [
        { name: 'Dye Shortage', severity: 'high', description: '50 kg reactive chemical dye shortage awaiting PO confirmation.' }
      ],
      recoveryOptions: [
        {
          type: 'buy_materials',
          title: 'Approve PO-1002 with Vetri Fabrics',
          description: '5-day lead time ensures dye arrives before batch run starts.',
          supplier: 'Vetri Fabrics',
          leadTimeDays: 5,
          estimatedCost: 65000,
          newEta: '18 Nov 2026'
        }
      ],
      llmSummary: 'Order TX-1025 is at risk in dyeing stage (35% complete) due to 50 kg reactive dye deficit. Admin sign-off on PO-1002 required.',
      createdAt: '2026-10-28 10:15 AM'
    },
    quotation: {
      id: 'QT-1002',
      orderId: 'TX-1025',
      version: 1,
      materialCost: 85000,
      wastagePercent: 3.5,
      processingCost: 45000,
      overheadCost: 25000,
      priceRiskBuffer: 17000,
      marginPercent: 20.0,
      pricePerUnit: 71.67,
      totalPrice: 215000,
      validUntil: '28 Oct 2026',
      etaBasis: '18 Nov 2026',
      adminApproved: true,
      status: 'approved',
      bomItems: [],
      explanation: 'Total cost ₹ 1,72,000 against selling price ₹ 2,15,000 yields 20% margin.'
    },
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // 3. Order TX-1026 · Linen Trousers · HomeNest (Approved / On Track - 100%)
  {
    id: 'TX-1026',
    clientName: 'HomeNest',
    clientEmail: 'orders@homenest.com',
    productName: 'Linen Trousers',
    category: 'Apparel',
    specs: {
      yarnCount: '25 Lea Pure Flax',
      gsm: 220,
      width: '58 inches',
      weave: 'Twill Weave',
      finishing: 'Garment Enzyme Washed'
    },
    quantityMeters: 2000,
    producedMeters: 2000,
    submittedDate: '2026-10-20',
    deadlineDate: '20 Nov 2026',
    currentPhase: 'Finishing',
    status: 'client_accepted',
    assignedSupervisorId: 'usr_sup_3',
    assignedSupervisorName: 'Arunachalam S.',
    feasibility: {
      id: 'feas_1026',
      orderId: 'TX-1026',
      verdict: 'feasible',
      eta: '20 Nov 2026',
      bottleneckProcess: 'Finishing Bay',
      riskFactors: [],
      recoveryOptions: [],
      llmSummary: '100% completed. Passed 4-point fabric inspection in Shed B.',
      createdAt: '2026-10-20 11:00 AM'
    },
    quotation: {
      id: 'QT-1003',
      orderId: 'TX-1026',
      version: 1,
      materialCost: 180000,
      wastagePercent: 3.0,
      processingCost: 80000,
      overheadCost: 35000,
      priceRiskBuffer: 25000,
      marginPercent: 17.0,
      pricePerUnit: 192.50,
      totalPrice: 385000,
      validUntil: '28 Oct 2026',
      etaBasis: '20 Nov 2026',
      adminApproved: false,
      status: 'rejected',
      rejectionReason: 'Margin below minimum threshold for custom linen blend',
      bomItems: [],
      explanation: 'Quotation rejected by Admin: Total cost ₹ 3,20,000 vs selling price ₹ 3,85,000 margin of 17% requested revision.'
    },
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // 4. Order TX-1027 · Polo T-Shirts · TechCart (Pending - 0%)
  {
    id: 'TX-1027',
    clientName: 'TechCart',
    clientEmail: 'procurement@techcart.com',
    productName: 'Polo T-Shirts',
    category: 'Apparel',
    specs: {
      yarnCount: '26s Pique Knit',
      gsm: 210,
      width: '60 inches',
      weave: 'Honeycomb Pique',
      finishing: 'Silicone Softener'
    },
    quantityMeters: 4500,
    producedMeters: 0,
    submittedDate: '2026-10-25',
    deadlineDate: '22 Nov 2026',
    currentPhase: 'Pending',
    status: 'quotation_pending_approval',
    quotation: {
      id: 'QT-1004',
      orderId: 'TX-1027',
      version: 1,
      materialCost: 105000,
      wastagePercent: 4.0,
      processingCost: 50000,
      overheadCost: 25000,
      priceRiskBuffer: 15000,
      marginPercent: 19.0,
      pricePerUnit: 53.33,
      totalPrice: 240000,
      validUntil: '27 Oct 2026',
      etaBasis: '22 Nov 2026',
      adminApproved: false,
      status: 'pending_approval',
      bomItems: [],
      explanation: 'Total cost ₹ 1,95,000, selling price ₹ 2,40,000, margin 19% pending Admin sign-off.'
    },
    deliveries: [],
    payments: [],
    dailyReports: []
  },

  // 5. Order TX-1028 · Kitchen Aprons · KitchenKart (New - 0%)
  {
    id: 'TX-1028',
    clientName: 'KitchenKart',
    clientEmail: 'buyer@kitchenkart.com',
    productName: 'Kitchen Aprons',
    category: 'Home Textiles',
    specs: {
      yarnCount: '16s Duck Cotton',
      gsm: 280,
      width: '56 inches',
      weave: 'Duck Canvas',
      finishing: 'Water-Repellent'
    },
    quantityMeters: 1500,
    producedMeters: 0,
    submittedDate: '2026-10-26',
    deadlineDate: '25 Nov 2026',
    currentPhase: 'Cutting',
    status: 'submitted',
    quotation: {
      id: 'QT-1005',
      orderId: 'TX-1028',
      version: 1,
      materialCost: 65000,
      wastagePercent: 3.5,
      processingCost: 30000,
      overheadCost: 15000,
      priceRiskBuffer: 10000,
      marginPercent: 21.0,
      pricePerUnit: 101.33,
      totalPrice: 152000,
      validUntil: '26 Oct 2026',
      etaBasis: '25 Nov 2026',
      adminApproved: true,
      status: 'approved',
      bomItems: [],
      explanation: 'Total cost ₹ 1,20,000, selling price ₹ 1,52,000, margin 21% approved.'
    },
    deliveries: [],
    payments: [],
    dailyReports: []
  }
];

export const INITIAL_AUDIT_LOGS: AuditEntry[] = [
  { id: 'aud_1', timestamp: '2026-10-29 09:30:12', actor: 'Admin (John Doe)', action: 'QUOTATION_REVIEW', orderId: 'TX-1024', details: 'Opened quotation review for ABC Garments (QT-1001).' },
  { id: 'aud_2', timestamp: '2026-10-29 09:12:44', actor: 'Client Assistant', action: 'DISCOUNT_ESCALATED', orderId: 'TX-1024', details: 'Client ABC Garments requested 4.5% concession; forwarded to Admin.' },
  { id: 'aud_3', timestamp: '2026-10-29 08:35:00', actor: 'Market Price Agent', action: 'SURGE_ALERT_GENERATED', details: 'Cotton Fabric surged +14.2%. Affected quotes queued for Admin review.' },
  { id: 'aud_4', timestamp: '2026-10-28 17:00:22', actor: 'Supervisor (Ramesh Kumar)', action: 'DAILY_REPORT_SUBMITTED', orderId: 'TX-1024', details: 'Reported 1,280 pcs stitched; 24 workers present in Shed A.' }
];

export const INITIAL_AGENT_RUNS: AgentRun[] = [
  { id: 'run_101', agentName: 'Feasibility Agent', status: 'SUCCESS', durationMs: 1420, orderId: 'TX-1024', summary: 'Feasible verdict computed in 1.4s. 600 m Cotton Fabric shortage flagged.', timestamp: '10 mins ago' },
  { id: 'run_102', agentName: 'Quotation Agent', status: 'SUCCESS', durationMs: 2150, orderId: 'TX-1024', summary: 'Itemized BOM and margin calculated (₹ 3,50,000 @ 18% margin). Held for Admin review.', timestamp: '8 mins ago' },
  { id: 'run_103', agentName: 'Market Price Agent', status: 'ALERT', durationMs: 890, summary: 'Flagged 2 commodity surges (Cotton Fabric +14.2%, Dyeing Chemicals +8.4%).', timestamp: '25 mins ago' },
  { id: 'run_104', agentName: 'Monitoring Agent', status: 'SUCCESS', durationMs: 640, orderId: 'TX-1024', summary: 'Stitching pace steady. 65% complete. On schedule for Nov 15 finish.', timestamp: '1 hour ago' },
  { id: 'run_105', agentName: 'Client Assistant', status: 'ALERT', durationMs: 450, orderId: 'TX-1024', summary: 'Detected concession request on TX-1024. Escalated to Admin queue with margin data.', timestamp: '20 mins ago' }
];

export const INITIAL_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  'TX-1024': [
    { id: 'msg_1', sender: 'assistant', senderName: 'LoomPilot Assistant', timestamp: '08:45 AM', content: 'Good morning! A formal quotation QT-1001 has been drafted for Order TX-1024 (Cotton Shirts, 5,000 pcs) at ₹ 3,50,000.' },
    { id: 'msg_2', sender: 'client', senderName: 'ABC Garments', timestamp: '09:05 AM', content: 'Can you offer a discount for this order quantity?' },
    { id: 'msg_3', sender: 'assistant', senderName: 'LoomPilot Assistant', timestamp: '09:06 AM', content: 'As the AI assistant, I cannot approve discounts directly. I have escalated your request with all volume terms to Managing Director for final approval.' },
    { id: 'msg_4', sender: 'assistant', senderName: 'System Context (Admin Only)', timestamp: '09:06 AM', content: 'Internal note: Current gross margin is 18.0% (₹ 65,000). Granting 4.5% discount drops margin to 15.2% (₹ 49,250), which remains above the 15.0% policy floor.', isInternalContext: true }
  ]
};

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'usr_admin_1',
    name: 'John Doe',
    email: 'admin@loompilot.com',
    role: 'admin',
    title: 'Managing Director & Operations Head',
    departmentOrCompany: 'LoomPilot Textile Mills',
    status: 'active',
    joinedAt: '2026-01-10',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_sup_1',
    name: 'Ramesh Kumar',
    email: 'ramesh@loompilot.com',
    role: 'supervisor',
    title: 'Head Production Master',
    departmentOrCompany: 'Airjet Weaving & Stitching (Shed A)',
    status: 'active',
    joinedAt: '2026-02-15',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_sup_2',
    name: 'Murugan K.',
    email: 'murugan@loompilot.com',
    role: 'supervisor',
    title: 'Dyeing & Weaving Master',
    departmentOrCompany: 'Continuous Dyeing Bay (Shed B)',
    status: 'active',
    joinedAt: '2026-02-20',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_sup_3',
    name: 'Arunachalam S.',
    email: 'arun@loompilot.com',
    role: 'supervisor',
    title: 'Finishing & Quality Inspector',
    departmentOrCompany: 'Final 4-Point Inspection Bay',
    status: 'active',
    joinedAt: '2026-03-01',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_client_1',
    name: 'Anand Sharma',
    email: 'contact@abcgarments.com',
    role: 'client',
    title: 'Procurement Director',
    departmentOrCompany: 'ABC Garments',
    status: 'active',
    joinedAt: '2026-04-12',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_client_2',
    name: 'Vikram Mehta',
    email: 'sourcing@stylemart.com',
    role: 'client',
    title: 'Senior Sourcing Partner',
    departmentOrCompany: 'StyleMart',
    status: 'active',
    joinedAt: '2026-05-20',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_client_3',
    name: 'Pooja Nair',
    email: 'orders@homenest.com',
    role: 'client',
    title: 'VP Materials',
    departmentOrCompany: 'HomeNest',
    status: 'active',
    joinedAt: '2026-06-18',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_client_4',
    name: 'Rohit Verma',
    email: 'procurement@techcart.com',
    role: 'client',
    title: 'Sourcing Lead',
    departmentOrCompany: 'TechCart',
    status: 'active',
    joinedAt: '2026-07-15',
    avatar: '/assets/avatar.svg'
  },
  {
    id: 'usr_client_5',
    name: 'Sneha Patel',
    email: 'buyer@kitchenkart.com',
    role: 'client',
    title: 'Category Manager',
    departmentOrCompany: 'KitchenKart',
    status: 'active',
    joinedAt: '2026-08-01',
    avatar: '/assets/avatar.svg'
  }
];

export const INITIAL_INVITES: UserInvite[] = [
  {
    id: 'inv_101',
    name: 'Suresh Babu',
    email: 'suresh.b@loompilot.com',
    role: 'supervisor',
    departmentOrCompany: 'Yarn Testing & Quality Lab',
    inviteToken: 'inv_9a8f21b7c',
    inviteLink: 'http://localhost:5173/register?token=inv_9a8f21b7c',
    createdAt: '2026-10-28',
    expiresAt: '2026-11-04',
    status: 'pending'
  },
  {
    id: 'inv_102',
    name: 'Pooja Agarwal',
    email: 'partnerships@abcgarments.com',
    role: 'client',
    departmentOrCompany: 'ABC Garments',
    inviteToken: 'inv_4c7e81d2f',
    inviteLink: 'http://localhost:5173/register?token=inv_4c7e81d2f',
    createdAt: '2026-10-29',
    expiresAt: '2026-11-05',
    status: 'pending'
  }
];

export const INITIAL_MATERIAL_REQUIREMENTS: MaterialRequirement[] = [
  {
    id: 'mat_1',
    materialName: 'Cotton Fabric',
    category: 'fiber',
    requiredQuantity: 2000,
    availableQuantity: 1400,
    unit: 'm',
    shortageQuantity: 600,
    affectedOrderId: 'TX-1024',
    affectedProductName: 'Cotton Shirts',
    supplierName: 'Sri Textiles',
    supplierPrice: 120.00,
    moq: 500,
    leadTimeDays: 3,
    expectedArrival: '02 Nov 2026',
    status: 'pending'
  },
  {
    id: 'mat_2',
    materialName: 'Yarn',
    category: 'yarn',
    requiredQuantity: 500,
    availableQuantity: 520,
    unit: 'kg',
    shortageQuantity: 0,
    affectedOrderId: 'TX-1024',
    affectedProductName: 'Cotton Shirts',
    supplierName: 'Vetri Fabrics',
    supplierPrice: 240.00,
    moq: 200,
    leadTimeDays: 2,
    expectedArrival: 'In Stock',
    status: 'received'
  },
  {
    id: 'mat_3',
    materialName: 'Dyeing Chemicals',
    category: 'dye',
    requiredQuantity: 350,
    availableQuantity: 300,
    unit: 'kg',
    shortageQuantity: 50,
    affectedOrderId: 'TX-1025',
    affectedProductName: 'Printed Fabric',
    supplierName: 'Vetri Fabrics',
    supplierPrice: 180.00,
    moq: 100,
    leadTimeDays: 5,
    expectedArrival: '05 Nov 2026',
    status: 'ordered'
  },
  {
    id: 'mat_4',
    materialName: 'Buttons',
    category: 'trims',
    requiredQuantity: 5000,
    availableQuantity: 6200,
    unit: 'pcs',
    shortageQuantity: 0,
    affectedOrderId: 'TX-1024',
    affectedProductName: 'Cotton Shirts',
    supplierName: 'Kings Textiles',
    supplierPrice: 1.50,
    moq: 1000,
    leadTimeDays: 4,
    expectedArrival: 'In Stock',
    status: 'received'
  }
];

export const INITIAL_PURCHASE_ORDERS = [
  {
    poNo: 'PO-1001',
    supplier: 'Sri Textiles',
    items: 'Cotton Fabric',
    amount: 240000,
    expectedDelivery: '02 Nov 2026',
    status: 'Ordered' as const
  },
  {
    poNo: 'PO-1002',
    supplier: 'Vetri Fabrics',
    items: 'Dyeing Chemicals',
    amount: 65000,
    expectedDelivery: '05 Nov 2026',
    status: 'Pending' as const
  }
];

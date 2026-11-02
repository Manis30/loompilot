import type {
  Order as AdminOrder,
  ProductionTimelineStage,
  OrderItemProduct,
  OrderLifecycleStatus,
} from '../types';
import type {
  Order as ClientOrder,
  ProductionStage,
  OrderMilestone,
} from '../client-supervisor/types';
import type { SupervisorOrder } from '../client-supervisor/types/supervisor';

export interface CanonicalProductionStage {
  step: number; // 1 to 8, or 0 if unknown/unavailable
  name: string; // e.g. "Quote Accepted" or "Unavailable"
  numberedName: string; // e.g. "1. Quote Accepted" or "Unavailable"
  key: string; // e.g. "quote_accepted" or "unavailable"
  isKnown: boolean;
}

export const CANONICAL_PRODUCTION_STAGES: readonly CanonicalProductionStage[] = [
  { step: 1, name: 'Quote Accepted', numberedName: '1. Quote Accepted', key: 'quote_accepted', isKnown: true },
  { step: 2, name: 'Yarn Sourcing', numberedName: '2. Yarn Sourcing', key: 'yarn_sourcing', isKnown: true },
  { step: 3, name: 'Warping & Sizing', numberedName: '3. Warping & Sizing', key: 'warping_sizing', isKnown: true },
  { step: 4, name: 'Loom Weaving', numberedName: '4. Loom Weaving', key: 'loom_weaving', isKnown: true },
  { step: 5, name: 'Dyeing & Finishing', numberedName: '5. Dyeing & Finishing', key: 'dyeing_finishing', isKnown: true },
  { step: 6, name: 'Quality Check', numberedName: '6. Quality Check', key: 'quality_check', isKnown: true },
  { step: 7, name: 'Packaging & Dispatch', numberedName: '7. Packaging & Dispatch', key: 'packaging_dispatch', isKnown: true },
  { step: 8, name: 'Delivered', numberedName: '8. Delivered', key: 'delivered', isKnown: true },
] as const;

export const UNKNOWN_PRODUCTION_STAGE: CanonicalProductionStage = {
  step: 0,
  name: 'Unavailable',
  numberedName: 'Unavailable',
  key: 'unavailable',
  isKnown: false,
};

/**
 * Normalizes any production phase representation (numbered, unnumbered, or known unambiguous legacy alias)
 * to the canonical 8-stage sequence.
 *
 * Rules:
 * 1. An explicit confirmed delivered order status (completed/delivered) maps to Stage 8 (Delivered).
 * 2. An explicit recognized canonical phase string is matched first (numbered, unnumbered, or prefixed).
 * 3. Ambiguous legacy phases (cutting, stitching, standalone knitting, standalone finishing, ironing)
 *    are explicitly rejected and return UNKNOWN_PRODUCTION_STAGE.
 * 4. Legacy aliases are mapped ONLY when unambiguous and confirmed by codebase/backend contracts.
 * 5. In the absence of an explicit percentage-to-stage contract, percentage is NEVER used to infer a stage;
 *    unmapped orders return UNKNOWN_PRODUCTION_STAGE while preserving reported progress and order status.
 */
export function normalizeProductionStage(
  phase?: string | null,
  _percentComplete?: number,
  orderStatus?: string
): CanonicalProductionStage {
  const rawStatus = String(orderStatus || '').toLowerCase().trim();
  const isDeliveredByStatus = rawStatus === 'completed' || rawStatus === 'delivered';
  if (isDeliveredByStatus) {
    return CANONICAL_PRODUCTION_STAGES[7];
  }

  const rawPhase = String(phase || '').trim();
  if (!rawPhase) {
    return UNKNOWN_PRODUCTION_STAGE;
  }

  // 1. Direct match on numbered name (e.g. "1. Quote Accepted", "2. Yarn Sourcing")
  const matchNumbered = CANONICAL_PRODUCTION_STAGES.find(
    (s) => s.numberedName.toLowerCase() === rawPhase.toLowerCase()
  );
  if (matchNumbered) return matchNumbered;

  // 2. Direct match on unnumbered name (e.g. "Quote Accepted", "Yarn Sourcing")
  const matchName = CANONICAL_PRODUCTION_STAGES.find(
    (s) => s.name.toLowerCase() === rawPhase.toLowerCase()
  );
  if (matchName) return matchName;

  // 3. Match stripped numeric prefix (e.g. "2 - Yarn Sourcing", "2) Yarn Sourcing")
  const stripped = rawPhase.replace(/^\d+[\.\-\)]\s*/, '').trim();
  if (stripped) {
    const matchStripped = CANONICAL_PRODUCTION_STAGES.find(
      (s) => s.name.toLowerCase() === stripped.toLowerCase()
    );
    if (matchStripped) return matchStripped;
  }

  // 4. Reject ambiguous legacy manufacturing phases
  const slug = rawPhase.toLowerCase().replace(/[-/&\s]+/g, '_').replace(/_{2,}/g, '_');
  const ambiguousPhases = [
    'cutting',
    'stitching',
    'knitting',
    'finishing',
    'ironing',
    'ironing_finishing',
  ];
  if (ambiguousPhases.includes(slug)) {
    return UNKNOWN_PRODUCTION_STAGE;
  }

  // 5. Match known unambiguous legacy backend aliases
  switch (slug) {
    // Stage 1: Quote Accepted
    case 'quote_accepted':
    case 'quote':
      return CANONICAL_PRODUCTION_STAGES[0];

    // Stage 2: Yarn Sourcing
    case 'yarn_sourcing':
    case 'yarn_procurement_stock':
    case 'yarn_procurement':
    case 'yarn_inward':
    case 'yarn':
      return CANONICAL_PRODUCTION_STAGES[1];

    // Stage 3: Warping & Sizing
    case 'warping_sizing':
    case 'warping':
    case 'sizing':
      return CANONICAL_PRODUCTION_STAGES[2];

    // Stage 4: Loom Weaving
    case 'loom_weaving':
    case 'weaving':
    case 'knitting_weaving':
      return CANONICAL_PRODUCTION_STAGES[3];

    // Stage 5: Dyeing & Finishing
    case 'dyeing_finishing':
    case 'dyeing_fabric_processing':
    case 'dyeing_processing':
    case 'dyeing':
    case 'washing':
    case 'dyeing_washing':
      return CANONICAL_PRODUCTION_STAGES[4];

    // Stage 6: Quality Check
    case 'quality_check':
    case 'checking':
    case 'checking_quality_control':
    case 'inspection':
    case 'finishing_inspection':
    case 'checking_and_quality_control':
    case 'quality_inspection':
      return CANONICAL_PRODUCTION_STAGES[5];

    // Stage 7: Packaging & Dispatch
    case 'packaging_dispatch':
    case 'packaging':
    case 'packing':
    case 'packing_dispatch':
    case 'packaging_and_dispatch':
    case 'dispatch':
      return CANONICAL_PRODUCTION_STAGES[6];

    // Stage 8: Delivered
    case 'delivered':
    case 'delivery':
    case 'dispatch_delivery':
      return CANONICAL_PRODUCTION_STAGES[7];

    default:
      return UNKNOWN_PRODUCTION_STAGE;
  }
}

/**
 * Maps raw backend Order document to Admin Portal Order domain model.
 */
export function mapApiOrderToAdminOrder(
  apiOrder: any,
  clientsMap?: Map<string, any>,
  productsMap?: Map<string, any>,
  usersMap?: Map<string, any>
): AdminOrder {
  const id = String(apiOrder.orderNumber || apiOrder.id || apiOrder._id || '');
  const clientId = String(apiOrder.clientId || '');
  const productId = String(apiOrder.productId || '');

  const client = clientsMap?.get(clientId);
  const product = productsMap?.get(productId);

  const clientName = client?.companyName || client?.name || apiOrder.clientName || 'Enterprise Apparel Partner';
  const clientEmail = client?.email || apiOrder.clientEmail || 'procurement@client.com';
  const productName = product?.name || apiOrder.spec?.fabric || apiOrder.productDescription || 'Custom Combed Cotton Fabric';
  const category = product?.category || (apiOrder.spec?.fabric ? 'Cotton & Blends' : 'Apparel Textiles');

  const quantityMeters = Number(apiOrder.quantity) || 0;
  const producedMeters = apiOrder.production?.producedQty !== undefined
    ? Number(apiOrder.production.producedQty)
    : (apiOrder.status === 'completed' || apiOrder.status === 'delivered')
    ? quantityMeters
    : 0;

  const submittedDate = apiOrder.createdAt
    ? new Date(apiOrder.createdAt).toISOString().split('T')[0]
    : '2026-07-01';

  let deadlineDate = '2026-07-25';
  if (apiOrder.deliveryDeadline) {
    deadlineDate = typeof apiOrder.deliveryDeadline === 'string'
      ? apiOrder.deliveryDeadline.split('T')[0]
      : new Date(apiOrder.deliveryDeadline).toISOString().split('T')[0];
  }

  const status = (apiOrder.status as OrderLifecycleStatus) || 'submitted';

  // Risk Status
  let riskStatus: 'on_track' | 'at_risk' | 'early_production' | 'just_started' = 'on_track';
  if (
    status === 'awaiting_admin_decision' ||
    apiOrder.feasibility?.verdict === 'at_risk' ||
    apiOrder.feasibility?.verdict === 'not_feasible'
  ) {
    riskStatus = 'at_risk';
  } else if (status === 'completed' || status === 'delivered' || (apiOrder.production?.percentComplete || 0) >= 90) {
    riskStatus = 'on_track';
  } else if ((apiOrder.production?.percentComplete || 0) >= 20) {
    riskStatus = 'early_production';
  } else {
    riskStatus = 'just_started';
  }

  // Build process timeline stages
  const rawProcessPlan: any[] = apiOrder.production?.processPlan || [];
  const percentComplete = Number(apiOrder.production?.percentComplete) || (status === 'completed' ? 100 : 0);

  const canonicalStage = normalizeProductionStage(
    apiOrder.production?.phase,
    percentComplete,
    status
  );
  const isOrderDelivered = status === 'completed' || status === 'delivered';

  const stagesList: ProductionTimelineStage[] = rawProcessPlan.map((step: any, idx: number) => {
    const rawStageName = String(step.stage || `Stage ${idx + 1}`);
    const stageName = rawStageName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const totalSteps = rawProcessPlan.length || 1;
    const stageCompletionThreshold = ((idx + 1) / totalSteps) * 100;
    const prevThreshold = (idx / totalSteps) * 100;

    let stepStatus: 'completed' | 'in_progress' | 'pending' = 'pending';
    let dateOrDetails = step.start && step.end ? `${step.start} → ${step.end}` : 'Target Scheduled';

    if (status === 'completed' || status === 'delivered' || percentComplete >= stageCompletionThreshold) {
      stepStatus = 'completed';
      dateOrDetails = `Completed · Target: ${step.dailyTarget || 0} m/day`;
    } else if (percentComplete > prevThreshold) {
      stepStatus = 'in_progress';
      dateOrDetails = `Current stage · Target: ${step.dailyTarget || 0} m/day`;
    } else {
      stepStatus = 'pending';
      dateOrDetails = `Scheduled: ${step.start || 'Upcoming'}`;
    }

    return {
      id: `stage-${idx + 1}`,
      name: stageName,
      status: stepStatus,
      dateOrDetails,
    };
  });

  if (stagesList.length === 0) {
    CANONICAL_PRODUCTION_STAGES.forEach((cs) => {
      let stepStatus: 'completed' | 'in_progress' | 'pending' = 'pending';
      let dateOrDetails = 'Scheduled';

      if (isOrderDelivered || (canonicalStage.isKnown && cs.step < canonicalStage.step)) {
        stepStatus = 'completed';
        dateOrDetails = 'Completed';
      } else if (canonicalStage.isKnown && cs.step === canonicalStage.step) {
        stepStatus = 'in_progress';
        dateOrDetails = 'Current stage · Underway';
      } else {
        stepStatus = 'pending';
        dateOrDetails = `Scheduled: ${deadlineDate}`;
      }

      stagesList.push({
        id: `stage-${cs.step}`,
        name: cs.name,
        status: stepStatus,
        dateOrDetails,
      });
    });
  }

  const items: OrderItemProduct[] = [
    {
      id: `${id}-item-1`,
      name: productName,
      designCode: apiOrder.orderNumber || id,
      category,
      quantityPieces: quantityMeters,
      progressPercent: percentComplete,
      timeline: stagesList,
    },
  ];

    const rawSupervisorAssignment = apiOrder.production?.assignedSupervisors?.[0];
  const assignedSupervisorId = rawSupervisorAssignment?.supervisorId
    ? String(rawSupervisorAssignment.supervisorId)
    : undefined;
  const assignedSupervisorUser = assignedSupervisorId ? usersMap?.get(assignedSupervisorId) : undefined;
  const assignedSupervisorName = assignedSupervisorUser?.name || undefined;
  const handoverDate = apiOrder.production?.assignedAt
    ? String(apiOrder.production.assignedAt).split('T')[0]
    : undefined;

  let quotationObj: any = undefined;
  if (apiOrder.quotation) {
    const q = apiOrder.quotation;
    const materialCost = q.materialCostPaise ? q.materialCostPaise / 100 : 0;
    const processingCost = q.processingCostPaise ? q.processingCostPaise / 100 : 0;
    const overheadCost = q.overheadCostPaise ? q.overheadCostPaise / 100 : 0;
    const priceRiskBuffer = q.riskBufferPaise ? q.riskBufferPaise / 100 : 0;
    const unitPrice = q.unitPricePaise ? q.unitPricePaise / 100 : 0;
    const totalPrice = q.totalPaise ? q.totalPaise / 100 : 0;

    quotationObj = {
      id: String(q._id || q.id || `qt-${id}`),
      orderId: id,
      version: Number(q.version) || 1,
      materialCost,
      wastagePercent: Number(q.wastagePercent) || 0,
      processingCost,
      overheadCost,
      priceRiskBuffer,
      marginPercent: Number(q.marginPercent) || 18,
      pricePerUnit: unitPrice,
      totalPrice,
      validUntil: q.validUntil ? String(q.validUntil).split('T')[0] : deadlineDate,
      etaBasis: q.etaDate ? String(q.etaDate).split('T')[0] : deadlineDate,
      adminApproved: q.status === 'approved' || q.status === 'sent' || q.status === 'accepted',
      status: q.status || 'pending_approval',
      rejectionReason: q.rejectionReason,
      bomItems: [],
      explanation: q.explanation || 'Backend calculated quotation',
    };
  }

  return {
    id,
    backendId: String(apiOrder._id || apiOrder.id || id),
    clientName,
    clientEmail,
    productName,
    category,
    specs: {
      yarnCount: apiOrder.spec?.warpYarn || apiOrder.spec?.yarnCount || '40s Ne Combed',
      gsm: Number(apiOrder.spec?.gsm) || 180,
      width: apiOrder.spec?.reedSpace || apiOrder.spec?.width || '58 Inches',
      weave: apiOrder.spec?.weave || apiOrder.spec?.weavePattern || 'Single Jersey',
      finishing: apiOrder.spec?.fabric?.includes('Bio') ? 'Bio-Washed Finish' : 'Standard Soft Finish',
    },
    quantityMeters,
    producedMeters,
    submittedDate,
    deadlineDate,
    currentPhase: canonicalStage.isKnown
      ? canonicalStage.name
      : (isOrderDelivered ? 'Delivered' : 'Unavailable'),
    status,
    riskStatus,
    riskReason: apiOrder.feasibility?.bottleneckProcess
      ? `Bottleneck in ${apiOrder.feasibility.bottleneckProcess}`
      : undefined,
    items,
    deliveries: (apiOrder.deliveries || []).map((d: any, idx: number) => ({
      id: String(d.id || d._id || d.invoiceNo || `del-${idx + 1}`),
      orderId: id,
      date: d.deliveryDate ? String(d.deliveryDate).split('T')[0] : submittedDate,
      quantityMeters: Number(d.qty != null ? d.qty : 0),
      invoiceNumber: d.invoiceNo || '',
      carrier: d.carrier || d.notes || '-',
      deliveryType: (d.qty && quantityMeters && d.qty >= quantityMeters) ? 'full' : 'partial',
      status: 'delivered',
      invoiceAmount: d.invoiceAmountPaise ? d.invoiceAmountPaise / 100 : undefined,
    })),
    payments: (apiOrder.financials?.milestones || []).map((m: any, idx: number) => {
      const totalAmount = m.amountPaise ? m.amountPaise / 100 : 0;
      const receivedAmount = m.receivedPaise ? m.receivedPaise / 100 : 0;
      const dueAmount = m.duePaise ? m.duePaise / 100 : Math.max(0, totalAmount - receivedAmount);
      return {
        id: String(m.id || m._id || `pay-${idx + 1}`),
        orderId: id,
        invoiceNumber: m.invoiceNo || m.receipts?.[0]?.ref || (m.milestone ? `${apiOrder.orderNumber || id}-${m.milestone}` : ''),
        amount: m.status === 'received' ? (receivedAmount || totalAmount) : (receivedAmount > 0 ? receivedAmount : totalAmount),
        dueAmount,
        receivedAmount,
        milestoneIndex: idx,
        milestoneName: m.milestone || `Milestone ${idx + 1}`,
        date: m.dueDate ? String(m.dueDate).split('T')[0] : submittedDate,
        type: m.milestone || (idx === 0 ? 'advance_30' : idx === 1 ? 'mid_progress_40' : 'final_balance_30'),
        status: m.status === 'received' ? 'received' : m.status === 'partial' ? 'partial' : 'pending',
      };
    }),
    deliveredMeters: Number(apiOrder.production?.deliveredQty || 0),
    financials: apiOrder.financials,
        quotation: quotationObj,
    assignedSupervisorId,
    assignedSupervisorName,
    handoverDate,
    productionPlanConfirmed: !!(apiOrder.production?.assignedSupervisors?.length),
    dailyReports: [],
  };
}

/**
 * Authoritative check for whether a financial milestone has been settled on the backend.
 */
export function isMilestoneSettled(milestone: any, txnRef?: string): boolean {
  if (!milestone) return false;
  if (milestone.status === 'received') return true;
  const received = Number(milestone.receivedPaise) || 0;
  const total = Number(milestone.amountPaise) || 0;
  if (total > 0 && received >= total) return true;
  if (txnRef) {
    const hasReceipt = (milestone.receipts || []).some(
      (r: any) => !r.reversedAt && (r.razorpayPaymentId === txnRef || r.ref === txnRef)
    );
    if (hasReceipt) return true;
  }
  return false;
}

/**
 * Maps raw backend Order document to Client Portal Order domain model.
 */
export function mapApiClientOrder(
  apiOrder: any,
  productsMap?: Map<string, any>
): ClientOrder {
  const id = String(apiOrder.orderNumber || apiOrder.id || apiOrder._id || '');
  const productId = String(apiOrder.productId || '');
  const product = productsMap?.get(productId);

  const productName = product?.name || apiOrder.spec?.fabric || apiOrder.productDescription || 'Custom Fabric';
  const category = product?.category || 'Cotton & Blends';
  const colorway = apiOrder.spec?.colours?.length
    ? apiOrder.spec.colours.join(', ')
    : 'Natural White / Standard Dye';

  const orderedMetres = Number(apiOrder.quantity) || 0;
  const producedMetres = apiOrder.production?.producedQty !== undefined
    ? Number(apiOrder.production.producedQty)
    : (apiOrder.status === 'completed' || apiOrder.status === 'delivered')
    ? orderedMetres
    : 0;

  const remainingMetres = Math.max(0, orderedMetres - producedMetres);
  const progressPercent = apiOrder.production?.percentComplete !== undefined
    ? Number(apiOrder.production.percentComplete)
    : (apiOrder.status === 'completed' || apiOrder.status === 'delivered')
    ? 100
    : 0;

  const unitPrice = apiOrder.quotation?.unitPricePaise
    ? apiOrder.quotation.unitPricePaise / 100
    : 185;
  const totalValue = apiOrder.quotation?.totalPaise
    ? apiOrder.quotation.totalPaise / 100
    : orderedMetres * unitPrice;

  const orderDate = apiOrder.createdAt
    ? new Date(apiOrder.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '01 Jul 2026';

  let expectedDelivery = '25 Jul 2026';
  if (apiOrder.deliveryDeadline) {
    expectedDelivery = new Date(apiOrder.deliveryDeadline).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // Client Order Status mapping
  let status: 'Awaiting Quotation' | 'In Production' | 'Delivered' | 'Cancelled' = 'In Production';
  const rawStatus = String(apiOrder.status || '').toLowerCase();
  if (rawStatus === 'completed' || rawStatus === 'delivered' || rawStatus === 'partially_delivered') {
    status = 'Delivered';
  } else if (rawStatus === 'cancelled') {
    status = 'Cancelled';
  } else if (
    rawStatus === 'submitted' ||
    rawStatus === 'analyzing' ||
    rawStatus === 'quotation_drafting' ||
    rawStatus === 'quotation_pending_approval' ||
    rawStatus === 'quotation_sent' ||
    rawStatus === 'awaiting_admin_decision'
  ) {
    status = 'Awaiting Quotation';
  } else {
    status = 'In Production';
  }

  const isDelivered = status === 'Delivered';
  const canonicalStage = normalizeProductionStage(
    apiOrder.production?.phase,
    progressPercent,
    rawStatus
  );

  const currentStageNumber = isDelivered ? 8 : (canonicalStage.isKnown ? canonicalStage.step : 0);
  const currentStageName = isDelivered ? 'Delivered' : (canonicalStage.isKnown ? canonicalStage.name : 'Unavailable');

  const defaultStageNotes: Record<number, string> = {
    1: 'Commercial terms locked and advance deposit recorded',
    2: 'Raw spinning lots procured and tensile tested',
    3: 'Beam warping aligned and protective sizing starch applied',
    4: 'Precision weaving underway on Airjet / Rapier loom sheds',
    5: 'Continuous jet dyeing, scouring, and finishing treatment',
    6: '4-point visual inspection, GSM, and lab colorfastness testing',
    7: 'Inspection tagging, moisture-barrier wrapping, and palletizing',
    8: 'Material delivered to client plant with receipt signed',
  };

  const stages: ProductionStage[] = CANONICAL_PRODUCTION_STAGES.map((cs) => {
    let stageStatus: 'completed' | 'active' | 'upcoming';
    if (isDelivered || (canonicalStage.isKnown && cs.step < currentStageNumber)) {
      stageStatus = 'completed';
    } else if (canonicalStage.isKnown && cs.step === currentStageNumber) {
      stageStatus = 'active';
    } else {
      stageStatus = 'upcoming';
    }

    return {
      step: cs.step,
      name: cs.name,
      status: stageStatus,
      date: cs.step >= 7 ? expectedDelivery : orderDate,
      notes: defaultStageNotes[cs.step] || 'Stage scheduled',
    };
  });

  const milestones: OrderMilestone[] = (apiOrder.quotation?.paymentSchedule || apiOrder.financials?.milestones || []).map((m: any, idx: number) => ({
    id: `ms-${idx + 1}`,
    phase: m.milestone || `Milestone ${idx + 1}`,
    amount: m.amountPaise ? m.amountPaise / 100 : 0,
    status: isMilestoneSettled(m) ? 'paid' : 'pending',
    invoiceId: `INV-2026-000${idx + 1}`,
    dueDate: m.dueDate,
  }));

  return {
    id,
    productId,
    productName,
    category,
    colorway,
    orderedMetres,
    producedMetres,
    remainingMetres,
    progressPercent,
    unitPrice,
    totalValue,
    orderDate,
    expectedDelivery,
    currentStageNumber,
    currentStageName,
    status,
    deliveryAddress: apiOrder.deliveryAddress || 'Central Warehouse Hub, Plant #1',
    specifications: {
      gsm: Number(apiOrder.spec?.gsm) || 180,
      width: apiOrder.spec?.reedSpace || apiOrder.spec?.width || '58"',
      yarnCount: apiOrder.spec?.warpYarn || apiOrder.spec?.yarnCount || '40s Combed Cotton',
      weave: apiOrder.spec?.weave || apiOrder.spec?.weavePattern || 'Single Jersey Knitted',
      finish: apiOrder.spec?.fabric?.includes('Bio') ? 'Bio-Washed Finish' : 'Standard Finish',
      packaging: apiOrder.deliveryNotes || 'Standard Carton Packaging',
    },
    stages,
    milestones,
  };
}

/**
 * Maps raw backend Order document to Mill Supervisor Order domain model.
 */
export function mapApiSupervisorOrder(
  apiOrder: any,
  clientsMap?: Map<string, any>
): SupervisorOrder {
  const id = String(apiOrder.orderNumber || apiOrder.id || apiOrder._id || '');
  const clientId = String(apiOrder.clientId || '');
  const client = clientsMap?.get(clientId);

  const clientName = client?.companyName || client?.name || apiOrder.clientName || 'Premier Garments Ltd';
  const fabricName = apiOrder.spec?.fabric || apiOrder.productDescription || '100% Combed Cotton Single Jersey';

  const assignedDate = apiOrder.createdAt
    ? new Date(apiOrder.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '03 Jul 2026';

  const assignedTime = apiOrder.createdAt
    ? new Date(apiOrder.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '09:30 AM';

  const totalQty = Number(apiOrder.quantity) || 0;
  const producedQty = apiOrder.production?.producedQty !== undefined
    ? Number(apiOrder.production.producedQty)
    : (apiOrder.status === 'completed' || apiOrder.status === 'delivered')
    ? totalQty
    : 0;

  const remainingQty = Math.max(0, totalQty - producedQty);

  let deliveryDeadline = '2026-07-25';
  if (apiOrder.deliveryDeadline) {
    deliveryDeadline = typeof apiOrder.deliveryDeadline === 'string'
      ? apiOrder.deliveryDeadline.split('T')[0]
      : new Date(apiOrder.deliveryDeadline).toISOString().split('T')[0];
  }

  const rawStatus = String(apiOrder.status || '').toLowerCase();
  const percentComplete = Number(apiOrder.production?.percentComplete) || (rawStatus === 'completed' ? 100 : 0);

  // Map to 8 supervisor production stages using canonical stage normalizer
  const canonicalStage = normalizeProductionStage(
    apiOrder.production?.phase,
    percentComplete,
    rawStatus
  );
  const currentStage = canonicalStage.isKnown ? canonicalStage.numberedName : 'Unavailable';

  let status: 'In Progress' | 'Newly Assigned' | 'At Risk' | 'Completed' | 'Not Started' = 'In Progress';
  if (rawStatus === 'completed' || rawStatus === 'delivered') {
    status = 'Completed';
  } else if (rawStatus === 'awaiting_admin_decision') {
    status = 'At Risk';
  } else if (rawStatus === 'assigned' || rawStatus === 'submitted') {
    status = 'Newly Assigned';
  } else {
    status = 'In Progress';
  }

  const isNew = status === 'Newly Assigned';
  const dailyTarget = apiOrder.production?.processPlan?.[0]?.dailyTarget
    ? Number(apiOrder.production.processPlan[0].dailyTarget)
    : Math.max(100, Math.round(totalQty / 10));

  return {
    id,
    fabricName,
    clientName,
    assignedDate,
    assignedTime,
    totalQty,
    producedQty,
    remainingQty,
    deliveryDeadline,
    currentStage,
    status,
    isNew,
    dailyTarget,
    specs: {
      composition: apiOrder.spec?.fabric || '100% Combed Cotton',
      weavePattern: apiOrder.spec?.weave || apiOrder.spec?.weavePattern || 'Single Jersey Knitted / Oxford Plain',
      gsm: `${apiOrder.spec?.gsm || 180} GSM`,
      warpYarn: apiOrder.spec?.warpYarn || '40s Ne Compact Combed',
      weftYarn: apiOrder.spec?.weftYarn || '40s Ne Compact Combed',
      reedSpace: apiOrder.spec?.reedSpace || '68 Inches / Airjet',
      density: apiOrder.spec?.density || '84 x 72 Ends/Picks per inch',
      assignedLooms: apiOrder.spec?.assignedLooms || 'Airjet Shed #2 (Looms 11-18)',
      colorCode: apiOrder.spec?.colours?.[0] || 'PANTONE 19-4052 Classic Navy',
    },
  };
}


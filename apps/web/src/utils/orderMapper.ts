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

/**
 * Maps raw backend Order document to Admin Portal Order domain model.
 */
export function mapApiOrderToAdminOrder(
  apiOrder: any,
  clientsMap?: Map<string, any>,
  productsMap?: Map<string, any>
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
    const defaultSteps = [
      'Yarn Procurement & Stock',
      'Knitting & Weaving',
      'Dyeing & Finishing',
      'Cutting',
      'Stitching',
      'Checking & Quality Control',
      'Ironing & Finishing',
      'Packing & Dispatch',
    ];
    defaultSteps.forEach((stName, idx) => {
      stagesList.push({
        id: `stage-${idx + 1}`,
        name: stName,
        status: status === 'completed' || status === 'delivered' ? 'completed' : idx === 0 ? 'in_progress' : 'pending',
        dateOrDetails: status === 'completed' || status === 'delivered' ? 'Completed' : 'Scheduled',
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
    currentPhase: apiOrder.production?.phase
      ? String(apiOrder.production.phase).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : (status === 'completed' ? 'Delivered' : status === 'in_production' ? 'Knitting / Weaving' : 'Order Intake'),
    status,
    riskStatus,
    riskReason: apiOrder.feasibility?.bottleneckProcess
      ? `Bottleneck in ${apiOrder.feasibility.bottleneckProcess}`
      : undefined,
    items,
    deliveries: (apiOrder.deliveries || []).map((d: any, idx: number) => ({
      id: String(d.id || d._id || `del-${idx + 1}`),
      orderId: id,
      date: d.deliveryDate ? String(d.deliveryDate).split('T')[0] : submittedDate,
      quantityMeters: Number(d.qty || quantityMeters),
      invoiceNumber: d.invoiceNo || `INV-2026-000${idx + 1}`,
      carrier: 'Primary Freight Logistics',
      deliveryType: 'full',
      status: 'delivered',
    })),
    payments: (apiOrder.financials?.milestones || []).map((m: any, idx: number) => ({
      id: String(m.id || m._id || `pay-${idx + 1}`),
      orderId: id,
      invoiceNumber: `INV-2026-000${idx + 1}`,
      amount: m.amountPaise ? m.amountPaise / 100 : 0,
      date: m.dueDate || submittedDate,
      type: idx === 0 ? 'advance_30' : idx === 1 ? 'mid_progress_40' : 'final_balance_30',
      status: m.status === 'received' ? 'received' : 'pending',
    })),
    dailyReports: [],
  };
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

  const currentStageNumber = status === 'Delivered'
    ? 8
    : Math.min(8, Math.max(1, Math.ceil((progressPercent / 100) * 8)));

  const currentStageName = apiOrder.production?.phase
    ? String(apiOrder.production.phase).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : (status === 'Delivered' ? 'Delivered & Handed Over' : 'Loom Weaving & Processing');

  const stages: ProductionStage[] = [
    { step: 1, name: 'Yarn Inward', status: currentStageNumber >= 1 ? 'completed' : 'active', date: orderDate, notes: 'Sourced and tested' },
    { step: 2, name: 'Warping & Sizing', status: currentStageNumber > 2 ? 'completed' : currentStageNumber === 2 ? 'active' : 'upcoming', date: orderDate, notes: 'Sizing completed' },
    { step: 3, name: 'Loom Weaving', status: currentStageNumber > 3 ? 'completed' : currentStageNumber === 3 ? 'active' : 'upcoming', date: orderDate, notes: 'Looms operating at 800 RPM' },
    { step: 4, name: 'Dyeing & Washing', status: currentStageNumber > 4 ? 'completed' : currentStageNumber === 4 ? 'active' : 'upcoming', date: orderDate, notes: 'Color-fastness verified' },
    { step: 5, name: 'Finishing & Inspection', status: currentStageNumber > 5 ? 'completed' : currentStageNumber === 5 ? 'active' : 'upcoming', date: orderDate, notes: '4-point inspection' },
    { step: 6, name: 'Cutting & Stitching', status: currentStageNumber > 6 ? 'completed' : currentStageNumber === 6 ? 'active' : 'upcoming', date: expectedDelivery, notes: 'Precision assembly' },
    { step: 7, name: 'Packaging', status: currentStageNumber > 7 ? 'completed' : currentStageNumber === 7 ? 'active' : 'upcoming', date: expectedDelivery, notes: 'Barcoded packaging' },
    { step: 8, name: 'Dispatch & Delivery', status: currentStageNumber === 8 ? 'completed' : 'upcoming', date: expectedDelivery, notes: 'Delivered to customer warehouse' },
  ];

  const milestones: OrderMilestone[] = (apiOrder.quotation?.paymentSchedule || apiOrder.financials?.milestones || []).map((m: any, idx: number) => ({
    id: `ms-${idx + 1}`,
    phase: m.milestone || `Milestone ${idx + 1}`,
    amount: m.amountPaise ? m.amountPaise / 100 : 0,
    status: m.status === 'received' ? 'paid' : idx === 0 ? 'paid' : 'pending',
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

  // Map to 8 supervisor production stages
  let currentStage = '4. Loom Weaving';
  if (rawStatus === 'completed' || rawStatus === 'delivered' || percentComplete >= 100) {
    currentStage = '8. Delivered';
  } else if (apiOrder.production?.phase === 'packing' || percentComplete >= 88) {
    currentStage = '7. Packaging & Dispatch';
  } else if (apiOrder.production?.phase === 'checking' || percentComplete >= 75) {
    currentStage = '6. Quality Check';
  } else if (apiOrder.production?.phase === 'dyeing_fabric_processing' || percentComplete >= 60) {
    currentStage = '5. Dyeing & Finishing';
  } else if (apiOrder.production?.phase === 'knitting' || apiOrder.production?.phase === 'stitching' || percentComplete >= 40) {
    currentStage = '4. Loom Weaving';
  } else if (apiOrder.production?.phase === 'cutting' || percentComplete >= 25) {
    currentStage = '3. Warping & Sizing';
  } else if (apiOrder.production?.phase === 'yarn_procurement_stock' || percentComplete >= 10) {
    currentStage = '2. Yarn Sourcing';
  } else {
    currentStage = '1. Quote Accepted';
  }

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


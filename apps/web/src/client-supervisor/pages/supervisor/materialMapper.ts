import { RawMaterial } from '../../types/supervisor';

export function mapApiMaterialToRawMaterial(m: any): RawMaterial {
  const id = String(m.id || m._id || '');
  const name = m.materialName || m.name || 'Textile Material';
  const type = (m.type || '').toLowerCase();

  let category: 'Cotton Yarns' | 'Warp Beams' | 'Chemicals & Dyes' | 'Synthetic & Blends' = 'Cotton Yarns';
  let defaultComposition = '100% Combed Ringspun Cotton';
  let storageLocation = 'Bay Y-04 (Yarn Vault)';
  let yarnCount = '30s Ne';

  if (type === 'yarn') {
    category = 'Cotton Yarns';
    defaultComposition = name.includes('Carded')
      ? '100% Carded Compact Cotton'
      : name.includes('Spandex') || name.includes('Elastane')
      ? '95% Cotton / 5% Elastane Core'
      : '100% Combed Ringspun Cotton';
    storageLocation = 'Bay Y-04 (Yarn Vault)';
    yarnCount = name.includes('24s') ? '24s Ne' : name.includes('30s') ? '30s Ne' : '40s Ne';
  } else if (type === 'fabric') {
    category = 'Warp Beams';
    defaultComposition = '100% Cotton Greige Knit / Woven';
    storageLocation = 'Bay F-02 (Weave Prep)';
    yarnCount = 'Warp Beam 40s';
  } else if (type === 'dye_chemical') {
    category = 'Chemicals & Dyes';
    defaultComposition = 'Concentrated Reactive Dyestuffs & Sizing Auxiliaries';
    storageLocation = 'Bay C-01 (Chemical Store)';
    yarnCount = 'N/A (Liquid / Powder)';
  } else if (type === 'trim' || type === 'packing') {
    category = 'Synthetic & Blends';
    defaultComposition = 'Export Grade Industrial Accessories';
    storageLocation = 'Bay W-03 (Trims & Packing)';
    yarnCount = 'N/A';
  }

  const stockQty = typeof m.stockQty === 'number' ? m.stockQty : (typeof m.inStockQty === 'number' ? m.inStockQty : 0);
  const reservedQty = typeof m.reservedQty === 'number' ? m.reservedQty : 0;
  const reorderLevel = typeof m.reorderLevel === 'number' ? m.reorderLevel : (typeof m.thresholdQty === 'number' ? m.thresholdQty : 0);
  const unit = m.unit || 'kg';

  let status: 'In Stock' | 'Low Stock' | 'Ready for Loom' = 'In Stock';
  if (stockQty <= reorderLevel) {
    status = 'Low Stock';
  } else if (reservedQty > 0) {
    status = 'Ready for Loom';
  }

  return {
    id,
    name,
    composition: m.composition || defaultComposition,
    category,
    inStockQty: stockQty,
    unit,
    allocatedOrder: m.allocatedOrder || (reservedQty > 0 ? `${reservedQty.toLocaleString()} ${unit} Alloc.` : 'Unallocated'),
    orderName: m.orderName || (reservedQty > 0 ? 'Active Production Batches' : 'General Mill Buffer'),
    storageLocation: m.storageLocation || storageLocation,
    thresholdQty: reorderLevel,
    status,
    lastReceived: m.lastReceived || (m.updatedAt ? new Date(m.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Verified In-Stock'),
    supplier: m.supplier || 'Approved Mill Supplier',
    yarnCount: m.yarnCount || yarnCount,
    csp: m.csp || '2850',
    twistPerInch: m.twistPerInch || '28.5 TPI',
    moistureRegain: m.moistureRegain || '7.5%',
  };
}


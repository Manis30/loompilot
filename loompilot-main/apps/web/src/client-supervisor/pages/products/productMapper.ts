import { Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export interface ApiProductRecord {
  _id?: string;
  id?: string;
  productName?: string;
  name?: string;
  category?: string;
  categoryCode?: string;
  basePricePaise?: number;
  basePriceRange?: string;
  routing?: Array<{ stage: string; seq: number; stdMinPerUnit: number }>;
  bom?: Array<{ materialId: any; qtyPerUnit: number; wastage?: number }>;
  imageFileIds?: string[];
  active?: boolean;
  gsm?: number;
  yarnCount?: string;
  weave?: string;
  construction?: string;
  widthInches?: number;
  widthCm?: number;
  moq?: number;
  leadTimeWeeks?: string;
  image?: string;
  description?: string;
  features?: string[];
  colors?: string[];
  [key: string]: any;
}

export interface UiProduct extends Product {
  rawCategory: string;
  basePricePaise: number;
  routing?: Array<{ stage: string; seq: number; stdMinPerUnit: number }>;
  bom?: Array<{ materialId: any; qtyPerUnit: number; wastage?: number }>;
}

export function mapApiProductToProduct(item: ApiProductRecord): UiProduct {
  const id = String(item.id || item._id || '');
  const rawCat = (item.category || '').toLowerCase().trim();
  const name = item.productName || item.name || 'Textile Formulation';

  // Category mapping
  let categoryLabel = item.category || 'Fabric Formulation';
  let categoryCode: 'cotton' | 'woven' | 'blended' | 'knitted' | 'poly' | 'custom' = 'custom';
  let defaultImage = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80';
  let defaultGsm = 200;
  let defaultYarnCount = '30s Single Jersey';
  let defaultWeave = 'Single Jersey Knit';
  let defaultConstruction = '28 GG Circular Knit';
  let defaultWidthInches = 60;
  let defaultWidthCm = 152;
  let defaultMoq = 500;
  let defaultLeadTime = '2 - 3 Weeks';
  let defaultDesc = `${name} engineered for commercial volume manufacturing with verified mill BOM and multi-stage production routing.`;
  let defaultFeatures = [
    'Mill Verified Formulation & QA Inspection',
    'Commercial Grade Colorfastness',
    'Pre-shrunk Dimensional Stability',
    'Standard Industrial Yarn Blend',
  ];
  let defaultColors = ['Classic White', 'Jet Black', 'Navy Blue', 'Heather Grey', 'Olive Green'];

  if (rawCat === 't_shirt' || rawCat.includes('t_shirt') || rawCat.includes('t-shirt') || rawCat === 'knitted') {
    categoryLabel = 'T-Shirts / Knits';
    categoryCode = 'knitted';
    defaultImage = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80';
    defaultGsm = 180;
    defaultYarnCount = '30s Combed Cotton Bio-Wash';
    defaultWeave = 'Single Jersey Knit';
    defaultConstruction = '28 GG / Single Knit';
    defaultWidthInches = 60;
    defaultWidthCm = 152;
    defaultMoq = 500;
    defaultLeadTime = '2 - 3 Weeks';
    defaultDesc = 'Super-combed 100% bio-washed cotton single jersey knitted for high dimensional stability, zero torque, and superior hand-feel. Ideal for premium casualwear.';
    defaultFeatures = [
      '100% Super-Combed Bio-Washed Cotton',
      'Bio-Polished Anti-Pilling Surface',
      'High Colorfastness to Washing (4.5+)',
      'Compact Ringspun Yarn with Zero Seam Twisting',
    ];
    defaultColors = ['Classic White', 'Jet Black', 'Navy Blue', 'Melange Grey', 'Bottle Green'];
  } else if (rawCat === 'polo_shirt' || rawCat.includes('polo')) {
    categoryLabel = 'Polo Shirts';
    categoryCode = 'knitted';
    defaultImage = 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=800&q=80';
    defaultGsm = 220;
    defaultYarnCount = '26s/2 Double Ply Combed';
    defaultWeave = 'Honeycomb Pique Knit';
    defaultConstruction = '24 GG / Pique Knit';
    defaultWidthInches = 48;
    defaultWidthCm = 122;
    defaultMoq = 300;
    defaultLeadTime = '2 - 4 Weeks';
    defaultDesc = 'Double-ply combed cotton knit in a breathable honeycomb pique structure. Engineered for corporate apparel and structured collar polo shirts.';
    defaultFeatures = [
      'Double-Ply Combed Ringspun Yarn',
      'Breathable Honeycomb Aeration Structure',
      'Pre-shrunk with Ribbed Collar & Cuffs',
      'Reinforced Shoulder Taping',
    ];
    defaultColors = ['Royal Navy', 'Crimson Red', 'White', 'Slate Charcoal', 'Teal'];
  } else if (rawCat === 'hoodie' || rawCat.includes('hoodie') || rawCat.includes('fleece')) {
    categoryLabel = 'Fleece & Hoodies';
    categoryCode = 'blended';
    defaultImage = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80';
    defaultGsm = 380;
    defaultYarnCount = '20s/1 Face + 10s Fleecy Loop';
    defaultWeave = '3-Thread Brushed Fleece';
    defaultConstruction = '20 GG / Heavy Fleece';
    defaultWidthInches = 58;
    defaultWidthCm = 147;
    defaultMoq = 250;
    defaultLeadTime = '3 - 4 Weeks';
    defaultDesc = 'Heavyweight 3-thread French terry brushed fleece with an ultra-soft inner lining and a dense, clean outer face for high-definition embroidery and printing.';
    defaultFeatures = [
      'Heavyweight 380 GSM Brushed Interior',
      '100% Cotton Outer Face for Fine Printing',
      'Durable 2x2 Lycra Ribbing Trim',
      'Minimal Thermal Shrinkage (< 2%)',
    ];
    defaultColors = ['Heather Grey', 'Deep Black', 'Burgundy', 'Forest Green', 'Camel Brown'];
  } else if (rawCat === 'activewear' || rawCat.includes('active') || rawCat.includes('poly')) {
    categoryLabel = 'Performance Activewear';
    categoryCode = 'poly';
    defaultImage = 'https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?auto=format&fit=crop&w=800&q=80';
    defaultGsm = 160;
    defaultYarnCount = '75D/72F Micro-Poly + Spandex';
    defaultWeave = 'Interlock Dry-Fit Knit';
    defaultConstruction = '32 GG / Fine Gauge Interlock';
    defaultWidthInches = 60;
    defaultWidthCm = 152;
    defaultMoq = 500;
    defaultLeadTime = '2 - 3 Weeks';
    defaultDesc = 'Engineered micro-polyester interlock infused with 4-way spandex stretch and moisture-wicking capillary channels for athletic and gym apparel.';
    defaultFeatures = [
      'Capillary Moisture-Wicking Technology',
      '4-Way Stretch Ergonomic Recovery',
      'Anti-Microbial & Odor-Resistant Finish',
      'Quick-Dry Breathable Airflow Channels',
    ];
    defaultColors = ['Electric Blue', 'Neon Coral', 'Charcoal Mist', 'Matte Black', 'Bright White'];
  } else if (rawCat === 'cotton') {
    categoryLabel = 'Cotton Fabrics';
    categoryCode = 'cotton';
    defaultImage = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80';
  } else if (rawCat === 'woven') {
    categoryLabel = 'Woven & Denim';
    categoryCode = 'woven';
    defaultImage = 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80';
  }

  // Base price calculation
  const paise = typeof item.basePricePaise === 'number' ? item.basePricePaise : 0;
  let basePriceRange = item.basePriceRange;
  if (!basePriceRange && paise > 0) {
    const rupees = paise / 100;
    basePriceRange = `${formatCurrency(rupees)} / unit`;
  } else if (!basePriceRange) {
    basePriceRange = 'Price on Request';
  }

  return {
    id,
    name,
    category: categoryLabel,
    rawCategory: item.category || rawCat,
    categoryCode: (item.categoryCode as any) || categoryCode,
    gsm: item.gsm || defaultGsm,
    yarnCount: item.yarnCount || defaultYarnCount,
    weave: item.weave || defaultWeave,
    construction: item.construction || defaultConstruction,
    widthInches: item.widthInches || defaultWidthInches,
    widthCm: item.widthCm || defaultWidthCm,
    moq: item.moq || defaultMoq,
    leadTimeWeeks: item.leadTimeWeeks || defaultLeadTime,
    basePriceRange,
    basePricePaise: paise,
    image: item.image || defaultImage,
    description: item.description || defaultDesc,
    features: item.features && item.features.length > 0 ? item.features : defaultFeatures,
    colors: item.colors && item.colors.length > 0 ? item.colors : defaultColors,
    routing: item.routing,
    bom: item.bom,
  };
}


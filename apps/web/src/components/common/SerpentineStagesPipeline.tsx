import React, { useState } from 'react';
import {
  Check,
  Clock,
  Maximize2,
  X,
  MapPin
} from 'lucide-react';
import type { ProductionTimelineStage } from '../../types';

interface SerpentineStagesPipelineProps {
  stages: ProductionTimelineStage[];
  orderId: string;
  productName: string;
  designCode?: string;
  onAdvanceStage?: () => void;
  canAdvance?: boolean;
}

// =============================================================================
// DETAILED VECTOR TEXTILE STAGE ILLUSTRATIONS (With pastel organic backdrops)
// =============================================================================

// 1. Yarn Inward Illustration (Yarn Cones, Spools & Raw Cotton Inward)
const YarnInwardIllustration: React.FC = () => (
  <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%' }}>
    {/* Soft Pastel Blue Organic Backdrop */}
    <circle cx="80" cy="60" r="46" fill="#dbeafe" opacity="0.85" />
    <ellipse cx="108" cy="40" r="16" fill="#bfdbfe" opacity="0.6" />
    
    {/* Wooden Pallet Base */}
    <rect x="35" y="88" width="90" height="7" rx="3" fill="#cbd5e1" />
    <rect x="42" y="95" width="12" height="6" rx="1.5" fill="#94a3b8" />
    <rect x="74" y="95" width="12" height="6" rx="1.5" fill="#94a3b8" />
    <rect x="106" y="95" width="12" height="6" rx="1.5" fill="#94a3b8" />

    {/* Cone 1: Left Indigo Yarn Cone */}
    <path d="M50 88 L58 38 L68 38 L76 88 Z" fill="#3b82f6" />
    {/* Yarn Thread Lines */}
    <ellipse cx="63" cy="38" rx="5" ry="2.5" fill="#1d4ed8" />
    <path d="M52 78 Q63 81 74 78" stroke="#60a5fa" strokeWidth="1.5" fill="none" />
    <path d="M54 68 Q63 71 72 68" stroke="#93c5fd" strokeWidth="1.5" fill="none" />
    <path d="M56 58 Q63 61 70 58" stroke="#60a5fa" strokeWidth="1.5" fill="none" />
    <path d="M57 48 Q63 50 69 48" stroke="#93c5fd" strokeWidth="1.5" fill="none" />

    {/* Cone 2: Center Cream/White Cotton Cone */}
    <path d="M74 88 L81 32 L91 32 L98 88 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
    <ellipse cx="86" cy="32" rx="5" ry="2.5" fill="#e2e8f0" />
    <path d="M76 76 Q86 79 96 76" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
    <path d="M78 64 Q86 67 94 64" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
    <path d="M80 52 Q86 54 92 52" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />

    {/* Cone 3: Right Emerald Accent Cone */}
    <path d="M96 88 L103 44 L111 44 L118 88 Z" fill="#10b981" />
    <ellipse cx="107" cy="44" rx="4" ry="2" fill="#047857" />
    <path d="M98 78 Q107 80 116 78" stroke="#34d399" strokeWidth="1.5" fill="none" />
    <path d="M100 66 Q107 68 114 66" stroke="#6ee7b7" strokeWidth="1.5" fill="none" />
    <path d="M102 54 Q107 56 112 54" stroke="#34d399" strokeWidth="1.5" fill="none" />

    {/* Fluffy Raw Cotton Flower Bloom */}
    <circle cx="42" cy="74" r="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    <circle cx="36" cy="80" r="7" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
    <circle cx="46" cy="82" r="7" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />

    {/* Inward Quality Inspection Badge */}
    <g transform="translate(108, 22)">
      <circle cx="14" cy="14" r="14" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />
      <circle cx="14" cy="14" r="11" fill="#22c55e" />
      <path d="M10 14 L13 17 L18 11" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  </svg>
);

// 2. Warping & Sizing Illustration (High-Speed Creel & Beam Sizing)
const WarpingSizingIllustration: React.FC = () => (
  <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%' }}>
    {/* Soft Pastel Amber Organic Backdrop */}
    <circle cx="80" cy="60" r="46" fill="#fef3c7" opacity="0.85" />
    <ellipse cx="50" cy="75" r="18" fill="#fde68a" opacity="0.5" />

    {/* Warping Creel Stand (Left) */}
    <line x1="28" y1="28" x2="28" y2="95" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
    <line x1="22" y1="95" x2="34" y2="95" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
    {/* Yarn package pegs on creel */}
    <circle cx="28" cy="40" r="4.5" fill="#f59e0b" />
    <circle cx="28" cy="58" r="4.5" fill="#f59e0b" />
    <circle cx="28" cy="76" r="4.5" fill="#f59e0b" />

    {/* Parallel Warp Yarn Sheet (Streaming across to the beam) */}
    <path d="M32 40 C60 42 75 50 102 54" stroke="#f59e0b" strokeWidth="1.4" fill="none" opacity="0.9" />
    <path d="M32 46 C60 47 75 54 102 56" stroke="#d97706" strokeWidth="1.4" fill="none" opacity="0.8" />
    <path d="M32 58 C60 56 75 58 102 58" stroke="#f59e0b" strokeWidth="1.4" fill="none" opacity="0.9" />
    <path d="M32 68 C60 64 75 62 102 60" stroke="#d97706" strokeWidth="1.4" fill="none" opacity="0.8" />
    <path d="M32 76 C60 70 75 66 102 62" stroke="#f59e0b" strokeWidth="1.4" fill="none" opacity="0.9" />

    {/* Comb Separator Grid */}
    <rect x="68" y="44" width="8" height="30" rx="2" fill="#475569" />
    <line x1="72" y1="46" x2="72" y2="72" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />

    {/* Sizing Chemical Roller Vat (Below) */}
    <rect x="88" y="76" width="46" height="18" rx="4" fill="#cbd5e1" />
    <path d="M90 84 Q111 82 132 84 L132 92 Q111 94 90 92 Z" fill="#38bdf8" opacity="0.75" />

    {/* Large Warp Beam Roller (Right) */}
    <ellipse cx="112" cy="58" rx="8" ry="24" fill="#334155" />
    <rect x="112" y="34" width="22" height="48" fill="#475569" />
    <ellipse cx="134" cy="58" rx="8" ry="24" fill="#64748b" />
    <ellipse cx="134" cy="58" rx="4" ry="12" fill="#0f172a" />
    {/* Yarn wound on beam */}
    <rect x="115" y="38" width="16" height="40" fill="#f59e0b" rx="2" />
  </svg>
);

// 3. Loom Weaving Illustration (High-Speed Airjet Loom)
const LoomWeavingIllustration: React.FC = () => (
  <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%' }}>
    {/* Soft Pastel Purple Organic Backdrop */}
    <circle cx="80" cy="60" r="46" fill="#ede9fe" opacity="0.85" />
    <ellipse cx="115" cy="72" r="16" fill="#ddd6fe" opacity="0.6" />

    {/* Loom Machine Main Frame */}
    <rect x="32" y="36" width="96" height="58" rx="8" fill="#1e293b" />
    <rect x="36" y="40" width="88" height="50" rx="6" fill="#0f172a" />

    {/* Heddle Frames & Reed (Weaving Mechanism) */}
    <rect x="68" y="44" width="4" height="34" fill="#94a3b8" />
    <rect x="76" y="44" width="4" height="34" fill="#94a3b8" />
    <rect x="84" y="44" width="4" height="34" fill="#94a3b8" />

    {/* Warp Threads Feeding in */}
    <line x1="42" y1="58" x2="68" y2="52" stroke="#a78bfa" strokeWidth="1.5" />
    <line x1="42" y1="62" x2="68" y2="62" stroke="#c4b5fd" strokeWidth="1.5" />
    <line x1="42" y1="66" x2="68" y2="70" stroke="#a78bfa" strokeWidth="1.5" />

    {/* Shuttle / Airjet Insertion Flight Path */}
    <path d="M58 61 L102 61" stroke="#f43f5e" strokeWidth="2" strokeDasharray="3 2" />
    <polygon points="102,59 107,61 102,63" fill="#f43f5e" />

    {/* Finished Woven Cloth Roll Descending at Front */}
    <ellipse cx="106" cy="68" rx="6" ry="16" fill="#7c3aed" />
    <rect x="86" y="52" width="20" height="32" fill="#8b5cf6" />
    {/* Woven Twill Fabric Texture Lines */}
    <line x1="88" y1="56" x2="96" y2="64" stroke="#c4b5fd" strokeWidth="1" />
    <line x1="92" y1="60" x2="100" y2="68" stroke="#c4b5fd" strokeWidth="1" />
    <line x1="96" y1="64" x2="104" y2="72" stroke="#c4b5fd" strokeWidth="1" />

    {/* Digital Loom Telemetry Screen */}
    <rect x="40" y="44" width="22" height="15" rx="3" fill="#0284c7" />
    <path d="M43 52 L46 48 L49 54 L53 50 L56 53 L59 51" stroke="#38bdf8" strokeWidth="1.2" fill="none" />

    {/* Machine Floor Mount */}
    <rect x="28" y="94" width="104" height="5" rx="2" fill="#475569" />
  </svg>
);

// 4. Dyeing & Finishing Illustration (Continuous Stenter & Color Immersion)
const DyeingFinishingIllustration: React.FC = () => (
  <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%' }}>
    {/* Soft Pastel Cyan/Mint Backdrop */}
    <circle cx="80" cy="60" r="46" fill="#ccfbf1" opacity="0.85" />
    <ellipse cx="48" cy="45" r="16" fill="#99f6e4" opacity="0.6" />

    {/* Stenter Frame Enclosure */}
    <rect x="30" y="32" width="100" height="62" rx="8" fill="#0f766e" />
    <rect x="34" y="36" width="92" height="54" rx="6" fill="#134e4a" />

    {/* Dye Chemical Immersion Vat (Left) */}
    <rect x="40" y="56" width="32" height="26" rx="4" fill="#0284c7" />
    <path d="M42 62 Q56 60 70 62 L70 80 Q56 82 42 80 Z" fill="#38bdf8" opacity="0.85" />
    {/* Bubbles */}
    <circle cx="48" cy="68" r="2" fill="#ffffff" opacity="0.7" />
    <circle cx="62" cy="72" r="2.5" fill="#ffffff" opacity="0.7" />

    {/* Fabric Ribbon Entering Dye & Curving over Rollers */}
    <path d="M36 46 Q54 44 56 62 Q58 76 72 70 Q84 62 88 48 Q92 38 106 44 L118 48"
          stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" fill="none" />
    <path d="M36 46 Q54 44 56 62 Q58 76 72 70 Q84 62 88 48 Q92 38 106 44 L118 48"
          stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Heated Finishing Rollers */}
    <circle cx="56" cy="52" r="7" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
    <circle cx="88" cy="52" r="7" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
    <circle cx="106" cy="52" r="7" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />

    {/* Steam / Heat Waves */}
    <path d="M84 32 Q87 26 84 20" stroke="#99f6e4" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M96 32 Q99 26 96 20" stroke="#99f6e4" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M108 32 Q111 26 108 20" stroke="#99f6e4" strokeWidth="1.5" strokeLinecap="round" fill="none" />

    {/* Floor base */}
    <rect x="26" y="94" width="108" height="5" rx="2" fill="#334155" />
  </svg>
);

// 5. Quality Inspection Illustration (ASTM 4-Point Lightbox Inspection Table)
const QualityInspectionIllustration: React.FC = () => (
  <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%' }}>
    {/* Soft Pastel Emerald Backdrop */}
    <circle cx="80" cy="60" r="46" fill="#dcfce7" opacity="0.85" />
    <ellipse cx="112" cy="45" r="18" fill="#bbf7d0" opacity="0.6" />

    {/* Angled Lightbox Table Legs */}
    <line x1="42" y1="72" x2="36" y2="98" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    <line x1="118" y1="72" x2="124" y2="98" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    <line x1="32" y1="98" x2="128" y2="98" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

    {/* Angled Inspection Table Frame */}
    <polygon points="38,72 122,72 114,36 46,36" fill="#1e293b" />
    {/* Illuminated Backlit Glass Screen */}
    <polygon points="42,70 118,70 112,40 48,40" fill="#f0fdf4" />
    {/* Internal Lighting Glow */}
    <ellipse cx="80" cy="55" rx="28" ry="12" fill="#86efac" opacity="0.45" />

    {/* Fabric Roll Flowing Across Lightbox */}
    <path d="M40 70 L46 38 L114 38 L120 70" stroke="#16a34a" strokeWidth="3" fill="none" opacity="0.8" />
    {/* Grid Gridlines on Screen */}
    <line x1="60" y1="40" x2="56" y2="70" stroke="#86efac" strokeWidth="1" strokeDasharray="3 3" />
    <line x1="80" y1="40" x2="80" y2="70" stroke="#86efac" strokeWidth="1" strokeDasharray="3 3" />
    <line x1="100" y1="40" x2="104" y2="70" stroke="#86efac" strokeWidth="1" strokeDasharray="3 3" />

    {/* Magnifying Glass Inspecting Weave */}
    <g transform="translate(68, 38)">
      <circle cx="16" cy="16" r="14" fill="rgba(255,255,255,0.7)" stroke="#0f172a" strokeWidth="2.5" />
      <line x1="26" y1="26" x2="38" y2="38" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
      {/* Target Crosshair */}
      <circle cx="16" cy="16" r="7" fill="none" stroke="#22c55e" strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="16" y1="8" x2="16" y2="24" stroke="#22c55e" strokeWidth="1.2" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="#22c55e" strokeWidth="1.2" />
    </g>

    {/* 98.5% First-Pass Approved Stamp Badge */}
    <g transform="translate(102, 18)">
      <circle cx="15" cy="15" r="15" fill="#ffffff" filter="drop-shadow(0 2px 6px rgba(16,185,129,0.3))" />
      <circle cx="15" cy="15" r="12" fill="#16a34a" />
      <path d="M10 15 L14 19 L21 11" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  </svg>
);

// 6. Dispatch & Logistics Illustration (Cartons, Pallet, Logistics Van)
const DispatchIllustration: React.FC = () => (
  <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%' }}>
    {/* Soft Pastel Rose Backdrop */}
    <circle cx="80" cy="60" r="46" fill="#ffe4e6" opacity="0.85" />
    <ellipse cx="48" cy="74" r="18" fill="#fecdd3" opacity="0.6" />

    {/* Wooden Pallet */}
    <rect x="28" y="90" width="58" height="6" rx="2" fill="#cbd5e1" />
    <rect x="34" y="96" width="10" height="5" rx="1.5" fill="#94a3b8" />
    <rect x="52" y="96" width="10" height="5" rx="1.5" fill="#94a3b8" />
    <rect x="70" y="96" width="10" height="5" rx="1.5" fill="#94a3b8" />

    {/* Carton 1 (Bottom Left) */}
    <rect x="30" y="64" width="26" height="26" rx="3" fill="#d97706" />
    <polygon points="30,64 43,56 56,64" fill="#b45309" />
    {/* Packaging Tape */}
    <line x1="43" y1="56" x2="43" y2="90" stroke="#fef08a" strokeWidth="2.5" />
    {/* Barcode label */}
    <rect x="34" y="72" width="10" height="6" rx="1" fill="#ffffff" />
    <line x1="36" y1="74" x2="36" y2="76" stroke="#000" strokeWidth="1" />
    <line x1="38" y1="74" x2="38" y2="76" stroke="#000" strokeWidth="1" />
    <line x1="41" y1="74" x2="41" y2="76" stroke="#000" strokeWidth="1" />

    {/* Carton 2 (Bottom Right on Pallet) */}
    <rect x="58" y="68" width="24" height="22" rx="3" fill="#f59e0b" />
    <polygon points="58,68 70,61 82,68" fill="#d97706" />
    <line x1="70" y1="61" x2="70" y2="90" stroke="#fef08a" strokeWidth="2" />

    {/* Wrapped Fabric Roll on top */}
    <rect x="38" y="44" width="38" height="18" rx="8" fill="#f43f5e" />
    <ellipse cx="76" cy="53" rx="4" ry="9" fill="#be123c" />
    {/* Poly-film wrap shine */}
    <path d="M42 48 L72 48" stroke="#fda4af" strokeWidth="1.5" />

    {/* Delivery Dispatch Truck (Right) */}
    <g transform="translate(86, 42)">
      {/* Truck Body Cargo */}
      <rect x="0" y="8" width="36" height="32" rx="3" fill="#1e293b" />
      {/* Truck Cab */}
      <path d="M36 20 L48 20 L54 30 L54 40 L36 40 Z" fill="#0f172a" />
      <polygon points="38,23 46,23 50,30 38,30" fill="#38bdf8" />
      {/* Wheels */}
      <circle cx="12" cy="40" r="6" fill="#475569" stroke="#0f172a" strokeWidth="2" />
      <circle cx="44" cy="40" r="6" fill="#475569" stroke="#0f172a" strokeWidth="2" />
      <circle cx="12" cy="40" r="2.5" fill="#e2e8f0" />
      <circle cx="44" cy="40" r="2.5" fill="#e2e8f0" />
      {/* Speed Motion Lines */}
      <line x1="56" y1="26" x2="62" y2="26" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="56" y1="32" x2="65" y2="32" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" />
    </g>

    {/* Road Surface */}
    <line x1="20" y1="102" x2="148" y2="102" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// SERPENTINE STAGES PIPELINE COMPONENT
// =============================================================================
export const SerpentineStagesPipeline: React.FC<SerpentineStagesPipelineProps> = ({
  stages,
  orderId,
  productName,
  designCode,
  onAdvanceStage,
  canAdvance = true
}) => {
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null);
  const [isFullscreenModal, setIsFullscreenModal] = useState<boolean>(false);

  // Derive which stage is the active/current in-progress stage
  const inProgressIndex = stages.findIndex((s) => s.status === 'in_progress');
  const activeStageIdx = inProgressIndex !== -1 ? inProgressIndex : stages.length - 1;
  const currentStage = stages[activeStageIdx] || stages[4];

  // Specific textile manufacturing sub-tasks for each of the 6 stages
  const stageSubTasks: Record<number, string[]> = {
    0: [
      'Raw fiber lot verification',
      'Ring-spun yarn tension test',
      'Moisture: 7.8% (Approved)',
      '40s Combed Cotton batch ok'
    ],
    1: [
      '12 High-speed creel beams',
      'PVA sizing chemical mix',
      'Yarn elongation check',
      'Beam tension calibrated'
    ],
    2: [
      'Airjet Loom #12 run',
      '850 RPM continuous weaving',
      'Zero warp stops detected',
      '2,000 meters produced'
    ],
    3: [
      'Continuous stenter run',
      'Reactive Dye Shade 4B',
      'Delta-E: 0.42 (Passed)',
      'Bio-washed soft finish'
    ],
    4: [
      'ASTM D5430 4-point yield',
      'Defect density: 1.2 pts/100m²',
      'Tensile warp / weft passed',
      'Supervisor: Ramesh Kumar'
    ],
    5: [
      'Poly-film protective wrapping',
      'Barcoded carton labelling',
      'Waybill generated',
      'Ready for delivery'
    ]
  };

  const stageAccentColors = [
    '#3b82f6', // Yarn Inward - Blue
    '#f59e0b', // Warping & Sizing - Amber
    '#8b5cf6', // Loom Weaving - Purple
    '#06b6d4', // Dyeing & Finishing - Cyan
    '#10b981', // Quality Inspection - Emerald
    '#f43f5e'  // Dispatch - Rose
  ];

  // ===========================================================================
  // ILLUSTRATED TEXTILE PRODUCTION ROADMAP
  // (Inspired by reference roadmap: winding sand ribbon, road signs, landmarks & 'YOU ARE HERE' pin)
  // ===========================================================================
  const [hoveredStageIdx, setHoveredStageIdx] = useState<number | null>(null);

  // The winding scenic ribbon highway path
  const roadDPath = `
    M 20, 105
    C 70, 105   120, 100  180, 100
    C 260, 100  340, 85   430, 85
    C 520, 85   610, 110  700, 115
    C 770, 120  840, 120  885, 160
    C 930, 200  930, 255  880, 290
    C 820, 325  730, 310  640, 310
    C 530, 310  430, 330  340, 320
    C 250, 310  160, 305  105, 345
    C 55, 385   80, 435   170, 445
    C 260, 455  380, 445  520, 445
    C 640, 445  740, 440  930, 440
  `;

  const totalRoadLength = 2650;
  // Progress ratio from Start (0) to Active Stage
  const progressRatio = Math.min(1, Math.max(0.08, (activeStageIdx + 0.75) / 6));
  const completedStrokeDashoffset = totalRoadLength * (1 - progressRatio);

  const selectedOrActiveIdx = selectedStageIndex !== null ? selectedStageIndex : activeStageIdx;
  const inspectedStage = stages[selectedOrActiveIdx] || currentStage;

  return (
    <div className="textile-roadmap-container">
      {/* =======================================================================
          SCENIC ROADMAP SVG CANVAS (Fills right panel without scrolling)
          ======================================================================= */}
      <div className="textile-roadmap-canvas">
        <svg
          className="textile-roadmap-svg"
          viewBox="0 0 960 510"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Soft Ambient Shadow under the Road */}
            <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.08" />
            </filter>
            {/* Landmark Soft Glow */}
            <filter id="landmarkGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#10b981" floodOpacity="0.3" />
            </filter>
            <filter id="activePinGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#dc2626" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* ===================================================================
              1. THE WINDING ROAD LAYERS (Warm sandstone asphalt matching reference)
              =================================================================== */}
          {/* Base Road Drop Shadow */}
          <path
            d={roadDPath}
            stroke="rgba(15, 23, 42, 0.05)"
            strokeWidth="62"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Road Curb / Sandstone Shoulder */}
          <path
            d={roadDPath}
            stroke="#e4dac9"
            strokeWidth="54"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Road Main Asphalt Ribbon (Warm Beige Painterly Finish from reference) */}
          <path
            d={roadDPath}
            stroke="#f2ebe0"
            strokeWidth="46"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Completed Journey Route: Illuminated Emerald Glow up to Active Stage */}
          <path
            d={roadDPath}
            stroke="#10b981"
            strokeWidth="46"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.18"
            strokeDasharray={totalRoadLength}
            strokeDashoffset={completedStrokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
          <path
            d={roadDPath}
            stroke="#10b981"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.75"
            strokeDasharray={totalRoadLength}
            strokeDashoffset={completedStrokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />

          {/* Dashed White Center Dividing Stripe */}
          <path
            d={roadDPath}
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeDasharray="8 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.95"
          />

          {/* Directional Chevron Arrows on Road */}
          <g transform="translate(240, 100)"><polygon points="-3,-4 4,0 -3,4" fill="#10b981" opacity="0.8" /></g>
          <g transform="translate(620, 108)"><polygon points="-3,-4 4,0 -3,4" fill="#10b981" opacity="0.8" /></g>
          <g transform="translate(905, 225)"><polygon points="-4,-3 0,4 4,-3" fill={activeStageIdx >= 2 ? "#10b981" : "#94a3b8"} opacity="0.85" /></g>
          <g transform="translate(680, 313)"><polygon points="3,-4 -4,0 3,4" fill={activeStageIdx >= 3 ? "#10b981" : "#94a3b8"} opacity="0.8" /></g>
          <g transform="translate(380, 323)"><polygon points="3,-4 -4,0 3,4" fill={activeStageIdx >= 4 ? "#10b981" : "#94a3b8"} opacity="0.8" /></g>
          <g transform="translate(560, 445)"><polygon points="-3,-4 4,0 -3,4" fill={activeStageIdx >= 5 ? "#10b981" : "#94a3b8"} opacity="0.8" /></g>

          {/* ===================================================================
              2. DECORATIVE ROADSIDE ELEMENTS & FLORA (Matching illustrated feel)
              =================================================================== */}
          {/* Milestone markers along road shoulders */}
          <circle cx="340" cy="115" r="3" fill="#cbd5e1" />
          <circle cx="680" cy="142" r="3.5" fill="#cbd5e1" />
          <circle cx="840" cy="275" r="3" fill="#cbd5e1" />
          <circle cx="480" cy="290" r="3.5" fill="#cbd5e1" />
          <circle cx="380" cy="425" r="3" fill="#cbd5e1" />

          {/* Little green grass tufts */}
          <path d="M 28,135 Q 31,126 34,135 M 34,135 Q 37,124 40,135" stroke="#86efac" strokeWidth="1.4" fill="none" />
          <path d="M 520,60 Q 523,52 526,60 M 526,60 Q 529,50 532,60" stroke="#86efac" strokeWidth="1.4" fill="none" />
          <path d="M 915,160 Q 918,152 921,160" stroke="#86efac" strokeWidth="1.4" fill="none" />
          <path d="M 330,350 Q 333,342 336,350 M 336,350 Q 339,340 342,350" stroke="#86efac" strokeWidth="1.4" fill="none" />
          <path d="M 120,410 Q 123,402 126,410" stroke="#86efac" strokeWidth="1.4" fill="none" />

          {/* ===================================================================
              3. STAGE 1: YARN INWARD (Top-Left)
              =================================================================== */}
          {/* Welcome to LoomPilot Arch Billboard (Exact match to 'Welcome to Budget Town') */}
          <g transform="translate(48, 14)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(0)}>
            {/* Wooden posts in ground */}
            <rect x="22" y="16" width="5" height="42" fill="#854d0e" rx="1" />
            <rect x="138" y="16" width="5" height="42" fill="#854d0e" rx="1" />
            {/* Archway Board */}
            <path d="M 14,24 Q 82,6 148,24 L 148,42 Q 82,24 14,42 Z" fill="#222C2E" stroke="#79B4B7" strokeWidth="1.8" />
            <circle cx="82" cy="14" r="8" fill="#79B4B7" stroke="#4A8184" strokeWidth="1.2" />
            <text x="82" y="17" textAnchor="middle" fill="#1B1918" fontSize="7.5" fontWeight="900">★</text>
            <text x="82" y="27" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900" letterSpacing="0.4">
              WELCOME TO LOOMPILOT
            </text>
            <text x="82" y="38" textAnchor="middle" fill="#FAF4EA" fontSize="7" fontWeight="700">
              MILL INWARD GATE • 40S LOT
            </text>
          </g>

          {/* Green Highway Exit Sign (like 'Savings Land Next Exit') */}
          <g transform="translate(34, 62)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(0)}>
            <rect x="10" y="24" width="3.5" height="24" fill="#64748b" rx="1" />
            <rect x="0" y="0" width="86" height="30" rx="4" fill="#047857" stroke="#ffffff" strokeWidth="1.4" />
            <text x="43" y="12" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="900">
              YARN INWARD
            </text>
            <text x="43" y="23" textAnchor="middle" fill="#fef08a" fontSize="6.5" fontWeight="700">
              NEXT EXIT ➔
            </text>
          </g>

          {/* Stage 1 Landmark Art (Cotton Bloom, Yarn Cones on Pallet) */}
          <g
            transform="translate(100, 68)"
            className="roadmap-station-landmark"
            onClick={() => setSelectedStageIndex(0)}
            onMouseEnter={() => setHoveredStageIdx(0)}
            onMouseLeave={() => setHoveredStageIdx(null)}
          >
            <circle cx="40" cy="38" r="36" fill="#ffffff" stroke={stages[0]?.status === 'completed' ? '#10b981' : '#e2e8f0'} strokeWidth="2" filter="url(#roadShadow)" />
            <g transform="translate(14, 12) scale(0.34)">
              <YarnInwardIllustration />
            </g>
            {/* Milestone Stamp */}
            <rect x="12" y="58" width="56" height="15" rx="7" fill={stages[0]?.status === 'completed' ? '#dcfce7' : '#f1f5f9'} stroke={stages[0]?.status === 'completed' ? '#86efac' : '#cbd5e1'} strokeWidth="1" />
            <text x="40" y="69" textAnchor="middle" fill={stages[0]?.status === 'completed' ? '#15803d' : '#64748b'} fontSize="7" fontWeight="800">
              {stages[0]?.status === 'completed' ? '✓ COMPLETED' : 'STEP 01'}
            </text>
          </g>

          {/* Wooden Dual Arrow Signpost between Stage 1 & 2 (Exact replica of 'SPEND / SAVE') */}
          <g transform="translate(265, 46)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(1)}>
            <rect x="22" y="10" width="4.5" height="46" fill="#78350f" rx="1" />
            {/* Upper Arrow pointing right: WARP CREEL */}
            <path d="M 4,10 L 36,10 L 44,17 L 36,24 L 4,24 Z" fill="#fef3c7" stroke="#92400e" strokeWidth="1.2" />
            <text x="20" y="19" textAnchor="middle" fill="#78350f" fontSize="6.5" fontWeight="900">
              WARP CREEL ➔
            </text>
            {/* Lower Arrow pointing left: YARN LOTS */}
            <path d="M 44,26 L 12,26 L 4,33 L 12,40 L 44,40 Z" fill="#fef3c7" stroke="#92400e" strokeWidth="1.2" />
            <text x="26" y="35" textAnchor="middle" fill="#78350f" fontSize="6.5" fontWeight="900">
              ⬅ YARN LOTS
            </text>
          </g>

          {/* ===================================================================
              4. STAGE 2: WARPING & SIZING (Top-Center)
              =================================================================== */}
          {/* Highway Milestone Signboard */}
          <g transform="translate(372, 18)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(1)}>
            <rect x="14" y="24" width="4" height="28" fill="#854d0e" rx="1" />
            <rect x="122" y="24" width="4" height="28" fill="#854d0e" rx="1" />
            <rect x="0" y="0" width="138" height="28" rx="4" fill="#047857" stroke="#ffffff" strokeWidth="1.4" />
            <text x="69" y="12" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">
              WARPING &amp; SIZING
            </text>
            <text x="69" y="22" textAnchor="middle" fill="#fef08a" fontSize="6.5" fontWeight="700">
              12 HIGH-SPEED BEAMS • 850 RPM
            </text>
          </g>

          {/* Circular Green 'P' Milestone Sign (like 'P' / 'GIC'S' in reference) */}
          <g transform="translate(528, 42)">
            <rect x="10" y="16" width="3" height="30" fill="#78350f" rx="1" />
            <circle cx="11.5" cy="14" r="11" fill="#15803d" stroke="#ffffff" strokeWidth="1.4" />
            <text x="11.5" y="18" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="900">
              P
            </text>
          </g>

          {/* Stage 2 Landmark Art (Creel & Warp Beam Roller) */}
          <g
            transform="translate(412, 60)"
            className="roadmap-station-landmark"
            onClick={() => setSelectedStageIndex(1)}
            onMouseEnter={() => setHoveredStageIdx(1)}
            onMouseLeave={() => setHoveredStageIdx(null)}
          >
            <circle cx="40" cy="38" r="36" fill="#ffffff" stroke={stages[1]?.status === 'completed' ? '#10b981' : '#e2e8f0'} strokeWidth="2" filter="url(#roadShadow)" />
            <g transform="translate(14, 12) scale(0.34)">
              <WarpingSizingIllustration />
            </g>
            <rect x="12" y="58" width="56" height="15" rx="7" fill={stages[1]?.status === 'completed' ? '#dcfce7' : '#f1f5f9'} stroke={stages[1]?.status === 'completed' ? '#86efac' : '#cbd5e1'} strokeWidth="1" />
            <text x="40" y="69" textAnchor="middle" fill={stages[1]?.status === 'completed' ? '#15803d' : '#64748b'} fontSize="7" fontWeight="800">
              {stages[1]?.status === 'completed' ? '✓ COMPLETED' : 'STEP 02'}
            </text>
          </g>

          {/* ===================================================================
              5. STAGE 3: LOOM WEAVING SHED (Top-Right)
              =================================================================== */}
          {/* Overhead Highway Gantry Billboard (Exact match to 'INVESTOPIA ↓↓↓') */}
          <g transform="translate(712, 22)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(2)}>
            <rect x="14" y="32" width="4.5" height="36" fill="#475569" rx="1" />
            <rect x="146" y="32" width="4.5" height="36" fill="#475569" rx="1" />
            {/* Golden Sun Emblem */}
            <circle cx="82" cy="4" r="14" fill="#fbbf24" stroke="#d97706" strokeWidth="1.4" />
            <rect x="0" y="8" width="164" height="34" rx="5" fill="#047857" stroke="#ffffff" strokeWidth="1.6" />
            <text x="82" y="22" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900" letterSpacing="0.4">
              AIRJET SHED A
            </text>
            <text x="82" y="34" textAnchor="middle" fill="#fef08a" fontSize="7.5" fontWeight="700">
              CONTINUOUS WEAVE • 2,000m ↓↓↓
            </text>
          </g>

          {/* Stage 3 Landmark Art (Airjet Loom Machine & Cloth Roll) */}
          <g
            transform="translate(755, 78)"
            className="roadmap-station-landmark"
            onClick={() => setSelectedStageIndex(2)}
            onMouseEnter={() => setHoveredStageIdx(2)}
            onMouseLeave={() => setHoveredStageIdx(null)}
          >
            <circle cx="40" cy="38" r="36" fill="#ffffff" stroke={stages[2]?.status === 'completed' ? '#10b981' : '#e2e8f0'} strokeWidth="2" filter="url(#roadShadow)" />
            <g transform="translate(14, 12) scale(0.34)">
              <LoomWeavingIllustration />
            </g>
            <rect x="12" y="58" width="56" height="15" rx="7" fill={stages[2]?.status === 'completed' ? '#dcfce7' : '#f1f5f9'} stroke={stages[2]?.status === 'completed' ? '#86efac' : '#cbd5e1'} strokeWidth="1" />
            <text x="40" y="69" textAnchor="middle" fill={stages[2]?.status === 'completed' ? '#15803d' : '#64748b'} fontSize="7" fontWeight="800">
              {stages[2]?.status === 'completed' ? '✓ COMPLETED' : 'STEP 03'}
            </text>
          </g>

          {/* ===================================================================
              6. HAIRPIN TURN HAZARD SIGN (Exact match to 'WARNING: Entering Debt-Ville')
              =================================================================== */}
          <g transform="translate(864, 202)">
            <rect x="22" y="28" width="4" height="30" fill="#475569" rx="1" />
            {/* Red Warning Triangle */}
            <polygon points="24,2 46,30 2,30" fill="#fef2f2" stroke="#dc2626" strokeWidth="2.4" strokeLinejoin="round" />
            <text x="24" y="24" textAnchor="middle" fill="#dc2626" fontSize="13" fontWeight="900">!</text>
            {/* Text Box */}
            <rect x="0" y="32" width="48" height="18" rx="3" fill="#ffffff" stroke="#dc2626" strokeWidth="1.2" />
            <text x="24" y="40" textAnchor="middle" fill="#991b1b" fontSize="5.5" fontWeight="900">WARNING</text>
            <text x="24" y="47" textAnchor="middle" fill="#991b1b" fontSize="5" fontWeight="700">STENTER 180°C</text>
          </g>

          {/* ===================================================================
              7. STAGE 4: DYEING & FINISHING (Mid-Right/Center)
              =================================================================== */}
          {/* Milestone Signpost */}
          <g transform="translate(585, 238)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(3)}>
            <rect x="18" y="22" width="3.5" height="28" fill="#78350f" rx="1" />
            <rect x="122" y="22" width="3.5" height="28" fill="#78350f" rx="1" />
            <rect x="0" y="0" width="142" height="28" rx="4" fill="#0e7490" stroke="#ffffff" strokeWidth="1.4" />
            <text x="71" y="12" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">
              DYEHOUSE &amp; FINISHING
            </text>
            <text x="71" y="22" textAnchor="middle" fill="#a5f3fc" fontSize="6.5" fontWeight="700">
              REACTIVE SHADE 4B • BIO-WASH
            </text>
          </g>

          {/* Stage 4 Landmark Art (Dyeing Vat & Heated Finishing Stenter) */}
          <g
            transform="translate(625, 275)"
            className="roadmap-station-landmark"
            onClick={() => setSelectedStageIndex(3)}
            onMouseEnter={() => setHoveredStageIdx(3)}
            onMouseLeave={() => setHoveredStageIdx(null)}
          >
            <circle cx="40" cy="38" r="36" fill="#ffffff" stroke={stages[3]?.status === 'completed' ? '#10b981' : '#e2e8f0'} strokeWidth="2" filter="url(#roadShadow)" />
            <g transform="translate(14, 12) scale(0.34)">
              <DyeingFinishingIllustration />
            </g>
            <rect x="12" y="58" width="56" height="15" rx="7" fill={stages[3]?.status === 'completed' ? '#dcfce7' : '#f1f5f9'} stroke={stages[3]?.status === 'completed' ? '#86efac' : '#cbd5e1'} strokeWidth="1" />
            <text x="40" y="69" textAnchor="middle" fill={stages[3]?.status === 'completed' ? '#15803d' : '#64748b'} fontSize="7" fontWeight="800">
              {stages[3]?.status === 'completed' ? '✓ COMPLETED' : 'STEP 04'}
            </text>
          </g>

          {/* ===================================================================
              8. STAGE 5: QUALITY INSPECTION - THE ACTIVE STAGE
                 FEATURING THE ICONIC "YOU ARE HERE" SIGNBOARD & ANIMATED PIN
                 (Exact signature element from reference roadmap image!)
              =================================================================== */}
          {/* THE FAMOUS "YOU ARE HERE" SIGNBOARD */}
          <g transform="translate(110, 222)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(4)}>
            {/* Wooden posts in ground */}
            <rect x="22" y="44" width="5" height="56" fill="#78350f" rx="1.5" />
            <rect x="146" y="44" width="5" height="56" fill="#78350f" rx="1.5" />

            {/* Wooden framed signboard */}
            <rect x="6" y="8" width="162" height="66" rx="6" fill="#fef3c7" stroke="#92400e" strokeWidth="2.5" />
            <rect x="10" y="12" width="154" height="58" rx="4" fill="#fffbeb" stroke="#d97706" strokeWidth="1" />

            {/* Bold Red YOU ARE HERE Header Banner */}
            <rect x="20" y="16" width="134" height="18" rx="4" fill="#dc2626" />
            <text x="87" y="29" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900" letterSpacing="0.8">
              📍 YOU ARE HERE
            </text>

            {/* Mini Illustrated Roadmap sketch inside the sign! */}
            <path d="M 22,46 Q 40,38 60,44 Q 85,52 110,42 Q 130,38 152,46" stroke="#ca8a04" strokeWidth="1.3" strokeDasharray="3 2" fill="none" />
            <path d="M 28,54 Q 50,48 78,54 Q 108,60 148,50" stroke="#ca8a04" strokeWidth="1" strokeDasharray="2 2" fill="none" />

            {/* Pulsing Active Radar Center in Sign */}
            <circle cx="87" cy="48" r="10" fill="#22c55e" opacity="0.25" className="roadmap-radar-wave" />
            <circle cx="87" cy="48" r="6" fill="#16a34a" />
            <circle cx="87" cy="48" r="2.5" fill="#ffffff" />

            <text x="87" y="63" textAnchor="middle" fill="#166534" fontSize="7" fontWeight="800">
              ASTM 4-POINT INSPECTION • 98.5% YIELD
            </text>

            {/* Bouncing Map Pin on top of signboard */}
            <g transform="translate(87, -2)" className="roadmap-pin-animated" filter="url(#activePinGlow)">
              <path d="M 0,0 C -6.5,0 -11,4.5 -11,11 C -11,18 0,28 0,28 C 0,28 11,18 11,11 C 11,4.5 6.5,0 0,0 Z" fill="#dc2626" stroke="#ffffff" strokeWidth="1.6" />
              <circle cx="0" cy="10" r="3.8" fill="#ffffff" />
            </g>
          </g>

          {/* Active Radar Ripple Wave on the road itself */}
          <circle cx="218" cy="320" r="16" fill="#10b981" opacity="0.3" className="roadmap-radar-wave" />
          <circle cx="218" cy="320" r="7" fill="#10b981" />
          <circle cx="218" cy="320" r="3" fill="#ffffff" />

          {/* Stage 5 Landmark Art (ASTM 4-Point Lightbox Table & Magnifying Glass) */}
          <g
            transform="translate(195, 275)"
            className="roadmap-station-landmark"
            onClick={() => setSelectedStageIndex(4)}
            onMouseEnter={() => setHoveredStageIdx(4)}
            onMouseLeave={() => setHoveredStageIdx(null)}
            filter="url(#landmarkGlow)"
          >
            <circle cx="40" cy="38" r="38" fill="#f0fdf4" stroke="#10b981" strokeWidth="3" filter="url(#roadShadow)" />
            <g transform="translate(14, 12) scale(0.34)">
              <QualityInspectionIllustration />
            </g>
            {/* Active Stage Pulsing Pill */}
            <rect x="8" y="58" width="64" height="16" rx="8" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
            <text x="40" y="69.5" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="900" letterSpacing="0.4">
              ● ACTIVE STAGE
            </text>
          </g>

          {/* ===================================================================
              9. STAGE 6: DISPATCH & LOGISTICS (Bottom-Right - FINAL DESTINATION)
              =================================================================== */}
          {/* Final Destination Arch Billboard */}
          <g transform="translate(712, 368)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(5)}>
            <rect x="18" y="24" width="4" height="36" fill="#475569" rx="1" />
            <rect x="148" y="24" width="4" height="36" fill="#475569" rx="1" />
            {/* Checkered Flag Header Trim */}
            <rect x="0" y="0" width="170" height="32" rx="5" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
            <text x="85" y="13" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="900" letterSpacing="0.5">
              🏁 FINAL DESTINATION
            </text>
            <text x="85" y="24" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="700">
              DISPATCH &amp; LOGISTICS HUB
            </text>
          </g>

          {/* Highway Exit Sign for Shipping Bay */}
          <g transform="translate(860, 412)" className="roadmap-sign-interactive" onClick={() => setSelectedStageIndex(5)}>
            <rect x="0" y="0" width="75" height="24" rx="4" fill="#047857" stroke="#ffffff" strokeWidth="1.2" />
            <text x="37.5" y="11" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="800">SHIPPING BAY</text>
            <text x="37.5" y="19" textAnchor="middle" fill="#86efac" fontSize="6" fontWeight="700">READY FOR DISPATCH</text>
          </g>

          {/* Stage 6 Landmark Art (Delivery Van & Cartons on Pallets) */}
          <g
            transform="translate(755, 395)"
            className="roadmap-station-landmark"
            onClick={() => setSelectedStageIndex(5)}
            onMouseEnter={() => setHoveredStageIdx(5)}
            onMouseLeave={() => setHoveredStageIdx(null)}
          >
            <circle cx="40" cy="38" r="36" fill="#ffffff" stroke={stages[5]?.status === 'completed' ? '#10b981' : '#e2e8f0'} strokeWidth="2" filter="url(#roadShadow)" />
            <g transform="translate(14, 12) scale(0.34)">
              <DispatchIllustration />
            </g>
            <rect x="12" y="58" width="56" height="15" rx="7" fill={stages[5]?.status === 'completed' ? '#dcfce7' : '#f1f5f9'} stroke={stages[5]?.status === 'completed' ? '#86efac' : '#cbd5e1'} strokeWidth="1" />
            <text x="40" y="69" textAnchor="middle" fill={stages[5]?.status === 'completed' ? '#15803d' : '#64748b'} fontSize="7" fontWeight="800">
              {stages[5]?.status === 'completed' ? '✓ COMPLETED' : 'STEP 06'}
            </text>
          </g>
        </svg>

        {/* Interactive Floating Stage Tooltip on Hover */}
        {hoveredStageIdx !== null && (
          <div
            className="roadmap-floating-popover"
            style={{
              top: hoveredStageIdx <= 2 ? 40 : 250,
              left: hoveredStageIdx === 0 ? 80 : hoveredStageIdx === 1 ? 360 : hoveredStageIdx === 2 ? 640 : hoveredStageIdx === 3 ? 550 : hoveredStageIdx === 4 ? 120 : 680
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 12, color: stageAccentColors[hoveredStageIdx] || '#0f172a' }}>
                Step 0{hoveredStageIdx + 1}: {stages[hoveredStageIdx]?.name}
              </strong>
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '1.5px 6px',
                borderRadius: 6,
                background: stages[hoveredStageIdx]?.status === 'completed' ? '#dcfce7' : stages[hoveredStageIdx]?.status === 'in_progress' ? '#10b981' : '#f1f5f9',
                color: stages[hoveredStageIdx]?.status === 'in_progress' ? '#ffffff' : stages[hoveredStageIdx]?.status === 'completed' ? '#15803d' : '#64748b'
              }}>
                {stages[hoveredStageIdx]?.status === 'completed' ? '✓ Completed' : stages[hoveredStageIdx]?.status === 'in_progress' ? '● Live' : '○ Queued'}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.35 }}>
              {stageSubTasks[hoveredStageIdx]?.[0]} &bull; {stageSubTasks[hoveredStageIdx]?.[1]}
            </div>
          </div>
        )}
      </div>

      {/* =======================================================================
          STATION INSPECTION BOTTOM BAR & FULLSCREEN TRIGGER
          ======================================================================= */}
      <div style={{
        padding: '6px 12px',
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '0 8px 4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: inspectedStage?.status === 'completed' ? '#ecfdf3' : inspectedStage?.status === 'in_progress' ? '#10b981' : '#f1f5f9',
            color: inspectedStage?.status === 'in_progress' ? '#ffffff' : inspectedStage?.status === 'completed' ? '#027a48' : '#64748b',
            padding: '2px 8px',
            borderRadius: 9999,
            fontSize: 10,
            fontWeight: 800
          }}>
            {inspectedStage?.status === 'completed' ? <Check size={11} strokeWidth={3} /> : inspectedStage?.status === 'in_progress' ? <MapPin size={11} /> : <Clock size={11} />}
            <span>MILESTONE {selectedOrActiveIdx + 1} OF 6: {inspectedStage?.name}</span>
          </div>

          <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>
            {stageSubTasks[selectedOrActiveIdx]?.[0] || 'Verification ok'} &bull; {stageSubTasks[selectedOrActiveIdx]?.[1] || 'Output verified'}
          </span>
          <span style={{ fontSize: 10.5, color: '#64748b' }}>
            &bull; {inspectedStage?.dateOrDetails || 'Schedule on track'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedOrActiveIdx === activeStageIdx && onAdvanceStage && canAdvance && (
            <button
              onClick={onAdvanceStage}
              style={{
                background: '#79B4B7', color: '#18191B',
                border: 'none',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(121, 180, 183, 0.35)'
              }}
            >
              <Check size={12} strokeWidth={2.8} />
              <span>Advance Stage</span>
            </button>
          )}

          <button
            onClick={() => setIsFullscreenModal(true)}
            title="Expand Roadmap to Widescreen Modal"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              color: '#64748b',
              fontSize: 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            <Maximize2 size={11} />
            <span>Widescreen Map</span>
          </button>
        </div>
      </div>

      {/* =======================================================================
          FULLSCREEN POPUP MODAL (WIDESCREEN ROADMAP VIEW)
          ======================================================================= */}
      {isFullscreenModal && (
        <div className="serpentine-fullscreen-backdrop">
          <div className="serpentine-fullscreen-dialog" style={{ maxWidth: 1080 }}>
            <div className="serpentine-modal-header">
              <div>
                <span className="serpentine-section-pill">
                  ORDER PRODUCTION ROADMAP &bull; #{orderId} {designCode ? `• ${designCode}` : ''}
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: 20, color: '#0f172a', fontWeight: 900 }}>
                  {productName} &bull; Illustrated 6-Stage Manufacturing Journey
                </h2>
              </div>
              <button
                className="serpentine-modal-close-btn"
                onClick={() => setIsFullscreenModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* High-Res Widescreen Roadmap Canvas */}
            <div style={{ padding: '16px 20px', minHeight: 480 }}>
              <div className="textile-roadmap-canvas" style={{ minHeight: 480 }}>
                {/* Embedded Roadmap SVG identical to main view */}
                <svg
                  className="textile-roadmap-svg"
                  viewBox="0 0 960 510"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ maxHeight: 520 }}
                >
                  <defs>
                    <filter id="roadShadowModal" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.08" />
                    </filter>
                  </defs>

                  {/* Road Base Layers */}
                  <path d={roadDPath} stroke="rgba(15, 23, 42, 0.05)" strokeWidth="62" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <path d={roadDPath} stroke="#e4dac9" strokeWidth="54" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <path d={roadDPath} stroke="#f2ebe0" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <path d={roadDPath} stroke="#10b981" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.18" strokeDasharray={totalRoadLength} strokeDashoffset={completedStrokeDashoffset} />
                  <path d={roadDPath} stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.75" strokeDasharray={totalRoadLength} strokeDashoffset={completedStrokeDashoffset} />
                  <path d={roadDPath} stroke="#ffffff" strokeWidth="2.4" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95" />

                  {/* Directional Chevron Arrows */}
                  <g transform="translate(240, 100)"><polygon points="-3,-4 4,0 -3,4" fill="#10b981" opacity="0.8" /></g>
                  <g transform="translate(620, 108)"><polygon points="-3,-4 4,0 -3,4" fill="#10b981" opacity="0.8" /></g>
                  <g transform="translate(905, 225)"><polygon points="-4,-3 0,4 4,-3" fill="#10b981" opacity="0.85" /></g>
                  <g transform="translate(680, 313)"><polygon points="3,-4 -4,0 3,4" fill="#10b981" opacity="0.8" /></g>
                  <g transform="translate(380, 323)"><polygon points="3,-4 -4,0 3,4" fill="#10b981" opacity="0.8" /></g>

                  {/* Stage 1: Welcome Sign & Landmark */}
                  <g transform="translate(48, 14)">
                    <rect x="22" y="16" width="5" height="42" fill="#854d0e" rx="1" />
                    <rect x="138" y="16" width="5" height="42" fill="#854d0e" rx="1" />
                    <path d="M 14,24 Q 82,6 148,24 L 148,42 Q 82,24 14,42 Z" fill="#222C2E" stroke="#79B4B7" strokeWidth="1.8" />
                    <circle cx="82" cy="14" r="8" fill="#79B4B7" stroke="#4A8184" strokeWidth="1.2" />
                    <text x="82" y="17" textAnchor="middle" fill="#1B1918" fontSize="7.5" fontWeight="900">★</text>
                    <text x="82" y="27" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">WELCOME TO LOOMPILOT</text>
                    <text x="82" y="38" textAnchor="middle" fill="#FAF4EA" fontSize="7" fontWeight="700">MILL INWARD GATE • 40S LOT</text>
                  </g>
                  <g transform="translate(100, 68)">
                    <circle cx="40" cy="38" r="36" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="url(#roadShadowModal)" />
                    <g transform="translate(14, 12) scale(0.34)"><YarnInwardIllustration /></g>
                    <rect x="12" y="58" width="56" height="15" rx="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
                    <text x="40" y="69" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="800">✓ COMPLETED</text>
                  </g>

                  {/* Arrow Signpost */}
                  <g transform="translate(265, 46)">
                    <rect x="22" y="10" width="4.5" height="46" fill="#78350f" rx="1" />
                    <path d="M 4,10 L 36,10 L 44,17 L 36,24 L 4,24 Z" fill="#fef3c7" stroke="#92400e" strokeWidth="1.2" />
                    <text x="20" y="19" textAnchor="middle" fill="#78350f" fontSize="6.5" fontWeight="900">WARP CREEL ➔</text>
                    <path d="M 44,26 L 12,26 L 4,33 L 12,40 L 44,40 Z" fill="#fef3c7" stroke="#92400e" strokeWidth="1.2" />
                    <text x="26" y="35" textAnchor="middle" fill="#78350f" fontSize="6.5" fontWeight="900">⬅ YARN LOTS</text>
                  </g>

                  {/* Stage 2: Warping & Sizing */}
                  <g transform="translate(372, 18)">
                    <rect x="14" y="24" width="4" height="28" fill="#854d0e" rx="1" />
                    <rect x="122" y="24" width="4" height="28" fill="#854d0e" rx="1" />
                    <rect x="0" y="0" width="138" height="28" rx="4" fill="#047857" stroke="#ffffff" strokeWidth="1.4" />
                    <text x="69" y="12" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">WARPING &amp; SIZING</text>
                    <text x="69" y="22" textAnchor="middle" fill="#fef08a" fontSize="6.5" fontWeight="700">12 HIGH-SPEED BEAMS</text>
                  </g>
                  <g transform="translate(412, 60)">
                    <circle cx="40" cy="38" r="36" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="url(#roadShadowModal)" />
                    <g transform="translate(14, 12) scale(0.34)"><WarpingSizingIllustration /></g>
                    <rect x="12" y="58" width="56" height="15" rx="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
                    <text x="40" y="69" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="800">✓ COMPLETED</text>
                  </g>

                  {/* Stage 3: Loom Weaving */}
                  <g transform="translate(712, 22)">
                    <rect x="14" y="32" width="4.5" height="36" fill="#475569" rx="1" />
                    <rect x="146" y="32" width="4.5" height="36" fill="#475569" rx="1" />
                    <circle cx="82" cy="4" r="14" fill="#fbbf24" stroke="#d97706" strokeWidth="1.4" />
                    <rect x="0" y="8" width="164" height="34" rx="5" fill="#047857" stroke="#ffffff" strokeWidth="1.6" />
                    <text x="82" y="22" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">AIRJET SHED A</text>
                    <text x="82" y="34" textAnchor="middle" fill="#fef08a" fontSize="7.5" fontWeight="700">CONTINUOUS WEAVE • 2,000m ↓↓↓</text>
                  </g>
                  <g transform="translate(755, 78)">
                    <circle cx="40" cy="38" r="36" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="url(#roadShadowModal)" />
                    <g transform="translate(14, 12) scale(0.34)"><LoomWeavingIllustration /></g>
                    <rect x="12" y="58" width="56" height="15" rx="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
                    <text x="40" y="69" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="800">✓ COMPLETED</text>
                  </g>

                  {/* Hazard Warning Sign */}
                  <g transform="translate(864, 202)">
                    <rect x="22" y="28" width="4" height="30" fill="#475569" rx="1" />
                    <polygon points="24,2 46,30 2,30" fill="#fef2f2" stroke="#dc2626" strokeWidth="2.4" strokeLinejoin="round" />
                    <text x="24" y="24" textAnchor="middle" fill="#dc2626" fontSize="13" fontWeight="900">!</text>
                  </g>

                  {/* Stage 4: Dyeing & Finishing */}
                  <g transform="translate(585, 238)">
                    <rect x="18" y="22" width="3.5" height="28" fill="#78350f" rx="1" />
                    <rect x="122" y="22" width="3.5" height="28" fill="#78350f" rx="1" />
                    <rect x="0" y="0" width="142" height="28" rx="4" fill="#0e7490" stroke="#ffffff" strokeWidth="1.4" />
                    <text x="71" y="12" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">DYEHOUSE &amp; FINISHING</text>
                    <text x="71" y="22" textAnchor="middle" fill="#a5f3fc" fontSize="6.5" fontWeight="700">REACTIVE SHADE 4B • BIO-WASH</text>
                  </g>
                  <g transform="translate(625, 275)">
                    <circle cx="40" cy="38" r="36" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="url(#roadShadowModal)" />
                    <g transform="translate(14, 12) scale(0.34)"><DyeingFinishingIllustration /></g>
                    <rect x="12" y="58" width="56" height="15" rx="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
                    <text x="40" y="69" textAnchor="middle" fill="#15803d" fontSize="7" fontWeight="800">✓ COMPLETED</text>
                  </g>

                  {/* Stage 5: YOU ARE HERE */}
                  <g transform="translate(110, 222)">
                    <rect x="22" y="44" width="5" height="56" fill="#78350f" rx="1.5" />
                    <rect x="146" y="44" width="5" height="56" fill="#78350f" rx="1.5" />
                    <rect x="6" y="8" width="162" height="66" rx="6" fill="#fef3c7" stroke="#92400e" strokeWidth="2.5" />
                    <rect x="10" y="12" width="154" height="58" rx="4" fill="#fffbeb" stroke="#d97706" strokeWidth="1" />
                    <rect x="20" y="16" width="134" height="18" rx="4" fill="#dc2626" />
                    <text x="87" y="29" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900" letterSpacing="0.8">📍 YOU ARE HERE</text>
                    <text x="87" y="63" textAnchor="middle" fill="#166534" fontSize="7" fontWeight="800">ASTM 4-POINT INSPECTION • 98.5% YIELD</text>
                    <g transform="translate(87, -2)" className="roadmap-pin-animated">
                      <path d="M 0,0 C -6.5,0 -11,4.5 -11,11 C -11,18 0,28 0,28 C 0,28 11,18 11,11 C 11,4.5 6.5,0 0,0 Z" fill="#dc2626" stroke="#ffffff" strokeWidth="1.6" />
                      <circle cx="0" cy="10" r="3.8" fill="#ffffff" />
                    </g>
                  </g>
                  <circle cx="218" cy="320" r="16" fill="#10b981" opacity="0.3" className="roadmap-radar-wave" />
                  <g transform="translate(195, 275)">
                    <circle cx="40" cy="38" r="38" fill="#f0fdf4" stroke="#10b981" strokeWidth="3" filter="url(#roadShadowModal)" />
                    <g transform="translate(14, 12) scale(0.34)"><QualityInspectionIllustration /></g>
                    <rect x="8" y="58" width="64" height="16" rx="8" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                    <text x="40" y="69.5" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="900">● ACTIVE STAGE</text>
                  </g>

                  {/* Stage 6: Dispatch & Final Destination */}
                  <g transform="translate(712, 368)">
                    <rect x="18" y="24" width="4" height="34" fill="#475569" rx="1" />
                    <rect x="148" y="24" width="4" height="34" fill="#475569" rx="1" />
                    <rect x="0" y="0" width="170" height="32" rx="5" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
                    <text x="85" y="13" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="900">🏁 FINAL DESTINATION</text>
                    <text x="85" y="24" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="700">DISPATCH &amp; LOGISTICS HUB</text>
                  </g>
                  <g transform="translate(755, 395)">
                    <circle cx="40" cy="38" r="36" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" filter="url(#roadShadowModal)" />
                    <g transform="translate(14, 12) scale(0.34)"><DispatchIllustration /></g>
                    <rect x="12" y="58" width="56" height="15" rx="7" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                    <text x="40" y="69" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="800">STEP 06</text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Stage <strong>{activeStageIdx + 1} of 6: {currentStage.name}</strong> is currently live on Shed A lightbox.
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                {onAdvanceStage && canAdvance && (
                  <button
                    className="serpentine-advance-btn"
                    onClick={() => {
                      onAdvanceStage();
                      setIsFullscreenModal(false);
                    }}
                  >
                    <Check size={14} strokeWidth={2.8} />
                    <span>Advance {currentStage.name} to Next Stage</span>
                  </button>
                )}
                <button
                  onClick={() => setIsFullscreenModal(false)}
                  style={{
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 18px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

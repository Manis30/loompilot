import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Award,
  Filter,
  SlidersHorizontal,
  MoreHorizontal,
  MoreVertical,
  ArrowUp,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  FileText,
  Truck,
  Activity,
  Boxes,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import type { Order, OrderItemProduct } from '../../types';
import { GarmentVisual3D } from '../common/GarmentVisual3D';
import { SerpentineStagesPipeline } from '../common/SerpentineStagesPipeline';

interface OrderPipelineModuleProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  onOpenOrderModal: (order: Order) => void;
  onDeclineOrder?: (id: string) => void;
}

export const OrderPipelineModule: React.FC<OrderPipelineModuleProps> = ({
  orders: propOrders,
  selectedOrderId: _selectedOrderId,
  onSelectOrder,
  onOpenOrderModal
}) => {
  const [orders, setOrders] = useState<Order[]>(propOrders);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(['LP-901', 'LP-903']);
  const [orderTab, setOrderTab] = useState<'all' | 'active' | 'to_invoice' | 'to_ship'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_track' | 'at_risk' | 'early_production' | 'just_started'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [activeDetailOrderId, setActiveDetailOrderId] = useState<string | null>(_selectedOrderId || null);
  const [selectedProductItemId, setSelectedProductItemId] = useState<string | null>(null);
  const [useRealPhoto, setUseRealPhoto] = useState<boolean>(false);
  const [activeFloatingModal, setActiveFloatingModal] = useState<'specs' | 'bom' | 'history' | 'quality' | null>(null);
  const [isFullscreenCard, setIsFullscreenCard] = useState<boolean>(false);
  const [isMorphing, setIsMorphing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveDetailOrderId(_selectedOrderId || null);
  }, [_selectedOrderId]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Quantity-Weighted Order Progress Calculation
  const calculateWeightedProgress = (items?: OrderItemProduct[], fallbackProgress: number = 0): number => {
    if (!items || items.length === 0) return fallbackProgress;
    const totalQty = items.reduce((acc, item) => acc + item.quantityPieces, 0);
    if (totalQty === 0) return fallbackProgress;
    const weightedSum = items.reduce((acc, item) => acc + (item.quantityPieces * item.progressPercent), 0);
    return Math.round(weightedSum / totalQty);
  };

  // Determine Card Size & Color Category
  const getCardPresentation = (order: Order) => {
    const progress = calculateWeightedProgress(
      order.items,
      Math.round((order.producedMeters / (order.quantityMeters || 1)) * 100)
    );

    const isAtRisk = order.riskStatus === 'at_risk' || order.status === 'awaiting_admin_decision';
    const isCompleted = progress >= 95 || order.status === 'completed';
    const isAlmostCompleted = progress >= 70 && !isAtRisk;
    const isEarlyOrWarning = (progress >= 20 && progress < 45 && !isAtRisk) || order.riskStatus === 'early_production';
    const isSmallJustStarted = progress < 20 && !isAtRisk;

    // Sizing: Large = span 2, Medium = span 1, Small = span 1 (compact)
    let sizeCategory: 'large' | 'medium' | 'small' = 'medium';
    if (isAlmostCompleted || isCompleted) {
      sizeCategory = 'large';
    } else if (isSmallJustStarted) {
      sizeCategory = 'small';
    }

    // Color Theme: full red for At-Risk, yellow for early/warning, green for completed, mint/white for standard
    let themeType: 'red' | 'yellow' | 'dark_green' | 'mint_large' | 'white_standard' = 'white_standard';
    if (isAtRisk) {
      themeType = 'red';
    } else if (isCompleted) {
      themeType = 'dark_green';
    } else if (isAlmostCompleted) {
      themeType = 'mint_large';
    } else if (isEarlyOrWarning) {
      themeType = 'yellow';
    }

    return {
      progress,
      isAtRisk,
      sizeCategory,
      themeType
    };
  };

  // Handle stage advancement
  const handleAdvanceStage = (orderId: string, itemId: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((ord) => {
        if (ord.id !== orderId || !ord.items) return ord;

        const updatedItems = ord.items.map((item) => {
          if (item.id !== itemId) return item;

          const currentInProgIdx = item.timeline.findIndex((s) => s.status === 'in_progress');
          if (currentInProgIdx === -1) {
            const firstPendingIdx = item.timeline.findIndex((s) => s.status === 'pending');
            if (firstPendingIdx !== -1) {
              const newTimeline = [...item.timeline];
              newTimeline[firstPendingIdx] = {
                ...newTimeline[firstPendingIdx],
                status: 'in_progress',
                dateOrDetails: 'In progress · Current stage'
              };
              const newProgress = Math.min(100, item.progressPercent + 15);
              return { ...item, progressPercent: newProgress, timeline: newTimeline };
            }
            return item;
          }

          const newTimeline = [...item.timeline];
          newTimeline[currentInProgIdx] = {
            ...newTimeline[currentInProgIdx],
            status: 'completed',
            dateOrDetails: `Completed · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
          };

          if (currentInProgIdx + 1 < newTimeline.length) {
            newTimeline[currentInProgIdx + 1] = {
              ...newTimeline[currentInProgIdx + 1],
              status: 'in_progress',
              dateOrDetails: 'Current stage · Underway'
            };
          }

          const completedCount = newTimeline.filter((s) => s.status === 'completed').length;
          const inProgressCount = newTimeline.filter((s) => s.status === 'in_progress').length;
          const calculatedItemProgress = Math.round(((completedCount + inProgressCount * 0.5) / newTimeline.length) * 100);

          return {
            ...item,
            progressPercent: calculatedItemProgress,
            timeline: newTimeline
          };
        });

        const newWeighted = calculateWeightedProgress(updatedItems);
        const newProduced = Math.round((ord.quantityMeters * newWeighted) / 100);

        return {
          ...ord,
          items: updatedItems,
          producedMeters: newProduced
        };
      })
    );

    showNotification(`Stage advanced & overall progress recalculated automatically.`);
  };

  const activeCount = useMemo(() => orders.filter((o) => o.status === 'in_production' || o.riskStatus === 'on_track').length, [orders]);
  const toInvoiceCount = useMemo(() => orders.filter((o) => (o.producedMeters || 0) >= o.quantityMeters * 0.75 || o.status === 'completed').length, [orders]);
  const toShipCount = useMemo(() => orders.filter((o) => (o.producedMeters || 0) >= o.quantityMeters * 0.9).length, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.clientName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClient = selectedClientFilter === 'all' || o.clientName === selectedClientFilter;

      if (viewMode === 'table') {
        if (orderTab === 'active' && !(o.status === 'in_production' || o.riskStatus === 'on_track')) return false;
        if (orderTab === 'to_invoice' && !((o.producedMeters || 0) >= o.quantityMeters * 0.75 || o.status === 'completed')) return false;
        if (orderTab === 'to_ship' && !((o.producedMeters || 0) >= o.quantityMeters * 0.9)) return false;
      } else {
        if (statusFilter === 'on_track' && !(o.riskStatus === 'on_track' || (!o.riskStatus && o.status === 'in_production'))) return false;
        if (statusFilter === 'at_risk' && !(o.riskStatus === 'at_risk' || o.status === 'awaiting_admin_decision')) return false;
        if (statusFilter === 'early_production' && o.riskStatus !== 'early_production') return false;
        if (statusFilter === 'just_started' && !(o.riskStatus === 'just_started' || o.status === 'submitted')) return false;
      }

      return matchesSearch && matchesClient;
    });
  }, [orders, searchQuery, selectedClientFilter, viewMode, orderTab, statusFilter]);

  const activeOrder = orders.find((o) => o.id === activeDetailOrderId);

  // =========================================================================
  // VIEW MODE 2: ANIMATED ORDER SHOWCASE & STOREHOUSE (Inspired by order.mp4)
  // =========================================================================
  if (activeOrder) {
    const weightedOrderProgress = calculateWeightedProgress(
      activeOrder.items,
      Math.round((activeOrder.producedMeters / (activeOrder.quantityMeters || 1)) * 100)
    );
    const isAtRisk = activeOrder.riskStatus === 'at_risk' || activeOrder.status === 'awaiting_admin_decision';
    const activeItemIndex = activeOrder.items?.findIndex((i) => i.id === (selectedProductItemId || activeOrder.items?.[0]?.id)) ?? 0;
    const currentItem = activeOrder.items?.[activeItemIndex >= 0 ? activeItemIndex : 0] || activeOrder.items?.[0];

    // Dynamic Visual Themes matching Vintage Crest Shield (Heritage Crimson, Antique Brass Gold, Charcoal Obsidian)
    const getProductTheme = (item?: OrderItemProduct, idx: number = 0) => {
      if (!item) {
        return {
          gradient: 'linear-gradient(135deg, #79B4B7 0%, #589598 50%, #2A3638 100%)', accentColor: '#79B4B7', glowColor: 'rgba(121, 180, 183, 0.45)',
          blobTransform: 'translate3d(0px, 0px, 0) scale(1) rotate(0deg)',
          blobBorderRadius: '45px 70% 54% 46% / 46% 52% 48% 68%',
          blobTop: '-25px',
          blobLeft: '-30px',
          blobWidth: '94%',
          blobHeight: '92%',
          sphere1Pos: { top: '38px', left: '42px', scale: 1 },
          sphere2Pos: { top: '65px', right: '16%', scale: 1.15 },
          sphere3Pos: { bottom: '40px', left: '22%', scale: 0.8 },
          title1: 'Formal',
          title2: 'Shirt',
          subTitle: 'Textile Design Collection',
          chips: [
            { label: '40s Combed Cotton', icon: '🧶' },
            { label: '185 GSM Oxford', icon: '📐' },
            { label: 'Bio-Washed Finish', icon: '✨' },
            { label: 'Airjet Shed A', icon: '🏭' }
          ]
        };
      }

      if (item.designCode === 'FS-A-01' || idx === 0) {
        return {
          gradient: 'linear-gradient(135deg, #79B4B7 0%, #589598 50%, #2A3638 100%)', accentColor: '#79B4B7', glowColor: 'rgba(121, 180, 183, 0.45)',
          blobTransform: 'translate3d(0px, 0px, 0) scale(1) rotate(0deg)',
          blobBorderRadius: '45px 70% 54% 46% / 46% 52% 48% 68%',
          blobTop: '-25px',
          blobLeft: '-30px',
          blobWidth: '94%',
          blobHeight: '92%',
          sphere1Pos: { top: '38px', left: '42px', scale: 1 },
          sphere2Pos: { top: '65px', right: '16%', scale: 1.15 },
          sphere3Pos: { bottom: '40px', left: '22%', scale: 0.8 },
          title1: 'Formal',
          title2: 'Shirt',
          subTitle: `${item.name} • ${item.quantityPieces.toLocaleString()} pieces • Shed A`,
          chips: [
            { label: '40s Combed Cotton', icon: '🧶' },
            { label: '185 GSM Oxford Twill', icon: '📐' },
            { label: 'Bio-Washed Silk Finish', icon: '✨' },
            { label: 'Airjet Shed A • 2,000 pcs', icon: '🏭' }
          ]
        };
      } else if (item.designCode === 'FP-B-02' || idx === 1) {
        return {
          gradient: 'linear-gradient(135deg, #9D9D9D 0%, #767878 50%, #2A3638 100%)', accentColor: '#79B4B7', glowColor: 'rgba(157, 157, 157, 0.35)',
          blobTransform: 'translate3d(48px, -22px, 0) scale(1.07) rotate(6deg)',
          blobBorderRadius: '68px 46% 80% 48% / 54% 80% 38% 66%',
          blobTop: '-10px',
          blobLeft: '15px',
          blobWidth: '96%',
          blobHeight: '94%',
          sphere1Pos: { top: '85px', left: '55px', scale: 1.25 },
          sphere2Pos: { top: '22px', right: '10%', scale: 0.85 },
          sphere3Pos: { bottom: '55px', left: '36%', scale: 1.1 },
          title1: 'Formal',
          title2: 'Pants',
          subTitle: `${item.name} • ${item.quantityPieces.toLocaleString()} pieces • Shed B`,
          chips: [
            { label: '30s Ring Spun Cotton', icon: '🧶' },
            { label: '240 GSM Heavy Twill', icon: '📐' },
            { label: 'Wrinkle-Free Finish', icon: '✨' },
            { label: 'Rapier Shed B • 1,500 pcs', icon: '🏭' }
          ]
        };
      } else {
        return {
          gradient: 'linear-gradient(135deg, #79B4B7 0%, #A2CED0 50%, #F8F0DF 100%)', accentColor: '#79B4B7', glowColor: 'rgba(121, 180, 183, 0.45)',
          blobTransform: 'translate3d(-32px, 32px, 0) scale(1.1) rotate(-8deg)',
          blobBorderRadius: '50% 68% 44% 76% / 72% 44% 66% 46%',
          blobTop: '-45px',
          blobLeft: '-45px',
          blobWidth: '96%',
          blobHeight: '96%',
          sphere1Pos: { top: '24px', left: '28%', scale: 0.9 },
          sphere2Pos: { top: '95px', right: '20%', scale: 1.3 },
          sphere3Pos: { bottom: '28px', left: '16%', scale: 0.95 },
          title1: 'Casual',
          title2: 'Shirt',
          subTitle: `${item.name} • ${item.quantityPieces.toLocaleString()} pieces • Shed C`,
          chips: [
            { label: '50s Poplin Compact', icon: '🧶' },
            { label: '160 GSM Chambray Weave', icon: '📐' },
            { label: 'Soft Enzyme Wash', icon: '✨' },
            { label: 'Continuous Stenter • 1,500 pcs', icon: '🏭' }
          ]
        };
      }
    };

    const currentTheme = getProductTheme(currentItem, activeItemIndex);

    // Cycle to next/prev product when garment or arrow is clicked
    const handleNextProduct = (direction: 'next' | 'prev' = 'next') => {
      if (!activeOrder.items || activeOrder.items.length === 0) return;
      setIsMorphing(true);
      const len = activeOrder.items.length;
      const nextIdx = direction === 'next'
        ? (activeItemIndex + 1) % len
        : (activeItemIndex - 1 + len) % len;
      setSelectedProductItemId(activeOrder.items[nextIdx].id);
      showNotification(`Switched visual focus to ${activeOrder.items[nextIdx].name}`);
      setTimeout(() => {
        setIsMorphing(false);
      }, 750);
    };

    return (
      <div className="order-detail-canvas">
        {/* ================= LARGE WHITE FLOATING WORKSPACE CARD ================= */}
        <div
          className="order-configurator-card"
          style={isFullscreenCard ? {
            position: 'fixed',
            inset: 16,
            zIndex: 1000,
            minHeight: 'calc(100vh - 32px)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.3)'
          } : {}}
        >
          {/* Top-Right Yellow Avatar Emblem (exact match to order.mp4) */}
          <div
            className="configurator-avatar-emblem"
            title="LoomPilot Intelligent Production Engine"
            onClick={() => showNotification("LoomPilot Autonomous Production Supervisor is actively synchronizing Shed telemetry.")}
          >
            <svg className="configurator-avatar-smile" viewBox="0 0 24 24">
              <circle cx="8" cy="9" r="1.8" />
              <circle cx="16" cy="9" r="1.8" />
              <path d="M7 14.5 Q12 18.5 17 14.5" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          {/* ================= LEFT SIDE: VISUAL PRODUCT SHOWCASE (~50%) ================= */}
          <div className="showcase-left-area">
            {/* Dynamic Colorful Organic Blob Background (Moves and morphs when clicked) */}
            <div
              className={`organic-blob-background ${isMorphing ? 'is-morphing' : ''}`}
              style={{
                background: currentTheme.gradient,
                transform: currentTheme.blobTransform,
                borderRadius: currentTheme.blobBorderRadius,
                top: currentTheme.blobTop,
                left: currentTheme.blobLeft,
                width: currentTheme.blobWidth,
                height: currentTheme.blobHeight,
                boxShadow: `inset 0 0 50px rgba(0, 0, 0, 0.05), 0 25px 70px ${currentTheme.glowColor}`
              }}
            />

            {/* Organic Floating Ambient Spheres (Position shifts dynamically) */}
            <div
              className="organic-floating-sphere-1"
              style={{
                top: currentTheme.sphere1Pos.top,
                left: currentTheme.sphere1Pos.left,
                transform: `scale(${currentTheme.sphere1Pos.scale})`
              }}
            />
            <div
              className="organic-floating-sphere-2"
              style={{
                top: currentTheme.sphere2Pos.top,
                right: currentTheme.sphere2Pos.right,
                transform: `scale(${currentTheme.sphere2Pos.scale})`
              }}
            />
            <div
              className="organic-floating-sphere-3"
              style={{
                bottom: currentTheme.sphere3Pos.bottom,
                left: currentTheme.sphere3Pos.left,
                transform: `scale(${currentTheme.sphere3Pos.scale})`
              }}
            />

            {/* Top Row: Back Button Pill & Design Code Badge */}
            <div className="showcase-header-row">
              <button
                className="showcase-back-pill"
                onClick={() => {
                  setActiveDetailOrderId(null);
                  onSelectOrder('');
                }}
                title="Return to Orders Overview Table"
              >
                <ArrowLeft size={13} />
                <span>Back to Orders</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="quick-action-pill-btn"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(8px)',
                    color: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.6)',
                    padding: '4px 10px',
                    fontSize: 10.5,
                    fontWeight: 700
                  }}
                  onClick={() => setUseRealPhoto((prev) => !prev)}
                  title={useRealPhoto ? "Switch to 3D Render" : "Switch to Photo Visual"}
                >
                  <Sparkles size={11} color="#6366f1" />
                  <span>{useRealPhoto ? '3D Render' : 'Photo'}</span>
                </button>
                <button
                  className="quick-action-pill-btn"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(8px)',
                    color: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.6)',
                    padding: '4px 8px',
                    fontSize: 10.5
                  }}
                  onClick={() => setIsFullscreenCard((prev) => !prev)}
                  title={isFullscreenCard ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreenCard ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
                <div className="showcase-code-pill">
                  {currentItem?.designCode || activeOrder.id}
                </div>
              </div>
            </div>

            {/* Huge Bold Stacked Title with Entrance Animation */}
            <div className="showcase-title-block" key={`title-${currentItem?.id}`}>
              <h1 className="showcase-giant-title">
                <span>{currentTheme.title1}</span>
                <span>{currentTheme.title2}</span>
              </h1>
              <div className="showcase-subtitle">
                {currentTheme.subTitle}
              </div>
            </div>

            {/* 3D Floating Garment Visual with Realistic Radial Floor Shadow & Click-To-Change */}
            <div className="showcase-3d-stage">
              {/* Circular Navigation Arrows for Direct Intuitive Clicking */}
              <button
                type="button"
                className="stage-nav-arrow-btn prev"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextProduct('prev');
                }}
                title="Previous garment design"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                className="stage-nav-arrow-btn next"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextProduct('next');
                }}
                title="Next garment design"
              >
                <ChevronRight size={18} />
              </button>

              {/* Garment Animation Wrapper: Triggers 3D Pop/Slide-In on Product Change */}
              <div
                key={currentItem?.id}
                className="showcase-garment-anim-wrapper"
                onClick={() => handleNextProduct('next')}
                title="Click image to animate circle and show next design"
              >
                <div className="showcase-floating-garment">
                  <GarmentVisual3D
                    designCode={currentItem?.designCode}
                    size="hero"
                    photoUrl={currentItem?.imageUrl}
                    usePhoto={useRealPhoto}
                  />
                </div>
              </div>

              <div
                key={`shadow-${currentItem?.id}`}
                className="showcase-radial-floor-shadow"
              />

              {/* Click-To-Switch Interactive Hint Pill with Circular Next Action */}
              <div
                className="cloth-click-hint"
                onClick={() => handleNextProduct('next')}
                title="Click image or button to animate circle and show next image"
              >
                <Sparkles size={12} color="#fbbf24" />
                <span>Click image to switch ({activeItemIndex + 1} of {activeOrder.items?.length || 1})</span>
                <div className="cloth-hint-next-circle">
                  <ArrowRight size={11} strokeWidth={2.8} />
                </div>
              </div>

              {/* Direct Cloth Selector Pills */}
              <div className="cloth-selector-dock">
                {activeOrder.items?.map((item) => {
                  const isSelected = currentItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`cloth-selector-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setIsMorphing(true);
                        setSelectedProductItemId(item.id);
                        showNotification(`Switched to ${item.name}`);
                        setTimeout(() => setIsMorphing(false), 750);
                      }}
                      title={`Select ${item.name}`}
                    >
                      <span>{item.name.split('—')[0].trim()}</span>
                      <span>•</span>
                      <span>{item.designCode}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floating Frosted Glass Specification Pills */}
            <div className="showcase-spec-pills-wrap" key={`specs-${currentItem?.id}`}>
              {currentTheme.chips.map((chip, i) => (
                <div key={i} className="showcase-spec-pill" style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="showcase-spec-pill-icon">{chip.icon}</span>
                  <span>{chip.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ================= RIGHT SIDE: ONLY REQUIRED BASIC DETAILS & STAGES (NON-SCROLLABLE) ================= */}
          <div className="order-detail-right-panel-clean">
            {/* 1. Compact Basic Details & Which Stage It Is In */}
            {(() => {
              const inProgStage = currentItem?.timeline.find((s) => s.status === 'in_progress') || currentItem?.timeline[4] || currentItem?.timeline[0];
              const inProgIdx = currentItem?.timeline.findIndex((s) => s.id === inProgStage?.id) ?? 4;
              const isCompletedAll = currentItem?.timeline.every((s) => s.status === 'completed');

              return (
                <div className="clean-order-summary-header">
                  <div className="clean-header-top-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="clean-so-badge">#{activeOrder.id}</span>
                      <strong className="clean-client-name">{activeOrder.clientName}</strong>
                      <span className="clean-dot">&bull;</span>
                      <span className="clean-cloth-name">{currentItem?.name}</span>
                      <span className="clean-qty-pill">{(currentItem?.quantityPieces || 2000).toLocaleString()} pcs</span>
                      {isAtRisk && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 7px', borderRadius: 10, border: '1px solid #fecaca' }}>
                          At Risk
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        Deadline: <strong style={{ color: '#0f172a' }}>{activeOrder.deadlineDate || '05 Nov 2026'}</strong>
                      </span>
                      <span className="clean-progress-badge" title={`Item progress: ${currentItem?.progressPercent}%, Overall Order progress: ${weightedOrderProgress}%`}>
                        {currentItem?.progressPercent}% Progress
                      </span>
                    </div>
                  </div>

                  {/* Which Stage It Is In Banner + Direct Advance Action */}
                  <div className="clean-current-stage-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div className="clean-stage-indicator-pill">
                        <span className="pulsing-live-stage-dot" />
                        <span>CURRENT STAGE {inProgIdx + 1} OF 6</span>
                      </div>
                      <strong className="clean-stage-title">
                        {isCompletedAll ? 'All Manufacturing Stages Completed' : inProgStage?.name || 'Quality Inspection'}
                      </strong>
                      <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>
                        &bull; {inProgStage?.dateOrDetails || 'Underway · 98.5% First-Pass Yield'}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        &bull; Supervisor: <strong>Ramesh Kumar (Shed A)</strong>
                      </span>
                    </div>

                    <button
                      className="clean-stage-advance-btn"
                      onClick={() => {
                        if (!currentItem) return;
                        handleAdvanceStage(activeOrder.id, currentItem.id);
                        showNotification(`Advanced stage on ${currentItem.name}!`);
                      }}
                      title={`Advance ${inProgStage?.name} to Next Stage`}
                    >
                      <Check size={13} strokeWidth={2.8} />
                      <span>Advance Stage</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 2. Stages Display: Serpentine Timeline with Visual Stages (Fits without scrolling!) */}
            {currentItem?.timeline && (
              <SerpentineStagesPipeline
                stages={currentItem.timeline}
                orderId={activeOrder.id}
                productName={currentItem.name}
                designCode={currentItem.designCode}
                onAdvanceStage={() => {
                  handleAdvanceStage(activeOrder.id, currentItem.id);
                  showNotification(`Advanced stage on ${currentItem.name}!`);
                }}
                canAdvance={true}
              />
            )}
          </div>

          {/* Floating Contextual Inspector Dialogs (BOM, History, Quality) */}
          {activeFloatingModal && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(6px)',
              zIndex: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              animation: 'popoverFadeIn 0.2s ease'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: 24,
                width: '100%',
                maxWidth: 520,
                padding: 24,
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0f172a'
                    }}>
                      {activeFloatingModal === 'bom' ? <Layers size={18} /> : activeFloatingModal === 'history' ? <Clock size={18} /> : <Award size={18} />}
                    </div>
                    <div>
                      <strong style={{ fontSize: 16, color: '#0f172a' }}>
                        {activeFloatingModal === 'bom' ? 'Bill of Materials (BOM) Sheet' : activeFloatingModal === 'history' ? 'Production Shift Logs & Telemetry' : '4-Point Fabric Quality Scorecard'}
                      </strong>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                        {currentItem?.name} &bull; {currentItem?.designCode}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveFloatingModal(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {activeFloatingModal === 'bom' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '6px 10px', background: '#f8fafc', borderRadius: 8, fontWeight: 700, color: '#64748b', fontSize: 10.5 }}>
                      <span>MATERIAL</span>
                      <span style={{ textAlign: 'center' }}>QTY</span>
                      <span style={{ textAlign: 'right' }}>RATE</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 600 }}>40s Combed Cotton Warp</span>
                      <span style={{ textAlign: 'center' }}>680 kg</span>
                      <span style={{ textAlign: 'right', fontWeight: 700 }}>₹ 245 / kg</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 600 }}>40s Compact Weft Yarn</span>
                      <span style={{ textAlign: 'center' }}>540 kg</span>
                      <span style={{ textAlign: 'right', fontWeight: 700 }}>₹ 238 / kg</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 600 }}>Reactive Dye Indigo Shade 4B</span>
                      <span style={{ textAlign: 'center' }}>24 kg</span>
                      <span style={{ textAlign: 'right', fontWeight: 700 }}>₹ 850 / kg</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 10px' }}>
                      <span style={{ fontWeight: 600 }}>PVA Sizing Chemical Compound</span>
                      <span style={{ textAlign: 'center' }}>120 kg</span>
                      <span style={{ textAlign: 'right', fontWeight: 700 }}>₹ 110 / kg</span>
                    </div>
                  </div>
                )}

                {activeFloatingModal === 'history' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11.5 }}>
                    <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0f172a' }}>
                        <span>Loom Weaving Run Complete</span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>27 Oct &bull; 17:30</span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: 11 }}>Airjet Loom #12 produced 2,000 meters at 850 RPM with zero warp stop alarms.</span>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0f172a' }}>
                        <span>Dyeing Batch Quality Approved</span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>29 Oct &bull; 11:15</span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: 11 }}>Spectrophotometer delta-E measured 0.42 (Tolerance: &lt; 0.8). Shade approved by Ramesh Kumar.</span>
                    </div>
                  </div>
                )}

                {activeFloatingModal === 'quality' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700 }}>
                      <span>4-Point ASTM D5430 Yield</span>
                      <span style={{ fontSize: 14 }}>98.5% First-Pass Approved</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                      <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Tensile Warp / Weft</span>
                        <strong style={{ fontSize: 12, color: '#0f172a' }}>420 N / 385 N (Passed)</strong>
                      </div>
                      <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Colorfastness to Washing</span>
                        <strong style={{ fontSize: 12, color: '#0f172a' }}>Grade 4.5 / 5 (ISO 105-C06)</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setActiveFloatingModal(null)}
                    style={{
                      background: '#79B4B7',
                      color: '#18191B',
                      border: '1px solid #67A4A7',
                      borderRadius: 10,
                      padding: '8px 18px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Celebratory Animated Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#0f172a',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: 14,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            zIndex: 100,
            border: '1px solid #334155'
          }}>
            <Sparkles size={16} color="#fbbf24" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE 1: ORDERS OVERVIEW (With Modern Reference Table Design & Visual Card Toggle)
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', padding: '12px 18px', boxSizing: 'border-box', background: '#ffffff'
    }}>
      {/* 1. TOP HEADER & VIEW TOGGLES */}
      <div className="module-header-flat">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', margin: 0 }}>
            Sales Orders
          </h1>
          
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Jump to 3D Order Configurator */}
          <button
            type="button"
            onClick={() => {
              setActiveDetailOrderId('LP-901');
              onSelectOrder('LP-901');
              setSelectedProductItemId('LP-901-A');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 9999,
              border: '1.5px solid #79B4B7',
              background: '#ffffff',
              color: '#18191B',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(195, 43, 55, 0.15)',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={13} color="#79B4B7" />
            <span>3D Configurator (LP-901)</span>
          </button>

          {/* View Switcher: Table vs Cards */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#ffffff',
            border: '1px solid #E8DEC8',
            borderRadius: 9999,
            padding: 3,
            gap: 2
          }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 9999,
                border: 'none',
                background: viewMode === 'table' ? '#79B4B7' : 'transparent',
                color: viewMode === 'table' ? '#18191B' : '#64748b',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <TableIcon size={12} color={viewMode === 'table' ? '#18191B' : '#64748b'} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 9999,
                border: 'none',
                background: viewMode === 'cards' ? '#79B4B7' : 'transparent',
                color: viewMode === 'cards' ? '#18191B' : '#64748b',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={12} color={viewMode === 'cards' ? '#18191B' : '#64748b'} />
              <span>Cards</span>
            </button>
          </div>

          <button
            onClick={() => showNotification('Client intake modal opened.')}
            className="modern-action-pill-btn"
          >
            <Plus size={14} />
            <span>New sales order</span>
          </button>
        </div>
      </div>

      {/* 1.5. UNTITLED UI KPI METRIC CARDS (Matching Reference Design System) */}
      <div className="untitled-kpi-grid">
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Total Orders</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{orders.length}</span>
            <span className="untitled-kpi-badge success"><ArrowUp size={11} strokeWidth={2.5} /> 20%</span>
          </div>
        </div>

        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">In Production</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{activeCount}</span>
            <span className="untitled-kpi-badge success"><ArrowUp size={11} strokeWidth={2.5} /> 15%</span>
          </div>
        </div>

        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Active Customers</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{new Set(orders.map(o => o.clientName)).size}</span>
            <div className="untitled-kpi-avatar-stack">
              <span className="untitled-kpi-avatar" style={{ background: '#dbeafe', color: '#1d4ed8' }}>FH</span>
              <span className="untitled-kpi-avatar" style={{ background: '#fce7f3', color: '#be185d' }}>UT</span>
              <span className="untitled-kpi-avatar" style={{ background: '#dcfce7', color: '#15803d' }}>SW</span>
              <span className="untitled-kpi-avatar" style={{ background: '#fef3c7', color: '#b45309' }}>+2</span>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        /* =========================================================================
           PRIMARY TABLE DESIGN (Exact Specification from Reference Image)
           - Folder / Segmented Pill Tabs Navigation
           - Search filter input with filter icon, settings sliders, and CTA
           - Checkbox column with bold vertical left accent bar on selection
           - Capsule status pill with circular colored bullet dot
           - Three-dot (•••) action menu column
           ========================================================================= */
        <div className="modern-table-card">
          {/* Top Folder Tabs with Count Badges */}
          <div className="modern-table-tabs-bar">
            <button
              type="button"
              className={`modern-table-tab ${orderTab === 'all' ? 'active' : ''}`}
              onClick={() => setOrderTab('all')}
            >
              <Boxes size={14} />
              <span>All orders</span>
              <span className="modern-table-tab-badge">{orders.length}</span>
            </button>
            <button
              type="button"
              className={`modern-table-tab ${orderTab === 'active' ? 'active' : ''}`}
              onClick={() => setOrderTab('active')}
            >
              <Activity size={14} />
              <span>Active</span>
              <span className="modern-table-tab-badge">{activeCount}</span>
            </button>
            <button
              type="button"
              className={`modern-table-tab ${orderTab === 'to_invoice' ? 'active' : ''}`}
              onClick={() => setOrderTab('to_invoice')}
            >
              <FileText size={14} />
              <span>To invoice</span>
              <span className="modern-table-tab-badge">{toInvoiceCount}</span>
            </button>
            <button
              type="button"
              className={`modern-table-tab ${orderTab === 'to_ship' ? 'active' : ''}`}
              onClick={() => setOrderTab('to_ship')}
            >
              <Truck size={14} />
              <span>To ship</span>
              <span className="modern-table-tab-badge">{toShipCount}</span>
            </button>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="modern-table-toolbar">
            <div className="modern-table-filter-group">
              <div className="modern-search-pill">
                <Filter size={13} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Filter sales orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="modern-filter-btn"
                title="Filter options"
                onClick={() => setOrderTab(prev => prev === 'all' ? 'active' : 'all')}
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <button
              type="button"
              className="modern-action-pill-btn"
              onClick={() => showNotification('Client intake modal opened.')}
            >
              <Plus size={14} />
              <span>New sales order</span>
            </button>
          </div>

          {/* Modern Data Table */}
          <div className="modern-data-table-wrapper">
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th className="col-checkbox">
                    <input
                      type="checkbox"
                      className="modern-checkbox"
                      checked={
                        filteredOrders.length > 0 &&
                        filteredOrders.every((o) => selectedOrderIds.includes(o.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = Array.from(new Set([...selectedOrderIds, ...filteredOrders.map((o) => o.id)]));
                          setSelectedOrderIds(allIds);
                        } else {
                          const curDispIds = new Set(filteredOrders.map((o) => o.id));
                          setSelectedOrderIds(selectedOrderIds.filter((id) => !curDispIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      Order # <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th>Company name</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th>Last updated</th>
                  <th style={{ width: 44, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>
                      No orders found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    const amountVal = order.quotation?.totalPrice ?? Math.round(order.quantityMeters * 385);
                    const formattedAmount = `₹${(amountVal >= 100000 ? (amountVal / 100000).toFixed(2) + 'L' : amountVal.toLocaleString())}`;

                    // Derive status matching reference image badge types
                    let statusLabel = 'CONFIRMED';
                    let statusClass = 'confirmed';
                    if (order.status === 'completed' || (order.producedMeters || 0) >= order.quantityMeters * 0.95) {
                      statusLabel = 'FULFILLED';
                      statusClass = 'fulfilled';
                    } else if (order.riskStatus === 'at_risk' || order.status === 'awaiting_admin_decision') {
                      statusLabel = 'AT RISK';
                      statusClass = 'failed';
                    } else if ((order.producedMeters || 0) > order.quantityMeters * 0.4) {
                      statusLabel = 'PARTIALLY SHIPPED';
                      statusClass = 'partially-shipped';
                    } else if (order.status === 'in_production') {
                      statusLabel = 'CONFIRMED';
                      statusClass = 'confirmed';
                    }

                    const lastUpdatedText = idx === 0 ? 'Today' : idx === 1 ? 'Yesterday' : order.deadlineDate || '15 Nov 2026';

                    return (
                      <tr
                        key={order.id}
                        className={isSelected ? 'is-selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setActiveDetailOrderId(order.id);
                          onSelectOrder(order.id);
                          if (order.items && order.items.length > 0) {
                            setSelectedProductItemId(order.items[0].id);
                          }
                        }}
                      >
                        <td
                          className="col-checkbox"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="modern-checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                setSelectedOrderIds(selectedOrderIds.filter((id) => id !== order.id));
                              } else {
                                setSelectedOrderIds([...selectedOrderIds, order.id]);
                              }
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: '#18191B', letterSpacing: '-0.01em' }}>
                          #{order.id}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#111827' }}>
                              {order.clientName}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>
                              {order.productName || order.category} &bull; {order.quantityMeters.toLocaleString()}m
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-dot-pill ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                          {formattedAmount}
                        </td>
                        <td style={{ color: '#64748b', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                          {order.submittedDate || '24 Oct 2026'}
                        </td>
                        <td style={{ color: '#64748b', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                          {lastUpdatedText}
                        </td>
                        <td
                          style={{ textAlign: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="modern-table-row-action"
                            title="More options"
                            onClick={() => onOpenOrderModal(order)}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =========================================================================
           VIEW MODE 2: VISUAL PRODUCTION CARDS GRID (Available via Toggle)
           ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 2. STATUS FILTER PILLS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All Orders', count: orders.length },
              { key: 'on_track', label: 'On Track', count: orders.filter((o) => o.riskStatus === 'on_track' || (!o.riskStatus && o.status === 'in_production')).length },
              { key: 'at_risk', label: 'At Risk', count: orders.filter((o) => o.riskStatus === 'at_risk' || o.status === 'awaiting_admin_decision').length },
              { key: 'early_production', label: 'Early Production', count: orders.filter((o) => o.riskStatus === 'early_production').length },
              { key: 'just_started', label: 'Just Started', count: orders.filter((o) => o.riskStatus === 'just_started' || o.status === 'submitted').length }
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 9999,
                    border: isActive ? '1px solid #F6C8CC' : '1px solid #E8DEC8',
                    background: isActive ? '#FDF2F3' : '#ffffff',
                    color: isActive ? '#18191B' : '#475569',
                    fontSize: 11,
                    fontWeight: isActive ? 800 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    background: isActive ? 'rgba(195, 43, 55, 0.12)' : '#f1f5f9',
                    color: isActive ? '#18191B' : '#64748b',
                    padding: '1px 7px',
                    borderRadius: 9999,
                    fontSize: 9.5,
                    fontWeight: 700
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. SEARCH & CLIENT CONTROLS ROW */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#ffffff',
              border: '1px solid #edf2ee',
              borderRadius: 9999,
              padding: '6px 14px',
              flex: 1,
              maxWidth: 420
            }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by order ID, client or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: 11.5, background: 'transparent', width: '100%', color: '#111827' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                className="admin-form-select"
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
                style={{ fontSize: 11 }}
              >
                <option value="all">All Clients</option>
                <option value="Fashion House">Fashion House</option>
                <option value="Urban Textiles">Urban Textiles</option>
                <option value="Style World">Style World</option>
                <option value="Home Living">Home Living</option>
                <option value="ABC Garments">ABC Garments</option>
                <option value="StyleMart">StyleMart</option>
              </select>

              {/* Color Legend Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, background: '#f8faf9', padding: '4px 10px', borderRadius: 9999, border: '1px solid #edf2ee' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
                  Full Red (At Risk)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#facc15' }} />
                  Full Yellow (Early)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#79B4B7' }} />
                  Large (Span 2)
                </span>
              </div>
            </div>
          </div>

          {/* 4. RESPONSIVE GRID OF VISUAL PRODUCTION CARDS (With Distinct Sizes & Bold Full Colors) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
            alignItems: 'stretch'
          }}>
            {filteredOrders.map((order) => {
              const { progress, isAtRisk, sizeCategory, themeType } = getCardPresentation(order);
              const isLarge = sizeCategory === 'large';
              const isSmall = sizeCategory === 'small';

              // Visual styles based on themeType:
              let cardBg = '#ffffff';
              let cardBorder = '1px solid #E8DEC8';
              let textColor = '#111827';
              let subtitleColor = '#475569';
              let progressBg = '#FAF4EA';
              let progressFill = '#79B4B7';
              let pillBg = '#FAF4EA';
              let pillText = '#18191B';
              let pillBorder = '1px solid #E8DEC8';
              let chevronBg = '#FAF4EA';
              let chevronColor = '#111827';
              let cardShadow = '0 1px 6px rgba(0,0,0,0.02)';

              // FULL RED for At-Risk Cards (as requested by user!)
              if (themeType === 'red') {
                cardBg = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                cardBorder = '1.5px solid #b91c1c';
                textColor = '#ffffff';
                subtitleColor = '#fecaca';
                progressBg = 'rgba(255, 255, 255, 0.25)';
                progressFill = '#ffffff';
                pillBg = '#ffffff';
                pillText = '#dc2626';
                pillBorder = 'none';
                chevronBg = '#ffffff';
                chevronColor = '#dc2626';
                cardShadow = '0 4px 16px rgba(220, 38, 38, 0.22)';
              }
              // FULL YELLOW for Early Production / Warning (as requested by user!)
              else if (themeType === 'yellow') {
                cardBg = 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)';
                cardBorder = '1.5px solid #eab308';
                textColor = '#78350f';
                subtitleColor = '#854d0e';
                progressBg = 'rgba(133, 77, 14, 0.18)';
                progressFill = '#78350f';
                pillBg = '#78350f';
                pillText = '#ffffff';
                pillBorder = 'none';
                chevronBg = '#78350f';
                chevronColor = '#ffffff';
                cardShadow = '0 4px 14px rgba(234, 179, 8, 0.18)';
              }
              // FULL OBSIDIAN / CHARCOAL with GOLD TRIM for 100% Completed
              else if (themeType === 'dark_green') {
                cardBg = 'linear-gradient(135deg, #242120 0%, #151312 100%)';
                cardBorder = '1.5px solid #79B4B7';
                textColor = '#ffffff';
                subtitleColor = '#5A5A5A';
                progressBg = 'rgba(215, 171, 106, 0.25)';
                progressFill = '#79B4B7';
                pillBg = '#79B4B7';
                pillText = '#1B1918';
                pillBorder = 'none';
                chevronBg = '#79B4B7';
                chevronColor = '#1B1918';
                cardShadow = '0 4px 16px rgba(27, 25, 24, 0.35)';
              }
              // WARM LINEN & CRIMSON for Active Production (Spans 2 columns!)
              else if (themeType === 'mint_large') {
                cardBg = 'linear-gradient(135deg, #FFFFFF 0%, #F8F0DF 100%)';
                cardBorder = '2px solid #79B4B7';
                textColor = '#111827';
                subtitleColor = '#18191B';
                progressBg = 'rgba(195, 43, 55, 0.12)';
                progressFill = '#79B4B7';
                pillBg = '#79B4B7';
                pillText = '#ffffff';
                pillBorder = 'none';
                chevronBg = '#79B4B7';
                chevronColor = '#ffffff';
                cardShadow = '0 4px 18px rgba(195, 43, 55, 0.15)';
              }

              return (
                <div
                  key={order.id}
                  onClick={() => {
                    setActiveDetailOrderId(order.id);
                    onSelectOrder(order.id);
                    if (order.items && order.items.length > 0) {
                      setSelectedProductItemId(order.items[0].id);
                    }
                  }}
                  style={{
                    gridColumn: isLarge ? 'span 2' : 'span 1',
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: 22,
                    padding: isLarge ? '20px 24px' : isSmall ? '12px 16px' : '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: isLarge ? 220 : isSmall ? 135 : 180,
                    cursor: 'pointer',
                    boxShadow: cardShadow,
                    transition: 'transform 0.16s ease, box-shadow 0.16s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Top Header: ID + Status Badge + Chevron */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: isLarge ? 18 : 15,
                          fontWeight: 800,
                          color: textColor,
                          letterSpacing: '-0.3px'
                        }}>
                          {order.id}
                        </span>

                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          background: pillBg,
                          color: pillText,
                          border: pillBorder,
                          padding: '2px 9px',
                          borderRadius: 9999,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                        }}>
                          {isAtRisk ? 'At Risk' : progress >= 95 ? 'Completed' : isLarge ? 'Almost Completed' : order.riskStatus === 'early_production' ? 'Early Prod' : 'On Track'}
                        </span>
                      </div>

                      <div style={{
                        fontSize: isLarge ? 13 : 11.5,
                        fontWeight: 700,
                        color: textColor,
                        marginTop: 3
                      }}>
                        {order.clientName}
                      </div>
                    </div>

                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: chevronBg,
                      color: chevronColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                    }}>
                      <ChevronRight size={15} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Product and Pieces commitment */}
                  <div style={{ fontSize: isLarge ? 12 : 10.5, color: subtitleColor, margin: isSmall ? '2px 0' : '4px 0' }}>
                    <span style={{ fontWeight: 700, color: textColor }}>{order.productName}</span> &bull; {order.quantityMeters.toLocaleString()} pcs
                  </div>

                  {/* For Large Cards: Multi-item mini chips preview */}
                  {isLarge && order.items && order.items.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      margin: '6px 0',
                      flexWrap: 'wrap'
                    }}>
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            background: 'rgba(255, 255, 255, 0.7)',
                            border: '1px solid rgba(22, 78, 50, 0.2)',
                            borderRadius: 8,
                            padding: '3px 8px',
                            fontSize: 9.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#18191B' }}>{item.name}:</span>
                          <strong style={{ color: '#111827' }}>{item.progressPercent}%</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Progress Section: Clear percentage & visual bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{
                        fontSize: isLarge ? 34 : isSmall ? 22 : 26,
                        fontWeight: 800,
                        color: textColor,
                        lineHeight: 1,
                        letterSpacing: '-0.5px'
                      }}>
                        {progress}%
                      </span>

                      <span style={{
                        fontSize: isLarge ? 11 : 9.5,
                        color: subtitleColor,
                        fontWeight: 700
                      }}>
                        {order.riskReason || (isLarge ? `Almost completed · Due ${order.deadlineDate}` : `Due ${order.deadlineDate}`)}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: isLarge ? 8 : 6, background: progressBg, borderRadius: 9999, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: progressFill,
                          borderRadius: 9999,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer: Multi-item count & click prompt */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: isSmall ? 4 : 6,
                    fontSize: 9.5,
                    color: subtitleColor
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isLarge ? <Award size={12} color={textColor} /> : <Layers size={11} color={subtitleColor} />}
                      <span>{order.items?.length || 1} product designs &bull; {isLarge ? 'Large Card' : isSmall ? 'Small Card' : 'Medium Card'}</span>
                    </span>

                    <span style={{ fontWeight: 800, color: textColor, display: 'flex', alignItems: 'center', gap: 2 }}>
                      Inspect Details &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
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
          zIndex: 100
        }}>
          <Sparkles size={15} color="#86efac" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default OrderPipelineModule;
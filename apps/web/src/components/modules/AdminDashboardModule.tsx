import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Search,
  Bell,
  MessageSquare,
  MoreVertical,
  MoreHorizontal,
  SlidersHorizontal,
  Filter,
  ChevronDown,
  Plus,
  ArrowUpRight,
  DollarSign,
  History,
  Wifi,
  CreditCard,
  PiggyBank,
  ShieldAlert,
  Layers,
  Home,
  CheckCircle2,
  X,
  ArrowUpDown,
  ExternalLink,
  Activity,
  Boxes
} from 'lucide-react';
import type { Order, AppUser, MarketCommodity, AdminNavTab, AuditEntry } from '../../types';
import './AdminDashboardModule.css';

export interface AdminDashboardModuleProps {
  orders: Order[];
  users: AppUser[];
  commodities: MarketCommodity[];
  auditLogs?: AuditEntry[];
  onNavigateTab: (tab: AdminNavTab) => void;
  onSelectOrder?: (orderId: string) => void;
  onOpenOrderModal?: (order: Order) => void;
  onApproveQuotation?: (orderId: string) => void;
  onRejectQuotation?: (orderId: string, reason: string) => void;
}

interface TransactionItem {
  id: string;
  name: string;
  category: string;
  dateTime: string;
  amount: string;
  note: string;
  status: 'Completed' | 'Pending' | 'Failed';
  orderRef?: Order;
}

interface ActivityItem {
  id: string;
  user: string;
  avatar?: string;
  initials?: string;
  action: string;
  time: string;
  section: 'Today' | 'Yesterday';
  badgeColor?: string;
}

interface ProductionBatchItem {
  id: string;
  orderId: string;
  clientName: string;
  productName: string;
  iconType: 'shield' | 'layers' | 'home';
  currentMeters: number;
  targetMeters: number;
  percentage: number;
  phase: string;
  orderRef?: Order;
}

interface MonthlyCashflow {
  month: string;
  fullMonth: string;
  income: number;
  expense: number;
  incomeDisplay: string;
  expenseDisplay: string;
}

export const AdminDashboardModule: React.FC<AdminDashboardModuleProps> = ({
  orders,
  users: _users,
  commodities: _commodities,
  auditLogs: _auditLogs,
  onNavigateTab,
  onSelectOrder,
  onOpenOrderModal
}) => {
  // -------------------------------------------------------------------------
  // Search & Filter State
  // -------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [statTab, setStatTab] = useState<'income' | 'expense'>('income');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number>(5); // Default to June (index 5)
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [newPlanClient, setNewPlanClient] = useState<string>('');
  const [newPlanMeters, setNewPlanMeters] = useState<string>('');

  // Unified Modern Table Selection & Filters
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>(['LP-902']);
  const [tableTab, setTableTab] = useState<'all' | 'on_track' | 'in_review' | 'at_risk'>('all');
  const [tableFilterText, setTableFilterText] = useState<string>('');

  // -------------------------------------------------------------------------
  // Production Batches (Derived from live Application Orders)
  // -------------------------------------------------------------------------
  const [customBatches, setCustomBatches] = useState<ProductionBatchItem[]>([]);

  const productionBatches: ProductionBatchItem[] = useMemo(() => {
    // Primary items from application orders
    const liveItems: ProductionBatchItem[] = orders.slice(0, 4).map((o, idx) => {
      const produced = o.producedMeters || Math.round(o.quantityMeters * (o.status === 'in_production' ? 0.65 : 0.3));
      const target = o.quantityMeters;
      const pct = Math.min(100, Math.round((produced / target) * 100));

      const iconType: 'shield' | 'layers' | 'home' =
        idx === 0 ? 'shield' : idx === 1 ? 'layers' : 'home';

      return {
        id: `batch_${o.id}`,
        orderId: o.id,
        clientName: o.clientName,
        productName: o.productName || o.category,
        iconType,
        currentMeters: produced,
        targetMeters: target,
        percentage: pct,
        phase: o.currentPhase,
        orderRef: o
      };
    });

    return [...liveItems, ...customBatches];
  }, [orders, customBatches]);

  const totalActiveMeters = useMemo(() => {
    return orders.reduce((acc, o) => acc + (o.quantityMeters || 0), 0);
  }, [orders]);

  // -------------------------------------------------------------------------
  // Cashflow 12-Month Mill Revenue & Opex (Bi-directional Bar Chart)
  // -------------------------------------------------------------------------
  const cashflowData: MonthlyCashflow[] = useMemo(() => [
    { month: 'Jan', fullMonth: 'January 2026', income: 4800, expense: 3200, incomeDisplay: '₹48.0L', expenseDisplay: '₹32.0L' },
    { month: 'Feb', fullMonth: 'February 2026', income: 4200, expense: 2900, incomeDisplay: '₹42.0L', expenseDisplay: '₹29.0L' },
    { month: 'Mar', fullMonth: 'March 2026', income: 5600, expense: 3800, incomeDisplay: '₹56.0L', expenseDisplay: '₹38.0L' },
    { month: 'Apr', fullMonth: 'April 2026', income: 5100, expense: 3400, incomeDisplay: '₹51.0L', expenseDisplay: '₹34.0L' },
    { month: 'May', fullMonth: 'May 2026', income: 6200, expense: 4100, incomeDisplay: '₹62.0L', expenseDisplay: '₹41.0L' },
    { month: 'Jun', fullMonth: 'June 2026 (Peak)', income: 6000, expense: 4000, incomeDisplay: '₹60.0L', expenseDisplay: '₹40.0L' },
    { month: 'Jul', fullMonth: 'July 2026', income: 5800, expense: 3900, incomeDisplay: '₹58.0L', expenseDisplay: '₹39.0L' },
    { month: 'Aug', fullMonth: 'August 2026', income: 6500, expense: 4200, incomeDisplay: '₹65.0L', expenseDisplay: '₹42.0L' },
    { month: 'Sep', fullMonth: 'September 2026', income: 7100, expense: 4600, incomeDisplay: '₹71.0L', expenseDisplay: '₹46.0L' },
    { month: 'Oct', fullMonth: 'October 2026 (Current)', income: 6800, expense: 4400, incomeDisplay: '₹48.6L', expenseDisplay: '₹37.4L' },
    { month: 'Nov', fullMonth: 'November 2026 (Projected)', income: 7400, expense: 4700, incomeDisplay: '₹74.0L', expenseDisplay: '₹47.0L' },
    { month: 'Dec', fullMonth: 'December 2026 (Projected)', income: 8000, expense: 5100, incomeDisplay: '₹80.0L', expenseDisplay: '₹51.0L' }
  ], []);

  // -------------------------------------------------------------------------
  // Mill Production Orders & Commercial POs Table (Using Live Orders)
  // -------------------------------------------------------------------------
  const liveOrderTransactions: TransactionItem[] = useMemo(() => {
    return orders.slice(0, 6).map((o) => {
      let status: 'Completed' | 'Pending' | 'Failed' = 'Pending';
      if (o.status === 'completed' || o.status === 'in_production' || o.riskStatus === 'on_track') {
        status = 'Completed';
      } else if (o.status === 'awaiting_admin_decision' || o.riskStatus === 'at_risk') {
        status = 'Pending';
      } else if (o.status === 'rejected_by_admin' || o.status === 'declined_by_client') {
        status = 'Failed';
      }

      const amountVal = o.quotation?.totalPrice ?? Math.round(o.quantityMeters * 385);

      return {
        id: o.id,
        name: `${o.clientName} (${o.id})`,
        category: `${o.productName || o.category} • ${o.quantityMeters.toLocaleString()}m`,
        dateTime: `${o.deadlineDate || '15 Nov 2026'}`,
        amount: `₹${(amountVal >= 100000 ? (amountVal / 100000).toFixed(2) + 'L' : amountVal.toLocaleString())}`,
        note: `${o.currentPhase} • ${(o.producedMeters || 0).toLocaleString()}m ready`,
        status,
        orderRef: o
      };
    });
  }, [orders]);

  const onTrackCount = useMemo(() => liveOrderTransactions.filter(t => t.status === 'Completed').length, [liveOrderTransactions]);
  const inReviewCount = useMemo(() => liveOrderTransactions.filter(t => t.status === 'Pending').length, [liveOrderTransactions]);
  const atRiskCount = useMemo(() => liveOrderTransactions.filter(t => t.status === 'Failed').length, [liveOrderTransactions]);

  const displayedTransactions = useMemo(() => {
    return liveOrderTransactions.filter((t) => {
      if (tableTab === 'on_track' && t.status !== 'Completed') return false;
      if (tableTab === 'in_review' && t.status !== 'Pending') return false;
      if (tableTab === 'at_risk' && t.status !== 'Failed') return false;

      const q = (tableFilterText || searchQuery).trim().toLowerCase();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.note.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [liveOrderTransactions, tableTab, tableFilterText, searchQuery]);

  // -------------------------------------------------------------------------
  // Mill Telemetry & Agent Activity Feed (Authentic LoomPilot Events)
  // -------------------------------------------------------------------------
  const activities: ActivityItem[] = useMemo(() => [
    {
      id: 'act_1',
      user: 'John Doe (MD)',
      initials: 'JD',
      badgeColor: '#79B4B7',
      action: 'approved quotation review QT-1001 for ABC Garments (₹3,50,000)',
      time: '16:05',
      section: 'Today'
    },
    {
      id: 'act_2',
      user: 'Market Price Agent',
      initials: 'AI',
      badgeColor: '#0284c7',
      action: 'detected Cotton Fabric surge +14.2%. Price buffers adjusted in PO drafts.',
      time: '13:05',
      section: 'Today'
    },
    {
      id: 'act_3',
      user: 'Ramesh Kumar (Supervisor)',
      initials: 'RK',
      badgeColor: '#16a34a',
      action: 'reported 1,280 pcs stitched in Shed A; 24 weavers active on Airjets.',
      time: '11:20',
      section: 'Today'
    },
    {
      id: 'act_4',
      user: 'Airjet Telemetry #12',
      initials: 'TX',
      badgeColor: '#5A5A5A',
      action: 'completed 2,000m weaving batch with 98.5% first-pass yield.',
      time: '09:45',
      section: 'Today'
    },
    {
      id: 'act_5',
      user: 'Client Assistant Agent',
      initials: 'AI',
      badgeColor: '#0284c7',
      action: 'escalated discount request for StyleMart (TX-1025) to Managing Director.',
      time: '21:05',
      section: 'Yesterday'
    },
    {
      id: 'act_6',
      user: 'Procurement Agent',
      initials: 'PO',
      badgeColor: '#d97706',
      action: 'cleared PO-1002 with Sri Textiles for 600m raw Cotton Fabric deficit.',
      time: '17:30',
      section: 'Yesterday'
    }
  ], []);

  // Notifications Drawer Data
  const notifications = useMemo(() => [
    {
      id: 'notif_1',
      title: 'Airjet Loom #7 Breakdown',
      message: 'Tension sensor fault in Shed A. 1,200m curtain batch stalled (LP-904).',
      timestamp: '15m ago',
      tab: 'supervisors' as AdminNavTab
    },
    {
      id: 'notif_2',
      title: 'PO-1002 Cotton Deficit',
      message: 'Shipment delayed 2 days by Sri Textiles. Immediate purchase clearance needed.',
      timestamp: '45m ago',
      tab: 'procurement' as AdminNavTab
    },
    {
      id: 'notif_3',
      title: 'Quotation QT-1001 Ready for Review',
      message: '5,000m Cotton Shirts order (₹3,50,000) drafted by AI Agent awaiting MD sign-off.',
      timestamp: '2h ago',
      tab: 'quotations' as AdminNavTab
    }
  ], []);

  // Add custom batch submit handler
  const handleAddBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanClient.trim() || !newPlanMeters.trim()) return;
    const target = parseFloat(newPlanMeters) || 5000;
    const newBatch: ProductionBatchItem = {
      id: `batch_${Date.now()}`,
      orderId: `LP-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: newPlanClient.trim(),
      productName: 'Cotton Garment Batch',
      iconType: 'layers',
      currentMeters: 0,
      targetMeters: target,
      percentage: 0,
      phase: 'Yarn Inward'
    };
    setCustomBatches((prev) => [...prev, newBatch]);
    setNewPlanClient('');
    setNewPlanMeters('');
    setShowAddPlanModal(false);
  };

  const activeCashflow = cashflowData[hoveredMonthIndex] || cashflowData[5];

  return (
    <div className="db-viewport">
      {/* =====================================================================
          1. TOP NAVIGATION / HEADER
          ===================================================================== */}
      <header className="db-header">
        <h1 className="db-header-title">Manufacturing Dashboard</h1>

        <div className="db-header-center">
          <div className="db-search-box">
            <Search className="db-search-icon" size={16} />
            <input
              type="text"
              className="db-search-input"
              placeholder="Search orders, looms, clients, supervisors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="db-header-right">
          {/* Chat Icon (Routes to Communications Module) */}
          <button
            className="db-icon-btn"
            title="Open Client Communications"
            onClick={() => onNavigateTab('chat')}
          >
            <MessageSquare size={17} />
          </button>

          {/* Notification Bell with red alert dot */}
          <button
            className="db-icon-btn"
            title="System Alerts & Machine Telemetry"
            onClick={() => setShowNotificationDrawer(true)}
          >
            <Bell size={17} />
            <span className="db-badge-dot" />
          </button>

          {/* User Profile Pill */}
          <div
            className="db-user-pill"
            title="John Doe — Managing Director & Operations Head"
            onClick={() => onNavigateTab('users')}
          >
            <div className="db-user-avatar" style={{ background: '#222C2E', color: '#FEFBF3', fontWeight: 800 }}>
              JD
            </div>
            <span className="db-user-name">John Doe (MD)</span>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. MAIN 3-COLUMN DASHBOARD GRID
          ===================================================================== */}
      <div className="db-grid">
        {/* ===================================================================
            COLUMN 1: LEFT WIDGETS
            =================================================================== */}
        <div className="db-col-left">
          {/* Card 1: Dark Green Telemetry / Operations Card */}
          <div className="db-credit-card">
            <div className="db-credit-card-top">
              {/* 4-leaf loom telemetry emblem */}
              <div className="db-card-brand-logo">
                <span className="db-card-brand-dot" />
                <span className="db-card-brand-dot" />
                <span className="db-card-brand-dot" />
                <span className="db-card-brand-dot" />
              </div>
              <Wifi size={18} className="db-contactless-icon" style={{ transform: 'rotate(90deg)', color: '#79B4B7' }} />
            </div>

            <div className="db-card-holder">John Doe (Managing Director)</div>

            <div className="db-card-balance-section">
              <div className="db-card-balance-lbl">Mill Production Capital</div>
              <div className="db-card-balance-val">₹48,60,000</div>
            </div>

            <div className="db-credit-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a4d8b5' }}>
              <div>48 LOOMS ACTIVE</div>
              <div>YIELD &nbsp; 98.5%</div>
            </div>
          </div>

          {/* 4 Circular Action Buttons (Textile Operations) */}
          <div className="db-quick-actions-row">
            <button
              className="db-quick-action-item"
              title="Create New Production Order"
              onClick={() => onNavigateTab('orders')}
            >
              <div className="db-action-circle-btn">
                <Plus size={18} />
              </div>
              <span className="db-quick-action-label">+ Order</span>
            </button>

            <button
              className="db-quick-action-item"
              title="Handover Batches to Supervisor"
              onClick={() => onNavigateTab('supervisors')}
            >
              <div className="db-action-circle-btn">
                <ArrowUpRight size={18} />
              </div>
              <span className="db-quick-action-label">↗ Handover</span>
            </button>

            <button
              className="db-quick-action-item"
              title="Procure Raw Materials & Yarn"
              onClick={() => onNavigateTab('procurement')}
            >
              <div className="db-action-circle-btn">
                <Boxes size={18} />
              </div>
              <span className="db-quick-action-label">₹ Procure</span>
            </button>

            <button
              className="db-quick-action-item"
              title="View Loom Telemetry & History"
              onClick={() => onNavigateTab('production')}
            >
              <div className="db-action-circle-btn">
                <History size={18} />
              </div>
              <span className="db-quick-action-label">Telemetry</span>
            </button>
          </div>

          {/* Card 2: Daily Weaving Target Card */}
          <div className="db-card">
            <div className="db-card-header">
              <h2 className="db-card-title">Daily Loom Output</h2>
              <button className="db-card-action-btn" onClick={() => onNavigateTab('production')}>
                <MoreVertical size={15} />
              </button>
            </div>

            <div className="db-daily-limit-info">
              <span>2,350m woven of 2,700m target</span>
              <span className="db-daily-limit-percent">87.0%</span>
            </div>

            <div className="db-progress-track">
              <div
                className="db-progress-fill"
                style={{ width: '87.0%', background: '#79B4B7' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#6b7280', marginTop: 6 }}>
              <span>Pacing: 142 m/hr</span>
              <span style={{ color: '#18191B', fontWeight: 600 }}>Sheds A & B Online</span>
            </div>
          </div>

          {/* Card 3: Active Production Batches Card */}
          <div className="db-card">
            <div className="db-saving-header-row">
              <h2 className="db-card-title">Production Batches</h2>
              <button
                className="db-add-plan-link"
                onClick={() => onNavigateTab('orders')}
                title="View all orders in pipeline"
              >
                <Plus size={13} />
                View All ({orders.length})
              </button>
            </div>

            <div className="db-saving-total-lbl">Active Pipeline Volume</div>
            <div className="db-saving-total-val">{totalActiveMeters.toLocaleString()} metres</div>

            <div className="db-saving-plans-list">
              {productionBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="db-saving-plan-item"
                  style={{ cursor: batch.orderRef ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (batch.orderRef && onOpenOrderModal) {
                      onOpenOrderModal(batch.orderRef);
                    } else if (batch.orderRef && onSelectOrder) {
                      onSelectOrder(batch.orderRef.id);
                      onNavigateTab('orders');
                    }
                  }}
                >
                  <div className="db-plan-item-top">
                    <div className="db-plan-item-left">
                      <div className="db-plan-item-icon-box">
                        {batch.iconType === 'shield' && <ShieldAlert size={14} />}
                        {batch.iconType === 'layers' && <Layers size={14} />}
                        {batch.iconType === 'home' && <Home size={14} />}
                      </div>
                      <span className="db-plan-item-name">{batch.clientName} ({batch.orderId})</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#52796f', fontWeight: 600 }}>{batch.phase}</span>
                  </div>

                  <div className="db-plan-item-stats">
                    <span className="db-plan-current">
                      {batch.currentMeters.toLocaleString()}m &nbsp; {batch.percentage}%
                    </span>
                    <span className="db-plan-target">
                      Target {batch.targetMeters.toLocaleString()}m
                    </span>
                  </div>

                  <div className="db-progress-track">
                    <div
                      className="db-progress-fill"
                      style={{
                        width: `${batch.percentage}%`,
                        background: batch.percentage >= 70 ? '#79B4B7' : batch.percentage >= 40 ? '#5A5A5A' : '#f59e0b'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===================================================================
            COLUMN 2: CENTER WIDGETS
            =================================================================== */}
        <div className="db-col-center">
          {/* Top 3 KPI Summary Cards */}
          <div className="db-kpi-grid">
            {/* KPI 1: Expected Revenue */}
            <div className="db-kpi-card" onClick={() => onNavigateTab('quotations')} style={{ cursor: 'pointer' }}>
              <div className="db-kpi-card-top">
                <div className="db-kpi-icon-badge">
                  <DollarSign size={17} />
                </div>
                <button className="db-card-action-btn">
                  <MoreVertical size={15} />
                </button>
              </div>

              <div className="db-kpi-pill db-kpi-pill-green">
                <TrendingUp size={11} />
                +17.8% projected
              </div>

              <div className="db-kpi-value">₹48.60L</div>
              <div className="db-kpi-label">Expected Revenue</div>
            </div>

            {/* KPI 2: Expected Profit */}
            <div className="db-kpi-card" onClick={() => onNavigateTab('orders')} style={{ cursor: 'pointer' }}>
              <div className="db-kpi-card-top">
                <div className="db-kpi-icon-badge">
                  <CreditCard size={17} />
                </div>
                <button className="db-card-action-btn">
                  <MoreVertical size={15} />
                </button>
              </div>

              <div className="db-kpi-pill db-kpi-pill-green">
                <TrendingUp size={11} />
                23.0% net margin
              </div>

              <div className="db-kpi-value">₹11.20L</div>
              <div className="db-kpi-label">Expected Net Profit</div>
            </div>

            {/* KPI 3: On-Time Delivery */}
            <div className="db-kpi-card" onClick={() => onNavigateTab('deliveries')} style={{ cursor: 'pointer' }}>
              <div className="db-kpi-card-top">
                <div className="db-kpi-icon-badge">
                  <PiggyBank size={17} />
                </div>
                <button className="db-card-action-btn">
                  <MoreVertical size={15} />
                </button>
              </div>

              <div className="db-kpi-pill db-kpi-pill-green">
                <CheckCircle2 size={11} />
                46/48 dispatches
              </div>

              <div className="db-kpi-value">94.6%</div>
              <div className="db-kpi-label">On-Time Delivery Rate</div>
            </div>
          </div>

          {/* Cashflow Bar Chart Card (Mill Revenue vs Opex) */}
          <div className="db-card db-cashflow-card">
            <div className="db-card-header" style={{ marginBottom: 4 }}>
              <h2 className="db-card-title">Mill Cashflow & Turnover</h2>
              <div className="db-dropdown-pill">
                FY 2026 <ChevronDown size={12} />
              </div>
            </div>

            <div className="db-cashflow-subhead">
              <div>
                <div className="db-cashflow-balance-lbl">YTD Factory Turnover</div>
                <div className="db-cashflow-balance-val">₹56,20,000</div>
              </div>

              <div className="db-cashflow-legend">
                <div className="db-legend-item">
                  <span className="db-legend-box" style={{ background: '#79B4B7' }} />
                  <span>Revenue (₹)</span>
                </div>
                <div className="db-legend-item">
                  <span className="db-legend-box" style={{ background: '#5A5A5A' }} />
                  <span>Material & Opex (₹)</span>
                </div>
              </div>
            </div>

            {/* 12-Month Dual Bi-Directional Bar Chart */}
            <div className="db-cashflow-chart-container">
              {/* Y-Axis Guidelines */}
              <div className="db-cashflow-y-guide" style={{ top: 22 }}>
                <span>₹80L</span>
                <div className="db-cashflow-y-line" />
              </div>
              <div className="db-cashflow-y-guide" style={{ top: 58 }}>
                <span>₹40L</span>
                <div className="db-cashflow-y-line" />
              </div>
              <div className="db-cashflow-y-guide" style={{ top: 94 }}>
                <span>0</span>
                <div className="db-cashflow-y-line" style={{ borderBottomColor: '#d6e2d8' }} />
              </div>
              <div className="db-cashflow-y-guide" style={{ top: 130 }}>
                <span>-₹40L</span>
                <div className="db-cashflow-y-line" />
              </div>
              <div className="db-cashflow-y-guide" style={{ top: 166 }}>
                <span>-₹80L</span>
                <div className="db-cashflow-y-line" />
              </div>

              {/* Month Columns */}
              <div className="db-chart-columns-wrap">
                {cashflowData.map((item, idx) => {
                  const isHovered = hoveredMonthIndex === idx;
                  // Max height 45px per bar half
                  const incomeHeight = Math.max(12, Math.round((item.income / 8000) * 45));
                  const expenseHeight = Math.max(10, Math.round((item.expense / 8000) * 45));

                  return (
                    <div
                      key={item.month}
                      className={`db-month-col ${isHovered ? 'is-active' : ''}`}
                      onMouseEnter={() => setHoveredMonthIndex(idx)}
                      onClick={() => setHoveredMonthIndex(idx)}
                    >
                      {/* Tooltip on active month */}
                      {isHovered && (
                        <div className="db-chart-tooltip">
                          <span className="db-tooltip-title">{activeCashflow.fullMonth}</span>
                          <div className="db-tooltip-row">
                            <span>Revenue:</span>
                            <span style={{ fontWeight: 700, color: '#18191B' }}>
                              {activeCashflow.incomeDisplay}
                            </span>
                          </div>
                          <div className="db-tooltip-row">
                            <span>Opex:</span>
                            <span style={{ fontWeight: 700, color: '#2e7d32' }}>
                              {activeCashflow.expenseDisplay}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Bar Stack: Income (points up), Expense (points down) */}
                      <div className="db-bars-stack">
                        <div
                          className="db-bar-income"
                          style={{
                            height: `${incomeHeight}px`,
                            position: 'absolute',
                            bottom: '52px'
                          }}
                        />
                        <div
                          className="db-bar-expense"
                          style={{
                            height: `${expenseHeight}px`,
                            position: 'absolute',
                            top: '53px'
                          }}
                        />
                      </div>

                      <span className="db-month-label">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Unified Modern Table: Factory Orders & POs (Matching Reference Design) */}
          <div className="modern-table-card" style={{ marginTop: 4 }}>
            {/* Folder-style Tabs Navigation with Count Badges */}
            <div className="modern-table-tabs-bar">
              <button
                type="button"
                className={`modern-table-tab ${tableTab === 'all' ? 'active' : ''}`}
                onClick={() => setTableTab('all')}
              >
                <Boxes size={14} />
                <span>All Orders</span>
                <span className="modern-table-tab-badge">{liveOrderTransactions.length}</span>
              </button>
              <button
                type="button"
                className={`modern-table-tab ${tableTab === 'on_track' ? 'active' : ''}`}
                onClick={() => setTableTab('on_track')}
              >
                <Activity size={14} />
                <span>On Track</span>
                <span className="modern-table-tab-badge">{onTrackCount}</span>
              </button>
              <button
                type="button"
                className={`modern-table-tab ${tableTab === 'in_review' ? 'active' : ''}`}
                onClick={() => setTableTab('in_review')}
              >
                <CreditCard size={14} />
                <span>In Review</span>
                <span className="modern-table-tab-badge">{inReviewCount}</span>
              </button>
              <button
                type="button"
                className={`modern-table-tab ${tableTab === 'at_risk' ? 'active' : ''}`}
                onClick={() => setTableTab('at_risk')}
              >
                <ShieldAlert size={14} />
                <span>At Risk</span>
                <span className="modern-table-tab-badge">{atRiskCount}</span>
              </button>
            </div>

            {/* Toolbar: Filter search pill, settings sliders toggle, and +New Order CTA */}
            <div className="modern-table-toolbar">
              <div className="modern-table-filter-group">
                <div className="modern-search-pill">
                  <Filter size={13} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Filter factory orders & POs..."
                    value={tableFilterText}
                    onChange={(e) => setTableFilterText(e.target.value)}
                  />
                  {tableFilterText && (
                    <button
                      type="button"
                      onClick={() => setTableFilterText('')}
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
                  onClick={() => setTableTab(prev => prev === 'all' ? 'on_track' : 'all')}
                >
                  <SlidersHorizontal size={14} />
                </button>
              </div>

              <button
                type="button"
                className="modern-action-pill-btn"
                onClick={() => onNavigateTab('orders')}
              >
                <Plus size={14} />
                <span>New Order</span>
              </button>
            </div>

            {/* Table Container */}
            <div className="modern-data-table-wrapper">
              <table className="modern-data-table">
                <thead>
                  <tr>
                    <th className="col-checkbox">
                      <input
                        type="checkbox"
                        className="modern-checkbox"
                        checked={
                          displayedTransactions.length > 0 &&
                          displayedTransactions.every((tx) => selectedTxIds.includes(tx.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allIds = Array.from(new Set([...selectedTxIds, ...displayedTransactions.map((t) => t.id)]));
                            setSelectedTxIds(allIds);
                          } else {
                            const curDispIds = new Set(displayedTransactions.map((t) => t.id));
                            setSelectedTxIds(selectedTxIds.filter((id) => !curDispIds.has(id)));
                          }
                        }}
                      />
                    </th>
                    <th>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        Order # <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th>Company Name</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Deadline</th>
                    <th>Last Updated</th>
                    <th style={{ width: 44, textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>
                        No orders found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedTransactions.map((tx) => {
                      const isSelected = selectedTxIds.includes(tx.id);
                      return (
                        <tr
                          key={tx.id}
                          className={isSelected ? 'is-selected' : ''}
                          style={{ cursor: tx.orderRef ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (tx.orderRef && onOpenOrderModal) {
                              onOpenOrderModal(tx.orderRef);
                            } else if (tx.orderRef && onSelectOrder) {
                              onSelectOrder(tx.orderRef.id);
                              onNavigateTab('orders');
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
                                  setSelectedTxIds(selectedTxIds.filter((id) => id !== tx.id));
                                } else {
                                  setSelectedTxIds([...selectedTxIds, tx.id]);
                                }
                              }}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: '#18191B', letterSpacing: '-0.01em' }}>
                            #{tx.id}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: '#111827' }}>
                                {tx.orderRef?.clientName || tx.name}
                              </span>
                              <span style={{ fontSize: 10.5, color: '#64748b' }}>
                                {tx.category}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`status-dot-pill ${tx.status === 'Completed'
                                  ? 'fulfilled'
                                  : tx.status === 'Pending'
                                    ? 'pending'
                                    : 'failed'
                                }`}
                            >
                              {tx.status === 'Completed' ? 'FULFILLED' : tx.status === 'Pending' ? 'IN REVIEW' : 'AT RISK'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                            {tx.amount}
                          </td>
                          <td style={{ color: '#64748b', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                            {tx.dateTime}
                          </td>
                          <td style={{ color: '#64748b', fontSize: 11, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tx.note}
                          </td>
                          <td
                            style={{ textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="modern-table-row-action"
                              title="More options"
                              onClick={() => {
                                if (tx.orderRef && onOpenOrderModal) {
                                  onOpenOrderModal(tx.orderRef);
                                }
                              }}
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
        </div>

        {/* ===================================================================
            COLUMN 3: RIGHT WIDGETS
            =================================================================== */}
        <div className="db-col-right">
          {/* Card 1: Production Allocation Donut Card */}
          <div className="db-card">
            <div className="db-card-header" style={{ marginBottom: 4 }}>
              <h2 className="db-card-title">Production Allocation</h2>
              <div className="db-dropdown-pill">
                Oct 2026 <ChevronDown size={12} />
              </div>
            </div>

            {/* Income / Expense Toggle Tabs -> Fabric Revenue / Mill Cost */}
            <div className="db-stat-tabs-row">
              <button
                className={`db-stat-tab-btn ${statTab === 'income' ? 'is-active' : ''}`}
                onClick={() => setStatTab('income')}
              >
                By Fabric (₹48.6L)
              </button>
              <button
                className={`db-stat-tab-btn ${statTab === 'expense' ? 'is-active' : ''}`}
                onClick={() => setStatTab('expense')}
              >
                Cost Centers (₹37.4L)
              </button>
            </div>

            {/* Circular Donut Ring */}
            <div className="db-donut-center-wrap">
              <svg width="140" height="140" viewBox="0 0 140 140" className="db-donut-svg">
                {/* Background Ring */}
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  stroke="#e8efe9"
                  strokeWidth="14"
                />
                {/* Lime segment (35%) */}
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  stroke="#9D9D9D"
                  strokeWidth="14"
                  strokeDasharray="339.29"
                  strokeDashoffset="220.5"
                  strokeLinecap="round"
                />
                {/* Dark Pine segment (65%) */}
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  stroke="#79B4B7"
                  strokeWidth="14"
                  strokeDasharray="339.29"
                  strokeDashoffset="118.75"
                  strokeLinecap="round"
                />
              </svg>

              <div className="db-donut-center-text">
                <span className="db-donut-lbl">
                  {statTab === 'income' ? 'Total Volume' : 'Total Cost'}
                </span>
                <span className="db-donut-val">
                  {statTab === 'income' ? '₹48.60L' : '₹37.40L'}
                </span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="db-breakdown-list">
              {statTab === 'income' ? (
                <>
                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-60" style={{ background: '#79B4B7', color: '#18191B' }}>45%</span>
                      <span className="db-breakdown-name">Cotton Shirts & Apparel</span>
                    </div>
                    <span className="db-breakdown-val">₹21,87,000</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-15" style={{ background: '#9D9D9D', color: '#FEFBF3' }}>25%</span>
                      <span className="db-breakdown-name">Bedsheet Sets & Linens</span>
                    </div>
                    <span className="db-breakdown-val">₹12,15,000</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-12">15%</span>
                      <span className="db-breakdown-name">Curtains & Jacquard Drapes</span>
                    </div>
                    <span className="db-breakdown-val">₹7,29,000</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-8">10%</span>
                      <span className="db-breakdown-name">Yarn & Greige Inventory</span>
                    </div>
                    <span className="db-breakdown-val">₹4,86,000</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-5">5%</span>
                      <span className="db-breakdown-name">Trims & Dye Chemicals</span>
                    </div>
                    <span className="db-breakdown-val">₹2,43,000</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-60" style={{ background: '#79B4B7', color: '#18191B' }}>55%</span>
                      <span className="db-breakdown-name">Raw Yarn & Combed Fibers</span>
                    </div>
                    <span className="db-breakdown-val">₹20,57,000</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-15" style={{ background: '#9D9D9D', color: '#FEFBF3' }}>20%</span>
                      <span className="db-breakdown-name">Dyeing & Reactive Finishes</span>
                    </div>
                    <span className="db-breakdown-val">₹7,48,000</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-12">12%</span>
                      <span className="db-breakdown-name">Loom Power & Weaving Sheds</span>
                    </div>
                    <span className="db-breakdown-val">₹4,48,800</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-8">8%</span>
                      <span className="db-breakdown-name">Weavers & Supervising Pay</span>
                    </div>
                    <span className="db-breakdown-val">₹2,99,200</span>
                  </div>

                  <div className="db-breakdown-row">
                    <div className="db-breakdown-left">
                      <span className="db-percent-badge db-percent-5">5%</span>
                      <span className="db-breakdown-name">Logistics & Dispatches</span>
                    </div>
                    <span className="db-breakdown-val">₹1,87,000</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Recent Mill Activity & Agent Telemetry Feed */}
          <div className="db-card">
            <div className="db-card-header">
              <h2 className="db-card-title">Mill Telemetry & Activity</h2>
              <button className="db-card-action-btn" onClick={() => onNavigateTab('audit')}>
                <Activity size={15} />
              </button>
            </div>

            {/* Today Section */}
            <div className="db-activity-group">
              <span className="db-activity-section-title">Today</span>
              {activities
                .filter((a) => a.section === 'Today')
                .map((item) => (
                  <div key={item.id} className="db-activity-item">
                    <div
                      className="db-activity-avatar"
                      style={{
                        background: item.badgeColor || '#79B4B7',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 800
                      }}
                    >
                      {item.initials}
                    </div>
                    <div className="db-activity-content">
                      <div className="db-activity-text">
                        <span className="db-activity-user">{item.user}</span> {item.action}
                      </div>
                      <span className="db-activity-time">{item.time}</span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Yesterday Section */}
            <div className="db-activity-group" style={{ marginTop: 12 }}>
              <span className="db-activity-section-title">Yesterday</span>
              {activities
                .filter((a) => a.section === 'Yesterday')
                .map((item) => (
                  <div key={item.id} className="db-activity-item">
                    <div
                      className="db-activity-avatar"
                      style={{
                        background: item.badgeColor || '#79B4B7',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 800
                      }}
                    >
                      {item.initials}
                    </div>
                    <div className="db-activity-content">
                      <div className="db-activity-text">
                        <span className="db-activity-user">{item.user}</span> {item.action}
                      </div>
                      <span className="db-activity-time">{item.time}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          NOTIFICATIONS SLIDE-OVER DRAWER
          ===================================================================== */}
      {showNotificationDrawer && (
        <div className="db-drawer-backdrop" onClick={() => setShowNotificationDrawer(false)}>
          <div className="db-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="db-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color="#18191B" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#132a1e' }}>
                  Mill Notifications & Machine Alerts
                </h3>
              </div>
              <button
                className="db-icon-btn"
                style={{ width: 32, height: 32 }}
                onClick={() => setShowNotificationDrawer(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="db-drawer-body">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="db-notif-item"
                  onClick={() => {
                    setShowNotificationDrawer(false);
                    onNavigateTab(notif.tab);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="db-notif-title">
                    <span>{notif.title}</span>
                    <span style={{ fontSize: 10, color: '#e53e3e', fontWeight: 600 }}>Action</span>
                  </div>
                  <div className="db-notif-msg">{notif.message}</div>
                  <div className="db-notif-footer">
                    <span>{notif.timestamp}</span>
                    <span
                      style={{
                        color: '#18191B',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      Open in {notif.tab} <ExternalLink size={11} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddPlanModal && (
        <div className="db-modal-backdrop" onClick={() => setShowAddPlanModal(false)}>
          <div className="db-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Queue New Production Batch</h3>
              <button
                className="db-icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={() => setShowAddPlanModal(false)}
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleAddBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Client / Order Name</label>
                <input
                  type="text"
                  placeholder="e.g. Zara Textiles - Linen Batch"
                  value={newPlanClient}
                  onChange={(e) => setNewPlanClient(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #dcdcdc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Target Volume (Meters)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={newPlanMeters}
                  onChange={(e) => setNewPlanMeters(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #dcdcdc' }}
                />
              </div>
              <button
                type="submit"
                style={{
                  background: '#79B4B7', color: '#18191B',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  cursor: 'pointer'
                }}
              >
                Queue Batch
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardModule;

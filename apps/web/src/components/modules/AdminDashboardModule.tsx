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
  Boxes,
  RotateCw
} from 'lucide-react';
import type { Order, AppUser, MarketCommodity, AdminNavTab, AuditEntry } from '../../types';
import { useGetOrdersSummaryQuery } from '../../store/api/ordersApi';
import {
  useGetProductionBoardQuery,
  useGetSupervisorNotificationsQuery
} from '../../store/api/productionApi';
import { useGetStockSummaryQuery } from '../../store/api/stockApi';
import { useGetMachinesQuery } from '../../store/api/machinesApi';
import { useGetAuditLogsQuery } from '../../store/api/dashboardApi';
import './AdminDashboardModule.css';

export interface AdminDashboardModuleProps {
  orders: Order[];
  users: AppUser[];
  commodities: MarketCommodity[];
  auditLogs?: AuditEntry[];
  ordersSummary?: any;
  isOrdersSummaryLoading?: boolean;
  isOrdersSummaryError?: boolean;
  refetchOrdersSummary?: () => void;
  productionBoard?: any;
  isProductionBoardLoading?: boolean;
  refetchProductionBoard?: () => void;
  stockSummary?: any;
  isStockSummaryLoading?: boolean;
  refetchStockSummary?: () => void;
  machines?: any[];
  isMachinesLoading?: boolean;
  refetchMachines?: () => void;
  notifications?: any[];
  isNotificationsLoading?: boolean;
  isNotificationsError?: boolean;
  refetchNotifications?: () => void;
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
  statusPillText: string;
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

function formatPaiseToLakhs(paise?: number | null): string {
  if (paise === undefined || paise === null) return 'Unavailable';
  const rupees = paise / 100;
  if (rupees >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(2)}Cr`;
  }
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)}L`;
  }
  return `₹${rupees.toLocaleString('en-IN')}`;
}

function formatPaiseToExactCurrency(paise?: number | null): string {
  if (paise === undefined || paise === null) return 'Unavailable';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

export const AdminDashboardModule: React.FC<AdminDashboardModuleProps> = (props) => {
  const {
    orders,
    users: _users,
    commodities: _commodities,
    onNavigateTab,
    onSelectOrder,
    onOpenOrderModal
  } = props;

  const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

  // Fallback RTK Query calls if props not supplied
  const {
    data: fetchedOrdersSummaryData,
    isLoading: isFetchedOrdersSummaryLoading,
    error: fetchedOrdersSummaryError,
    refetch: refetchFetchedOrdersSummary
  } = useGetOrdersSummaryQuery(undefined, { skip: props.ordersSummary !== undefined });

  const {
    data: fetchedProductionBoardData,
    isLoading: isFetchedProductionBoardLoading,
    refetch: refetchFetchedProductionBoard
  } = useGetProductionBoardQuery(undefined, { skip: props.productionBoard !== undefined });

  const {
    data: fetchedStockSummaryData,
    isLoading: isFetchedStockSummaryLoading,
    refetch: refetchFetchedStockSummary
  } = useGetStockSummaryQuery(undefined, { skip: props.stockSummary !== undefined });

  const {
    data: fetchedMachinesData,
    isLoading: isFetchedMachinesLoading,
    refetch: refetchFetchedMachines
  } = useGetMachinesQuery(undefined, { skip: props.machines !== undefined });

  const {
    data: fetchedAuditLogsData,
    isLoading: _isFetchedAuditLogsLoading
  } = useGetAuditLogsQuery(undefined, { skip: props.auditLogs !== undefined });

  // GET /api/v1/supervisor/notifications is explicitly authorized for admin and supervisor roles in RBAC matrix
  const {
    data: fetchedNotificationsData,
    isLoading: isFetchedNotificationsLoading,
    error: fetchedNotificationsError,
    refetch: refetchFetchedNotifications
  } = useGetSupervisorNotificationsQuery(undefined, { skip: props.notifications !== undefined || isDemo });

  // Resolve active data and loading/error states
  const ordersSummary = props.ordersSummary ?? fetchedOrdersSummaryData?.data ?? fetchedOrdersSummaryData;
  const isOrdersSummaryLoading = props.isOrdersSummaryLoading ?? isFetchedOrdersSummaryLoading;
  const isOrdersSummaryError = props.isOrdersSummaryError ?? !!fetchedOrdersSummaryError;
  const refetchOrdersSummary = props.refetchOrdersSummary ?? refetchFetchedOrdersSummary;

  const productionBoard = props.productionBoard ?? fetchedProductionBoardData?.data ?? fetchedProductionBoardData;
  const _refetchProductionBoard = props.refetchProductionBoard ?? refetchFetchedProductionBoard;

  const stockSummary = props.stockSummary ?? fetchedStockSummaryData?.data ?? fetchedStockSummaryData;
  const _refetchStockSummary = props.refetchStockSummary ?? refetchFetchedStockSummary;

  const machines = props.machines ?? (Array.isArray(fetchedMachinesData?.data) ? fetchedMachinesData.data : (Array.isArray(fetchedMachinesData) ? fetchedMachinesData : undefined));
  const _refetchMachines = props.refetchMachines ?? refetchFetchedMachines;

  const auditLogs = props.auditLogs ?? (Array.isArray(fetchedAuditLogsData?.data) ? fetchedAuditLogsData.data : (Array.isArray(fetchedAuditLogsData) ? fetchedAuditLogsData : undefined));

  const notifications = props.notifications !== undefined
    ? props.notifications
    : (Array.isArray(fetchedNotificationsData?.data) ? fetchedNotificationsData.data : (Array.isArray(fetchedNotificationsData) ? fetchedNotificationsData : undefined));
  const isNotificationsLoading = props.isNotificationsLoading ?? isFetchedNotificationsLoading;
  const isNotificationsError = props.isNotificationsError ?? !!fetchedNotificationsError;
  const refetchNotifications = props.refetchNotifications ?? refetchFetchedNotifications;

  // -------------------------------------------------------------------------
  // Search & Filter State
  // -------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [statTab, setStatTab] = useState<'income' | 'expense'>('income');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number>(5);

  // Table Selection & Filters
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [tableTab, setTableTab] = useState<'all' | 'on_track' | 'in_review' | 'at_risk'>('all');
  const [tableFilterText, setTableFilterText] = useState<string>('');

  // -------------------------------------------------------------------------
  // Production Batches (Derived from live backend production board / orders)
  // -------------------------------------------------------------------------
  const productionBatches: ProductionBatchItem[] = useMemo(() => {
    const boardOrders: any[] = productionBoard?.orders;
    if (Array.isArray(boardOrders) && boardOrders.length > 0) {
      return boardOrders.slice(0, 4).map((bo, idx) => {
        const target = bo.quantity || bo.quantityMeters || 0;
        const produced = bo.production?.producedQty ?? bo.producedMeters ?? 0;
        const pct = target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;
        const iconType: 'shield' | 'layers' | 'home' =
          idx === 0 ? 'shield' : idx === 1 ? 'layers' : 'home';

        const matchingOrderRef = orders.find(
          (o) => o.id === bo.id || o.id === bo.orderNumber || o.id === bo._id
        );

        return {
          id: `batch_${bo.id || idx}`,
          orderId: bo.orderNumber || bo.id || `ORD-${idx + 1}`,
          clientName: bo.client?.companyName || bo.client?.name || bo.clientName || 'Partner Client',
          productName: bo.productName || bo.product?.name || bo.category || 'Textile Batch',
          iconType,
          currentMeters: produced,
          targetMeters: target,
          percentage: pct,
          phase: bo.production?.phase || bo.currentPhase || 'In Production',
          orderRef: matchingOrderRef
        };
      });
    }

    const activeProductionOrders = orders.filter(
      (o) => o.status === 'in_production' || o.status === 'assigned'
    );
    const sourceOrders = activeProductionOrders.length > 0 ? activeProductionOrders : orders;

    if (sourceOrders.length > 0) {
      return sourceOrders.slice(0, 4).map((o, idx) => {
        const produced = o.producedMeters || 0;
        const target = o.quantityMeters || 0;
        const pct = target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;
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
          phase: o.currentPhase || (o.status === 'in_production' ? 'In Production' : 'Queued'),
          orderRef: o
        };
      });
    }

    if (isDemo) {
      return [
        {
          id: 'demo_batch_1',
          orderId: 'LP-901',
          clientName: 'ABC Garments',
          productName: 'Cotton Garment Batch',
          iconType: 'shield',
          currentMeters: 3250,
          targetMeters: 5000,
          percentage: 65,
          phase: 'Weaving Shed A'
        },
        {
          id: 'demo_batch_2',
          orderId: 'LP-902',
          clientName: 'StyleMart Retail',
          productName: 'Loom Linen Batch',
          iconType: 'layers',
          currentMeters: 1800,
          targetMeters: 4000,
          percentage: 45,
          phase: 'Dyeing & Finishing'
        }
      ];
    }

    return [];
  }, [productionBoard, orders, isDemo]);

  const totalActivePipelineVolume = useMemo(() => {
    const summaryTarget =
      productionBoard?.summary?.totalTargetQty ??
      productionBoard?.totals?.totalTargetQty ??
      ordersSummary?.production?.totalTargetQty;
    if (summaryTarget !== undefined && summaryTarget !== null) {
      return summaryTarget;
    }
    return orders.reduce((acc, o) => acc + (o.quantityMeters || 0), 0);
  }, [productionBoard, ordersSummary, orders]);

  // -------------------------------------------------------------------------
  // Cashflow 12-Month Mill Financial Pipeline (Bi-directional Bar Chart)
  // Demo fixtures retained strictly behind VITE_ENABLE_DEMO_LOGIN === 'true'
  // In normal mode, no backend time-series cashflow endpoint exists -> empty
  // -------------------------------------------------------------------------
  const cashflowData: MonthlyCashflow[] = useMemo(() => {
    if (!isDemo) return [];
    return [
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
    ];
  }, [isDemo]);

  // -------------------------------------------------------------------------
  // Mill Production Orders & Commercial POs Table (Using Live Orders)
  // in_production is never marked as Completed; price & deadlines strictly backend
  // -------------------------------------------------------------------------
  const liveOrderTransactions: TransactionItem[] = useMemo(() => {
    return orders.map((o) => {
      let status: 'Completed' | 'Pending' | 'Failed' = 'Pending';
      if (o.status === 'completed' || o.status === 'delivered') {
        status = 'Completed';
      } else if (
        o.status === 'rejected_by_admin' ||
        o.status === 'declined_by_client' ||
        o.riskStatus === 'at_risk'
      ) {
        status = 'Failed';
      } else {
        status = 'Pending';
      }

      let amountDisplay = 'TBD';
      if (o.quotation?.totalPrice && o.quotation.totalPrice > 0) {
        const val = o.quotation.totalPrice;
        amountDisplay = `₹${val >= 100000 ? (val / 100000).toFixed(2) + 'L' : val.toLocaleString('en-IN')}`;
      } else if (o.quotation?.totalPricePaise && o.quotation.totalPricePaise > 0) {
        const val = o.quotation.totalPricePaise / 100;
        amountDisplay = `₹${val >= 100000 ? (val / 100000).toFixed(2) + 'L' : val.toLocaleString('en-IN')}`;
      }

      const deadlineDisplay = o.deadlineDate || 'No Deadline';

      const statusPillText =
        o.status === 'completed' || o.status === 'delivered'
          ? 'FULFILLED'
          : o.status === 'in_production'
          ? 'IN PRODUCTION'
          : o.status === 'awaiting_admin_decision'
          ? 'IN REVIEW'
          : o.status === 'rejected_by_admin' || o.status === 'declined_by_client'
          ? 'REJECTED'
          : o.riskStatus === 'at_risk'
          ? 'AT RISK'
          : 'PENDING';

      return {
        id: o.id,
        name: `${o.clientName} (${o.id})`,
        category: `${o.productName || o.category} • ${(o.quantityMeters || 0).toLocaleString()}m`,
        dateTime: deadlineDisplay,
        amount: amountDisplay,
        note: `${o.currentPhase || 'Phase Pending'} • ${(o.producedMeters || 0).toLocaleString()}m ready`,
        status,
        statusPillText,
        orderRef: o
      };
    });
  }, [orders]);

  const onTrackCount = useMemo(
    () => orders.filter((o) => o.riskStatus === 'on_track').length,
    [orders]
  );
  const inReviewCount = useMemo(
    () => orders.filter((o) => o.status === 'awaiting_admin_decision').length,
    [orders]
  );
  const atRiskCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.riskStatus === 'at_risk' ||
          o.status === 'rejected_by_admin' ||
          o.status === 'declined_by_client'
      ).length,
    [orders]
  );

  const displayedTransactions = useMemo(() => {
    return liveOrderTransactions.filter((t) => {
      if (tableTab === 'on_track' && t.orderRef?.riskStatus !== 'on_track') return false;
      if (tableTab === 'in_review' && t.orderRef?.status !== 'awaiting_admin_decision') return false;
      if (
        tableTab === 'at_risk' &&
        t.orderRef?.riskStatus !== 'at_risk' &&
        t.orderRef?.status !== 'rejected_by_admin' &&
        t.orderRef?.status !== 'declined_by_client'
      )
        return false;

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
  // Mill Telemetry & Agent Activity Feed (Backend Audit Logs)
  // -------------------------------------------------------------------------
  const activities: ActivityItem[] = useMemo(() => {
    if (auditLogs && Array.isArray(auditLogs) && auditLogs.length > 0) {
      const today = new Date().toDateString();
      return auditLogs.slice(0, 8).map((log: any, idx: number) => {
        const actorName =
          typeof log.actor === 'string'
            ? log.actor
            : log.actor?.email || log.actor?.name || log.actor?.type || 'System';
        const initials = actorName.substring(0, 2).toUpperCase();
        const badgeColors = ['#79B4B7', '#0284c7', '#16a34a', '#5A5A5A', '#d97706'];
        const badgeColor = badgeColors[idx % badgeColors.length];
        const logDate = log.timestamp || log.createdAt ? new Date(log.timestamp || log.createdAt) : new Date();
        const isToday = !isNaN(logDate.getTime()) && logDate.toDateString() === today;
        const timeStr = !isNaN(logDate.getTime())
          ? logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Recent';

        const actionText =
          log.action ||
          log.details ||
          (log.entity ? `${log.action || 'Updated'} ${log.entity.type || 'record'}` : 'Logged activity');

        return {
          id: log.id || `act_${idx}`,
          user: actorName,
          initials,
          badgeColor,
          action: actionText,
          time: timeStr,
          section: (isToday ? 'Today' : 'Yesterday') as 'Today' | 'Yesterday'
        };
      });
    }

    if (isDemo) {
      return [
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
      ];
    }

    return [];
  }, [auditLogs, isDemo]);

  // Notifications Drawer Data: User-scoped notifications for this administrator account
  const drawerNotifications = useMemo(() => {
    if (notifications && Array.isArray(notifications) && notifications.length > 0) {
      return notifications.map((n: any, idx: number) => {
        const title = n.title || (n.kind ? `${n.kind.replace(/_/g, ' ')} Alert` : 'Operational Notice');
        const message = n.message || n.body || n.details || 'Operational notice received for your account.';
        const notifDate = n.createdAt || n.timestamp ? new Date(n.createdAt || n.timestamp) : null;
        const timestamp = notifDate && !isNaN(notifDate.getTime())
          ? notifDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Recent';

        let tab: AdminNavTab = 'supervisors';
        const kindLower = (n.kind || '').toLowerCase();
        if (kindLower.includes('stock') || kindLower.includes('material') || kindLower.includes('po')) {
          tab = 'procurement';
        } else if (kindLower.includes('quote') || kindLower.includes('quotation')) {
          tab = 'quotations';
        } else if (kindLower.includes('order')) {
          tab = 'orders';
        }

        return {
          id: n.id || `notif_${idx}`,
          title,
          message,
          timestamp,
          tab
        };
      });
    }

    if (isDemo) {
      return [
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
      ];
    }

    return [];
  }, [notifications, isDemo]);

  // -------------------------------------------------------------------------
  // Financial metrics rigorously labeled according to backend definitions:
  // - totalPaidPaise: Total client payments received against order milestones
  // - totalValuePaise: Total order value summed across all order quotations/specifications
  // -------------------------------------------------------------------------
  const totalPaidDisplay = ordersSummary?.financials?.totalPaidPaise != null
    ? formatPaiseToExactCurrency(ordersSummary.financials.totalPaidPaise)
    : isDemo
    ? '₹48,60,000'
    : 'Unavailable';

  const totalOrderValueLakhs = ordersSummary?.financials?.totalValuePaise != null
    ? formatPaiseToLakhs(ordersSummary.financials.totalValuePaise)
    : isDemo
    ? '₹48.60L'
    : isOrdersSummaryLoading
    ? 'Loading...'
    : 'Unavailable';

  const pipelineOrderValueExact = ordersSummary?.financials?.totalValuePaise != null
    ? formatPaiseToExactCurrency(ordersSummary.financials.totalValuePaise)
    : isDemo
    ? '₹56,20,000'
    : 'Unavailable';

  const activeLoomsCount = useMemo(() => {
    if (machines && Array.isArray(machines)) {
      return machines.filter(
        (m: any) => m.currentStatus === 'running' || m.status === 'running'
      ).length;
    }
    return undefined;
  }, [machines]);

  const loomsTelemetryText = activeLoomsCount !== undefined
    ? `${activeLoomsCount} OF ${machines.length} LOOMS ACTIVE`
    : isDemo
    ? '48 LOOMS ACTIVE'
    : 'Looms: Unavailable';

  const yieldTelemetryText = isDemo ? 'YIELD   98.5%' : 'YIELD: Unavailable';

  // Cumulative active production progress calculations
  // Backend totalTargetQty & totalProducedQty represent cumulative volume across active orders, not today's daily shift output
  const cumulativeTargetMeters =
    productionBoard?.summary?.totalTargetQty ??
    productionBoard?.totals?.totalTargetQty ??
    ordersSummary?.production?.totalTargetQty;
  const cumulativeProducedMeters =
    productionBoard?.summary?.totalProducedQty ??
    productionBoard?.totals?.totalProducedQty ??
    ordersSummary?.production?.totalProducedQty;

  const hasCumulativeMetrics =
    cumulativeTargetMeters !== undefined &&
    cumulativeTargetMeters !== null &&
    cumulativeTargetMeters > 0;

  const productionProgressPct = hasCumulativeMetrics
    ? Math.min(100, Math.round(((cumulativeProducedMeters || 0) / cumulativeTargetMeters) * 100))
    : 0;

  // KPI calculations
  const ordersCountText = ordersSummary?.totalOrders !== undefined && ordersSummary?.totalOrders !== null
    ? `${ordersSummary.totalOrders} total orders`
    : isDemo
    ? '+17.8% projected'
    : 'Orders: Unavailable';

  const expectedProfitDisplay = isDemo ? '₹11.20L' : 'Unavailable';
  const marginPillText = isDemo ? '23.0% net margin' : 'Margin: Unavailable';

  // Performance calculations: Backend ordersSummary.performance measures active in-flight orders (onTrack vs delayed)
  // Denominator strictly includes active evaluated orders, excluding draft, completed, delivered, or cancelled orders
  const perfOnTrackCount = ordersSummary?.performance?.onTrackCount;
  const delayedCount = ordersSummary?.performance?.delayedCount;
  const hasPerformanceData =
    typeof perfOnTrackCount === 'number' && typeof delayedCount === 'number';
  const totalActiveEvaluatedOrders = hasPerformanceData ? perfOnTrackCount + delayedCount : 0;

  const onTrackRateDisplay = totalActiveEvaluatedOrders > 0
    ? `${((perfOnTrackCount / totalActiveEvaluatedOrders) * 100).toFixed(1)}%`
    : isDemo
    ? '94.6%'
    : 'Unavailable';

  const onTrackPillText = totalActiveEvaluatedOrders > 0
    ? `${perfOnTrackCount}/${totalActiveEvaluatedOrders} on track`
    : isDemo
    ? '46/48 on track'
    : 'On-Track: Unavailable';

  const activeCashflow = cashflowData[hoveredMonthIndex] || cashflowData[5];

  const costCentersTotal = stockSummary?.totalValuationPaise != null
    ? formatPaiseToLakhs(stockSummary.totalValuationPaise)
    : isDemo
    ? '₹37.40L'
    : 'Unavailable';

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
          {/* Refresh action if ordersSummary failed */}
          {refetchOrdersSummary && (
            <button
              className="db-icon-btn"
              title="Refresh Dashboard Data"
              onClick={() => refetchOrdersSummary()}
            >
              <RotateCw size={15} />
            </button>
          )}

          {/* Chat Icon (Routes to Communications Module) */}
          <button
            className="db-icon-btn"
            title="Open Client Communications"
            onClick={() => onNavigateTab('chat')}
          >
            <MessageSquare size={17} />
          </button>

          {/* Notification Bell for User-scoped Notifications */}
          <button
            className="db-icon-btn"
            title="User Notifications & Alerts"
            onClick={() => setShowNotificationDrawer(true)}
          >
            <Bell size={17} />
            {drawerNotifications.length > 0 && <span className="db-badge-dot" />}
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

      {/* Global API error notification */}
      {isOrdersSummaryError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 12
          }}
        >
          <span>Failed to load factory summary aggregates from backend.</span>
          {refetchOrdersSummary && (
            <button
              type="button"
              onClick={() => refetchOrdersSummary()}
              style={{
                background: '#b91c1c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

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
              <div className="db-card-balance-lbl">Total Payments Received</div>
              <div className="db-card-balance-val">{totalPaidDisplay}</div>
            </div>

            <div
              className="db-credit-card-bottom"
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a4d8b5' }}
            >
              <div>{loomsTelemetryText}</div>
              <div>{yieldTelemetryText}</div>
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

          {/* Card 2: Active Loom Production Progress (Accurately labeled cumulative target & production) */}
          <div className="db-card">
            <div className="db-card-header">
              <h2 className="db-card-title">
                {isDemo ? 'Daily Loom Output' : 'Active Production Progress'}
              </h2>
              <button
                type="button"
                className="db-card-action-btn"
                onClick={() => onNavigateTab('production')}
                title="View Production Telemetry"
              >
                <MoreVertical size={15} />
              </button>
            </div>

            {hasCumulativeMetrics ? (
              <>
                <div className="db-daily-limit-info">
                  <span>
                    {(cumulativeProducedMeters || 0).toLocaleString()}m produced of{' '}
                    {(cumulativeTargetMeters || 0).toLocaleString()}m target
                  </span>
                  <span className="db-daily-limit-percent">{productionProgressPct}%</span>
                </div>

                <div className="db-progress-track">
                  <div
                    className="db-progress-fill"
                    style={{ width: `${productionProgressPct}%`, background: '#79B4B7' }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                    color: '#6b7280',
                    marginTop: 6
                  }}
                >
                  <span>
                    {ordersSummary?.production?.activeProductionOrders ??
                      productionBoard?.summary?.totalActiveOrders ??
                      0}{' '}
                    Active Orders (Cumulative)
                  </span>
                  <span style={{ color: '#18191B', fontWeight: 600 }}>
                    {isDemo ? 'Sheds A & B Online' : "Today's Output: Unavailable"}
                  </span>
                </div>
              </>
            ) : isDemo ? (
              <>
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                    color: '#6b7280',
                    marginTop: 6
                  }}
                >
                  <span>Pacing: 142 m/hr</span>
                  <span style={{ color: '#18191B', fontWeight: 600 }}>Sheds A & B Online</span>
                </div>
              </>
            ) : (
              <div style={{ padding: '12px 0', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                <div>Production Metrics Unavailable</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                  Daily shift output is not provided by backend; cumulative target unset.
                </div>
              </div>
            )}
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
            <div className="db-saving-total-val">
              {totalActivePipelineVolume > 0
                ? `${totalActivePipelineVolume.toLocaleString()} metres`
                : isDemo
                ? '18,500 metres'
                : 'Unavailable'}
            </div>

            <div className="db-saving-plans-list">
              {productionBatches.length === 0 ? (
                <div style={{ padding: '18px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  No active production batches in progress.
                </div>
              ) : (
                productionBatches.map((batch) => (
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
                        <span className="db-plan-item-name">
                          {batch.clientName} ({batch.orderId})
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: '#52796f', fontWeight: 600 }}>
                        {batch.phase}
                      </span>
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
                          background:
                            batch.percentage >= 70
                              ? '#79B4B7'
                              : batch.percentage >= 40
                              ? '#5A5A5A'
                              : '#f59e0b'
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================
            COLUMN 2: CENTER WIDGETS
            =================================================================== */}
        <div className="db-col-center">
          {/* Top 3 KPI Summary Cards */}
          <div className="db-kpi-grid">
            {/* KPI 1: Total Order Value */}
            <div
              className="db-kpi-card"
              onClick={() => onNavigateTab('quotations')}
              style={{ cursor: 'pointer' }}
            >
              <div className="db-kpi-card-top">
                <div className="db-kpi-icon-badge">
                  <DollarSign size={17} />
                </div>
                <button type="button" className="db-card-action-btn">
                  <MoreVertical size={15} />
                </button>
              </div>

              <div className="db-kpi-pill db-kpi-pill-green">
                <TrendingUp size={11} />
                {ordersCountText}
              </div>

              <div className="db-kpi-value">{totalOrderValueLakhs}</div>
              <div className="db-kpi-label">Total Order Value</div>
            </div>

            {/* KPI 2: Expected Profit */}
            <div
              className="db-kpi-card"
              onClick={() => onNavigateTab('orders')}
              style={{ cursor: 'pointer' }}
            >
              <div className="db-kpi-card-top">
                <div className="db-kpi-icon-badge">
                  <CreditCard size={17} />
                </div>
                <button type="button" className="db-card-action-btn">
                  <MoreVertical size={15} />
                </button>
              </div>

              <div className="db-kpi-pill db-kpi-pill-green">
                <TrendingUp size={11} />
                {marginPillText}
              </div>

              <div className="db-kpi-value">{expectedProfitDisplay}</div>
              <div className="db-kpi-label">Expected Net Profit</div>
            </div>

            {/* KPI 3: Active Orders On-Track Rate */}
            <div
              className="db-kpi-card"
              onClick={() => onNavigateTab('orders')}
              style={{ cursor: 'pointer' }}
            >
              <div className="db-kpi-card-top">
                <div className="db-kpi-icon-badge">
                  <PiggyBank size={17} />
                </div>
                <button type="button" className="db-card-action-btn">
                  <MoreVertical size={15} />
                </button>
              </div>

              <div className="db-kpi-pill db-kpi-pill-green">
                <CheckCircle2 size={11} />
                {onTrackPillText}
              </div>

              <div className="db-kpi-value">{onTrackRateDisplay}</div>
              <div className="db-kpi-label">On-Track Rate</div>
            </div>
          </div>

          {/* Cashflow Bar Chart Card (Mill Cashflow & Pipeline Order Value) */}
          <div className="db-card db-cashflow-card">
            <div className="db-card-header" style={{ marginBottom: 4 }}>
              <h2 className="db-card-title">Mill Cashflow & Pipeline Order Value</h2>
              <div className="db-dropdown-pill">
                FY 2026 <ChevronDown size={12} />
              </div>
            </div>

            <div className="db-cashflow-subhead">
              <div>
                <div className="db-cashflow-balance-lbl">Cumulative Pipeline Order Value</div>
                <div className="db-cashflow-balance-val">{pipelineOrderValueExact}</div>
              </div>

              {isDemo && cashflowData.length > 0 && (
                <div className="db-cashflow-legend">
                  <div className="db-legend-item">
                    <span className="db-legend-box" style={{ background: '#79B4B7' }} />
                    <span>Order Value (₹)</span>
                  </div>
                  <div className="db-legend-item">
                    <span className="db-legend-box" style={{ background: '#5A5A5A' }} />
                    <span>Material & Opex (₹)</span>
                  </div>
                </div>
              )}
            </div>

            {/* 12-Month Dual Bi-Directional Bar Chart */}
            {isDemo && cashflowData.length > 0 ? (
              <div className="db-cashflow-chart-container">
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

                <div className="db-chart-columns-wrap">
                  {cashflowData.map((item, idx) => {
                    const isHovered = hoveredMonthIndex === idx;
                    const incomeHeight = Math.max(12, Math.round((item.income / 8000) * 45));
                    const expenseHeight = Math.max(10, Math.round((item.expense / 8000) * 45));

                    return (
                      <div
                        key={item.month}
                        className={`db-month-col ${isHovered ? 'is-active' : ''}`}
                        onMouseEnter={() => setHoveredMonthIndex(idx)}
                        onClick={() => setHoveredMonthIndex(idx)}
                      >
                        {isHovered && activeCashflow && (
                          <div className="db-chart-tooltip">
                            <span className="db-tooltip-title">{activeCashflow.fullMonth}</span>
                            <div className="db-tooltip-row">
                              <span>Order Value:</span>
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
            ) : (
              <div
                className="db-cashflow-chart-container"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 180
                }}
              >
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: 16 }}>
                  <Activity size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                  <div style={{ fontWeight: 600, color: '#334155' }}>
                    Monthly Cashflow Time-Series Unavailable
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    No backend time-series cashflow endpoint is available. Cumulative pipeline order value: {pipelineOrderValueExact}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Unified Modern Table: Factory Orders & POs */}
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
                  onClick={() => setTableTab((prev) => (prev === 'all' ? 'on_track' : 'all'))}
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
                              className={`status-dot-pill ${
                                tx.status === 'Completed'
                                  ? 'fulfilled'
                                  : tx.status === 'Pending'
                                  ? 'pending'
                                  : 'failed'
                              }`}
                            >
                              {tx.statusPillText}
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

            {/* Income / Expense Toggle Tabs */}
            <div className="db-stat-tabs-row">
              <button
                type="button"
                className={`db-stat-tab-btn ${statTab === 'income' ? 'is-active' : ''}`}
                onClick={() => setStatTab('income')}
              >
                By Order Value ({totalOrderValueLakhs})
              </button>
              <button
                type="button"
                className={`db-stat-tab-btn ${statTab === 'expense' ? 'is-active' : ''}`}
                onClick={() => setStatTab('expense')}
              >
                Cost Centers ({costCentersTotal})
              </button>
            </div>

            {/* Circular Donut Ring */}
            <div className="db-donut-center-wrap">
              <svg width="140" height="140" viewBox="0 0 140 140" className="db-donut-svg">
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  stroke="#e8efe9"
                  strokeWidth="14"
                />
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
                  {statTab === 'income' ? 'Total Order Value' : 'Total Stock Cost'}
                </span>
                <span className="db-donut-val">
                  {statTab === 'income' ? totalOrderValueLakhs : costCentersTotal}
                </span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="db-breakdown-list">
              {statTab === 'income' ? (
                isDemo ? (
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
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    <div>Fabric Category Order Value Allocation Unavailable</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Backend does not provide category-wise order value aggregation.
                    </div>
                  </div>
                )
              ) : (
                stockSummary?.byGroup && Object.keys(stockSummary.byGroup).length > 0 ? (
                  Object.entries(stockSummary.byGroup).map(([groupKey, groupData]: [string, any], idx) => {
                    const colors = ['#79B4B7', '#9D9D9D', '#5A5A5A', '#d97706', '#2563eb'];
                    const bg = colors[idx % colors.length];
                    return (
                      <div key={groupKey} className="db-breakdown-row">
                        <div className="db-breakdown-left">
                          <span
                            className="db-percent-badge"
                            style={{ background: bg, color: '#FEFBF3', textTransform: 'capitalize' }}
                          >
                            {groupData.count || 0} items
                          </span>
                          <span className="db-breakdown-name" style={{ textTransform: 'capitalize' }}>
                            {groupKey} Material Group
                          </span>
                        </div>
                        <span className="db-breakdown-val">
                          {(groupData.totalStock || 0).toLocaleString()} units
                        </span>
                      </div>
                    );
                  })
                ) : isDemo ? (
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
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    <div>Cost Centers Inventory Breakdown Unavailable</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Stock inventory summary data is currently not available.
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Card 2: Recent Mill Activity & Agent Telemetry Feed */}
          <div className="db-card">
            <div className="db-card-header">
              <h2 className="db-card-title">Mill Telemetry & Activity</h2>
              <button
                type="button"
                className="db-card-action-btn"
                onClick={() => onNavigateTab('audit')}
                title="View Full Audit Log"
              >
                <Activity size={15} />
              </button>
            </div>

            {activities.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                No recent activity logged in system.
              </div>
            ) : (
              <>
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
                {activities.some((a) => a.section === 'Yesterday') && (
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
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          USER NOTIFICATIONS SLIDE-OVER DRAWER
          Direct operational alerts for this administrator account
          ===================================================================== */}
      {showNotificationDrawer && (
        <div className="db-drawer-backdrop" onClick={() => setShowNotificationDrawer(false)}>
          <div className="db-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="db-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color="#18191B" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#132a1e' }}>
                    User Notifications & Alerts
                  </h3>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Direct operational notifications for this account
                  </div>
                </div>
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
              {isNotificationsLoading ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  <RotateCw size={22} className="db-spin" style={{ margin: '0 auto 8px', color: '#79B4B7' }} />
                  <div>Loading user notifications...</div>
                </div>
              ) : isNotificationsError || notifications === undefined ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  <Bell size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                  <div style={{ fontWeight: 600, color: '#475569' }}>User Notifications Unavailable</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Unable to load user-scoped alerts from backend.
                  </div>
                  {refetchNotifications && (
                    <button
                      type="button"
                      onClick={() => refetchNotifications()}
                      style={{
                        marginTop: 12,
                        background: '#79B4B7',
                        color: '#18191B',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : drawerNotifications.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No direct notifications found for your account.
                </div>
              ) : (
                drawerNotifications.map((notif) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardModule;

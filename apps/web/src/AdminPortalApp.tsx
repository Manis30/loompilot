import React, { useState, useMemo, useEffect } from 'react';
import {
  useGetOrdersQuery,
  useApproveQuotationMutation,
  useRejectQuotationMutation,
  useSendQuotationMutation,
  useAssignSupervisorsMutation,
  useCancelOrderMutation,
  useRecordDeliveryMutation,
  useRecordManualReceiptMutation,
} from './store/api/ordersApi';
import {
  useGetClientsQuery,
  useGetProductsQuery,
  useGetMaterialsQuery,
  useGetUsersQuery,
  useGetMachinesQuery,
} from './store/api/catalogApi';
import { useGetOrdersSummaryQuery, useGetAuditLogsQuery } from './store/api/dashboardApi';
import { useGetProductionBoardQuery, useGetSupervisorNotificationsQuery } from './store/api/productionApi';
import { useGetStockSummaryQuery } from './store/api/stockApi';
import { mapApiOrderToAdminOrder } from './utils/orderMapper';
import { useGetMeQuery, useLogoutStaffMutation } from './store/api/authApi';
import { useAppDispatch } from './store/hooks';
import { logout as authLogout } from './store/slices/authSlice';
import { AdminLogin } from './components/auth/AdminLogin';
import { AdminSidebar, type AdminNavTab } from './components/layout/AdminSidebar';

import { AdminDashboardModule } from './components/modules/AdminDashboardModule';
import { OrderPipelineModule } from './components/modules/OrderPipelineModule';
import { QuotationApprovalsModule } from './components/modules/QuotationApprovalsModule';
import { MaterialsProcurementModule } from './components/modules/MaterialsProcurementModule';
import { ProductionTrackingModule } from './components/modules/ProductionTrackingModule';
import { SupervisorsResourcesModule } from './components/modules/SupervisorsResourcesModule';
import { PriceCentreModule } from './components/modules/PriceCentreModule';
import { ChatEscalationsModule } from './components/modules/ChatEscalationsModule';
import { DeliveriesPaymentsModule } from './components/modules/DeliveriesPaymentsModule';
import { AIActivityAlertsModule } from './components/modules/AIActivityAlertsModule';
import { UserManagementModule } from './components/modules/UserManagementModule';
import { SettingsAuditModule } from './components/modules/SettingsAuditModule';

import { BuyMaterialsModal } from './components/modals/BuyMaterialsModal';
import { ProposeAlternativeModal } from './components/modals/ProposeAlternativeModal';
import { OrderDetailsModal } from './components/modals/OrderDetailsModal';
import { FloatingAIChatbot } from './components/layout/FloatingAIChatbot';

import {
  INITIAL_ADMIN_USER,
  INITIAL_COMMODITIES,
  INITIAL_ORDERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_AGENT_RUNS,
  INITIAL_CHAT_MESSAGES,
  INITIAL_USERS,
  INITIAL_INVITES,
  INITIAL_MATERIAL_REQUIREMENTS
} from './data/mockData';

import type {
  AdminUser,
  Order,
  MarketCommodity,
  AuditEntry,
  AgentRun,
  ChatMessage,
  DeliveryRecord,
  PaymentRecord,
  AppUser,
  UserInvite,
  UserRole,
  MaterialRequirement
} from './types';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

const getInitialAdminUser = (): AdminUser | null => {
  if (isDemo) {
    return INITIAL_ADMIN_USER;
  }
  // In normal mode, do not treat a cached user object or demo default as authenticated
  return null;
};

export const AdminPortalApp: React.FC = () => {
  // 1. Authentication State (restored only from verified admin session in normal mode)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(getInitialAdminUser);
  const dispatch = useAppDispatch();
  const [logoutStaffMutation] = useLogoutStaffMutation();

  const token = typeof window !== 'undefined' ? localStorage.getItem('loompilot_token') : null;
  const realm = typeof window !== 'undefined' ? localStorage.getItem('loompilot_realm') : null;

  // Restore session only through verified auth API with confirmed admin role
  const { data: meData, isSuccess: isMeSuccess, isError: isMeError } = useGetMeQuery(
    undefined,
    { skip: !token || realm !== 'user' }
  );

  useEffect(() => {
    if (isMeSuccess && meData) {
      const profile = (meData as any)?.profile;
      if ((meData as any)?.realm === 'user' && profile?.role === 'admin') {
        setAdminUser({
          id: profile.id || profile._id || 'admin_user',
          name: profile.name || 'Managing Director',
          email: profile.email || '',
          role: 'admin',
          title: 'Managing Director & Operations Head',
          unit: 'LoomPilot Textile Mills',
          avatar: profile.avatarUrl || '/assets/avatar.svg',
        });
      } else if (!isDemo) {
        setAdminUser(null);
      }
    } else if (isMeError && !isDemo) {
      setAdminUser(null);
      try {
        localStorage.removeItem('loompilot_token');
        localStorage.removeItem('loompilot_user');
        localStorage.removeItem('loompilot_realm');
      } catch {}
    }
  }, [isMeSuccess, isMeError, meData]);

  // 2. Navigation & Selection State
  const [currentTab, setCurrentTab] = useState<AdminNavTab>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Live RTK Query hooks for Backend persistence
  const { data: ordersResponse, refetch: refetchOrders } = useGetOrdersQuery(undefined);
  const { data: clientsResponse } = useGetClientsQuery(undefined);
  const { data: productsResponse } = useGetProductsQuery(undefined);
  const { data: usersResponse } = useGetUsersQuery(undefined);

  // Live Dashboard aggregate hooks
  const {
    data: ordersSummaryData,
    isLoading: isOrdersSummaryLoading,
    isError: isOrdersSummaryError,
    refetch: refetchOrdersSummary,
  } = useGetOrdersSummaryQuery(undefined);

  const {
    data: productionBoardData,
    isLoading: isProductionBoardLoading,
    refetch: refetchProductionBoard,
  } = useGetProductionBoardQuery();

  const {
    data: stockSummaryData,
    isLoading: isStockSummaryLoading,
    refetch: refetchStockSummary,
  } = useGetStockSummaryQuery();

  const {
    data: machinesData,
    isLoading: isMachinesLoading,
    refetch: refetchMachines,
  } = useGetMachinesQuery({ limit: 100 });

  const {
    data: auditLogsData,
    isLoading: isAuditLogsLoading,
  } = useGetAuditLogsQuery({ limit: 20 });

  const {
    data: notificationsData,
    isLoading: isNotificationsLoading,
    isError: isNotificationsError,
    refetch: refetchNotifications,
  } = useGetSupervisorNotificationsQuery(undefined, { skip: isDemo });

  const [approveQuotationMutation] = useApproveQuotationMutation();
  const [rejectQuotationMutation] = useRejectQuotationMutation();
  const [sendQuotationMutation] = useSendQuotationMutation();
  const [assignSupervisorsMutation] = useAssignSupervisorsMutation();
  const [cancelOrderMutation] = useCancelOrderMutation();
  const [recordDeliveryMutation] = useRecordDeliveryMutation();
  const [recordManualReceiptMutation] = useRecordManualReceiptMutation();

  const clientsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = clientsResponse?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((c: any) => {
        if (c.id || c._id) map.set(String(c.id || c._id), c);
      });
    }
    return map;
  }, [clientsResponse]);

  const productsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = productsResponse?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((p: any) => {
        if (p.id || p._id) map.set(String(p.id || p._id), p);
      });
    }
    return map;
  }, [productsResponse]);

  const usersMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = usersResponse?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((u: any) => {
        if (u.id || u._id) map.set(String(u.id || u._id), u);
      });
    }
    return map;
  }, [usersResponse]);

  // 3. Operational State
  const [orders, setOrders] = useState<Order[]>(isDemo ? INITIAL_ORDERS : []);

  useEffect(() => {
    const raw = ordersResponse?.data || [];
    if (Array.isArray(raw)) {
      if (raw.length > 0) {
        const mapped = raw.map((item) => mapApiOrderToAdminOrder(item, clientsMap, productsMap, usersMap));
        setOrders(mapped);
      } else if (!isDemo) {
        setOrders([]);
      }
    }
  }, [ordersResponse, clientsMap, productsMap, usersMap]);

  useEffect(() => {
    const rawUsers = usersResponse?.data || [];
    if (Array.isArray(rawUsers) && rawUsers.length > 0) {
      setUsers(
        rawUsers.map((u: any) => ({
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          departmentOrCompany: u.processAreas?.join(', ') || 'Operations',
          status: (u.status === 'inactive' ? 'suspended' : 'active') as 'active' | 'invited' | 'suspended',
        }))
      );
    }
  }, [usersResponse]);
  const [commodities] = useState<MarketCommodity[]>(isDemo ? INITIAL_COMMODITIES : []);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>(isDemo ? INITIAL_AUDIT_LOGS : []);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>(isDemo ? INITIAL_AGENT_RUNS : []);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(isDemo ? INITIAL_CHAT_MESSAGES : {});
  const [users, setUsers] = useState<AppUser[]>(isDemo ? INITIAL_USERS : []);
  const [invites, setInvites] = useState<UserInvite[]>(isDemo ? INITIAL_INVITES : []);
  const [materials, setMaterials] = useState<MaterialRequirement[]>(isDemo ? INITIAL_MATERIAL_REQUIREMENTS : []);

  // 4. Modal Dialogs State
  const [modalBuyOrder, setModalBuyOrder] = useState<Order | null>(null);
  const [modalAltOrder, setModalAltOrder] = useState<Order | null>(null);
  const [modalInspectorOrder, setModalInspectorOrder] = useState<Order | null>(null);

  // 5. Toast Message State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const addAuditLog = (action: string, details: string, orderId?: string) => {
    const entry: AuditEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actor: adminUser?.name || 'Admin',
      action,
      orderId,
      details
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const addAgentRun = (
    agentName: AgentRun['agentName'],
    status: AgentRun['status'],
    summary: string,
    orderId?: string
  ) => {
    const run: AgentRun = {
      id: `run_${Date.now()}`,
      agentName,
      status,
      durationMs: Math.floor(600 + Math.random() * 900),
      orderId,
      summary,
      timestamp: 'Just now'
    };
    setAgentRuns((prev) => [run, ...prev]);
  };

  // Notification Counts
  const pendingQuotesCount = orders.filter((o) => o.quotation && !o.quotation.adminApproved).length;
  const openEscalationsCount = orders.filter((o) => o.discountEscalation?.status === 'open').length;
  const surgeAlertsCount = commodities.filter((c) => c.isSurge).length;

  // =========================================================================
  // SIMULATION HANDLERS (Optional / Internal)
  // =========================================================================

  // Simulation handlers available for debug/automated flows if required

  // =========================================================================
  // QUOTATION & REVISION HANDLERS
  // =========================================================================

  const handleApproveQuotation = async (orderId: string, editedMargin?: number) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const realId = targetOrder?.backendId || orderId;

    if (!isDemo && (!realId || realId.length !== 24)) {
      showToast(`Cannot approve quotation: Order ${orderId} does not exist on server.`);
      throw new Error(`Order ${orderId} is not a valid server record.`);
    }

    try {
      if (realId && realId.length === 24) {
        await approveQuotationMutation({
          id: realId,
          body: {
            action: 'approve',
            editedMarginPercent: editedMargin ?? targetOrder?.quotation?.marginPercent ?? 18,
            notes: `Admin approved quotation with ${editedMargin ?? 18}% margin.`,
          },
        }).unwrap();

        await refetchOrders();
      } else if (isDemo) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId && o.quotation) {
              const margin = editedMargin !== undefined ? editedMargin : o.quotation.marginPercent;
              const costBefore =
                o.quotation.materialCost +
                o.quotation.processingCost +
                o.quotation.overheadCost +
                o.quotation.priceRiskBuffer;
              const newTotal = Math.round(costBefore / (1 - margin / 100));
              const newUnit = +(newTotal / o.quantityMeters).toFixed(2);

              return {
                ...o,
                status: 'quotation_sent',
                currentPhase: 'Quotation Sent to Client',
                quotation: {
                  ...o.quotation,
                  marginPercent: margin,
                  totalPrice: newTotal,
                  pricePerUnit: newUnit,
                  adminApproved: true,
                  status: 'approved',
                },
              };
            }
            return o;
          })
        );
      }

      addAuditLog(
        'QUOTATION_APPROVED',
        `Admin approved quotation for ${orderId}. Client-safe PDF generated and dispatched.`,
        orderId
      );
      addAgentRun(
        'Quotation Agent',
        'SUCCESS',
        `Quotation for ${orderId} approved by Admin.`,
        orderId
      );
      showToast(`Quotation approved! Order ${orderId} approved with ${editedMargin || 18}% margin.`);
    } catch (err: any) {
      const errMsg =
        err?.data?.message || err?.error || err?.message || 'Failed to approve quotation on server.';
      showToast(`Quotation approval failed: ${errMsg}`);
      throw err;
    }
  };

  const handleRejectQuotation = async (orderId: string, reason: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const realId = targetOrder?.backendId || orderId;

    if (!isDemo && (!realId || realId.length !== 24)) {
      showToast(`Cannot reject quotation: Order ${orderId} does not exist on server.`);
      throw new Error(`Order ${orderId} is not a valid server record.`);
    }

    try {
      if (realId && realId.length === 24) {
        await rejectQuotationMutation({
          id: realId,
          reason,
          notes: `Admin rejected quotation: ${reason}`,
        }).unwrap();

        await refetchOrders();
      } else if (isDemo) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId && o.quotation) {
              return {
                ...o,
                status: 'rejected_by_admin',
                currentPhase: 'Quotation Rejected',
                quotation: {
                  ...o.quotation,
                  adminApproved: false,
                  status: 'rejected',
                  rejectionReason: reason,
                },
              };
            }
            return o;
          })
        );
      }

      addAuditLog('QUOTATION_REJECTED', `Quotation for ${orderId} rejected by Admin. Reason: ${reason}`, orderId);
      showToast(`Quotation for ${orderId} rejected by Admin.`);
    } catch (err: any) {
      const errMsg =
        err?.data?.message || err?.error || err?.message || 'Failed to reject quotation on server.';
      showToast(`Quotation rejection failed: ${errMsg}`);
      throw err;
    }
  };

  const handleApprovePriceRevision = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId && o.priceRevision) {
          return {
            ...o,
            priceRevision: {
              ...o.priceRevision,
              adminApproved: true,
              status: 'approved'
            }
          };
        }
        return o;
      })
    );

    addAuditLog('PRICE_REVISION_APPROVED', `Admin approved price revision for ${orderId}. Client notified with approved reason.`, orderId);
    addAgentRun('Market Price Agent', 'SUCCESS', `Revision for ${orderId} approved by Admin. Client notified.`, orderId);
    showToast(`Price revision approved! Client notified for order ${orderId} with client-safe explanation.`);
  };

  const handleRejectPriceRevision = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return { ...o, priceRevision: undefined };
        }
        return o;
      })
    );

    addAuditLog('PRICE_REVISION_REJECTED', `Admin rejected price revision for ${orderId}. Mill absorbed price hike.`, orderId);
    showToast(`Price revision rejected. Mill will absorb material surge for order ${orderId}.`);
  };

  // =========================================================================
  // HANDOVER & RECOVERY HANDLERS
  // =========================================================================

  const handleConfirmHandover = async (orderId: string, supervisorId: string, supervisorName: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const realId = targetOrder?.backendId || orderId;
    try {
      await assignSupervisorsMutation({
        id: realId,
        body: { supervisorIds: [supervisorId] },
      }).unwrap();

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: 'in_production',
              currentPhase: 'Loom Weaving Shed A',
              assignedSupervisorId: supervisorId,
              assignedSupervisorName: supervisorName,
              handoverDate: '2026-10-29',
              productionPlanConfirmed: true
            };
          }
          return o;
        })
      );

      addAuditLog('ORDER_HANDOVER', `Admin handed over ${orderId} to supervisor ${supervisorName}. Stock reserved.`, orderId);
      addAgentRun('Monitoring Agent', 'SUCCESS', `Order ${orderId} entered in_production. Monitoring snapshots active.`, orderId);
      showToast(`Order ${orderId} successfully assigned to ${supervisorName}!`);
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.error || err?.message || 'Failed to assign supervisor on server.';
      showToast(`Supervisor assignment failed: ${errMsg}`);
    }
  };

  const handleConfirmPurchase = (orderId: string, supplier: string, quantityKg: number, totalCost: number) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'quotation_drafting',
            currentPhase: 'Quotation Drafting (Yarn Purchased)',
            feasibility: o.feasibility
              ? {
                  ...o.feasibility,
                  verdict: 'feasible',
                  eta: '2026-11-14',
                  bottleneckProcess: 'Yarn Secured from Vardhman (2d Lead Time)',
                  recoveryOptions: [],
                  llmSummary: `Purchase decision executed with ${supplier} for ${quantityKg.toLocaleString()} kg ($${totalCost.toLocaleString()}). Material ETA Nov 14 provides feasible window.`
                }
              : undefined,
            quotation: {
              id: `quote_${orderId}`,
              orderId,
              version: 1,
              materialCost: 28500,
              wastagePercent: 4.0,
              processingCost: 11200,
              overheadCost: 3500,
              priceRiskBuffer: 2100,
              marginPercent: 18.0,
              pricePerUnit: 3.85,
              totalPrice: Math.round(3.85 * o.quantityMeters),
              validUntil: '2026-11-15',
              etaBasis: '14 Nov 2026 (Includes 2-day yarn transport)',
              adminApproved: false,
              status: 'pending_approval',
              bomItems: [],
              explanation: 'Quotation prepared incorporating fast-track yarn purchase decision.'
            }
          };
        }
        return o;
      })
    );

    addAuditLog('PURCHASE_DECISION_EXECUTED', `Admin purchased ${quantityKg}kg yarn from ${supplier} ($${totalCost}). Feasibility re-run: FEASIBLE.`, orderId);
    addAgentRun('Feasibility Agent', 'SUCCESS', `Order ${orderId} re-evaluated with supplier delivery date. Verdict: FEASIBLE.`, orderId);
    showToast(`Purchase decision confirmed! Feasibility re-run: Order ${orderId} is now FEASIBLE.`);
  };

  const handleConfirmAlternative = (orderId: string, altDate: string, splitDesc: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'quotation_drafting',
            deadlineDate: altDate,
            currentPhase: 'Alternative Counter-Offer Drafted',
            quotation: {
              id: `quote_${orderId}_alt`,
              orderId,
              version: 1,
              materialCost: 26000,
              wastagePercent: 3.5,
              processingCost: 10500,
              overheadCost: 3200,
              priceRiskBuffer: 1800,
              marginPercent: 18.0,
              pricePerUnit: 3.65,
              totalPrice: Math.round(3.65 * o.quantityMeters),
              validUntil: '2026-11-12',
              etaBasis: `${altDate} (${splitDesc})`,
              adminApproved: false,
              status: 'pending_approval',
              bomItems: [],
              explanation: `Counter-offer with revised completion date ${altDate}.`
            }
          };
        }
        return o;
      })
    );

    addAuditLog('ALTERNATIVE_PROPOSED', `Admin proposed alternative completion date ${altDate} for ${orderId}.`, orderId);
    showToast(`Alternative date ${altDate} drafted for client.`);
  };

  const handleDeclineOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const realId = targetOrder?.backendId || orderId;
    try {
      await cancelOrderMutation({
        id: realId,
        body: { reason: 'Admin declined infeasible order' },
      }).unwrap();

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return { ...o, status: 'rejected_by_admin', currentPhase: 'Order Declined' };
          }
          return o;
        })
      );
      addAuditLog('ORDER_DECLINED', `Admin declined infeasible order ${orderId} with client-safe wording.`, orderId);
      showToast(`Order ${orderId} declined with polite client-safe wording.`);
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.error || err?.message || 'Failed to cancel order on server.';
      showToast(`Order decline failed: ${errMsg}`);
    }
  };

  // =========================================================================
  // DELIVERIES & PAYMENTS HANDLERS
  // =========================================================================

  const handleRecordDelivery = async (
    orderId: string,
    delivery: Omit<DeliveryRecord, 'id'> & { invoiceAmount?: number }
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const realId = targetOrder?.backendId || orderId;

    if (
      typeof delivery.quantityMeters !== 'number' ||
      !Number.isFinite(delivery.quantityMeters) ||
      delivery.quantityMeters <= 0
    ) {
      const errMsg = 'Delivery quantity must be a positive, finite number.';
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const invoiceNo = (delivery.invoiceNumber || '').trim();
    if (!invoiceNo) {
      const errMsg = 'Invoice / Gate pass number is required.';
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const alreadyDelivered =
      targetOrder?.deliveredMeters ??
      (targetOrder?.deliveries || []).reduce((s, d) => s + d.quantityMeters, 0);
    const remainingQty = (targetOrder?.quantityMeters ?? 0) - alreadyDelivered;
    if (remainingQty > 0 && delivery.quantityMeters > remainingQty) {
      const errMsg = `Delivery quantity (${delivery.quantityMeters.toLocaleString()}m) exceeds remaining unfulfilled quantity (${remainingQty.toLocaleString()}m).`;
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    // Duplicate check on already recorded deliveries for this order
    const isDuplicate = (targetOrder?.deliveries || []).some(
      (d) => d.invoiceNumber.trim().toLowerCase() === invoiceNo.toLowerCase()
    );
    if (isDuplicate) {
      const errMsg = `Invoice #${invoiceNo} has already been recorded for this order.`;
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    // Determine authoritative invoice amount according to backend contract
    let finalInvoiceAmount: number | undefined;
    if (delivery.invoiceAmount !== undefined) {
      if (
        typeof delivery.invoiceAmount !== 'number' ||
        !Number.isFinite(delivery.invoiceAmount) ||
        delivery.invoiceAmount <= 0
      ) {
        const errMsg = 'Delivery invoice amount must be a positive, finite number.';
        showToast(`Delivery record failed: ${errMsg}`);
        throw new Error(errMsg);
      }
      finalInvoiceAmount = delivery.invoiceAmount;
    } else if (targetOrder?.quotation?.pricePerUnit && targetOrder.quotation.pricePerUnit > 0) {
      finalInvoiceAmount = +(delivery.quantityMeters * targetOrder.quotation.pricePerUnit).toFixed(2);
    } else if (targetOrder?.quotation?.totalPrice && targetOrder.quotation.totalPrice > 0) {
      finalInvoiceAmount = targetOrder.quotation.totalPrice;
    }

    if (
      typeof finalInvoiceAmount !== 'number' ||
      !Number.isFinite(finalInvoiceAmount) ||
      finalInvoiceAmount <= 0
    ) {
      const errMsg =
        'Delivery invoice amount must be positive and finite. Please specify an invoice amount or ensure order quotation rate is available.';
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const invoiceAmountPaise = Math.round(finalInvoiceAmount * 100);
    if (!Number.isSafeInteger(invoiceAmountPaise) || invoiceAmountPaise <= 0) {
      const errMsg = 'Delivery invoice amount in paise must be a valid positive integer.';
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const previousInvoicedPaise = (targetOrder?.deliveries || []).reduce(
      (sum, d) => sum + Math.round((d.invoiceAmount || 0) * 100),
      0
    );
    const orderTotalPaise = targetOrder?.quotation?.totalPrice
      ? Math.round(targetOrder.quotation.totalPrice * 100)
      : 0;

    if (orderTotalPaise > 0 && previousInvoicedPaise + invoiceAmountPaise > orderTotalPaise) {
      const remainingAmount = ((orderTotalPaise - previousInvoicedPaise) / 100).toFixed(2);
      const errMsg = `Cumulative invoice amount exceeds total order value. Maximum remaining invoice amount is ₹${remainingAmount}.`;
      showToast(`Delivery record failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const idempotencyKey = `idem-del-${realId}-${invoiceNo}`;

    try {
      if (realId && realId.length === 24) {
        await recordDeliveryMutation({
          id: realId,
          body: {
            deliveryDate: delivery.date || new Date().toISOString().split('T')[0],
            qty: delivery.quantityMeters,
            invoiceNo,
            invoiceAmountPaise,
            carrier: delivery.carrier?.trim() || undefined,
            notes: delivery.notes || (delivery.carrier ? `Dispatched via ${delivery.carrier.trim()}` : undefined),
          },
          idempotencyKey,
        }).unwrap();

        // Refetch authoritative order from server to derive displayed records
        await refetchOrders();
      } else if (isDemo) {
        const record: DeliveryRecord = { ...delivery, id: `del_${Date.now()}` };
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId) {
              return { ...o, deliveries: [...o.deliveries, record] };
            }
            return o;
          })
        );
      } else {
        const errMsg = `Cannot record delivery: Order ${orderId} does not exist on server.`;
        showToast(errMsg);
        throw new Error(errMsg);
      }

      addAuditLog(
        'DELIVERY_RECORDED',
        `Logged dispatch of ${delivery.quantityMeters}m for ${orderId}. Invoice: ${invoiceNo}`,
        orderId
      );
      showToast(`Delivery recorded for ${orderId} (${delivery.quantityMeters}m).`);
    } catch (err: any) {
      const errMsg =
        err?.data?.error?.message ||
        err?.data?.message ||
        err?.error ||
        err?.message ||
        'Failed to record delivery on server.';
      showToast(`Delivery record failed: ${errMsg}`);
      throw err;
    }
  };

  const handleRecordPayment = async (
    orderId: string,
    payment: Omit<PaymentRecord, 'id'> & { milestoneIndex?: number; ref?: string; method?: string }
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const realId = targetOrder?.backendId || orderId;

    if (!payment.amount || payment.amount <= 0) {
      const errMsg = 'Payment amount must be a positive number.';
      showToast(`Payment receipt failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const ref = (payment.ref || payment.invoiceNumber || '').trim();
    if (!ref) {
      const errMsg = 'Payment reference / receipt number is required.';
      showToast(`Payment receipt failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const milestoneIndex = payment.milestoneIndex !== undefined ? payment.milestoneIndex : 0;
    const amountPaise = Math.round(payment.amount * 100);

    // Validate positive amount against selected milestone outstanding balance
    const milestone = targetOrder?.financials?.milestones?.[milestoneIndex];
    if (milestone) {
      const currentReceived = milestone.receivedPaise || 0;
      const remainingDuePaise = Math.max(0, milestone.amountPaise - currentReceived);
      if (remainingDuePaise <= 0) {
        const errMsg = `Milestone '${milestone.milestone}' is already fully paid.`;
        showToast(`Payment receipt failed: ${errMsg}`);
        throw new Error(errMsg);
      }
      if (amountPaise > remainingDuePaise) {
        const errMsg = `Payment amount ($${payment.amount.toLocaleString()}) exceeds remaining due ($${(remainingDuePaise / 100).toLocaleString()}) for milestone '${milestone.milestone}'.`;
        showToast(`Payment receipt failed: ${errMsg}`);
        throw new Error(errMsg);
      }
    }

    const idempotencyKey = `idem-pay-${realId}-${milestoneIndex}-${ref}`;

    try {
      if (realId && realId.length === 24) {
        await recordManualReceiptMutation({
          id: realId,
          body: {
            milestoneIndex,
            amountPaise,
            ref,
            method: (payment.method as any) || 'neft',
            notes: `Payment receipt recorded for reference ${ref}`,
          },
          idempotencyKey,
        }).unwrap();

        // Refetch authoritative order from server to derive displayed records
        await refetchOrders();
      } else if (isDemo) {
        const record: PaymentRecord = { ...payment, id: `pay_${Date.now()}` };
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId) {
              return { ...o, payments: [...o.payments, record] };
            }
            return o;
          })
        );
      } else {
        const errMsg = `Cannot record payment: Order ${orderId} does not exist on server.`;
        showToast(errMsg);
        throw new Error(errMsg);
      }

      addAuditLog(
        'PAYMENT_RECORDED',
        `Recorded payment receipt of $${payment.amount.toLocaleString()} for ${orderId}. Ref: ${ref}`,
        orderId
      );
      showToast(`Payment receipt of $${payment.amount.toLocaleString()} logged.`);
    } catch (err: any) {
      const errMsg =
        err?.data?.error?.message ||
        err?.data?.message ||
        err?.error ||
        err?.message ||
        'Failed to record payment on server.';
      showToast(`Payment receipt failed: ${errMsg}`);
      throw err;
    }
  };

  // =========================================================================
  // CHAT & ESCALATION HANDLERS
  // =========================================================================

  const handleSendChatMessage = (orderId: string, content: string) => {
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'admin',
      senderName: adminUser?.name || 'John Doe (MD)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content
    };

    setChatMessages((prev) => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), newMsg]
    }));

    addAuditLog('ADMIN_CHAT_REPLY', `Admin replied in client conversation for ${orderId}.`, orderId);
    showToast(`Reply sent to client on ${orderId}.`);
  };

  const handleResolveEscalation = (orderId: string, approved: boolean, concessionPercent?: number) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId && o.discountEscalation) {
          return {
            ...o,
            discountEscalation: {
              ...o.discountEscalation,
              status: approved ? 'resolved' : 'declined'
            }
          };
        }
        return o;
      })
    );

    const replyText = approved
      ? `Managing Director John Doe has reviewed your account and authorized a ${concessionPercent}% concession on order ${orderId} in appreciation of your seasonal partnership!`
      : `Managing Director John Doe has reviewed your request. Due to locked raw material costs, we cannot grant the discount, but we are prioritizing your shipment on Airjet Shed A.`;

    handleSendChatMessage(orderId, replyText);
    addAuditLog('DISCOUNT_ESCALATION_RESOLVED', `Admin ${approved ? 'approved' : 'declined'} concession for ${orderId}.`, orderId);
    showToast(`Escalation ${approved ? 'approved' : 'declined'} for order ${orderId}.`);
  };

  // =========================================================================
  // USER INVITATION & REGISTRATION HANDLERS (ADMIN ONLY AUTHORITY)
  // =========================================================================

  const handleAddInvite = (inviteData: Omit<UserInvite, 'id' | 'inviteToken' | 'inviteLink' | 'createdAt' | 'expiresAt' | 'status'>): UserInvite => {
    const token = `inv_${Math.random().toString(36).substring(2, 11)}`;
    const newInvite: UserInvite = {
      ...inviteData,
      id: `inv_${Date.now()}`,
      inviteToken: token,
      inviteLink: `http://localhost:5173/register?token=${token}`,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending'
    };
    setInvites((prev) => [newInvite, ...prev]);
    addAuditLog('USER_INVITE_GENERATED', `Admin generated invite for ${inviteData.name} (${inviteData.role.toUpperCase()} - ${inviteData.email})`);
    showToast(`Invite created for ${inviteData.name}! Registration link is active.`);
    return newInvite;
  };

  const handleCompleteRegistration = (inviteToken: string, name: string, email: string, role: UserRole, departmentOrCompany: string) => {
    // 1. Mark invite accepted
    setInvites((prev) =>
      prev.map((inv) =>
        inv.inviteToken === inviteToken ? { ...inv, status: 'accepted' } : inv
      )
    );

    // 2. Add user to active directory
    const newUser: AppUser = {
      id: `usr_${Date.now()}`,
      name,
      email,
      role,
      departmentOrCompany,
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
      avatar: '/assets/avatar.svg'
    };

    setUsers((prev) => [newUser, ...prev]);
    addAuditLog('USER_REGISTERED', `New ${role.toUpperCase()} user ${name} registered via invite link.`);
    showToast(`Registration complete! ${name} is now active as a ${role.toUpperCase()}.`);
  };

  const handleRecordPurchaseDecision = (materialId: string, status: MaterialRequirement['status'], notes?: string) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, status } : m))
    );
    addAuditLog('PURCHASE_DECISION', `Admin marked material PO ${materialId} as ${status.toUpperCase()}. ${notes || ''}`);
    showToast(`Material PO marked ${status.toUpperCase()}.`);
  };

  const handleRerunFeasibility = (orderId: string) => {
    addAgentRun('Feasibility Agent', 'SUCCESS', `Recalculated material availability & capacity for ${orderId}.`, orderId);
    addAuditLog('FEASIBILITY_RERUN', `Admin triggered feasibility recalculation for ${orderId}.`, orderId);
    showToast(`Feasibility rerun complete for ${orderId}.`);
  };

  const handleAssignSupervisor = async (orderId: string, supervisorId: string, supervisorName: string) => {
    await handleConfirmHandover(orderId, supervisorId, supervisorName);
  };

  const handleApproveOvertime = (shedName: string) => {
    addAuditLog('OVERTIME_APPROVED', `Admin authorized +2h evening shift overtime on ${shedName}.`);
    showToast(`Overtime shift authorized on ${shedName}.`);
  };

  const handleRetryAgent = (agentName: AgentRun['agentName'], orderId?: string) => {
    addAgentRun(agentName, 'SUCCESS', `Re-executed ${agentName} analysis sweep.`, orderId);
    showToast(`${agentName} sweep re-executed.`);
  };

  const handleApproveAgentRecommendation = (runId: string) => {
    addAuditLog('AGENT_RECOMMENDATION_APPROVED', `Admin approved AI Agent recommendation (Run ID: ${runId}).`);
    showToast(`Agent recommendation approved & committed.`);
  };

  const handleRejectAgentRecommendation = (runId: string) => {
    addAuditLog('AGENT_RECOMMENDATION_DISMISSED', `Admin dismissed AI Agent alert (Run ID: ${runId}).`);
    showToast(`Agent alert dismissed.`);
  };

  // Require valid existing authentication state and an admin role before exposing admin functionality
  if (!adminUser || adminUser.role !== 'admin') {
    return <AdminLogin onLogin={(user) => setAdminUser(user)} />;
  }

  const materialShortagesCount = materials.filter((m) => m.shortageQuantity > 0).length;

  return (
    <div className="app-viewport">
      <div className="dashboard-container">
        {/* ================= 1. LEFT SIDEBAR ================= */}
        <AdminSidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            if (tab === 'orders') {
              setSelectedOrderId('');
            }
          }}
          user={adminUser}
          pendingQuotesCount={pendingQuotesCount}
          openEscalationsCount={openEscalationsCount}
          surgeAlertsCount={surgeAlertsCount}
          materialShortagesCount={materialShortagesCount}
          onLogout={() => {
            try {
              logoutStaffMutation().unwrap().catch(() => {});
            } catch {}
            dispatch(authLogout());
            try {
              localStorage.removeItem('loompilot_token');
              localStorage.removeItem('loompilot_user');
              localStorage.removeItem('loompilot_realm');
            } catch (e) {
              console.warn(e);
            }
            setAdminUser(null);
          }}
        />

        {/* ================= 2. CENTER MAIN DASHBOARD ================= */}
        <main className={`main-content ${currentTab === 'dashboard' ? 'main-content-dashboard' : ''} ${currentTab === 'orders' ? 'main-content-orders' : ''}`}>
          {/* Main Dynamic View Area */}
          <div className={`main-view-container ${currentTab === 'orders' ? 'main-view-container-orders' : ''}`}>
            {currentTab === 'dashboard' && (
              <AdminDashboardModule
                orders={orders}
                users={users}
                commodities={commodities}
                ordersSummary={ordersSummaryData?.data}
                isOrdersSummaryLoading={isOrdersSummaryLoading}
                isOrdersSummaryError={isOrdersSummaryError}
                refetchOrdersSummary={refetchOrdersSummary}
                productionBoard={productionBoardData?.data}
                isProductionBoardLoading={isProductionBoardLoading}
                refetchProductionBoard={refetchProductionBoard}
                stockSummary={stockSummaryData?.data}
                isStockSummaryLoading={isStockSummaryLoading}
                refetchStockSummary={refetchStockSummary}
                machines={machinesData?.data}
                isMachinesLoading={isMachinesLoading}
                refetchMachines={refetchMachines}
                auditLogs={auditLogsData?.data || auditLogs}
                isAuditLogsLoading={isAuditLogsLoading}
                notifications={isDemo ? undefined : (isNotificationsError ? undefined : notificationsData?.data)}
                isNotificationsLoading={isNotificationsLoading}
                isNotificationsError={isNotificationsError}
                refetchNotifications={refetchNotifications}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                onSelectOrder={(id) => setSelectedOrderId(id)}
                onOpenOrderModal={(o) => setModalInspectorOrder(o)}
                onApproveQuotation={handleApproveQuotation}
                onRejectQuotation={handleRejectQuotation}
              />
            )}

            {currentTab === 'orders' && (
              <OrderPipelineModule
                selectedOrderId={selectedOrderId}
                onSelectOrder={setSelectedOrderId}
                onOpenOrderModal={(o) => setModalInspectorOrder(o)}
                onDeclineOrder={handleDeclineOrder}
              />
            )}

            {currentTab === 'quotations' && (
              <QuotationApprovalsModule
                orders={orders}
                onSelectOrder={setSelectedOrderId}
                onApproveQuotation={handleApproveQuotation}
                onRejectQuotation={handleRejectQuotation}
              />
            )}

            {currentTab === 'procurement' && (
              <MaterialsProcurementModule
                materials={materials}
                orders={orders}
                onRecordPurchaseDecision={handleRecordPurchaseDecision}
                onRerunFeasibility={handleRerunFeasibility}
              />
            )}

            {currentTab === 'production' && (
              <ProductionTrackingModule
                orders={orders}
                supervisors={users.filter((u) => u.role === 'supervisor')}
                onSelectOrder={setSelectedOrderId}
                onOpenOrderModal={(o) => setModalInspectorOrder(o)}
                onUpdateClientProgressView={(id) => showToast(`Client progress view updated for ${id}.`)}
                onInvestigateDelay={(id) => showToast(`Fast-track recovery coordinated for ${id}.`)}
              />
            )}

            {currentTab === 'supervisors' && (
              <SupervisorsResourcesModule
                users={users}
                orders={orders}
                onAssignSupervisor={handleAssignSupervisor}
                onApproveOvertime={handleApproveOvertime}
              />
            )}

            {currentTab === 'priceCentre' && (
              <PriceCentreModule
                commodities={commodities}
                orders={orders}
                onSelectOrder={setSelectedOrderId}
                onApprovePriceRevision={handleApprovePriceRevision}
                onRejectPriceRevision={handleRejectPriceRevision}
              />
            )}

            {currentTab === 'chat' && (
              <ChatEscalationsModule
                orders={orders}
                chatMessages={chatMessages}
                onSendMessage={handleSendChatMessage}
                onResolveEscalation={handleResolveEscalation}
              />
            )}

            {currentTab === 'deliveries' && (
              <DeliveriesPaymentsModule
                orders={orders}
                onSelectOrder={setSelectedOrderId}
                onRecordDelivery={handleRecordDelivery}
                onRecordPayment={handleRecordPayment}
              />
            )}

            {currentTab === 'aiAgents' && (
              <AIActivityAlertsModule
                agentRuns={agentRuns}
                onRetryAgent={handleRetryAgent}
                onApproveAgentRecommendation={handleApproveAgentRecommendation}
                onRejectAgentRecommendation={handleRejectAgentRecommendation}
              />
            )}

            {currentTab === 'users' && (
              <UserManagementModule
                users={users}
                invites={invites}
                onAddInvite={handleAddInvite}
                onCompleteRegistration={handleCompleteRegistration}
              />
            )}

            {currentTab === 'audit' && (
              <SettingsAuditModule auditLogs={auditLogs} />
            )}
          </div>
        </main>
      </div>

      {/* ================= MODALS ================= */}
      <BuyMaterialsModal
        order={modalBuyOrder}
        onClose={() => setModalBuyOrder(null)}
        onConfirmPurchase={handleConfirmPurchase}
      />

      <ProposeAlternativeModal
        order={modalAltOrder}
        onClose={() => setModalAltOrder(null)}
        onConfirmAlternative={handleConfirmAlternative}
      />

      <OrderDetailsModal
        order={modalInspectorOrder}
        onClose={() => setModalInspectorOrder(null)}
      />

      {/* ================= GLOBAL CIRCULAR AI CHATBOT (ACTIVE ON ALL PAGES) ================= */}
      <FloatingAIChatbot
        orders={orders}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onSelectOrder={(id) => setSelectedOrderId(id)}
      />

      {/* ================= TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="toast-container">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
export default AdminPortalApp;

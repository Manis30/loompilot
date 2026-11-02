import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  SupervisorProfile,
  SupervisorOrder,
  Employee,
  RawMaterial,
  Machine,
  ProductionLog,
  IssueTicket,
  SupervisorNotification,
} from '../types/supervisor';
import {
  INITIAL_SUPERVISOR_PROFILE,
  INITIAL_SUPERVISOR_ORDERS,
  INITIAL_EMPLOYEES,
  INITIAL_RAW_MATERIALS,
  INITIAL_MACHINES,
  INITIAL_PRODUCTION_LOGS,
  INITIAL_ISSUES,
  INITIAL_SUPERVISOR_NOTIFICATIONS,
  SUPERVISOR_PRODUCTION_STAGES,
} from '../data/supervisorMockData';
import { useAppSelector } from '../../store/hooks';
import { useGetMeQuery } from '../../store/api/authApi';
import { useGetSupervisorOrdersQuery, useAdvanceOrderStageMutation } from '../../store/api/ordersApi';
import { useGetClientsQuery, useGetMaterialsQuery, useGetMachinesQuery } from '../../store/api/catalogApi';
import {
  useGetSupervisorReportsQuery,
  useSubmitSupervisorReportMutation,
  useGetMaintenanceTicketsQuery,
  useCreateMaintenanceTicketMutation,
  useGetSupervisorNotificationsQuery,
  useMarkNotificationReadMutation,
} from '../../store/api/productionApi';
import { mapApiSupervisorOrder } from '../../utils/orderMapper';
import { mapApiMachineToSupervisorMachine } from '../pages/supervisor/machineMapper';
import { mapApiMaterialToRawMaterial } from '../pages/supervisor/materialMapper';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

const mapAuthUserToSupervisorProfile = (user: {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
  processAreas?: string[];
}): SupervisorProfile => {
  const name = user.name || 'Floor Supervisor';
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SP';

  const areas =
    Array.isArray(user.processAreas) && user.processAreas.length > 0
      ? user.processAreas.join(' & ')
      : 'Weaving & Loom Shed Division';

  return {
    name,
    title: 'Production Supervisor',
    empId: user.id ? `LP-SUP-${user.id.slice(-4).toUpperCase()}` : 'LP-SUP-STAFF',
    email: user.email || '',
    phone: '+91 98765 43210',
    department: areas,
    area: `Loom Shed (${areas})`,
    shift: 'Shift A (Morning: 06:00 AM – 02:30 PM)',
    facility: 'LoomPilot Facility 1, Coimbatore Textile Hub',
    reportingTo: 'Plant Operations Desk',
    avatar: initials,
    status: 'On Shift',
    joinedDate: 'Active Staff',
    experience: 'Textile Operations',
    certifications: [
      'Master Weaver Certification (SITRA)',
      'ISO 9001:2015 Textile Quality Auditor',
    ],
  };
};

const getInitialSupervisorProfile = (): SupervisorProfile | null => {
  if (isDemoEnabled) {
    return INITIAL_SUPERVISOR_PROFILE;
  }
  try {
    const token = localStorage.getItem('loompilot_token');
    const realm = localStorage.getItem('loompilot_realm');
    const rawUser = localStorage.getItem('loompilot_user');
    if (!token || realm !== 'user' || !rawUser) {
      return null;
    }
    const parsed = JSON.parse(rawUser);
    if (parsed.role === 'supervisor') {
      return mapAuthUserToSupervisorProfile(parsed);
    }
    return null;
  } catch {
    return null;
  }
};

interface SupervisorContextType {
  profile: SupervisorProfile | null;
  orders: SupervisorOrder[];
  isOrdersLoading: boolean;
  ordersError: any;
  refetchOrders: () => void;
  employees: Employee[];
  materials: RawMaterial[];
  machines: Machine[];
  productionLogs: ProductionLog[];
  isReportsLoading: boolean;
  issues: IssueTicket[];
  notifications: SupervisorNotification[];
  unreadNotifCount: number;
  isDailyUpdateModalOpen: boolean;
  openDailyUpdateModal: () => void;
  closeDailyUpdateModal: () => void;
  logShiftOutput: (orderId: string, produced: number, defective: number, notes: string) => Promise<boolean>;
  advanceOrderStage: (orderId: string) => Promise<void>;
  reportIssue: (issue: Omit<IssueTicket, 'id' | 'date' | 'time' | 'status'>) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  resetSupervisorData: () => void;
}

const SupervisorContext = createContext<SupervisorContextType | undefined>(undefined);

export const SupervisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authUser = useAppSelector((state) => state.auth.user);
  const authToken = useAppSelector((state) => state.auth.token);
  const authRealm = useAppSelector((state) => state.auth.realm);

  // Authenticated supervisor profile from the auth flow (null when session is missing in normal mode)
  const [profile, setProfile] = useState<SupervisorProfile | null>(getInitialSupervisorProfile);

  // Live session verification from existing auth API
  const { data: meData, isSuccess: isMeSuccess, isError: isMeError } = useGetMeQuery(
    undefined,
    { skip: !authToken || authRealm !== 'user' }
  );

  useEffect(() => {
    if (authToken && authRealm === 'user' && authUser?.role === 'supervisor') {
      setProfile(mapAuthUserToSupervisorProfile(authUser));
    } else if (!authToken || authRealm !== 'user') {
      setProfile(isDemoEnabled ? INITIAL_SUPERVISOR_PROFILE : null);
    }
  }, [authToken, authRealm, authUser]);

  useEffect(() => {
    if (isMeSuccess && meData) {
      const p = (meData as any)?.profile;
      if ((meData as any)?.realm === 'user' && p?.role === 'supervisor') {
        setProfile(mapAuthUserToSupervisorProfile(p));
      } else if (!isDemoEnabled) {
        setProfile(null);
      }
    } else if (isMeError && !isDemoEnabled) {
      setProfile(null);
    }
  }, [isMeSuccess, isMeError, meData]);

  useEffect(() => {
    if (!isDemoEnabled && !profile && typeof window !== 'undefined' && window.location.pathname.startsWith('/supervisor')) {
      window.location.replace('/login');
    }
  }, [profile]);

  // 1. Orders from existing backend API
  const {
    data: supervisorOrdersRes,
    isLoading: isOrdersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useGetSupervisorOrdersQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });

  const { data: clientsRes } = useGetClientsQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });

  const clientsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = clientsRes?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((c: any) => {
        if (c.id || c._id) map.set(String(c.id || c._id), c);
      });
    }
    return map;
  }, [clientsRes]);

  const orders: SupervisorOrder[] = useMemo(() => {
    const raw = supervisorOrdersRes?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((ord: any) => mapApiSupervisorOrder(ord, clientsMap));
    }
    // Remove mock orders as normal-mode fallback; allow mock data only in explicit demo mode
    return isDemoEnabled ? INITIAL_SUPERVISOR_ORDERS : [];
  }, [supervisorOrdersRes, clientsMap]);

  // 2. Production Reports from existing backend API
  const {
    data: reportsRes,
    isLoading: isReportsLoading,
    refetch: refetchReports,
  } = useGetSupervisorReportsQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });

  const [submitSupervisorReportMutation] = useSubmitSupervisorReportMutation();
  const [advanceOrderStageMutation, { isLoading: isAdvancingContextStage }] = useAdvanceOrderStageMutation();

  const productionLogs: ProductionLog[] = useMemo(() => {
    const raw = reportsRes?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((r: any, idx: number) => ({
        id: String(r.id || r._id || `LOG-${idx + 1}`),
        orderId: r.outputs?.[0]?.orderId || 'ORD-GENERAL',
        fabricName: r.outputs?.[0]?.fabric || 'Production Greige Weave',
        date: r.reportDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'Today'),
        process: r.outputs?.[0]?.stage || 'Knitting / Weaving',
        dailyTarget: 700,
        actualQty: r.outputs?.[0]?.produced || 0,
        defectiveQty: r.outputs?.[0]?.defective || 0,
        notes: r.notes || r.handoverNotes || '',
        supervisor: r.supervisorName || profile?.name || 'Floor Supervisor',
        timestamp: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '14:30',
      }));
    }
    return isDemoEnabled ? INITIAL_PRODUCTION_LOGS : [];
  }, [reportsRes, profile]);

  // 3. Machines & Materials from existing backend APIs
  const { data: machinesRes, refetch: refetchMachines } = useGetMachinesQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });

  const machines: Machine[] = useMemo(() => {
    const raw = machinesRes?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((m: any) => mapApiMachineToSupervisorMachine(m));
    }
    return isDemoEnabled ? INITIAL_MACHINES : [];
  }, [machinesRes]);

  const { data: materialsRes, refetch: refetchMaterials } = useGetMaterialsQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });

  const materials: RawMaterial[] = useMemo(() => {
    const raw = materialsRes?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((m: any) => mapApiMaterialToRawMaterial(m));
    }
    return isDemoEnabled ? INITIAL_RAW_MATERIALS : [];
  }, [materialsRes]);

  // Operator assignments / personnel (no backend endpoint available; empty in normal mode rather than fabricating data)
  const employees: Employee[] = useMemo(() => {
    return isDemoEnabled ? INITIAL_EMPLOYEES : [];
  }, []);

  // 4. Maintenance Tickets & Notifications from existing backend APIs
  const { data: ticketsRes, refetch: refetchTickets } = useGetMaintenanceTicketsQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });
  const [createMaintenanceTicketMutation] = useCreateMaintenanceTicketMutation();

  const issues: IssueTicket[] = useMemo(() => {
    const raw = ticketsRes?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((t: any) => ({
        id: String(t.ticketNumber || t.id || t._id),
        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Today',
        time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
        machineId: t.machineId || 'Loom-01',
        shed: t.shed || 'Shed A',
        issueType: t.issueType || 'Mechanical',
        description: t.description || t.title || 'Maintenance check',
        reportedBy: t.reportedBy || 'Floor Supervisor',
        status: t.status === 'resolved' || t.status === 'closed' ? 'Resolved' : 'Pending',
        priority: t.priority || 'Medium',
      }));
    }
    return isDemoEnabled ? INITIAL_ISSUES : [];
  }, [ticketsRes]);

  const { data: notificationsRes, refetch: refetchNotifications } = useGetSupervisorNotificationsQuery(undefined, {
    skip: !authToken || authRealm !== 'user',
  });
  const [markNotificationReadMutation] = useMarkNotificationReadMutation();

  const notifications: SupervisorNotification[] = useMemo(() => {
    const raw = notificationsRes?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((n: any) => ({
        id: String(n.id || n._id),
        type: n.type || 'breakdown',
        title: n.title || 'Floor Notification',
        message: n.message || '',
        timestamp: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Just now',
        timeFormatted: n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Today',
        isRead: Boolean(n.read || n.isRead),
        linkPage: n.linkPage || 'issues',
        refId: n.refId || '',
      }));
    }
    return isDemoEnabled ? INITIAL_SUPERVISOR_NOTIFICATIONS : [];
  }, [notificationsRes]);

  // Local UI dialog state
  const [isDailyUpdateModalOpen, setIsDailyUpdateModalOpen] = useState(false);
  const openDailyUpdateModal = () => setIsDailyUpdateModalOpen(true);
  const closeDailyUpdateModal = () => setIsDailyUpdateModalOpen(false);

  // Save report strictly through existing mutation without optimistically showing as saved until confirmed
  const logShiftOutput = async (orderId: string, produced: number, defective: number, notes: string): Promise<boolean> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const stageName = targetOrder?.currentStage
      ? targetOrder.currentStage.replace(/^\d+\.\s*/, '').toLowerCase().replace(/\s+/g, '_')
      : 'weaving';

    await submitSupervisorReportMutation({
      reportDate: new Date().toISOString().split('T')[0],
      employeesPresentTotal: employees.length || 12,
      outputs: [
        {
          orderId: targetOrder?.id || orderId,
          stage: stageName,
          produced,
          defective,
        },
      ],
      notes,
    }).unwrap();

    // Confirm persisted report from backend before updating list
    await refetchReports();
    return true;
  };

  // Advance order stage via existing backend mutation
  const advanceOrderStage = async (orderId: string) => {
    if (isAdvancingContextStage) return;
    const ord = orders.find((o) => o.id === orderId);
    if (!ord) return;

    const currentIndex = SUPERVISOR_PRODUCTION_STAGES.findIndex((s) => s === ord.currentStage);
    if (currentIndex === -1 || currentIndex >= SUPERVISOR_PRODUCTION_STAGES.length - 1) return;
    const nextStage = SUPERVISOR_PRODUCTION_STAGES[currentIndex + 1];

    const rawList = supervisorOrdersRes?.data || [];
    const rawOrder = Array.isArray(rawList)
      ? rawList.find((o: any) => o._id === orderId || o.id === orderId || o.orderNumber === orderId)
      : null;
    const targetId = rawOrder?._id || rawOrder?.id || (orderId.length === 24 ? orderId : null) || ord.id;

    if (!targetId) return;

    const nextPercent = Math.min(100, Math.round(((currentIndex + 2) / SUPERVISOR_PRODUCTION_STAGES.length) * 100));

    await advanceOrderStageMutation({
      id: targetId,
      stage: nextStage,
      producedQty: ord.producedQty,
      percentComplete: nextPercent,
    }).unwrap();

    await refetchOrders();
  };

  // Report issue via existing mutation
  const reportIssue = async (issueData: Omit<IssueTicket, 'id' | 'date' | 'time' | 'status'>) => {
    await createMaintenanceTicketMutation({
      category: issueData.category,
      machineId: issueData.machineId,
      description: issueData.description,
      priority: issueData.priority?.toLowerCase() || 'medium',
    }).unwrap();

    refetchTickets();
  };

  // Mark notification read via existing mutation
  const markNotificationAsRead = async (id: string) => {
    try {
      await markNotificationReadMutation(id).unwrap();
      refetchNotifications();
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  const resetSupervisorData = () => {
    refetchOrders();
    refetchReports();
    refetchMachines();
    refetchMaterials();
    refetchTickets();
    refetchNotifications();
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  if (!isDemoEnabled && !profile && typeof window !== 'undefined' && window.location.pathname.startsWith('/supervisor')) {
    return null;
  }

  return (
    <SupervisorContext.Provider
      value={{
        profile,
        orders,
        isOrdersLoading,
        ordersError,
        refetchOrders,
        employees,
        materials,
        machines,
        productionLogs,
        isReportsLoading,
        issues,
        notifications,
        unreadNotifCount,
        isDailyUpdateModalOpen,
        openDailyUpdateModal,
        closeDailyUpdateModal,
        logShiftOutput,
        advanceOrderStage,
        reportIssue,
        markNotificationAsRead,
        resetSupervisorData,
      }}
    >
      {children}
    </SupervisorContext.Provider>
  );
};

export const useSupervisor = () => {
  const context = useContext(SupervisorContext);
  if (!context) {
    throw new Error('useSupervisor must be used within a SupervisorProvider');
  }
  return context;
};

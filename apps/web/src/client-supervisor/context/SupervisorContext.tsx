import React, { createContext, useContext, useState, useEffect } from 'react';
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
  employees: Employee[];
  materials: RawMaterial[];
  machines: Machine[];
  productionLogs: ProductionLog[];
  issues: IssueTicket[];
  notifications: SupervisorNotification[];
  unreadNotifCount: number;
  isDailyUpdateModalOpen: boolean;
  openDailyUpdateModal: () => void;
  closeDailyUpdateModal: () => void;
  logShiftOutput: (orderId: string, produced: number, defective: number, notes: string) => void;
  advanceOrderStage: (orderId: string) => void;
  reportIssue: (issue: Omit<IssueTicket, 'id' | 'date' | 'time' | 'status'>) => void;
  markNotificationAsRead: (id: string) => void;
  resetSupervisorData: () => void;
}

const STORAGE_KEYS = {
  ORDERS: 'loompilot_sup_orders',
  MATERIALS: 'loompilot_sup_materials',
  MACHINES: 'loompilot_sup_machines',
  LOGS: 'loompilot_sup_logs',
  ISSUES: 'loompilot_sup_issues',
  NOTIFICATIONS: 'loompilot_sup_notifs',
};

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

  const [orders, setOrders] = useState<SupervisorOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : INITIAL_SUPERVISOR_ORDERS;
    } catch {
      return INITIAL_SUPERVISOR_ORDERS;
    }
  });

  const [employees] = useState<Employee[]>(INITIAL_EMPLOYEES);

  const [materials, setMaterials] = useState<RawMaterial[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      return saved ? JSON.parse(saved) : INITIAL_RAW_MATERIALS;
    } catch {
      return INITIAL_RAW_MATERIALS;
    }
  });

  const [machines, setMachines] = useState<Machine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MACHINES);
      return saved ? JSON.parse(saved) : INITIAL_MACHINES;
    } catch {
      return INITIAL_MACHINES;
    }
  });

  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTION_LOGS;
    } catch {
      return INITIAL_PRODUCTION_LOGS;
    }
  });

  const [issues, setIssues] = useState<IssueTicket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ISSUES);
      return saved ? JSON.parse(saved) : INITIAL_ISSUES;
    } catch {
      return INITIAL_ISSUES;
    }
  });

  const [notifications, setNotifications] = useState<SupervisorNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return saved ? JSON.parse(saved) : INITIAL_SUPERVISOR_NOTIFICATIONS;
    } catch {
      return INITIAL_SUPERVISOR_NOTIFICATIONS;
    }
  });

  const [isDailyUpdateModalOpen, setIsDailyUpdateModalOpen] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machines));
  }, [machines]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(productionLogs));
  }, [productionLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));
  }, [issues]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  const openDailyUpdateModal = () => setIsDailyUpdateModalOpen(true);
  const closeDailyUpdateModal = () => setIsDailyUpdateModalOpen(false);

  // Log daily shift output for an order
  const logShiftOutput = (orderId: string, produced: number, defective: number, notes: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const newLog: ProductionLog = {
      id: `PROD-LOG-${Date.now().toString().slice(-4)}`,
      orderId,
      fabricName: targetOrder.fabricName,
      date: new Date().toISOString().split('T')[0],
      process: targetOrder.currentStage,
      dailyTarget: targetOrder.dailyTarget,
      actualQty: produced,
      defectiveQty: defective,
      notes,
      supervisor: profile?.name || 'Shift Supervisor',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setProductionLogs((prev) => [newLog, ...prev]);

    // Update order produced & remaining quantity
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const updatedProduced = Math.min(ord.totalQty, ord.producedQty + produced);
          const updatedRemaining = Math.max(0, ord.totalQty - updatedProduced);
          return {
            ...ord,
            producedQty: updatedProduced,
            remainingQty: updatedRemaining,
            status: updatedRemaining === 0 ? 'Completed' : ord.status,
          };
        }
        return ord;
      })
    );
  };

  // Advance order to next production stage in the strict 8 stages
  const advanceOrderStage = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const currentIndex = SUPERVISOR_PRODUCTION_STAGES.findIndex((s) => s === ord.currentStage);
          if (currentIndex !== -1 && currentIndex < SUPERVISOR_PRODUCTION_STAGES.length - 1) {
            const nextStage = SUPERVISOR_PRODUCTION_STAGES[currentIndex + 1];
            return {
              ...ord,
              currentStage: nextStage,
              status: nextStage.includes('Delivered') ? 'Completed' : 'In Progress',
            };
          }
        }
        return ord;
      })
    );
  };

  // Report new issue
  const reportIssue = (issueData: Omit<IssueTicket, 'id' | 'date' | 'time' | 'status'>) => {
    const now = new Date();
    const newIssue: IssueTicket = {
      ...issueData,
      id: `ISS-${Date.now().toString().slice(-4)}`,
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Technician Assigned',
      adminResponse: 'Logged by Shift Supervisor. Maintenance triage initiated.',
    };

    setIssues((prev) => [newIssue, ...prev]);

    // Add alert notification
    const newNotif: SupervisorNotification = {
      id: `NOTIF-${Date.now().toString().slice(-4)}`,
      type: 'breakdown',
      title: `Issue Logged: ${issueData.category}`,
      message: issueData.description,
      timestamp: 'Just now',
      timeFormatted: 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      linkPage: 'issues',
      refId: newIssue.id,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const resetSupervisorData = () => {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.MATERIALS);
    localStorage.removeItem(STORAGE_KEYS.MACHINES);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.ISSUES);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);

    setOrders(INITIAL_SUPERVISOR_ORDERS);
    setMaterials(INITIAL_RAW_MATERIALS);
    setMachines(INITIAL_MACHINES);
    setProductionLogs(INITIAL_PRODUCTION_LOGS);
    setIssues(INITIAL_ISSUES);
    setNotifications(INITIAL_SUPERVISOR_NOTIFICATIONS);
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
        employees,
        materials,
        machines,
        productionLogs,
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

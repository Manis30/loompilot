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

interface SupervisorContextType {
  profile: SupervisorProfile;
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
  const [profile] = useState<SupervisorProfile>(INITIAL_SUPERVISOR_PROFILE);

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
      supervisor: profile.name,
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


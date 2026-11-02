import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Order,
  Product,
  Invoice,
  PaymentTransaction,
  ChatThread,
  NotificationItem,
  ActivityEvent,
  DashboardMetrics,
} from '../types';
import { storageService } from '../services/storageService';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface AppContextType {
  orders: Order[];
  products: Product[];
  invoices: Invoice[];
  payments: PaymentTransaction[];
  chats: Record<string, ChatThread>;
  notifications: NotificationItem[];
  activities: ActivityEvent[];
  metrics: DashboardMetrics;
  unreadCount: number;
  toasts: ToastItem[];

  // Chat operational states
  isChatSending: boolean;
  chatError: string | null;

  // Actions
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  payInvoice: (invoiceNumber: string, method: string) => void;
  sendChatMessage: (orderId: string, messageText: string) => Promise<boolean>;
  clearChatError: () => void;
  acceptQuotation: (orderId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addToast: (message: string, type?: ToastItem['type']) => void;
  removeToast: (id: string) => void;
  resetDemoData: () => void;
  refreshData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>(() => storageService.getOrders());
  const [products] = useState<Product[]>(() => storageService.getProducts());
  const [invoices, setInvoices] = useState<Invoice[]>(() => storageService.getInvoices());
  const [payments, setPayments] = useState<PaymentTransaction[]>(() => storageService.getPayments());
  // In normal mode, do not treat localStorage mock conversations as persisted records.
  const [chats, setChats] = useState<Record<string, ChatThread>>(() =>
    isDemo ? storageService.getChats() : {}
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => storageService.getNotifications());
  const [activities, setActivities] = useState<ActivityEvent[]>(() => storageService.getActivities());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isChatSending, setIsChatSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const clearChatError = useCallback(() => {
    setChatError(null);
  }, []);

  const refreshData = useCallback(() => {
    setOrders(storageService.getOrders());
    setInvoices(storageService.getInvoices());
    setPayments(storageService.getPayments());
    setChats(isDemo ? storageService.getChats() : {});
    setNotifications(storageService.getNotifications());
    setActivities(storageService.getActivities());
  }, []);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addOrder = useCallback((newOrder: Order) => {
    storageService.addOrder(newOrder);
    refreshData();
    addToast(`Manufacturing Order #${newOrder.id} submitted successfully!`, 'success');
  }, [refreshData, addToast]);

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    storageService.updateOrder(orderId, updates);
    refreshData();
  }, [refreshData]);

  const payInvoice = useCallback((invoiceNumber: string, method: string) => {
    const paidInv = storageService.payInvoice(invoiceNumber, method);
    if (paidInv) {
      refreshData();
      addToast(`Invoice #${invoiceNumber} for ₹${paidInv.amount.toLocaleString('en-IN')} paid successfully via Razorpay!`, 'success');
    }
  }, [refreshData, addToast]);

  const sendChatMessage = useCallback(
    async (orderId: string, messageText: string): Promise<boolean> => {
      // Prevent duplicate submissions while a request is in progress
      if (isChatSending) {
        return false;
      }

      setIsChatSending(true);
      setChatError(null);

      // Demo replies isolated strictly behind VITE_ENABLE_DEMO_LOGIN === 'true'
      if (isDemo) {
        storageService.addChatMessage(orderId, messageText, 'user');
        refreshData();

        setTimeout(() => {
          const lower = messageText.toLowerCase();
          let aiText = "Thank you Mr. Malhotra. Your message has been logged in our mill merchandising ledger.";
          let badge: string | undefined;

          if (lower.includes('price') || lower.includes('discount') || lower.includes('reduce') || lower.includes('cost') || lower.includes('rate')) {
            aiText = "Under LoomPilot governance, AI concierge cannot independently authorize discounts. I have formatted your volume negotiation request and forwarded it to our Senior VP of Production Merchandising, Anil Sharma.";
            badge = "Negotiation Request Forwarded to Admin";

            setTimeout(() => {
              const adminReply = "Hello Vikram! We reviewed your order volume. We are pleased to approve a revised rate of ₹282/metre for this batch, saving Raymond ₹2,34,000 total. Please review and accept the official revised quotation below.";
              const chatsMap = storageService.getChats();
              const targetChat = chatsMap[orderId];
              if (targetChat) {
                targetChat.messages.push({
                  id: `msg-${Date.now()}`,
                  sender: 'admin',
                  senderName: 'Anil Sharma (Senior VP Merchandising)',
                  avatar: 'admin',
                  time: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                  type: 'quote_revision',
                  text: adminReply,
                  revisedData: {
                    originalRate: '₹295 / m',
                    newRate: '₹282 / m',
                    savings: '₹2,34,000',
                    newTotal: '₹50,76,000',
                    status: 'Admin Approved',
                    actionRequired: 'Client Acceptance Needed',
                  },
                });
                storageService.setChats(chatsMap);
                refreshData();
                addToast('Admin approved revised quotation received!', 'success');
              }
            }, 2200);
          } else if (lower.includes('delivery') || lower.includes('lead') || lower.includes('expedite') || lower.includes('date')) {
            aiText = "Standard lead time is 4 weeks. I have checked loom schedules and alerted our loom shed controller to explore expediting yarn warping on Line 3.";
          } else if (lower.includes('swatch') || lower.includes('lab') || lower.includes('sample')) {
            aiText = "A 3-shade lab dip strike-off will be dispatched to your Thane plant testing center within 4 business days.";
          }

          const chatsMap = storageService.getChats();
          const targetChat = chatsMap[orderId];
          if (targetChat) {
            targetChat.messages.push({
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              senderName: 'LoomPilot Assistant',
              avatar: 'ai',
              time: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              text: aiText,
              badge,
            });
            storageService.setChats(chatsMap);
            refreshData();
          }
          setIsChatSending(false);
        }, 700);

        return true;
      }

      // Normal mode: Do not simulate AI execution or append fabricated responses.
      // Backend conversation/agent endpoints (/api/v1/client/conversations) are not yet deployed.
      const errMsg = "AI Concierge & Chat service is currently unavailable. Backend conversation endpoints (/api/v1/client/conversations) are not deployed in this environment.";
      setChatError(errMsg);
      addToast(errMsg, 'error');
      setIsChatSending(false);
      return false;
    },
    [isChatSending, refreshData, addToast]
  );

  const acceptQuotation = useCallback((orderId: string) => {
    if (!isDemo) {
      addToast('Accepting quotations via chat is unavailable in normal mode.', 'warning');
      return;
    }
    const order = storageService.getOrderById(orderId);
    if (!order) return;

    // Update order status to In Production
    storageService.updateOrder(orderId, {
      status: 'In Production',
      currentStageNumber: 1,
      currentStageName: 'Quote Accepted',
      unitPrice: 282,
      totalValue: order.orderedMetres * 282,
    });

    // Create Advance Milestone Invoice if not exists
    const advanceInvNum = `INV-2026-0501`;
    const curInvoices = storageService.getInvoices();
    if (!curInvoices.some((i) => i.invoiceNumber === advanceInvNum)) {
      const advAmount = Math.round(order.orderedMetres * 282 * 0.3);
      curInvoices.unshift({
        invoiceNumber: advanceInvNum,
        orderId: order.id,
        productName: order.productName,
        milestonePhase: 'Milestone 1 — 30% Advance on Acceptance',
        issueDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        dueDate: 'Upon Acceptance',
        amount: advAmount,
        paidAmount: 0,
        remainingAmount: advAmount,
        status: 'Pending',
      });
      storageService.setInvoices(curInvoices);
    }

    refreshData();
    addToast(`Quotation accepted! Advance Invoice ${advanceInvNum} generated.`, 'success');
  }, [refreshData, addToast]);

  const markNotificationRead = useCallback((id: string) => {
    storageService.markNotificationRead(id);
    refreshData();
  }, [refreshData]);

  const markAllNotificationsRead = useCallback(() => {
    storageService.markAllNotificationsRead();
    refreshData();
    addToast('All notifications marked as read.', 'info');
  }, [refreshData, addToast]);

  const resetDemoData = useCallback(() => {
    storageService.resetAll();
    refreshData();
    addToast('All portal state reset to factory demo values.', 'info');
  }, [refreshData, addToast]);

  // Derived metrics
  const activeOrders = orders.filter((o) => o.status === 'In Production' || o.status === 'Awaiting Quotation').length;
  const totalOrders = orders.length;
  const productionInProgressMetres = orders
    .filter((o) => o.status === 'In Production')
    .reduce((acc, curr) => acc + (curr.producedMetres || 0), 0);
  const pendingPaymentsAmount = invoices
    .filter((i) => i.status === 'Pending')
    .reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

  const metrics: DashboardMetrics = {
    activeOrders,
    totalOrders,
    productionInProgressMetres,
    pendingPaymentsAmount,
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        orders,
        products,
        invoices,
        payments,
        chats,
        notifications,
        activities,
        metrics,
        unreadCount,
        toasts,
        isChatSending,
        chatError,
        addOrder,
        updateOrder,
        payInvoice,
        sendChatMessage,
        clearChatError,
        acceptQuotation,
        markNotificationRead,
        markAllNotificationsRead,
        addToast,
        removeToast,
        resetDemoData,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

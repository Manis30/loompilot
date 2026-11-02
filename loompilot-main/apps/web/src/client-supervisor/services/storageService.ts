/**
 * LoomPilot — Storage Service
 * LocalStorage state management with fallback to mock data
 */

import {
  ClientProfile,
  Product,
  Order,
  Invoice,
  PaymentTransaction,
  ChatThread,
  NotificationItem,
  ActivityEvent,
  DashboardMetrics,
} from '../types';

import {
  INITIAL_CLIENT,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_CHATS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITIES,
} from '../data/mockData';

const KEYS = {
  AUTH_USER: 'loompilot_auth_user',
  CLIENT: 'loompilot_client_profile',
  PRODUCTS: 'loompilot_products',
  ORDERS: 'loompilot_orders',
  INVOICES: 'loompilot_invoices',
  PAYMENTS: 'loompilot_payments',
  CHATS: 'loompilot_chats',
  NOTIFICATIONS: 'loompilot_notifications',
  ACTIVITIES: 'loompilot_activities',
};

export const storageService = {
  // Auth User
  getAuthUser(): ClientProfile | null {
    try {
      const data = localStorage.getItem(KEYS.AUTH_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setAuthUser(user: ClientProfile | null) {
    if (user) {
      localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.AUTH_USER);
    }
  },

  // Client Profile
  getClient(): ClientProfile {
    try {
      const data = localStorage.getItem(KEYS.CLIENT);
      return data ? JSON.parse(data) : INITIAL_CLIENT;
    } catch {
      return INITIAL_CLIENT;
    }
  },
  setClient(client: ClientProfile) {
    localStorage.setItem(KEYS.CLIENT, JSON.stringify(client));
  },

  // Products
  getProducts(): Product[] {
    try {
      const data = localStorage.getItem(KEYS.PRODUCTS);
      return data ? JSON.parse(data) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  },
  getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id);
  },

  // Orders
  getOrders(): Order[] {
    try {
      const data = localStorage.getItem(KEYS.ORDERS);
      return data ? JSON.parse(data) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  },
  setOrders(orders: Order[]) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  },
  getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id);
  },
  addOrder(order: Order) {
    const orders = this.getOrders();
    orders.unshift(order);
    this.setOrders(orders);

    // Also add to chat threads
    const chats = this.getChats();
    chats[order.id] = {
      orderId: order.id,
      productName: order.productName,
      orderQuantity: `${order.orderedMetres.toLocaleString()} metres`,
      quotedPrice: `₹${order.unitPrice} / metre`,
      totalQuote: `₹${order.totalValue.toLocaleString('en-IN')}`,
      validity: 'Valid for 7 Days',
      deliveryDate: order.expectedDelivery,
      status: 'Awaiting Quotation Review',
      unread: false,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          senderName: 'LoomPilot Assistant',
          avatar: 'ai',
          time: 'Just now',
          type: 'system_quote',
          text: `Order request #${order.id} for ${order.orderedMetres.toLocaleString()}m of ${order.productName} has been received. Our sales merchandising team is preparing your official capacity and quotation sheet. You may negotiate price or specs in this thread.`,
        },
      ],
    };
    this.setChats(chats);

    // Add activity
    this.addActivity({
      id: `act-${Date.now()}`,
      type: 'order_submitted',
      title: 'Order Request Submitted',
      desc: `Order #${order.id} (${order.orderedMetres.toLocaleString()}m of ${order.productName}) submitted for quotation review.`,
      time: 'Just now',
      badge: 'Order',
      badgeClass: 'badge-coral',
    });

    // Add notification
    this.addNotification({
      id: `notif-${Date.now()}`,
      title: 'Order Submitted Successfully',
      message: `Your manufacturing request #${order.id} has been submitted. Our merchandising team is preparing your official quotation.`,
      time: 'Just now',
      category: 'order',
      read: false,
      targetRoute: `/client/orders/${order.id}`,
      orderId: order.id,
    });
  },
  updateOrder(orderId: string, updates: Partial<Order>) {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      this.setOrders(orders);
      return orders[index];
    }
    return null;
  },

  // Invoices
  getInvoices(): Invoice[] {
    try {
      const data = localStorage.getItem(KEYS.INVOICES);
      return data ? JSON.parse(data) : INITIAL_INVOICES;
    } catch {
      return INITIAL_INVOICES;
    }
  },
  setInvoices(invoices: Invoice[]) {
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
  },
  getInvoiceByNumber(num: string): Invoice | undefined {
    return this.getInvoices().find((i) => i.invoiceNumber === num);
  },
  payInvoice(invoiceNumber: string, method: string) {
    const invoices = this.getInvoices();
    const inv = invoices.find((i) => i.invoiceNumber === invoiceNumber);
    if (inv) {
      inv.status = 'Paid';
      inv.paidAmount = inv.amount;
      inv.remainingAmount = 0;
      inv.paidDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      this.setInvoices(invoices);

      // Record transaction
      const txnRef = `RZP-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
      this.addPayment({
        paymentId: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceNumber: inv.invoiceNumber,
        orderId: inv.orderId,
        paymentDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        amount: inv.amount,
        method: method || 'Razorpay (Corporate NetBanking)',
        transactionRef: txnRef,
        status: 'Success',
      });

      // Update Order milestones
      const order = this.getOrderById(inv.orderId);
      if (order && order.milestones) {
        const ms = order.milestones.find((m) => m.invoiceId === invoiceNumber);
        if (ms) {
          ms.status = 'paid';
          ms.paidDate = inv.paidDate;
          this.updateOrder(order.id, { milestones: order.milestones });
        }
      }

      // Add activity
      this.addActivity({
        id: `act-${Date.now()}`,
        type: 'payment_received',
        title: 'Payment Confirmed via Razorpay',
        desc: `₹${inv.amount.toLocaleString('en-IN')} processed for Invoice #${invoiceNumber} (${inv.productName}).`,
        time: 'Just now',
        badge: 'Payment',
        badgeClass: 'badge-green',
      });

      // Add notification
      this.addNotification({
        id: `notif-${Date.now()}`,
        title: 'Payment Received',
        message: `Your payment of ₹${inv.amount.toLocaleString('en-IN')} for Invoice #${invoiceNumber} has been received and verified.`,
        time: 'Just now',
        category: 'payment',
        read: false,
        targetRoute: '/client/payments',
        orderId: inv.orderId,
      });

      return inv;
    }
    return null;
  },

  // Payments
  getPayments(): PaymentTransaction[] {
    try {
      const data = localStorage.getItem(KEYS.PAYMENTS);
      return data ? JSON.parse(data) : INITIAL_PAYMENTS;
    } catch {
      return INITIAL_PAYMENTS;
    }
  },
  setPayments(payments: PaymentTransaction[]) {
    localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(payments));
  },
  addPayment(payment: PaymentTransaction) {
    const list = this.getPayments();
    list.unshift(payment);
    this.setPayments(list);
  },

  // Chats
  getChats(): Record<string, ChatThread> {
    try {
      const data = localStorage.getItem(KEYS.CHATS);
      return data ? JSON.parse(data) : INITIAL_CHATS;
    } catch {
      return INITIAL_CHATS;
    }
  },
  setChats(chats: Record<string, ChatThread>) {
    localStorage.setItem(KEYS.CHATS, JSON.stringify(chats));
  },
  getChatByOrderId(orderId: string): ChatThread | undefined {
    return this.getChats()[orderId];
  },
  addChatMessage(orderId: string, messageText: string, sender: 'user' | 'assistant' | 'admin' = 'user') {
    const chats = this.getChats();
    if (!chats[orderId]) {
      const order = this.getOrderById(orderId);
      chats[orderId] = {
        orderId,
        productName: order?.productName || 'Textile Fabric',
        orderQuantity: order ? `${order.orderedMetres.toLocaleString()} metres` : 'Custom yardage',
        quotedPrice: order ? `₹${order.unitPrice} / m` : 'Quote in review',
        totalQuote: order ? `₹${order.totalValue.toLocaleString('en-IN')}` : 'TBD',
        validity: 'Valid for 7 Days',
        deliveryDate: order?.expectedDelivery || 'In 4 weeks',
        status: 'In Negotiation',
        unread: false,
        messages: [],
      };
    }

    const timeStr = `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender,
      senderName: sender === 'user' ? 'Vikram Malhotra (You)' : (sender === 'admin' ? 'Anil Sharma (Senior VP Merchandising)' : 'LoomPilot Assistant'),
      avatar: sender === 'user' ? 'user' as const : (sender === 'admin' ? 'admin' as const : 'ai' as const),
      time: timeStr,
      text: messageText,
    };

    chats[orderId].messages.push(newMsg);
    this.setChats(chats);
    return newMsg;
  },

  // Notifications
  getNotifications(): NotificationItem[] {
    try {
      const data = localStorage.getItem(KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },
  setNotifications(notifs: NotificationItem[]) {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifs));
  },
  addNotification(notif: NotificationItem) {
    const list = this.getNotifications();
    list.unshift(notif);
    this.setNotifications(list);
  },
  markNotificationRead(id: string) {
    const list = this.getNotifications();
    const item = list.find((n) => n.id === id);
    if (item) {
      item.read = true;
      this.setNotifications(list);
    }
  },
  markAllNotificationsRead() {
    const list = this.getNotifications();
    list.forEach((n) => (n.read = true));
    this.setNotifications(list);
  },

  // Activities
  getActivities(): ActivityEvent[] {
    try {
      const data = localStorage.getItem(KEYS.ACTIVITIES);
      return data ? JSON.parse(data) : INITIAL_ACTIVITIES;
    } catch {
      return INITIAL_ACTIVITIES;
    }
  },
  addActivity(act: ActivityEvent) {
    const list = this.getActivities();
    list.unshift(act);
    if (list.length > 25) list.pop();
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(list));
  },

  // Metrics
  getDashboardMetrics(): DashboardMetrics {
    const orders = this.getOrders();
    const invoices = this.getInvoices();

    const activeOrders = orders.filter((o) => o.status === 'In Production' || o.status === 'Awaiting Quotation').length;
    const totalOrders = orders.length;

    const productionInProgressMetres = orders
      .filter((o) => o.status === 'In Production')
      .reduce((acc, curr) => acc + (curr.producedMetres || 0), 0);

    const pendingPaymentsAmount = invoices
      .filter((i) => i.status === 'Pending')
      .reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

    return {
      activeOrders,
      totalOrders,
      productionInProgressMetres,
      pendingPaymentsAmount,
    };
  },

  // Reset
  resetAll() {
    localStorage.removeItem(KEYS.CLIENT);
    localStorage.removeItem(KEYS.PRODUCTS);
    localStorage.removeItem(KEYS.ORDERS);
    localStorage.removeItem(KEYS.INVOICES);
    localStorage.removeItem(KEYS.PAYMENTS);
    localStorage.removeItem(KEYS.CHATS);
    localStorage.removeItem(KEYS.NOTIFICATIONS);
    localStorage.removeItem(KEYS.ACTIVITIES);
  },
};


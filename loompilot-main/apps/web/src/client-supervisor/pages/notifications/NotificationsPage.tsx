import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Bell, Check, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { useGetClientNotificationsQuery, useMarkClientNotificationReadMutation } from '../../../store/api/ordersApi';
import type { NotificationItem } from '../../types';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const NotificationsPage: React.FC = () => {
  const { notifications: localNotifs, markNotificationRead: localMarkRead, markAllNotificationsRead: localMarkAllRead } = useApp();
  const navigate = useNavigate();

  const { data: serverNotifsResp, refetch: refetchNotifs } = useGetClientNotificationsQuery(undefined, { skip: isDemo });
  const [markClientNotificationRead] = useMarkClientNotificationReadMutation();

  const notifications = useMemo(() => {
    if (isDemo) return localNotifs;
    const raw = serverNotifsResp?.data || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((n: any): NotificationItem => {
      let category: 'quotation' | 'production' | 'payment' | 'order' = 'order';
      const type = String(n.type || '').toLowerCase();
      if (type.includes('quote') || type.includes('price')) category = 'quotation';
      else if (type.includes('pay') || type.includes('invoice')) category = 'payment';
      else if (type.includes('stage') || type.includes('production') || type.includes('loom')) category = 'production';

      let targetRoute = '/portal/orders';
      if (category === 'quotation') targetRoute = '/portal/quotations';
      else if (category === 'payment') targetRoute = '/portal/invoices';
      else if (n.orderId) targetRoute = `/portal/orders/${n.orderId}`;

      const timeStr = n.createdAt
        ? new Date(n.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Just now';

      return {
        id: String(n.id || n._id),
        title: n.title || 'Mill Notification',
        message: n.body || n.message || '',
        time: timeStr,
        category,
        read: Boolean(n.readAt),
        targetRoute,
        orderId: n.orderId,
      };
    });
  }, [isDemo, localNotifs, serverNotifsResp]);

  const [activeTab, setActiveTab] = useState<'all' | 'quotation' | 'production' | 'payment'>('all');

  const filteredNotifs = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'all') return true;
      return n.category === activeTab;
    });
  }, [notifications, activeTab]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (isDemo) {
      localMarkRead(item.id);
    } else {
      try {
        await markClientNotificationRead(item.id).unwrap();
        refetchNotifs();
      } catch {
        // ignore
      }
    }
    if (item.targetRoute) {
      navigate(item.targetRoute);
    }
  };

  const handleMarkAllRead = async () => {
    if (isDemo) {
      localMarkAllRead();
    } else {
      for (const item of notifications) {
        if (!item.read) {
          try {
            await markClientNotificationRead(item.id).unwrap();
          } catch {
            // ignore
          }
        }
      }
      refetchNotifs();
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
            Notification Centre
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time alerts for mill quotation revisions, daily loom milestones, and scheduled payment disbursements.
          </p>
        </div>

        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ivory text-charcoal border border-muted-border text-xs font-bold hover:bg-white transition-colors flex-shrink-0"
          >
            <Check size={16} />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: `All Alerts (${notifications.length})` },
          { id: 'quotation', label: 'Quotations & Pricing' },
          { id: 'production', label: 'Production Stages' },
          { id: 'payment', label: 'Payments & Invoices' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-charcoal text-white border-charcoal shadow-sm'
                : 'bg-white text-muted border-muted-border hover:border-vermilion hover:text-vermilion'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List Card */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card divide-y divide-muted-border/60 overflow-hidden">
        {filteredNotifs.map((item) => (
          <div
            key={item.id}
            onClick={() => handleNotificationClick(item)}
            className={`p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-ivory/60 transition-colors ${
              !item.read ? 'bg-vermilion/[0.02]' : ''
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                  !item.read ? 'bg-vermilion ring-4 ring-vermilion/10' : 'bg-transparent'
                }`}
              />

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-charcoal">{item.title}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.category === 'quotation'
                        ? 'bg-warning-bg text-warning'
                        : item.category === 'production'
                        ? 'bg-vermilion/10 text-vermilion'
                        : 'bg-success-bg text-success'
                    }`}
                  >
                    {item.category}
                  </span>
                </div>

                <p className="text-xs text-muted leading-relaxed max-w-2xl">{item.message}</p>
                <div className="text-[11px] text-muted-light">{item.time}</div>
              </div>
            </div>

            <button className="flex items-center gap-1 text-xs font-bold text-muted hover:text-vermilion transition-colors flex-shrink-0">
              <span>Open</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ))}

        {filteredNotifs.length === 0 && (
          <div className="text-center py-16 px-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-ivory flex items-center justify-center text-muted mx-auto">
              <Bell size={22} />
            </div>
            <h3 className="text-sm font-bold text-charcoal">
              {!isDemo ? 'No Notifications to Display' : 'No alerts in this category'}
            </h3>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              {!isDemo
                ? 'All caught up! You will receive live alerts when quotation revisions are prepared, raw material surges are analyzed, loom stages advance, or payment milestones become due.'
                : 'All caught up! There are no alerts currently in this category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

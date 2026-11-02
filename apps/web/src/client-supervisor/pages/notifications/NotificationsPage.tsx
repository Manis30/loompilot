import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Bell, Check, ArrowRight, ShieldCheck, Info } from 'lucide-react';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const NotificationsPage: React.FC = () => {
  const { notifications: localNotifs, markNotificationRead: localMarkRead, markAllNotificationsRead: localMarkAllRead } = useApp();
  const navigate = useNavigate();

  // In normal mode, no client-scoped notification endpoint exists in the backend API.
  // Respect requirement: do not fabricate notifications and do not expose supervisor/admin notifications.
  const notifications = useMemo(() => {
    return isDemo ? localNotifs : [];
  }, [localNotifs]);

  const [activeTab, setActiveTab] = useState<'all' | 'quotation' | 'production' | 'payment'>('all');

  const filteredNotifs = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'all') return true;
      return n.category === activeTab;
    });
  }, [notifications, activeTab]);

  const handleNotificationClick = (item: (typeof notifications)[0]) => {
    if (isDemo) {
      localMarkRead(item.id);
    }
    if (item.targetRoute) {
      navigate(item.targetRoute);
    }
  };

  const handleMarkAllRead = () => {
    if (isDemo) {
      localMarkAllRead();
    }
  };

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

        {isDemo && notifications.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ivory text-charcoal border border-muted-border text-xs font-bold hover:bg-white transition-colors flex-shrink-0"
          >
            <Check size={16} />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Normal Mode Notice: Feed status */}
      {!isDemo && (
        <div className="p-4 rounded-2xl bg-ivory border border-muted-border flex items-start gap-3 text-xs text-muted">
          <Info size={16} className="text-muted flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-charcoal block font-bold">Client Notification Feed Status</strong>
            <p className="leading-relaxed">
              Real-time push notifications are currently unavailable on the mill backend for client accounts. Operational stage milestones and commercial invoice statuses update directly in your Orders and Invoices tabs.
            </p>
          </div>
        </div>
      )}

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
                ? 'There are no active notifications for your client account. Direct order progress and financial milestones are tracked in real-time across your active contracts.'
                : 'All caught up! There are no alerts currently in this category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

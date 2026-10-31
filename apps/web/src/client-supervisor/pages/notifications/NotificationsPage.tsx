import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Bell, Check, ArrowRight, ShieldCheck } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'all' | 'quotation' | 'production' | 'payment'>('all');

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    return n.category === activeTab;
  });

  const handleNotificationClick = (item: (typeof notifications)[0]) => {
    markNotificationRead(item.id);
    if (item.targetRoute) {
      navigate(item.targetRoute);
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

        <button
          onClick={markAllNotificationsRead}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ivory text-charcoal border border-muted-border text-xs font-bold hover:bg-white transition-colors flex-shrink-0"
        >
          <Check size={16} />
          <span>Mark All as Read</span>
        </button>
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
          <div className="text-center py-16 text-muted text-xs">
            No notifications found in this alert category.
          </div>
        )}
      </div>
    </div>
  );
};


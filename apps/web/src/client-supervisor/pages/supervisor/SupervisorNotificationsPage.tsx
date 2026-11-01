import React, { useState } from 'react';
import { Bell, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useGetSupervisorNotificationsQuery, useMarkNotificationReadMutation } from '../../../store/api/productionApi';

export const SupervisorNotificationsPage: React.FC = () => {
  const { notifications: localNotifs, markNotificationAsRead: localMarkRead } = useSupervisor();
  const { data: notifsResponse } = useGetSupervisorNotificationsQuery(undefined);
  const [markNotificationReadMutation] = useMarkNotificationReadMutation();

  const notifications = useMemo(() => {
    const raw = notifsResponse?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((n: any) => ({
        id: String(n.id || n._id),
        type: (n.type === 'breakdown' ? 'breakdown' : n.type === 'deadline' ? 'deadline' : 'order') as 'order' | 'breakdown' | 'deadline' | 'admin',
        title: n.title || 'Shift Notification',
        message: n.message || n.content || '',
        timestamp: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        timeFormatted: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        isRead: !!n.read || !!n.isRead,
        linkPage: '/supervisor/orders',
        refId: n.orderId || n.entityId || 'N/A',
      }));
    }
    return localNotifs;
  }, [notifsResponse, localNotifs]);

  const markNotificationAsRead = (id: string) => {
    try {
      markNotificationReadMutation(id);
    } catch (e) {
      console.warn('API mark notification read warning:', e);
    }
    localMarkRead(id);
  };
  const [filterType, setFilterType] = useState<string>('All');

  const filteredNotifs = notifications.filter((n) => {
    if (filterType === 'All') return true;
    if (filterType === 'Orders') return n.type === 'order';
    if (filterType === 'Breakdowns') return n.type === 'breakdown';
    if (filterType === 'Deadlines') return n.type === 'deadline';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Shift Notifications &amp; Alerts
          </h1>
          <p className="text-xs text-gray-500">
            Order assignments, machine breakdowns, delivery deadlines &amp; plant management replies
          </p>
        </div>

        <div className="flex gap-2">
          {['All', 'Orders', 'Breakdowns', 'Deadlines'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterType === type
                  ? 'bg-[#252622] text-white'
                  : 'bg-white text-gray-600 border border-[#EAE2D9] hover:bg-[#FBF6F0]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifs.map((n) => (
          <div
            key={n.id}
            onClick={() => markNotificationAsRead(n.id)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
              !n.isRead
                ? 'bg-white border-[#E65338]/30 shadow-sm ring-1 ring-[#E65338]/10'
                : 'bg-white/80 border-[#EAE2D9] opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                  n.type === 'breakdown'
                    ? 'bg-[#E65338]/10 text-[#E65338]'
                    : n.type === 'deadline'
                    ? 'bg-[#C78627]/10 text-[#C78627]'
                    : 'bg-[#20845A]/10 text-[#20845A]'
                }`}
              >
                <Bell size={18} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-[#252622]">{n.title}</h3>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#E65338]"></span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                <div className="text-[10px] text-gray-400 mt-1 font-mono">{n.timeFormatted}</div>
              </div>
            </div>

            <span className="text-[11px] font-bold text-[#E65338] hover:underline flex-shrink-0">
              Mark Read
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


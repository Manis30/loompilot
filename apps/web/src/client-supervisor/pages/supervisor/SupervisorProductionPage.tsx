import React, { useMemo } from 'react';
import { Activity, PlusCircle, CheckCircle2, Clock, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useGetSupervisorReportsQuery } from '../../../store/api/productionApi';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const SupervisorProductionPage: React.FC = () => {
  const { productionLogs: localLogs, openDailyUpdateModal } = useSupervisor();
  const {
    data: reportsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSupervisorReportsQuery(undefined);

  // Load persisted reports from API; do not fall back to mock logs in normal mode
  const productionLogs = useMemo(() => {
    const raw = reportsResponse?.data || [];
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
        notes: r.notes || r.handoverNotes || 'Shift output recorded cleanly.',
        supervisor: r.supervisorName || 'Floor Supervisor',
        timestamp: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '14:30',
      }));
    }
    return isDemoEnabled ? localLogs : [];
  }, [reportsResponse, localLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Daily Production Output &amp; Logs
          </h1>
          <p className="text-xs text-gray-500">
            Shift actual meters woven, greige inspection defects &amp; supervisor handover notes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-[#252622] bg-[#FBF6F0] border border-[#EAE2D9] hover:bg-white shadow-sm transition-all"
            title="Refresh reports from backend API"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#E65338]' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Logs'}</span>
          </button>
          <button
            onClick={openDailyUpdateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm transition-all"
          >
            <PlusCircle size={15} />
            <span>Log Shift Output</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-[#EAE2D9] p-12 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin text-[#E65338]" />
          <span>Loading persisted shift production reports from backend...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span>Failed to load daily production reports: {String((error as any)?.data?.message || 'Network error')}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-xl bg-[#E65338] text-white font-bold hover:bg-[#D24227]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && productionLogs.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#EAE2D9] p-12 text-center text-xs text-gray-500 space-y-3">
          <div className="font-bold text-[#252622] text-sm">No shift production reports recorded yet.</div>
          <p className="max-w-md mx-auto text-gray-400">
            Shift outputs, meter counts, and defect logs submitted by supervisors will appear here after server verification.
          </p>
          <button
            onClick={openDailyUpdateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm transition-all"
          >
            <PlusCircle size={14} />
            <span>Log Shift Output</span>
          </button>
        </div>
      )}

      {/* Production Logs Table */}
      {!isLoading && !isError && productionLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EAE2D9] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FBF6F0] border-b border-[#EAE2D9] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Log ID &amp; Date</th>
                  <th className="py-3.5 px-4">Order &amp; Fabric</th>
                  <th className="py-3.5 px-4">Lifecycle Process</th>
                  <th className="py-3.5 px-4">Shift Target</th>
                  <th className="py-3.5 px-4">Produced Metres</th>
                  <th className="py-3.5 px-4">Defects</th>
                  <th className="py-3.5 px-4">Supervisor Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D9]/60">
                {productionLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FBF6F0]/40 transition-colors">
                    <td className="py-4 px-4 font-mono">
                      <div className="font-extrabold text-[#252622]">{log.id}</div>
                      <div className="text-[10px] text-gray-500 font-sans flex items-center gap-1">
                        <Clock size={11} /> {log.date} &bull; {log.timestamp}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="font-mono font-bold text-[#E65338] bg-[#E65338]/10 px-1.5 py-0.5 rounded text-[11px]">
                        {log.orderId}
                      </span>
                      <div className="font-semibold text-gray-800 text-[11px] mt-0.5">{log.fabricName}</div>
                    </td>

                    <td className="py-4 px-4 font-semibold text-gray-700">
                      {log.process}
                    </td>

                    <td className="py-4 px-4 font-mono text-gray-600">
                      {log.dailyTarget}m
                    </td>

                    <td className="py-4 px-4 font-mono font-extrabold text-sm text-[#20845A]">
                      +{log.actualQty}m
                    </td>

                    <td className="py-4 px-4 font-mono font-bold text-[#E65338]">
                      {log.defectiveQty}m
                    </td>

                    <td className="py-4 px-4 text-gray-600 text-[11px] max-w-xs">
                      {log.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

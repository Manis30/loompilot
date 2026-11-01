import React from 'react';
import { Activity, PlusCircle, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { useMemo } from 'react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useGetSupervisorReportsQuery } from '../../../store/api/productionApi';

export const SupervisorProductionPage: React.FC = () => {
  const { productionLogs: localLogs, openDailyUpdateModal } = useSupervisor();
  const { data: reportsResponse } = useGetSupervisorReportsQuery(undefined);

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
        actualQty: r.outputs?.[0]?.produced || 650,
        defectiveQty: r.outputs?.[0]?.defective || 0,
        notes: r.notes || r.handoverNotes || 'Shift output recorded cleanly.',
        supervisor: r.supervisorName || 'Floor Supervisor',
        timestamp: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '14:30',
      }));
    }
    return localLogs;
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
            Shift A actual meters woven, greige inspection defects &amp; supervisor handover notes
          </p>
        </div>

        <button
          onClick={openDailyUpdateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm transition-all"
        >
          <PlusCircle size={15} />
          <span>Log Shift Output</span>
        </button>
      </div>

      {/* Production Logs Table */}
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
    </div>
  );
};


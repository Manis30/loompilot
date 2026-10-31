import React, { useState } from 'react';
import { Cpu, Users, CheckCircle2, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';

export const SupervisorResourcesPage: React.FC = () => {
  const { machines, employees } = useSupervisor();

  const [activeTab, setActiveTab] = useState<'machines' | 'operators'>('machines');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Resource &amp; Loom Availability
          </h1>
          <p className="text-xs text-gray-500">
            Tsudakoma &amp; Picanol machinery telemetry, operator certifications &amp; station allocation
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex p-1 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9]">
          <button
            onClick={() => setActiveTab('machines')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'machines'
                ? 'bg-[#252622] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#252622]'
            }`}
          >
            <Cpu size={14} />
            <span>Looms &amp; Machines ({machines.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('operators')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'operators'
                ? 'bg-[#252622] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#252622]'
            }`}
          >
            <Users size={14} />
            <span>Shift Personnel ({employees.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Machines */}
      {activeTab === 'machines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((m) => {
            const isBreakdown = m.status === 'Breakdown';
            return (
              <div
                key={m.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                  isBreakdown ? 'border-[#E65338]/40 ring-1 ring-[#E65338]/20' : 'border-[#EAE2D9]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-[#E65338]">{m.id}</span>
                    <h3 className="font-extrabold text-sm text-[#252622]">{m.name}</h3>
                    <div className="text-[11px] text-gray-500">{m.type} &bull; {m.line}</div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.status === 'Running'
                        ? 'bg-[#20845A]/10 text-[#20845A]'
                        : isBreakdown
                        ? 'bg-[#E65338]/10 text-[#E65338]'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9] mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Speed</div>
                    <div className="font-mono font-extrabold text-[#252622]">{m.rpm} RPM</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Efficiency</div>
                    <div className="font-mono font-extrabold text-[#20845A]">{m.efficiency}</div>
                  </div>
                </div>

                {isBreakdown && m.breakdownNote && (
                  <div className="mb-3 p-2.5 rounded-lg bg-[#E65338]/10 border border-[#E65338]/20 text-[11px] text-[#E65338] flex items-start gap-1.5">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{m.breakdownNote}</span>
                  </div>
                )}

                <div className="text-xs text-gray-600 flex items-center justify-between pt-2 border-t border-[#EAE2D9]">
                  <span>Order: <strong className="font-mono text-[#252622]">{m.assignedOrder}</strong></span>
                  <span className="text-[10px] text-gray-400">{m.lastUpdated}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Operators */}
      {activeTab === 'operators' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-[#EAE2D9] p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#252622] text-white flex items-center justify-center font-bold text-sm">
                    {emp.avatar}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#252622]">{emp.name}</h3>
                    <div className="text-xs text-gray-500">{emp.role}</div>
                  </div>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FBF6F0] px-2 py-0.5 rounded border border-[#EAE2D9] text-[#252622]">
                  {emp.skill}
                </span>
              </div>

              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9] text-xs space-y-1">
                <div>
                  <span className="text-gray-500">Station: </span>
                  <strong className="text-gray-800">{emp.station}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Shift: </span>
                  <span className="font-mono text-gray-700">{emp.shift}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-[#EAE2D9]">
                <span className="flex items-center gap-1 text-[#20845A] font-semibold">
                  <CheckCircle2 size={13} /> {emp.deployment}
                </span>
                <span>{emp.experience} Exp</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


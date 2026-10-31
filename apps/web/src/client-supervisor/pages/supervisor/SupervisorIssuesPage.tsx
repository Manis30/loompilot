import React, { useState } from 'react';
import { AlertTriangle, PlusCircle, CheckCircle2, Clock, Wrench, X } from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useApp } from '../../context/AppContext';

export const SupervisorIssuesPage: React.FC = () => {
  const { issues, reportIssue, orders, machines } = useSupervisor();
  const { addToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState('Machine Breakdown');
  const [relatedOrder, setRelatedOrder] = useState(orders[0]?.id || 'ORD-8092');
  const [machineId, setMachineId] = useState(machines[0]?.id || 'LOOM-A01');
  const [severity, setSeverity] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;

    reportIssue({
      category,
      relatedOrder,
      machineId,
      severity,
      description,
      impact,
    });

    addToast(`Issue reported for ${machineId}. Maintenance engineer notified.`, 'success');
    setDescription('');
    setImpact('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Issues, Breakdowns &amp; Maintenance Tickets
          </h1>
          <p className="text-xs text-gray-500">
            Loom stoppage alerts, warp breakages, raw yarn shortages &amp; technician resolutions
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm transition-all"
        >
          <PlusCircle size={15} />
          <span>Report New Floor Issue</span>
        </button>
      </div>

      {/* Issues List */}
      <div className="grid grid-cols-1 gap-4">
        {issues.map((iss) => {
          const isCritical = iss.severity === 'Critical' || iss.severity === 'High';
          return (
            <div
              key={iss.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 ${
                isCritical ? 'border-[#E65338]/30' : 'border-[#EAE2D9]'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#EAE2D9]">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-xs text-[#E65338]">{iss.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      iss.severity === 'Critical'
                        ? 'bg-[#E65338] text-white'
                        : iss.severity === 'High'
                        ? 'bg-[#E65338]/10 text-[#E65338]'
                        : 'bg-[#C78627]/10 text-[#C78627]'
                    }`}
                  >
                    {iss.severity} Priority
                  </span>
                  <span className="text-xs font-bold text-[#252622]">{iss.category}</span>
                </div>

                <div className="text-[11px] text-gray-500 font-mono">
                  {iss.date} &bull; {iss.time}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-500 text-[11px] mb-0.5 font-bold uppercase">Description</div>
                  <div className="font-medium text-[#252622]">{iss.description}</div>

                  <div className="text-gray-500 text-[11px] mt-2 mb-0.5 font-bold uppercase">Estimated Production Impact</div>
                  <div className="font-medium text-[#E65338]">{iss.impact}</div>
                </div>

                <div className="p-3.5 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Machine / Order
                    </span>
                    <span className="font-mono font-bold text-[#252622]">
                      {iss.machineId} &bull; {iss.relatedOrder}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#EAE2D9]/70">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5 flex items-center gap-1">
                      <Wrench size={11} className="text-[#20845A]" />
                      <span>Resolution Status: {iss.status}</span>
                    </div>
                    <div className="text-[11px] text-gray-700 italic">
                      "{iss.adminResponse || 'Investigating...'}"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252622]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#EAE2D9] shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-[#252622]"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E65338]/10 text-[#E65338] flex items-center justify-center font-bold">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#252622]">Report Floor Issue</h3>
                <p className="text-xs text-gray-500">Log loom stoppage, shortage or quality defect</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                  >
                    <option>Machine Breakdown</option>
                    <option>Material Shortage</option>
                    <option>Quality Defect</option>
                    <option>Employee Shortage</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                  >
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Machine / Station</label>
                  <select
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>{m.id} ({m.name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Related Order</label>
                  <select
                    value={relatedOrder}
                    onChange={(e) => setRelatedOrder(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                  >
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>{o.id} ({o.fabricName.slice(0, 18)}...)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Issue Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  required
                  placeholder="e.g. Sub-nozzle solenoid pressure drop on line 2..."
                  className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Production Impact</label>
                <input
                  type="text"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  placeholder="e.g. Line halted; 400m daily deficit expected..."
                  className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EAE2D9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-[#FBF6F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm"
                >
                  Submit Issue Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


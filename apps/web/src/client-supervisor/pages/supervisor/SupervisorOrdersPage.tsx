import React, { useState } from 'react';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  PlusCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { SUPERVISOR_PRODUCTION_STAGES } from '../../data/supervisorMockData';

export const SupervisorOrdersPage: React.FC = () => {
  const { orders, advanceOrderStage, openDailyUpdateModal } = useSupervisor();

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderSpecs, setSelectedOrderSpecs] = useState<any | null>(null);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === 'All' || o.status === filterStatus;
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.fabricName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Mill Manufacturing Orders
          </h1>
          <p className="text-xs text-gray-500">
            Assigned brand orders, fabric specifications &amp; 8-stage production lifecycle tracking
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
          {['All', 'In Progress', 'Newly Assigned', 'At Risk', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-[#252622] text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-[#EAE2D9] hover:bg-[#FBF6F0]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, fabrics, clients..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#EAE2D9] bg-white focus:outline-none focus:border-[#E65338]"
          />
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredOrders.map((ord) => {
          const percent = Math.min(100, Math.round((ord.producedQty / ord.totalQty) * 100));
          const currentStageIndex = SUPERVISOR_PRODUCTION_STAGES.findIndex((s) => s === ord.currentStage);

          return (
            <div
              key={ord.id}
              className="bg-white rounded-2xl border border-[#EAE2D9] p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#EAE2D9]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-[#252622]">{ord.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ord.status === 'Completed'
                          ? 'bg-[#20845A]/10 text-[#20845A]'
                          : ord.status === 'At Risk'
                          ? 'bg-[#E65338]/10 text-[#E65338]'
                          : ord.status === 'Newly Assigned'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-[#C78627]/10 text-[#C78627]'
                      }`}
                    >
                      {ord.status}
                    </span>
                    <span className="text-xs text-gray-500">&bull; Assigned: {ord.assignedDate}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-[#252622] mt-1">
                    {ord.fabricName}
                  </h3>
                  <div className="text-xs text-gray-500 font-medium">
                    Client: <strong className="text-[#252622]">{ord.clientName}</strong> &bull; Deadline: <span className="font-mono text-gray-700">{ord.deliveryDeadline}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedOrderSpecs(ord)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#252622] bg-[#FBF6F0] border border-[#EAE2D9] hover:bg-white transition-colors"
                  >
                    Tech Specs
                  </button>
                  <button
                    onClick={() => advanceOrderStage(ord.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm transition-all flex items-center gap-1"
                  >
                    <span>Advance Stage</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* 8-Stage Progress Stepper */}
              <div className="py-4">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Current Lifecycle: <span className="text-[#E65338]">{ord.currentStage}</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {SUPERVISOR_PRODUCTION_STAGES.map((st, idx) => {
                    const isPassed = idx <= currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    return (
                      <div
                        key={st}
                        className={`p-2 rounded-lg text-center border text-[10px] font-bold transition-all ${
                          isCurrent
                            ? 'bg-[#E65338] text-white border-[#E65338] shadow-sm'
                            : isPassed
                            ? 'bg-[#20845A]/10 text-[#20845A] border-[#20845A]/20'
                            : 'bg-[#FBF6F0] text-gray-400 border-[#EAE2D9]'
                        }`}
                      >
                        <div className="opacity-75">{idx + 1}</div>
                        <div className="truncate mt-0.5">{st.split('. ')[1]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Produced Metres Metric Bar */}
              <div className="pt-3 border-t border-[#EAE2D9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-gray-500">Produced: </span>
                    <strong className="font-mono text-[#252622]">{ord.producedQty.toLocaleString()}m</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Balance: </span>
                    <strong className="font-mono text-gray-700">{ord.remainingQty.toLocaleString()}m</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Total: </span>
                    <strong className="font-mono text-[#252622]">{ord.totalQty.toLocaleString()}m</strong>
                  </div>
                </div>

                <div className="w-full sm:w-48 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#E65338] rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-xs text-[#252622]">{percent}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tech Specs Drawer Modal */}
      {selectedOrderSpecs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252622]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#EAE2D9] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE2D9] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#E65338]">{selectedOrderSpecs.id}</span>
                <h3 className="text-base font-extrabold text-[#252622]">{selectedOrderSpecs.fabricName}</h3>
              </div>
              <button
                onClick={() => setSelectedOrderSpecs(null)}
                className="text-gray-400 hover:text-[#252622] p-1"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Composition</div>
                <div className="font-bold text-[#252622] mt-0.5">{selectedOrderSpecs.specs.composition}</div>
              </div>
              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Weave Structure</div>
                <div className="font-bold text-[#252622] mt-0.5">{selectedOrderSpecs.specs.weavePattern}</div>
              </div>
              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
                <div className="text-[10px] text-gray-500 font-bold uppercase">GSM &amp; Weight</div>
                <div className="font-bold text-[#252622] mt-0.5">{selectedOrderSpecs.specs.gsm}</div>
              </div>
              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Reed Space</div>
                <div className="font-bold text-[#252622] mt-0.5">{selectedOrderSpecs.specs.reedSpace}</div>
              </div>
              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Warp Yarn Count</div>
                <div className="font-bold text-[#252622] mt-0.5">{selectedOrderSpecs.specs.warpYarn}</div>
              </div>
              <div className="p-3 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Weft Yarn Count</div>
                <div className="font-bold text-[#252622] mt-0.5">{selectedOrderSpecs.specs.weftYarn}</div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-[#EAE2D9] text-xs">
              <span className="font-bold text-gray-600">Assigned Looms / Station: </span>
              <strong className="text-[#252622]">{selectedOrderSpecs.specs.assignedLooms}</strong>
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedOrderSpecs(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#252622] hover:bg-[#191A16]"
              >
                Close Specs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useMemo, useEffect } from 'react';
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
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { SUPERVISOR_PRODUCTION_STAGES } from '../../data/supervisorMockData';
import { useGetSupervisorOrdersQuery, useAdvanceOrderStageMutation } from '../../../store/api/ordersApi';
import { useGetClientsQuery } from '../../../store/api/catalogApi';
import { mapApiSupervisorOrder } from '../../../utils/orderMapper';
import type { SupervisorOrder } from '../../types/supervisor';

export const SupervisorOrdersPage: React.FC = () => {
  const { advanceOrderStage, openDailyUpdateModal } = useSupervisor();

  const { data: supervisorOrdersRes, isLoading, isError, error, refetch } = useGetSupervisorOrdersQuery();
  const { data: clientsRes } = useGetClientsQuery(undefined);

  const clientsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = clientsRes?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((c: any) => {
        if (c.id || c._id) map.set(String(c.id || c._id), c);
      });
    }
    return map;
  }, [clientsRes]);

  const liveOrders: SupervisorOrder[] = useMemo(() => {
    const raw = supervisorOrdersRes?.data || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((ord: any) => mapApiSupervisorOrder(ord, clientsMap));
  }, [supervisorOrdersRes, clientsMap]);

  const [orders, setOrders] = useState<SupervisorOrder[]>([]);

  useEffect(() => {
    if (supervisorOrdersRes && Array.isArray(supervisorOrdersRes.data)) {
      setOrders(liveOrders);
    }
  }, [supervisorOrdersRes, liveOrders]);

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderSpecs, setSelectedOrderSpecs] = useState<any | null>(null);
  const [advanceOrderStageMutation, { isLoading: isAdvancingStage }] = useAdvanceOrderStageMutation();
  const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);

  const handleAdvanceStage = async (orderId: string) => {
    if (isAdvancingStage) return;
    setStageError(null);
    setAdvancingOrderId(orderId);

    const ord = orders.find((o) => o.id === orderId);
    if (!ord) {
      setAdvancingOrderId(null);
      return;
    }

    const currentIndex = SUPERVISOR_PRODUCTION_STAGES.findIndex((s) => s === ord.currentStage);
    if (currentIndex >= SUPERVISOR_PRODUCTION_STAGES.length - 1) {
      setAdvancingOrderId(null);
      return;
    }
    const nextStage = SUPERVISOR_PRODUCTION_STAGES[currentIndex + 1];

    // Find the real 24-character ObjectId from raw supervisor order query
    const rawList = supervisorOrdersRes?.data || [];
    const rawOrder = Array.isArray(rawList)
      ? rawList.find((o: any) => o._id === orderId || o.id === orderId || o.orderNumber === orderId)
      : null;
    const realOrderId = rawOrder?._id || rawOrder?.id || (orderId.length === 24 ? orderId : null);

    if (realOrderId) {
      try {
        const nextPercent = Math.min(100, Math.round(((currentIndex + 2) / SUPERVISOR_PRODUCTION_STAGES.length) * 100));
        await advanceOrderStageMutation({
          id: realOrderId,
          stage: nextStage,
          producedQty: ord.producedQty,
          percentComplete: nextPercent,
        }).unwrap();

        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                currentStage: nextStage,
                status: nextStage === '8. Delivered' ? 'Completed' : 'In Progress',
              };
            }
            return o;
          })
        );
        advanceOrderStage(orderId);
        refetch();
      } catch (err: any) {
        const errMsg = err?.data?.message || err?.message || 'Failed to advance stage on server';
        setStageError(`Error advancing stage for order ${orderId}: ${errMsg}`);
      } finally {
        setAdvancingOrderId(null);
      }
    } else {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              currentStage: nextStage,
              status: nextStage === '8. Delivered' ? 'Completed' : 'In Progress',
            };
          }
          return o;
        })
      );
      advanceOrderStage(orderId);
      setAdvancingOrderId(null);
    }
  };

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
      {stageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{stageError}</span>
          </div>
          <button
            onClick={() => setStageError(null)}
            className="text-red-500 hover:text-red-800 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-[#252622] bg-[#FBF6F0] border border-[#EAE2D9] hover:bg-white shadow-sm transition-all"
            title="Reload orders from backend API"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#E65338]' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Orders'}</span>
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

      {/* API Status Banners */}
      {isLoading && (
        <div className="p-4 rounded-2xl bg-white border border-[#EAE2D9] flex items-center gap-3 text-xs text-[#252622] font-semibold">
          <RefreshCw size={16} className="animate-spin text-[#E65338]" />
          <span>Synchronizing assigned orders from live supervisor API...</span>
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span>Failed to load supervisor orders: {String((error as any)?.data?.message || (error as any)?.error || 'Network error')}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-xl bg-[#E65338] text-white font-bold text-xs hover:bg-[#D24227]"
          >
            Retry
          </button>
        </div>
      )}

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
                    onClick={() => handleAdvanceStage(ord.id)}
                    disabled={isAdvancingStage && advancingOrderId === ord.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-1"
                  >
                    {isAdvancingStage && advancingOrderId === ord.id ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Advancing...</span>
                      </>
                    ) : (
                      <>
                        <span>Advance Stage</span>
                        <ArrowRight size={13} />
                      </>
                    )}
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
        {filteredOrders.length === 0 && !isLoading && (
          <div className="bg-white rounded-2xl border border-[#EAE2D9] p-12 text-center text-xs text-gray-500">
            No mill manufacturing orders match the selected filter or search term.
          </div>
        )}
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


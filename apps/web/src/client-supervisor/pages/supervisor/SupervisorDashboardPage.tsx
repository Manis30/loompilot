import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Layers,
  Package,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  Cpu,
  PlusCircle,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useApp } from '../../context/AppContext';
import { useGetSupervisorOrdersQuery, useAdvanceOrderStageMutation } from '../../../store/api/ordersApi';
import { useGetMachinesQuery, useGetClientsQuery, useGetProductsQuery } from '../../../store/api/catalogApi';
import { useGetMaintenanceTicketsQuery } from '../../../store/api/productionApi';
import { mapApiSupervisorOrder } from '../../../utils/orderMapper';
import { SUPERVISOR_PRODUCTION_STAGES } from '../../data/supervisorMockData';

export const SupervisorDashboardPage: React.FC = () => {
  const {
    orders: localOrders,
    machines: localMachines,
    employees,
    issues: localIssues,
    openDailyUpdateModal,
    advanceOrderStage,
  } = useSupervisor();
  const { addToast } = useApp();

  const { data: supervisorOrdersResponse } = useGetSupervisorOrdersQuery(undefined);
  const { data: machinesResponse } = useGetMachinesQuery(undefined);
  const { data: ticketsResponse } = useGetMaintenanceTicketsQuery(undefined);
  const { data: clientsResponse } = useGetClientsQuery(undefined);
  const { data: productsResponse } = useGetProductsQuery(undefined);
  const [advanceOrderStageMutation] = useAdvanceOrderStageMutation();

  const clientsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = clientsResponse?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((c: any) => {
        if (c.id || c._id) map.set(String(c.id || c._id), c);
      });
    }
    return map;
  }, [clientsResponse]);

  const productsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = productsResponse?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((p: any) => {
        if (p.id || p._id) map.set(String(p.id || p._id), p);
      });
    }
    return map;
  }, [productsResponse]);

  const orders = useMemo(() => {
    const raw = supervisorOrdersResponse?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item) => mapApiSupervisorOrder(item, clientsMap));
    }
    return localOrders;
  }, [supervisorOrdersResponse, clientsMap, localOrders]);

  const machines = useMemo(() => {
    const raw = machinesResponse?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((m: any) => ({
        id: String(m.machineNumber || m.id || m._id),
        name: m.name || `Loom ${m.machineNumber}`,
        type: m.type || 'Airjet Loom',
        process: m.process || 'Knitting / Weaving',
        status: (m.status === 'active' || m.status === 'running' ? 'Running' : m.status === 'maintenance' ? 'Breakdown' : 'Available') as 'Running' | 'Breakdown' | 'Available' | 'Maintenance',
        lastUpdated: 'Live telemetry',
        rpm: m.rpm || 750,
        efficiency: `${m.efficiencyPercent || 92}%`,
        assignedOrder: m.currentOrderId || 'LP-901',
        line: m.shed || 'Shed A',
      }));
    }
    return localMachines;
  }, [machinesResponse, localMachines]);

  const issues = useMemo(() => {
    const raw = ticketsResponse?.data || [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((t: any) => ({
        id: String(t.ticketNumber || t.id || t._id),
        date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Today',
        time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
        machineId: t.machineId || 'Loom-01',
        shed: t.shed || 'Shed A',
        issueType: t.issueType || 'Mechanical',
        description: t.description || t.title || 'Maintenance check',
        reportedBy: t.reportedBy || 'Floor Supervisor',
        status: t.status === 'resolved' || t.status === 'closed' ? 'Resolved' : 'Pending',
        priority: t.priority || 'Medium',
      }));
    }
    return localIssues;
  }, [ticketsResponse, localIssues]);

  const totalTarget = orders.reduce((acc, o) => acc + (o.dailyTarget || 0), 0);
  const activeMachines = machines.filter((m) => m.status === 'Running').length;
  const criticalIssues = issues.filter((i) => i.status !== 'Resolved').length;

  const handleAdvanceStage = async (ord: any) => {
    const currentIndex = SUPERVISOR_PRODUCTION_STAGES.findIndex((s) => s === ord.currentStage);
    if (currentIndex === -1 || currentIndex >= SUPERVISOR_PRODUCTION_STAGES.length - 1) return;
    const nextStage = SUPERVISOR_PRODUCTION_STAGES[currentIndex + 1];

    const targetId = ord.backendId || ord.id;
    try {
      await advanceOrderStageMutation({
        id: targetId,
        stage: nextStage.toLowerCase().replace(/\s+/g, '_'),
      }).unwrap();
      advanceOrderStage(ord.id);
      addToast(`Order ${ord.id} advanced to ${nextStage}`, 'success');
    } catch (err: any) {
      console.error('Backend advance stage error:', err);
      const errMsg =
        err?.data?.message ||
        err?.data?.error?.message ||
        err?.error ||
        err?.message ||
        'Failed to advance order stage on server';
      addToast(errMsg, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Shift Live Ticker */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20845A] animate-pulse"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#20845A]">
              Shift A Telemetry Online &bull; Palladam Weaving Cluster
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622] mt-1">
            Factory Floor Operations Dashboard
          </h1>
          <p className="text-xs text-gray-500">
            Real-time shop floor performance across Airjet &amp; Rapier loom sheds A &amp; B.
          </p>
        </div>

        <button
          onClick={openDailyUpdateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md shadow-[#E65338]/30 transition-all flex-shrink-0"
        >
          <PlusCircle size={15} />
          <span>Log Daily Shift Output</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Looms Active */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Looms</div>
            <div className="text-2xl font-black text-[#252622] mt-1">
              {activeMachines} <span className="text-sm font-semibold text-gray-400">/ {machines.length}</span>
            </div>
            <div className="text-[11px] text-[#20845A] font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Shed A &amp; B Running
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#20845A]/10 text-[#20845A] flex items-center justify-center">
            <Cpu size={24} />
          </div>
        </div>

        {/* Daily Production */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Shift Daily Target</div>
            <div className="text-2xl font-black text-[#252622] mt-1">
              {totalTarget.toLocaleString()} <span className="text-sm font-semibold text-gray-400">Metres</span>
            </div>
            <div className="text-[11px] text-[#E65338] font-bold mt-1 flex items-center gap-1">
              <TrendingUp size={12} /> 85.8% Target Velocity
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#E65338]/10 text-[#E65338] flex items-center justify-center">
            <Activity size={24} />
          </div>
        </div>

        {/* Weaving Efficiency */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Weaving Efficiency</div>
            <div className="text-2xl font-black text-[#252622] mt-1">94.2%</div>
            <div className="text-[11px] text-[#20845A] font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Above 90% Benchmark
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers size={24} />
          </div>
        </div>

        {/* Active Issues */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Floor Tickets</div>
            <div className="text-2xl font-black text-[#252622] mt-1">
              {criticalIssues} <span className="text-sm font-semibold text-gray-400">Pending</span>
            </div>
            <div className="text-[11px] text-[#C78627] font-bold mt-1 flex items-center gap-1">
              <Clock size={12} /> Technician Dispatched
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#C78627]/10 text-[#C78627] flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Active Mill Orders Section */}
      <div className="bg-white rounded-2xl border border-[#EAE2D9] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#252622]">Active Manufacturing Orders in Progress</h2>
            <p className="text-xs text-gray-500">Track current stage progression across the strict 8-stage textile lifecycle</p>
          </div>
          <Link
            to="/supervisor/orders"
            className="text-xs font-bold text-[#E65338] hover:underline flex items-center gap-1"
          >
            <span>View All Orders</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#EAE2D9] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Order ID</th>
                <th className="py-3 px-3">Fabric Construction</th>
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">Current Stage</th>
                <th className="py-3 px-3">Progress (Metres)</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE2D9]/60">
              {orders.slice(0, 5).map((ord) => {
                const percent = Math.min(100, Math.round((ord.producedQty / ord.totalQty) * 100));
                return (
                  <tr key={ord.id} className="hover:bg-[#FBF6F0]/60 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-extrabold text-[#252622]">
                      {ord.id}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[#252622]">
                      <div>{ord.fabricName}</div>
                      <div className="text-[10px] text-gray-500 font-normal">{ord.specs.weavePattern} &bull; {ord.specs.gsm}</div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-gray-700">{ord.clientName}</td>
                    <td className="py-3.5 px-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E65338]/10 text-[#E65338]">
                        {ord.currentStage}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span>{ord.producedQty.toLocaleString()}m</span>
                        <span className="text-gray-400">/ {ord.totalQty.toLocaleString()}m ({percent}%)</span>
                      </div>
                      <div className="w-36 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-[#E65338] rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => handleAdvanceStage(ord)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[#252622] hover:bg-[#E65338] transition-colors"
                        title="Advance order to next lifecycle stage"
                      >
                        Advance Stage &rarr;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loom Shed Telemetry Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machine Status */}
        <div className="bg-white rounded-2xl border border-[#EAE2D9] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#252622]">Loom Shed Machine Telemetry</h3>
              <p className="text-xs text-gray-500">Live RPM speeds &amp; status of Tsudakoma / Picanol air-jets</p>
            </div>
            <Link to="/supervisor/resources" className="text-xs font-bold text-[#E65338] hover:underline">
              All Machines &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {machines.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#252622]">{m.id} — {m.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.status === 'Running'
                          ? 'bg-[#20845A]/10 text-[#20845A]'
                          : m.status === 'Breakdown'
                          ? 'bg-[#E65338]/10 text-[#E65338]'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                    {m.line} &bull; Order: {m.assignedOrder}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-extrabold font-mono text-[#252622]">
                    {m.rpm} RPM
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Eff: {m.efficiency}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shift A Operator Roster */}
        <div className="bg-white rounded-2xl border border-[#EAE2D9] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#252622]">Shift Personnel Roster</h3>
              <p className="text-xs text-gray-500">Weavers, knotters, and inspection leads active in Shift A</p>
            </div>
            <span className="text-xs font-bold text-[#20845A] bg-[#20845A]/10 px-2.5 py-1 rounded-full">
              {employees.length} Operators Deployed
            </span>
          </div>

          <div className="space-y-3">
            {employees.slice(0, 4).map((emp) => (
              <div
                key={emp.id}
                className="p-3 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#252622] text-white flex items-center justify-center font-bold text-xs">
                    {emp.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#252622]">{emp.name}</div>
                    <div className="text-[11px] text-gray-500">{emp.role}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#EAE2D9] text-[#252622]">
                    {emp.skill}
                  </span>
                  <div className="text-[10px] text-[#20845A] font-semibold mt-0.5">
                    &bull; {emp.deployment}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


import React, { useState, useMemo } from 'react';
import { Cpu, Users, CheckCircle2, AlertTriangle, RefreshCw, Wrench, CheckCircle, Loader2 } from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useGetMachinesQuery } from '../../../store/api/catalogApi';
import { useUpdateMachineStatusMutation } from '../../../store/api/machinesApi';
import { mapApiMachineToSupervisorMachine } from './machineMapper';
import { Machine } from '../../types/supervisor';

export const SupervisorResourcesPage: React.FC = () => {
  const { employees } = useSupervisor();

  const {
    data: machinesResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetMachinesQuery(undefined);

  const [activeTab, setActiveTab] = useState<'machines' | 'operators'>('machines');

  const [updateMachineStatus, { isLoading: isUpdatingStatus }] = useUpdateMachineStatusMutation();
  const [updatingMachineId, setUpdatingMachineId] = useState<string | null>(null);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [statusSuccessMessage, setStatusSuccessMessage] = useState<string | null>(null);

  const handleUpdateStatus = async (machineCodeOrId: string, newStatus: 'available' | 'maint') => {
    if (isUpdatingStatus) return;
    setStatusActionError(null);
    setStatusSuccessMessage(null);
    setUpdatingMachineId(machineCodeOrId);

    const rawMatch = rawMachines.find(
      (rm) => String(rm._id) === machineCodeOrId || rm.id === machineCodeOrId || rm.machineCode === machineCodeOrId
    );
    const targetId = rawMatch ? String(rawMatch._id || rawMatch.id || rawMatch.machineCode) : machineCodeOrId;

    try {
      await updateMachineStatus({
        id: targetId,
        status: newStatus,
        notes: `Supervisor updated status to ${newStatus}`,
      }).unwrap();

      const label = newStatus === 'available' ? 'Available' : 'Maintenance';
      setStatusSuccessMessage(`Machine ${machineCodeOrId} marked as ${label}`);
      setTimeout(() => setStatusSuccessMessage(null), 4000);
      refetch();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to update machine status';
      setStatusActionError(`Machine ${machineCodeOrId}: ${errMsg}`);
    } finally {
      setUpdatingMachineId(null);
    }
  };

  const rawMachines: any[] = useMemo(() => {
    if (!machinesResponse) return [];
    if (Array.isArray(machinesResponse)) return machinesResponse;
    if (Array.isArray(machinesResponse.data)) return machinesResponse.data;
    return [];
  }, [machinesResponse]);

  const machines: Machine[] = useMemo(() => {
    return rawMachines.map(mapApiMachineToSupervisorMachine);
  }, [rawMachines]);

  const getErrorMessage = (err: any): string => {
    if (!err) return 'Failed to load factory machinery from API';
    if (typeof err === 'string') return err;
    if (err.data?.message) return err.data.message;
    if (err.error) return err.error;
    if (err.message) return err.message;
    return 'Unable to fetch machines. Please check server connection or authentication.';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Resource &amp; Loom Availability
          </h1>
          <p className="text-xs text-gray-500">
            Factory machinery telemetry, operator certifications &amp; station allocation
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'machines' && (
            <button
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EAE2D9] bg-white text-gray-600 hover:text-[#252622] text-xs font-bold transition-colors disabled:opacity-50"
              title="Refresh machinery telemetry"
            >
              <RefreshCw size={13} className={isLoading || isFetching ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          )}

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
              <span>Looms &amp; Machines ({isLoading ? '...' : machines.length})</span>
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
      </div>

      {/* Tab 1: Machines */}
      {activeTab === 'machines' && (
        <div className="space-y-4">
          {/* Status Action Error Banner */}
          {statusActionError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                <span className="font-semibold">{statusActionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusActionError(null)}
                className="text-red-700 hover:text-red-900 font-bold ml-2"
              >
                &times;
              </button>
            </div>
          )}

          {/* Status Action Success Banner */}
          {statusSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                <span className="font-semibold">{statusSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                &times;
              </button>
            </div>
          )}

          {/* Error Banner */}
          {isError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold">Failed to load factory machinery</h4>
                  <p className="text-xs text-red-700 mt-1 max-w-xl">{getErrorMessage(error)}</p>
                </div>
              </div>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors flex-shrink-0"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#EAE2D9] p-5 shadow-sm animate-pulse space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-16" />
                      <div className="h-4 bg-gray-200 rounded w-36" />
                      <div className="h-3 bg-gray-100 rounded w-24" />
                    </div>
                    <div className="h-5 bg-gray-200 rounded-full w-16" />
                  </div>
                  <div className="h-16 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]" />
                  <div className="h-4 bg-gray-100 rounded w-full pt-2" />
                </div>
              ))}
            </div>
          )}

          {/* Live Machine Cards */}
          {!isLoading && !isError && machines.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((m) => {
                const isBreakdown = m.status === 'Breakdown';
                return (
                  <div
                    key={m.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
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

                    <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-[#EAE2D9]">
                      <span className="text-[11px] font-bold text-gray-500">Status Action:</span>
                      <div className="flex items-center gap-1.5">
                        {m.status !== 'Running' && (
                          <button
                            type="button"
                            disabled={isUpdatingStatus && updatingMachineId === m.id}
                            onClick={() => handleUpdateStatus(m.id, 'available')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#20845A]/10 text-[#20845A] hover:bg-[#20845A]/20 transition-colors disabled:opacity-50"
                            title="Mark machine Available"
                          >
                            {isUpdatingStatus && updatingMachineId === m.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <CheckCircle size={11} />
                            )}
                            <span>Mark Available</span>
                          </button>
                        )}
                        {m.status !== 'Maintenance' && (
                          <button
                            type="button"
                            disabled={isUpdatingStatus && updatingMachineId === m.id}
                            onClick={() => handleUpdateStatus(m.id, 'maint')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                            title="Mark machine for Maintenance"
                          >
                            {isUpdatingStatus && updatingMachineId === m.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Wrench size={11} />
                            )}
                            <span>Maintenance</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && machines.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#EAE2D9] p-8 space-y-3">
              <p className="text-base font-bold text-[#252622]">No Factory Machines Found</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No active machinery records exist in this tenant database. Please contact mill maintenance administration.
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#252622] text-white hover:bg-black transition-colors"
              >
                Reload Machinery
              </button>
            </div>
          )}
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

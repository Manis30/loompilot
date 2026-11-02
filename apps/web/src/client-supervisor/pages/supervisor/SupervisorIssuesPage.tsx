import React, { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, PlusCircle, CheckCircle2, Clock, Wrench, X, Loader2, RefreshCw } from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useApp } from '../../context/AppContext';
import {
  useGetMaintenanceTicketsQuery,
  useCreateMaintenanceTicketMutation,
  useUpdateMaintenanceTicketMutation,
} from '../../../store/api/productionApi';
import { useGetMachinesQuery } from '../../../store/api/catalogApi';
import type { IssueTicket } from '../../types/supervisor';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const SupervisorIssuesPage: React.FC = () => {
  const { issues: mockIssues, reportIssue, orders, machines: mockMachines } = useSupervisor();
  const { addToast } = useApp();

  const {
    data: ticketsRes,
    isLoading: isLoadingTickets,
    isError: isTicketsError,
    error: ticketsError,
    refetch: refetchTickets,
  } = useGetMaintenanceTicketsQuery(undefined);

  const {
    data: machinesRes,
    isLoading: isLoadingMachines,
    isError: isMachinesError,
    refetch: refetchMachines,
  } = useGetMachinesQuery(undefined);

  const [createMaintenanceTicket, { isLoading: isSubmittingTicket }] = useCreateMaintenanceTicketMutation();
  const [updateMaintenanceTicket, { isLoading: isUpdatingTicket }] = useUpdateMaintenanceTicketMutation();

  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);

  const availableMachines = useMemo(() => {
    const rawList = Array.isArray(machinesRes?.data) ? machinesRes.data : [];
    if (rawList.length > 0) {
      return rawList.map((m: any) => ({
        id: String(m._id || m.id),
        code: m.machineCode || m.id,
        name: m.machineName || m.name || 'Textile Machine',
      }));
    }
    return isDemo ? mockMachines.map((m) => ({ id: m.id, code: m.id, name: m.name })) : [];
  }, [machinesRes, mockMachines]);

  const liveIssues: IssueTicket[] = useMemo(() => {
    const rawList = ticketsRes?.data || [];
    if (!Array.isArray(rawList)) return [];
    return rawList.map((t: any) => {
      const machineObj = typeof t.machineId === 'object' ? t.machineId : null;
      const machineCode = machineObj?.machineCode || (typeof t.machineId === 'string' ? t.machineId : 'Machine');
      const machineName = machineObj?.machineName;
      const createdDate = t.createdAt ? new Date(t.createdAt) : new Date();

      let statusLabel: 'Open' | 'Technician Assigned' | 'Resolved' = 'Open';
      if (t.status === 'assigned') statusLabel = 'Technician Assigned';
      else if (t.status === 'resolved') statusLabel = 'Resolved';

      // Parse structured category and description if formatted as "Category: Description"
      let parsedCategory = 'Machine Breakdown';
      let parsedDescription = t.issue || 'Breakdown reported';
      if (t.issue && t.issue.includes(': ')) {
        const colonIdx = t.issue.indexOf(': ');
        parsedCategory = t.issue.slice(0, colonIdx);
        parsedDescription = t.issue.slice(colonIdx + 2);
      }

      // Parse severity, order, and impact from notes if structured
      let parsedSeverity: 'Critical' | 'High' | 'Medium' | 'Low' = 'High';
      let parsedOrder = 'Floor Station';
      let parsedImpact = t.notes || 'Maintenance triage initiated';
      if (t.notes) {
        const sevMatch = t.notes.match(/Severity:\s*(Critical|High|Medium|Low)/i);
        if (sevMatch) {
          const matched = sevMatch[1];
          parsedSeverity = (matched.charAt(0).toUpperCase() + matched.slice(1).toLowerCase()) as any;
        }
        const ordMatch = t.notes.match(/Related Order:\s*([^|]+)/i) || t.notes.match(/Order:\s*([^|]+)/i);
        if (ordMatch) {
          parsedOrder = ordMatch[1].trim();
        }
        const impMatch = t.notes.match(/Impact:\s*(.+)/i);
        if (impMatch) {
          parsedImpact = impMatch[1].trim();
        }
      }

      const rawMachineId = machineObj
        ? String(machineObj._id || machineObj.id)
        : (typeof t.machineId === 'string' && t.machineId.length === 24 ? t.machineId : undefined);

      return {
        id: String(t._id || t.id || ''),
        rawStatus: t.status,
        backendMachineId: rawMachineId,
        date: createdDate.toISOString().split('T')[0],
        time: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: parsedCategory,
        relatedOrder: parsedOrder,
        machineId: machineName ? `${machineCode} (${machineName})` : machineCode,
        severity: parsedSeverity,
        description: parsedDescription,
        impact: parsedImpact,
        status: statusLabel,
        adminResponse: t.technicianName
          ? `Assigned to: ${t.technicianName}${t.technicianContact ? ` (${t.technicianContact})` : ''}`
          : t.status === 'resolved'
          ? (t.resolvedAt ? `Resolved on ${new Date(t.resolvedAt).toLocaleDateString()}` : 'Issue resolved & verified')
          : 'Maintenance triage initiated.',
      };
    });
  }, [ticketsRes]);

  const displayedIssues = isDemo ? (liveIssues.length > 0 ? liveIssues : mockIssues) : liveIssues;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState('Machine Breakdown');
  const [relatedOrder, setRelatedOrder] = useState<string>(() => orders[0]?.id || '');
  const [machineId, setMachineId] = useState<string>(() => availableMachines[0]?.id || '');
  const [severity, setSeverity] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Synchronize machine selection when availableMachines loads
  useEffect(() => {
    if (!machineId && availableMachines.length > 0) {
      setMachineId(availableMachines[0].id);
    }
  }, [availableMachines, machineId]);

  // Synchronize order selection when orders load
  useEffect(() => {
    if (!relatedOrder && orders.length > 0) {
      setRelatedOrder(orders[0].id);
    }
  }, [orders, relatedOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isSubmittingTicket) return;
    setSubmitError(null);

    // Resolve real backend machine ID
    const rawList = Array.isArray(machinesRes?.data) ? machinesRes.data : [];
    const matched = rawList.find(
      (m: any) => String(m._id) === machineId || m.id === machineId || m.machineCode === machineId
    );
    const targetMachineId = matched ? String(matched._id || matched.id) : (isDemo ? machineId : undefined);

    if (!isDemo && !targetMachineId) {
      setSubmitError('Please select a valid factory machine from the available machine list.');
      return;
    }

    const constructedNotes = `Severity: ${severity}${relatedOrder ? ` | Related Order: ${relatedOrder}` : ''}${impact.trim() ? ` | Impact: ${impact.trim()}` : ''}`;

    if (!isDemo && targetMachineId) {
      try {
        await createMaintenanceTicket({
          machineId: targetMachineId,
          issue: `${category}: ${description.trim()}`,
          notes: constructedNotes,
        }).unwrap();

        addToast('Breakdown ticket submitted for machine. Maintenance engineer notified.', 'success');
        setDescription('');
        setImpact('');
        setIsModalOpen(false);
        refetchTickets();
      } catch (err: any) {
        const errMsg = err?.data?.error?.message || err?.data?.message || err?.message || 'Failed to submit maintenance ticket';
        setSubmitError(errMsg);
      }
    } else if (isDemo) {
      reportIssue({
        category,
        relatedOrder: relatedOrder || 'ORD-DEMO',
        machineId: matched?.machineCode || machineId || 'LOOM-DEMO',
        severity,
        description: description.trim(),
        impact: impact.trim() || 'Floor inspection scheduled',
      });

      addToast('Breakdown ticket recorded (demo mode).', 'success');
      setDescription('');
      setImpact('');
      setIsModalOpen(false);
    }
  };

  const handleResolveIssue = async (ticket: any) => {
    // State machine guard: only open or assigned tickets may transition to resolved
    const rawStatus = (ticket.rawStatus || '').toLowerCase();
    const isPermitted =
      rawStatus === 'open' ||
      rawStatus === 'assigned' ||
      ticket.status === 'Open' ||
      ticket.status === 'Technician Assigned';

    if (!isPermitted) {
      addToast(`Cannot resolve ticket: Current status '${ticket.status}' does not permit resolution.`, 'error');
      return;
    }

    if (resolvingTicketId || isUpdatingTicket) return;
    setResolvingTicketId(ticket.id);

    if (!isDemo) {
      try {
        await updateMaintenanceTicket({
          id: ticket.id,
          machineId: ticket.backendMachineId,
          status: 'resolved',
          notes: 'Issue verified & resolved by floor supervisor',
        }).unwrap();

        addToast('Maintenance ticket resolved and verified.', 'success');
        refetchTickets();
        refetchMachines();
      } catch (err: any) {
        const errMsg = err?.data?.error?.message || err?.data?.message || err?.message || 'Failed to resolve maintenance ticket';
        addToast(errMsg, 'error');
      } finally {
        setResolvingTicketId(null);
      }
    } else {
      addToast('Maintenance ticket marked as resolved (demo mode).', 'success');
      setResolvingTicketId(null);
    }
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchTickets()}
            disabled={isLoadingTickets}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#252622] bg-[#FBF6F0] border border-[#EAE2D9] hover:bg-white transition-all disabled:opacity-50"
            title="Refresh tickets"
          >
            <RefreshCw size={13} className={isLoadingTickets ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setSubmitError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm transition-all"
          >
            <PlusCircle size={15} />
            <span>Report New Floor Issue</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoadingTickets && displayedIssues.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-[#EAE2D9]">
          <Loader2 className="animate-spin mx-auto text-[#E65338] mb-2" size={24} />
          <p className="text-xs text-gray-500">Loading maintenance tickets...</p>
        </div>
      )}

      {/* Error state */}
      {isTicketsError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>
              {(ticketsError as any)?.data?.message ||
                (ticketsError as any)?.error ||
                'Failed to load live maintenance tickets from backend.'}
            </span>
          </div>
          <button onClick={() => refetchTickets()} className="font-bold underline text-xs">Retry</button>
        </div>
      )}

      {/* Issues List */}
      <div className="grid grid-cols-1 gap-4">
        {displayedIssues.map((iss) => {
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

                  <div className="pt-2 border-t border-[#EAE2D9]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5 flex items-center gap-1">
                        <Wrench size={11} className={iss.status === 'Resolved' ? 'text-[#20845A]' : 'text-[#C78627]'} />
                        <span>Resolution Status: {iss.status}</span>
                      </div>
                      <div className="text-[11px] text-gray-700 italic">
                        "{iss.adminResponse || 'Investigating...'}"
                      </div>
                    </div>

                    {iss.status !== 'Resolved' && (iss.rawStatus === 'open' || iss.rawStatus === 'assigned' || iss.status === 'Open' || iss.status === 'Technician Assigned') ? (
                      <button
                        onClick={() => handleResolveIssue(iss)}
                        disabled={resolvingTicketId === iss.id || isUpdatingTicket}
                        className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#20845A] hover:bg-[#196B49] transition-all disabled:opacity-50 shadow-sm"
                        title="Mark issue as resolved on server"
                      >
                        {resolvingTicketId === iss.id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Resolving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} />
                            <span>Mark Resolved</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="self-start sm:self-auto flex items-center gap-1 text-[11px] font-bold text-[#20845A]">
                        <CheckCircle2 size={13} />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!isLoadingTickets && !isTicketsError && displayedIssues.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-[#EAE2D9]">
            <CheckCircle2 className="mx-auto text-green-600 mb-2" size={32} />
            <p className="text-sm font-bold text-[#252622]">No Active Breakdown Issues</p>
            <p className="text-xs text-gray-500 mt-1">All machinery is currently operating normally without open maintenance tickets.</p>
          </div>
        )}
      </div>

      {/* Report Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252622]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#EAE2D9] shadow-2xl p-6 relative">
            <button
              onClick={() => !isSubmittingTicket && setIsModalOpen(false)}
              disabled={isSubmittingTicket}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-[#252622] disabled:opacity-50"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E65338]/10 text-[#E65338] flex items-center justify-center font-bold">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#252622]">Report Floor Issue / Breakdown</h3>
                <p className="text-xs text-gray-500">Log loom stoppage, breakdown or defect to maintenance</p>
              </div>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
                <span>{submitError}</span>
                <button type="button" onClick={() => setSubmitError(null)} className="font-bold ml-2">&times;</button>
              </div>
            )}

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
                    disabled={availableMachines.length === 0}
                    className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] disabled:opacity-60"
                  >
                    {isLoadingMachines ? (
                      <option value="">Loading machines...</option>
                    ) : isMachinesError ? (
                      <option value="">Error loading machines from server</option>
                    ) : availableMachines.length === 0 ? (
                      <option value="">No factory machines registered</option>
                    ) : (
                      availableMachines.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.code} ({m.name})</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Related Order</label>
                  <select
                    value={relatedOrder}
                    onChange={(e) => setRelatedOrder(e.target.value)}
                    className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]"
                  >
                    {orders.length === 0 ? (
                      <option value="">No active production orders (Floor Station)</option>
                    ) : (
                      orders.map((o) => (
                        <option key={o.id} value={o.id}>{o.id} ({o.fabricName ? o.fabricName.slice(0, 18) : 'Order'}...)</option>
                      ))
                    )}
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
                  disabled={isSubmittingTicket}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-[#FBF6F0] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket || (!isDemo && availableMachines.length === 0)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                >
                  {isSubmittingTicket ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Issue Ticket</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

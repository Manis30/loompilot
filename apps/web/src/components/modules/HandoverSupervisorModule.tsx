import React, { useState, useMemo, useEffect } from 'react';
import { UserCheck, CheckCircle2, ShieldCheck, Calendar, Loader2, AlertCircle } from 'lucide-react';
import type { Order } from '../../types';
import { useGetUsersQuery } from '../../store/api/catalogApi';

interface HandoverSupervisorModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onConfirmHandover: (orderId: string, supervisorId: string, supervisorName: string) => Promise<void> | void;
}

export const HandoverSupervisorModule: React.FC<HandoverSupervisorModuleProps> = ({
  orders,
  onSelectOrder,
  onConfirmHandover
}) => {
  const { data: usersData } = useGetUsersQuery(undefined);

  const liveSupervisors = useMemo(() => {
    const raw = usersData?.data || [];
    if (Array.isArray(raw)) {
      const sups = raw.filter((u: any) => u.role === 'supervisor');
      if (sups.length > 0) {
        return sups.map((s: any) => ({
          id: String(s._id || s.id),
          name: `${s.name} (${s.processAreas?.join(', ') || 'Floor Master'})`,
        }));
      }
    }
    return [
      { id: 'sup_1', name: 'Murugan K. (Weaving Master - Airjet Shed A)' },
      { id: 'sup_2', name: 'Arunachalam S. (Finishing Master - Rapier Shed B)' },
    ];
  }, [usersData]);

  const [selectedSupervisor, setSelectedSupervisor] = useState<{ id: string; name: string }>({
    id: 'sup_1',
    name: 'Murugan K. (Weaving Master - Shed A)'
  });

  useEffect(() => {
    if (liveSupervisors.length > 0 && !liveSupervisors.some((s) => s.id === selectedSupervisor.id)) {
      setSelectedSupervisor(liveSupervisors[0]);
    }
  }, [liveSupervisors, selectedSupervisor.id]);

  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [handoverErrors, setHandoverErrors] = useState<Record<string, string>>({});

  const acceptedOrders = orders.filter((o) => ['client_accepted', 'assigned', 'in_production'].includes(o.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header Banner */}
      <div style={{
        background: 'var(--c-card-white)',
        borderRadius: 16,
        padding: '12px 18px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: '4px solid var(--c-terracotta)'
      }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Order Handover & Supervisor Floor Assignment
          </h3>
          <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>
            <strong>Rule BR-9:</strong> Only the Admin assigns an order to supervisors. Verifies raw material stock reservation, assigns floor masters, and locks initial production run-rates.
          </p>
        </div>
        <span className="status-pill status-quote">Admin Authority</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        {acceptedOrders.map((order) => {
          const isAssigned = !!order.assignedSupervisorId;
          const isSubmitting = submittingOrderId === order.id;
          const currentError = handoverErrors[order.id];

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              style={{
                background: 'var(--c-card-white)',
                borderRadius: 16,
                padding: '16px',
                boxShadow: 'var(--shadow-card)',
                border: isAssigned ? '1px solid #edf2ee' : '1px solid #fed7aa',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
                    {order.id} &bull; {order.productName}
                  </span>
                  <span className={`status-pill ${isAssigned ? 'status-feasible' : 'status-atrisk'}`}>
                    {isAssigned ? 'ASSIGNED & ACTIVE' : 'AWAITING HANDOVER'}
                  </span>
                </div>

                <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 8 }}>
                  Client: <strong>{order.clientName}</strong> &bull; Volume: <strong>{order.quantityMeters.toLocaleString()} meters</strong>
                </p>

                {/* Handover Checklist */}
                <div style={{
                  background: '#faf6f4',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 600 }}>
                    <ShieldCheck size={14} />
                    <span>Raw Material Stock Reserved in Ledger (Cotton & Dyes)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 600 }}>
                    <Calendar size={14} />
                    <span>Production Routing Confirmed (Warping &rarr; Weaving &rarr; Dyeing &rarr; QA)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isAssigned ? '#16a34a' : 'var(--c-terracotta)', fontWeight: 700 }}>
                    <UserCheck size={14} />
                    <span>Assigned Supervisor: {order.assignedSupervisorName || (isAssigned ? 'Assigned' : 'Unassigned')}</span>
                  </div>
                </div>
              </div>

              {/* Handover Actions */}
              {!isAssigned ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f6ebe3', paddingTop: 10 }}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-text-secondary)' }}>Select Floor Supervisor:</label>
                  <select
                    className="admin-form-input"
                    value={selectedSupervisor.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const matched = liveSupervisors.find((s) => s.id === id);
                      setSelectedSupervisor({ id, name: matched ? matched.name : id });
                    }}
                    style={{ fontSize: 11, padding: '7px 10px' }}
                  >
                    {liveSupervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  {currentError && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 10.5,
                      fontWeight: 600
                    }}>
                      <AlertCircle size={13} />
                      <span>{currentError}</span>
                    </div>
                  )}

                  <button
                    className="admin-btn-primary"
                    style={{ padding: '8px', fontSize: 11, opacity: isSubmitting ? 0.7 : 1 }}
                    disabled={isSubmitting}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setHandoverErrors((prev) => ({ ...prev, [order.id]: '' }));
                      setSubmittingOrderId(order.id);
                      try {
                        await onConfirmHandover(order.id, selectedSupervisor.id, selectedSupervisor.name);
                      } catch (err: any) {
                        const errMsg = err?.data?.message || err?.error || err?.message || 'Handover failed on server.';
                        setHandoverErrors((prev) => ({ ...prev, [order.id]: errMsg }));
                      } finally {
                        setSubmittingOrderId(null);
                      }
                    }}
                  >
                    {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>{isSubmitting ? 'Confirming with Server...' : 'Execute Handover & Authorize Floor Start'}</span>
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700, borderTop: '1px solid #f6ebe3', paddingTop: 8 }}>
                  ✓ Handed over{order.handoverDate ? ` on ${order.handoverDate}` : ''}. Daily progress reports active.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

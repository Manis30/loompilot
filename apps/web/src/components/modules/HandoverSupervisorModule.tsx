import React, { useState } from 'react';
import { UserCheck, CheckCircle2, ShieldCheck, Calendar } from 'lucide-react';
import type { Order } from '../../types';

interface HandoverSupervisorModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onConfirmHandover: (orderId: string, supervisorId: string, supervisorName: string) => void;
}

export const HandoverSupervisorModule: React.FC<HandoverSupervisorModuleProps> = ({
  orders,
  onSelectOrder,
  onConfirmHandover
}) => {
  const [selectedSupervisor, setSelectedSupervisor] = useState<{ id: string; name: string }>({
    id: 'sup_1',
    name: 'Murugan K. (Weaving Master - Shed A)'
  });

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
                    <span>Assigned Supervisor: {order.assignedSupervisorName || 'Unassigned'}</span>
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
                      const name = id === 'sup_1' ? 'Murugan K. (Shed A)' : 'Arunachalam S. (Shed B)';
                      setSelectedSupervisor({ id, name });
                    }}
                    style={{ fontSize: 11, padding: '7px 10px' }}
                  >
                    <option value="sup_1">Murugan K. (Weaving Master - Airjet Shed A)</option>
                    <option value="sup_2">Arunachalam S. (Finishing Master - Rapier Shed B)</option>
                  </select>

                  <button
                    className="admin-btn-primary"
                    style={{ padding: '8px', fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmHandover(order.id, selectedSupervisor.id, selectedSupervisor.name);
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Execute Handover & Authorize Floor Start</span>
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700, borderTop: '1px solid #f6ebe3', paddingTop: 8 }}>
                  ✓ Handed over on {order.handoverDate || '2026-10-18'}. Daily progress reports active.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

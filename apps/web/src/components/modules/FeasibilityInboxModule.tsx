import React from 'react';
import {
  AlertTriangle,
  XCircle,
  Calendar,
  Layers,
  ArrowRight,
  ShoppingCart
} from 'lucide-react';
import type { Order } from '../../types';

interface FeasibilityInboxModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onOpenBuyMaterialsModal: (order: Order) => void;
  onOpenProposeAlternativeModal: (order: Order) => void;
  onDeclineOrder: (orderId: string) => void;
  onProceedToQuotation: (orderId: string) => void;
}

export const FeasibilityInboxModule: React.FC<FeasibilityInboxModuleProps> = ({
  orders,
  onSelectOrder,
  onOpenBuyMaterialsModal,
  onOpenProposeAlternativeModal,
  onDeclineOrder,
  onProceedToQuotation
}) => {
  const feasibilityOrders = orders.filter((o) => o.feasibility !== undefined || ['submitted', 'analyzing', 'awaiting_admin_decision'].includes(o.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Informative Header Banner */}
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
            Feasibility Analysis & Decision Queue
          </h3>
          <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>
            The <strong>Feasibility Agent</strong> computes labor/machine capacity minus committed load, material lead times, and ETA.
            Admin decides whether to purchase raw materials, propose alternatives, or decline.
          </p>
        </div>
        <span className="status-pill status-quote">Agent Governed</span>
      </div>

      {/* Grid of Feasibility Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {feasibilityOrders.map((order) => {
          const feas = order.feasibility;
          const isAtRiskOrInfeasible = feas?.verdict === 'not_feasible' || feas?.verdict === 'at_risk' || order.status === 'awaiting_admin_decision';
          const isFeasible = feas?.verdict === 'feasible';

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              style={{
                background: 'var(--c-card-white)',
                borderRadius: 16,
                padding: '16px 20px',
                boxShadow: 'var(--shadow-card)',
                border: isAtRiskOrInfeasible ? '1px solid #fecdd3' : '1px solid #f1e6de',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'pointer'
              }}
            >
              {/* Card Top Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--c-text-primary)' }}>
                      {order.productName} ({order.id})
                    </span>
                    <span className={`status-pill ${
                      feas?.verdict === 'feasible' ? 'status-feasible' : (feas?.verdict === 'at_risk' ? 'status-atrisk' : 'status-infeasible')
                    }`}>
                      {feas?.verdict ? feas.verdict.toUpperCase().replace('_', ' ') : 'EVALUATING'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>
                    Client: <strong>{order.clientName}</strong> &bull; Quantity: <strong>{order.quantityMeters.toLocaleString()} m</strong> &bull; Requested Deadline: <strong>{order.deadlineDate}</strong>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>Calculated ETA</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isFeasible ? '#16a34a' : '#b91c1c' }}>
                    {feas?.eta || 'Calculating...'}
                  </div>
                </div>
              </div>

              {/* Bottleneck & Process Details */}
              <div style={{
                background: '#faf6f4',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} color="var(--c-terracotta)" />
                  <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>Bottleneck Process:</span>
                  <span style={{ fontWeight: 800, color: 'var(--c-text-primary)' }}>{feas?.bottleneckProcess || 'None identified'}</span>
                </div>

                <div style={{ color: 'var(--c-text-secondary)', lineHeight: 1.4 }}>
                  <strong>LLM Feasibility Summary:</strong> {feas?.llmSummary}
                </div>
              </div>

              {/* Risk Factors List */}
              {feas?.riskFactors && feas.riskFactors.length > 0 && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 6 }}>
                    Identified Risk Factors:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {feas.riskFactors.map((rf, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: rf.severity === 'high' ? '#fef2f2' : (rf.severity === 'medium' ? '#fffbeb' : '#f0fdf4'),
                          border: `1px solid ${rf.severity === 'high' ? '#fecaca' : (rf.severity === 'medium' ? '#fde68a' : '#edf2ee')}`,
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 10.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        {rf.severity === 'high' ? <XCircle size={12} color="#dc2626" /> : <AlertTriangle size={12} color="#d97706" />}
                        <span style={{ fontWeight: 700, color: rf.severity === 'high' ? '#b91c1c' : '#92400e' }}>
                          {rf.name} ({rf.severity.toUpperCase()}):
                        </span>
                        <span style={{ color: 'var(--c-text-secondary)' }}>{rf.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recovery Options & Admin Actions */}
              {isAtRiskOrInfeasible && feas?.recoveryOptions && feas.recoveryOptions.length > 0 && (
                <div style={{ borderTop: '1px solid #f6ebe3', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', marginBottom: 8 }}>
                    Recommended Admin Recovery Actions:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8, marginBottom: 10 }}>
                    {feas.recoveryOptions.map((opt, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #ebdcd3',
                          borderRadius: 10,
                          padding: '8px 12px',
                          fontSize: 10.5
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--c-terracotta)', marginBottom: 2 }}>{opt.title}</div>
                        <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.3 }}>{opt.description}</p>
                        {opt.supplier && (
                          <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--c-text-secondary)' }}>
                            Supplier: {opt.supplier} &bull; Lead time: {opt.leadTimeDays}d
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Decision Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="admin-btn-primary"
                      style={{ padding: '8px 14px', fontSize: 11, width: 'auto', background: '#0284c7' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBuyMaterialsModal(order);
                      }}
                    >
                      <ShoppingCart size={13} />
                      <span>Buy Raw Materials (Local Suppliers)</span>
                    </button>

                    <button
                      className="admin-btn-primary"
                      style={{ padding: '8px 14px', fontSize: 11, width: 'auto', background: 'var(--c-terracotta)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProposeAlternativeModal(order);
                      }}
                    >
                      <Calendar size={13} />
                      <span>Propose Alternative (Date/Split)</span>
                    </button>

                    <button
                      className="logout-pill-btn"
                      style={{ padding: '8px 14px', fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeclineOrder(order.id);
                      }}
                    >
                      <XCircle size={13} />
                      <span>Decline Order (Client-Safe Note)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* If Feasible: Proceed to Quotation */}
              {isFeasible && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f6ebe3', paddingTop: 8 }}>
                  <button
                    className="admin-btn-primary"
                    style={{ padding: '7px 14px', fontSize: 11, width: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onProceedToQuotation(order.id);
                    }}
                  >
                    <span>Proceed to Quotation Review</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

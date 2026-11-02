import React from 'react';
import { ArrowRight, Bot, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import type { Order } from '../../types';

interface AdminRightPanelProps {
  order: Order | null;
  onActionClick: () => void;
  actionButtonLabel: string;
}

export const AdminRightPanel: React.FC<AdminRightPanelProps> = ({
  order,
  onActionClick,
  actionButtonLabel
}) => {
  if (!order) {
    return (
      <aside className="right-panel">
        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--c-text-muted)' }}>
          <Bot size={32} style={{ color: 'var(--c-terracotta)', marginBottom: 8, opacity: 0.8 }} />
          <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--c-text-primary)' }}>No Order Selected</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>Select an order to inspect details.</p>
        </div>
      </aside>
    );
  }

  const completionPct = Math.round((order.producedMeters / order.quantityMeters) * 100);

  return (
    <aside className="right-panel">
      {/* 1. Header: Order & Client */}
      <div className="panel-header-clean">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="panel-order-id">{order.id}</span>
            <h3 className="panel-order-title" title={order.productName}>{order.productName}</h3>
            <p className="panel-order-client">{order.clientName}</p>
          </div>
          <span className={`status-pill status-${order.status === 'client_accepted' ? 'feasible' : (order.status === 'awaiting_admin_decision' ? 'infeasible' : 'inprod')}`} style={{ fontSize: 9 }}>
            {order.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* 2. Key Specifications List (Flat, clean, no nested cards) */}
      <div className="panel-specs-clean">
        <div className="spec-item-clean">
          <span className="spec-lbl">Committed Yardage</span>
          <span className="spec-val">{order.quantityMeters.toLocaleString()} meters</span>
        </div>
        <div className="spec-item-clean">
          <span className="spec-lbl">Produced So Far</span>
          <span className="spec-val" style={{ color: 'var(--c-terracotta)', fontWeight: 800 }}>
            {order.producedMeters.toLocaleString()} m ({completionPct}%)
          </span>
        </div>
        <div className="spec-item-clean">
          <span className="spec-lbl">Yarn & GSM</span>
          <span className="spec-val">{order.specs.yarnCount} &bull; {order.specs.gsm} GSM</span>
        </div>
        <div className="spec-item-clean">
          <span className="spec-lbl">Weave Architecture</span>
          <span className="spec-val">{order.specs.weave} ({order.specs.width})</span>
        </div>
        <div className="spec-item-clean">
          <span className="spec-lbl">Target Deadline</span>
          <span className="spec-val">{order.deadlineDate}</span>
        </div>
        <div className="spec-item-clean">
          <span className="spec-lbl">Assigned Floor Master</span>
          <span className="spec-val">{order.assignedSupervisorName || 'Unassigned'}</span>
        </div>
        {order.quotation && (
          <div className="spec-item-clean" style={{ borderTop: '1px dashed #ebdcd3', paddingTop: 6, marginTop: 2 }}>
            <span className="spec-lbl">Quoted Rate</span>
            <span className="spec-val" style={{ color: 'var(--c-terracotta)', fontWeight: 800 }}>
              ${order.quotation.pricePerUnit.toFixed(2)}/m (${order.quotation.totalPrice.toLocaleString()})
            </span>
          </div>
        )}
      </div>

      {/* 3. AI Agents Status (Compact Pills) */}
      <div className="panel-agents-summary">
        <div className="panel-sub-label">Autonomous AI Agents</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          <span className="agent-pill-clean">
            <CheckCircle2 size={11} color="#16a34a" />
            <span>Feasibility: {order.feasibility ? 'Evaluated' : 'Running'}</span>
          </span>
          <span className="agent-pill-clean">
            <ShieldCheck size={11} color="#0284c7" />
            <span>Quotation: {order.quotation?.adminApproved ? 'Approved' : 'Pending'}</span>
          </span>
          <span className="agent-pill-clean">
            <Clock size={11} color={order.priceRevision ? '#dc2626' : '#6b7280'} />
            <span>Market: {order.priceRevision ? 'Surge Alert' : 'Synced'}</span>
          </span>
        </div>
      </div>

      {/* 4. Action CTA (Directly visible, never cut off) */}
      <button className="panel-action-btn-clean" onClick={onActionClick}>
        <span>{actionButtonLabel}</span>
        <ArrowRight size={13} />
      </button>
    </aside>
  );
};

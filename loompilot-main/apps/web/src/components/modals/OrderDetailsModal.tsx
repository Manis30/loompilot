import React from 'react';
import { X, Truck, DollarSign } from 'lucide-react';
import type { Order } from '../../types';

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 680, borderRadius: 28, padding: 24 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="modal-title" style={{ fontSize: 18, fontWeight: 800, color: '#0a0d10' }}>
              {order.id} &bull; {order.productName}
            </h2>
            <span style={{
              background: '#FAF4EA',
              color: '#18191B',
              padding: '3px 10px',
              borderRadius: 9999,
              fontSize: 10,
              fontWeight: 700
            }}>
              {order.status.toUpperCase()}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <p style={{ fontSize: 11.5, color: '#64748b', marginTop: -8, marginBottom: 16 }}>
          Client: <strong>{order.clientName}</strong> ({order.clientEmail}) &bull; Committed Volume: <strong>{order.quantityMeters.toLocaleString()} m</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11.5 }}>
          {/* Section 1: Fabric Specifications */}
          <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 18, border: '1px solid #e5e9ee' }}>
            <strong style={{ color: '#0a0d10', fontSize: 12, display: 'block', marginBottom: 8 }}>
              Fabric Specifications & Weave Routing
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>Yarn Count: <strong style={{ color: '#0a0d10' }}>{order.specs.yarnCount}</strong></div>
              <div>GSM Weight: <strong style={{ color: '#0a0d10' }}>{order.specs.gsm} GSM</strong></div>
              <div>Usable Width: <strong style={{ color: '#0a0d10' }}>{order.specs.width}</strong></div>
              <div>Weave Architecture: <strong style={{ color: '#0a0d10' }}>{order.specs.weave}</strong></div>
              <div>Finishing: <strong style={{ color: '#0a0d10' }}>{order.specs.finishing}</strong></div>
              <div>Target Deadline: <strong style={{ color: '#0a0d10' }}>{order.deadlineDate}</strong></div>
            </div>
          </div>

          {/* Section 2: Feasibility & Quotation */}
          {order.feasibility && (
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 18, border: '1px solid #e5e9ee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ color: '#0a0d10', fontSize: 12 }}>AI Feasibility Assessment</strong>
                <span style={{
                  background: order.feasibility.verdict === 'feasible' ? '#dcfce7' : '#fee2e2',
                  color: order.feasibility.verdict === 'feasible' ? '#15803d' : '#dc2626',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  fontSize: 9.5,
                  fontWeight: 700
                }}>
                  {order.feasibility.verdict.toUpperCase()} (ETA: {order.feasibility.eta})
                </span>
              </div>
              <p style={{ color: '#475569', lineHeight: 1.4, margin: 0 }}>
                {order.feasibility.llmSummary}
              </p>
            </div>
          )}

          {/* Section 3: Quotation Financials */}
          {order.quotation && (
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 18, border: '1px solid #e5e9ee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ color: '#0a0d10', fontSize: 12 }}>Approved Contract Quotation</strong>
                <strong style={{ fontSize: 14, color: '#18191B' }}>
                  ${order.quotation.pricePerUnit.toFixed(2)}/m (${order.quotation.totalPrice.toLocaleString()})
                </strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11, color: '#475569' }}>
                <div>Raw Materials: <strong style={{ color: '#0a0d10' }}>${order.quotation.materialCost.toLocaleString()}</strong></div>
                <div>Loom Processing: <strong style={{ color: '#0a0d10' }}>${order.quotation.processingCost.toLocaleString()}</strong></div>
                <div>Risk Buffer: <strong style={{ color: '#0a0d10' }}>${order.quotation.priceRiskBuffer.toLocaleString()}</strong></div>
                <div>Gross Margin: <strong style={{ color: '#16a34a' }}>{order.quotation.marginPercent.toFixed(1)}%</strong></div>
              </div>
            </div>
          )}

          {/* Section 4: Production & Delivery Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e5e9ee', padding: 14, borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0a0d10' }}>
                <Truck size={15} color="#0369a1" />
                <span>Deliveries Logged: {order.deliveries.length}</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                {order.deliveries.length > 0 ? (
                  order.deliveries.map((d, i) => <div key={i}>{d.invoiceNumber} &bull; {d.quantityMeters}m ({d.date})</div>)
                ) : 'No deliveries recorded yet.'}
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e5e9ee', padding: 14, borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0a0d10' }}>
                <DollarSign size={15} color="#15803d" />
                <span>Payment Receipts: {order.payments.length}</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                {order.payments.length > 0 ? (
                  order.payments.map((p, i) => <div key={i}>{p.type}: ${p.amount.toLocaleString()} ({p.status.toUpperCase()})</div>)
                ) : 'No payments logged yet.'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            style={{
              background: '#79B4B7',
              color: '#18191B',
              border: '1px solid #67A4A7',
              borderRadius: 9999,
              padding: '8px 20px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

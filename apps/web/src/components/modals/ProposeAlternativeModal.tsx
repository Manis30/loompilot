import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import type { Order } from '../../types';

interface ProposeAlternativeModalProps {
  order: Order | null;
  onClose: () => void;
  onConfirmAlternative: (orderId: string, alternativeDate: string, splitDescription: string) => void;
}

export const ProposeAlternativeModal: React.FC<ProposeAlternativeModalProps> = ({
  order,
  onClose,
  onConfirmAlternative
}) => {
  if (!order) return null;

  const [altDate, setAltDate] = useState<string>('2026-11-24');
  const [splitDesc, setSplitDesc] = useState<string>(
    'Split shipment: Deliver 10,000m on requested date (Nov 12), balance 15,000m on Nov 24.'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmAlternative(order.id, altDate, splitDesc);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 500, borderRadius: 28, padding: 24 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ fontSize: 17, fontWeight: 800, color: '#0a0d10' }}>
            Propose Production Alternative
          </h2>
          <button className="modal-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <p style={{ fontSize: 11.5, color: '#64748b', marginTop: -8, marginBottom: 14 }}>
          Order {order.id} &bull; Adjusts delivery parameters within mill capacity and generates counter-quotation.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
              Earliest Feasible Completion Date
            </label>
            <input
              type="date"
              className="admin-form-input"
              value={altDate}
              onChange={(e) => setAltDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
              Split Shipment / Quantity Counter-Offer
            </label>
            <textarea
              className="admin-form-input"
              rows={3}
              style={{ borderRadius: 16 }}
              value={splitDesc}
              onChange={(e) => setSplitDesc(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="submit" className="admin-btn-primary" style={{ flex: 1.2, justifyContent: 'center' }}>
              <Send size={14} />
              <span>Draft Counter-Quotation</span>
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 9999,
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                cursor: 'pointer'
              }}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

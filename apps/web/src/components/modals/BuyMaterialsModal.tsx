import React, { useState, useEffect } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import type { Order } from '../../types';
import { useGetSuppliersQuery } from '../../store/api/catalogApi';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

interface BuyMaterialsModalProps {
  order: Order | null;
  onClose: () => void;
  onConfirmPurchase: (orderId: string, supplier: string, quantityKg: number, totalCost: number) => void;
}

export const BuyMaterialsModal: React.FC<BuyMaterialsModalProps> = ({
  order,
  onClose,
  onConfirmPurchase
}) => {
  if (!order) return null;

  const { data: suppliersResponse } = useGetSuppliersQuery(undefined);
  const liveSuppliers = suppliersResponse?.data || [];

  const [supplier, setSupplier] = useState<string>(
    isDemoEnabled ? 'Vardhman Textiles Ltd. (Ludhiana Depot)' : ''
  );

  useEffect(() => {
    if (liveSuppliers.length > 0 && !supplier) {
      setSupplier(liveSuppliers[0].supplierName);
    }
  }, [liveSuppliers, supplier]);
  const [quantityKg, setQuantityKg] = useState<number>(6200);
  const [ratePerKg, setRatePerKg] = useState<number>(4.60);

  const totalCost = Math.round(quantityKg * ratePerKg);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmPurchase(order.id, supplier, quantityKg, totalCost);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 520, borderRadius: 28, padding: 24 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ fontSize: 17, fontWeight: 800, color: '#0a0d10' }}>
            Record Raw Material Purchase Decision
          </h2>
          <button className="modal-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <p style={{ fontSize: 11.5, color: '#64748b', marginTop: -8, marginBottom: 14 }}>
          Order {order.id} &bull; Resolves yarn shortage and automatically triggers Feasibility re-run.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
              Verified Supplier Source
            </label>
            <select className="admin-form-input" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              {liveSuppliers.length > 0 ? (
                liveSuppliers.map((s: any) => (
                  <option key={s.id || s._id} value={s.supplierName}>
                    {s.supplierName} ({s.city || 'Regional Depot'}{s.defaultLeadTimeDays ? ` • ${s.defaultLeadTimeDays}d lead` : ''})
                  </option>
                ))
              ) : isDemoEnabled ? (
                <>
                  <option value="Vardhman Textiles Ltd. (Ludhiana Depot)">Vardhman Textiles Ltd. (Spot Delivery: 2 Days)</option>
                  <option value="Arvind Mills Yarn Division">Arvind Mills Yarn Division (Delivery: 3 Days)</option>
                  <option value="Jayshree Textiles (Coimbatore Depot)">Jayshree Textiles (Delivery: 4 Days)</option>
                </>
              ) : (
                <option value="">No suppliers available</option>
              )}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                Purchase Quantity (kg)
              </label>
              <input
                type="number"
                className="admin-form-input"
                value={quantityKg}
                onChange={(e) => setQuantityKg(+e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                Spot Rate ($/kg)
              </label>
              <input
                type="number"
                step="0.05"
                className="admin-form-input"
                value={ratePerKg}
                onChange={(e) => setRatePerKg(+e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{
            background: '#FAF4EA',
            padding: '12px 16px',
            borderRadius: 18,
            fontSize: 11.5,
            color: '#18191B',
            border: '1px solid #79B4B7'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Total Purchase Commitment:</span>
              <span style={{ fontSize: 14 }}>${totalCost.toLocaleString()}</span>
            </div>
            <p style={{ fontSize: 10.5, color: '#18191B', marginTop: 4, margin: '4px 0 0' }}>
              * Rule: Creates purchase decision & supplier order. Feasibility Agent recalculates ETA immediately.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="submit" className="admin-btn-primary" style={{ flex: 1.2, justifyContent: 'center' }}>
              <ShoppingCart size={14} />
              <span>Confirm Purchase</span>
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

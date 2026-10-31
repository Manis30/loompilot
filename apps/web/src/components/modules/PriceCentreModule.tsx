import React from 'react';
import {
  AlertTriangle,
  Lock,
  CheckCircle2,
  XCircle,
  TrendingUp
} from 'lucide-react';
import type { Order, MarketCommodity } from '../../types';

interface PriceCentreModuleProps {
  commodities: MarketCommodity[];
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onApprovePriceRevision: (orderId: string) => void;
  onRejectPriceRevision: (orderId: string) => void;
}

export const PriceCentreModule: React.FC<PriceCentreModuleProps> = ({
  commodities,
  orders,
  onSelectOrder,
  onApprovePriceRevision,
  onRejectPriceRevision
}) => {
  const revisedOrders = orders.filter((o) => o.priceRevision !== undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* 1. Header */}
      <div className="module-header-flat">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Market Prices
          </h1>
        </div>
      </div>

      {/* Raw Material Watchlist */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 12
      }}>
        {commodities.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e5e9ee',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.015)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {item.category}
              </span>
              {item.isSurge && (
                <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 9999 }}>
                  SURGE ALERT
                </span>
              )}
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: '#0a0d10' }}>
              {item.name}
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: '#0a0d10' }}>
              ${item.price.toFixed(2)}{' '}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>/{item.unit}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, paddingTop: 4, borderTop: '1px solid #edf1f5' }}>
              <span style={{ color: item.changeSevenDays > 0 ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', gap: 2 }}>
                <TrendingUp size={12} />
                {item.changeSevenDays >= 0 ? `+${item.changeSevenDays}%` : `${item.changeSevenDays}%`} 7d
              </span>
              <span style={{ color: '#64748b' }}>
                {item.volatilityPercent}% vol
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Surge Revisions List */}
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        border: '1px solid #e5e9ee',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        flex: 1
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#dc2626" />
            <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10' }}>
              Affected Orders & Proposed Quotation Revisions ({revisedOrders.length})
            </h4>
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Materials already purchased are locked and excluded from recalculation
          </span>
        </div>

        {revisedOrders.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            No orders currently impacted by material surges. All contracts operating within established volatility buffers.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {revisedOrders.map((order) => {
              const rev = order.priceRevision!;
              const isPending = !rev.adminApproved && rev.status === 'proposed';

              return (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e5e9ee',
                    borderRadius: 20,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 13, color: '#0a0d10' }}>
                        {order.productName} ({order.id})
                      </strong>
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                        Client: <strong>{order.clientName}</strong>
                      </span>
                    </div>

                    <span style={{
                      background: rev.adminApproved ? '#F8F0DF' : '#fef3c7',
                      color: rev.adminApproved ? '#18191B' : '#b45309',
                      padding: '3px 10px',
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 700
                    }}>
                      {rev.adminApproved ? 'APPROVED BY ADMIN' : 'NEEDS ADMIN SIGN-OFF'}
                    </span>
                  </div>

                  {/* Price Hike Comparison Pill */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 10,
                    background: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 11.5,
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10 }}>Original Price:</span>
                      <strong style={{ color: '#0a0d10' }}>${rev.oldPrice.toFixed(2)}/m</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10 }}>Revised Price:</span>
                      <strong style={{ color: '#dc2626' }}>${rev.newPrice.toFixed(2)}/m</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10 }}>Hike Percentage:</span>
                      <strong style={{ color: '#dc2626' }}>+{rev.percentageChange}%</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: 10 }}>Locked Inventory:</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 700 }}>
                        <Lock size={12} />
                        <span>{order.producedMeters}m Protected</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                    <strong>Client-Facing Explanation:</strong> "{rev.clientFriendlyReason}"
                  </div>

                  {/* Admin Actions */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #edf1f5', paddingTop: 10 }}>
                      <button
                        className="admin-btn-primary"
                        style={{ padding: '7px 16px', fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprovePriceRevision(order.id);
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve Revision & Notify Client</span>
                      </button>

                      <button
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 9999,
                          padding: '7px 16px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRejectPriceRevision(order.id);
                        }}
                      >
                        <XCircle size={13} />
                        <span>Absorb Surge (Reject Revision)</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

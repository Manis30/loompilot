import React from 'react';
import { ArrowUpRight, Cpu } from 'lucide-react';
import type { Order, MarketCommodity } from '../../types';

interface AdminMetricsRowProps {
  orders: Order[];
  commodities: MarketCommodity[];
  onOpenAgentLogs: () => void;
}

export const AdminMetricsRow: React.FC<AdminMetricsRowProps> = ({
  orders,
  commodities,
  onOpenAgentLogs
}) => {
  const totalMeters = orders.reduce((sum, o) => sum + o.quantityMeters, 0);
  const producedMeters = orders.reduce((sum, o) => sum + o.producedMeters, 0);
  const overallPercent = totalMeters > 0 ? Math.round((producedMeters / totalMeters) * 100) : 0;
  const cotton = commodities.find((c) => c.id === 'comm_cotton') || commodities[0];

  return (
    <div className="metrics-ticker-bar">
      <div className="ticker-item">
        <span className="ticker-label">Loom Yardage:</span>
        <span className="ticker-val">
          <strong>{producedMeters.toLocaleString()}</strong> / {totalMeters.toLocaleString()} m ({overallPercent}%)
        </span>
      </div>

      <span className="ticker-sep">&bull;</span>

      <div className="ticker-item">
        <span className="ticker-label">On-Time Target:</span>
        <span className="ticker-val"><strong>96.8%</strong></span>
      </div>

      <span className="ticker-sep">&bull;</span>

      <div className="ticker-item">
        <span className="ticker-label">Raw Cotton:</span>
        <span className="ticker-val">
          <strong>₹{cotton?.price.toFixed(2)}/m</strong>
          <span style={{ color: cotton?.isSurge ? '#dc2626' : '#16a34a', marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}>
            <ArrowUpRight size={10} />+{cotton?.changeSevenDays}%
          </span>
        </span>
      </div>

      <span className="ticker-sep">&bull;</span>

      <div className="ticker-item" style={{ cursor: 'pointer' }} onClick={onOpenAgentLogs} title="Click to view AI Agent status">
        <Cpu size={12} color="var(--c-terracotta)" />
        <span className="ticker-val" style={{ color: 'var(--c-terracotta)', fontWeight: 700 }}>5 Agents Synced</span>
      </div>
    </div>
  );
};

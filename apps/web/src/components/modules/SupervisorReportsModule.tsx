import React from 'react';
import { AlertCircle, Users, Cpu, Scissors } from 'lucide-react';
import type { Order, SupervisorDailyReport } from '../../types';

interface SupervisorReportsModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
}

export const SupervisorReportsModule: React.FC<SupervisorReportsModuleProps> = ({
  orders,
  onSelectOrder
}) => {
  // Aggregate daily reports across all orders
  const allReports: { orderId: string; fabricName: string; report: SupervisorDailyReport }[] = [];
  orders.forEach((o) => {
    o.dailyReports.forEach((rep) => {
      allReports.push({ orderId: o.id, fabricName: o.productName, report: rep });
    });
  });

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
            Supervisor Daily Production Reports & Resource Ledger
          </h3>
          <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>
            <strong>Rule BR-10:</strong> One daily report per supervisor per day. Submissions feed the <strong>Monitoring Agent</strong> to update order completion and deadline risk.
          </p>
        </div>
        <span className="status-pill status-feasible">Audit Enforced</span>
      </div>

      {/* Reports Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allReports.map(({ orderId, fabricName, report }, idx) => (
          <div
            key={idx}
            onClick={() => onSelectOrder(orderId)}
            style={{
              background: 'var(--c-card-white)',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              cursor: 'pointer',
              border: '1px solid #f1e6de'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 13, color: 'var(--c-text-primary)' }}>
                  {orderId} &bull; {fabricName}
                </strong>
                <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 8 }}>
                  Supervisor: <strong>{report.supervisorName}</strong> &bull; Date: <strong>{report.date}</strong> ({report.shift})
                </span>
              </div>
              <span className="status-pill status-feasible">VERIFIED & AUDITED</span>
            </div>

            {/* Metrics Chips Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 11 }}>
              <div style={{ background: '#faf6f4', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="var(--c-terracotta)" />
                <div>
                  <div style={{ color: 'var(--c-text-muted)', fontSize: 9.5 }}>Attendance</div>
                  <strong style={{ color: 'var(--c-text-primary)' }}>{report.workersPresent} Present</strong> ({report.workersAbsent} Absent)
                </div>
              </div>

              <div style={{ background: '#faf6f4', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={16} color="#0284c7" />
                <div>
                  <div style={{ color: 'var(--c-text-muted)', fontSize: 9.5 }}>Loom Machinery</div>
                  <strong style={{ color: 'var(--c-text-primary)' }}>{report.machinesAvailable} Running</strong> ({report.machinesBreakdown} Breakdown)
                </div>
              </div>

              <div style={{ background: '#faf6f4', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scissors size={16} color="#16a34a" />
                <div>
                  <div style={{ color: 'var(--c-text-muted)', fontSize: 9.5 }}>Produced Today</div>
                  <strong style={{ color: 'var(--c-text-primary)' }}>{report.metersProduced.toLocaleString()} meters</strong>
                </div>
              </div>

              <div style={{ background: '#faf6f4', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} color="#d97706" />
                <div>
                  <div style={{ color: 'var(--c-text-muted)', fontSize: 9.5 }}>Loom Defects / Scrap</div>
                  <strong style={{ color: 'var(--c-text-primary)' }}>{report.scrapMeters} m ({((report.scrapMeters / (report.metersProduced || 1)) * 100).toFixed(1)}%)</strong>
                </div>
              </div>
            </div>

            {/* Supervisor Notes */}
            {report.issuesRaised && (
              <div style={{
                background: '#faf6f4',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 10.5,
                color: 'var(--c-text-secondary)',
                fontStyle: 'italic'
              }}>
                "{report.issuesRaised}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

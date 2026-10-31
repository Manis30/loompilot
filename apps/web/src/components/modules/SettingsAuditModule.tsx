import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  Layers,
  Settings
} from 'lucide-react';
import type { AuditEntry } from '../../types';

interface SettingsAuditModuleProps {
  auditLogs: AuditEntry[];
}

export const SettingsAuditModule: React.FC<SettingsAuditModuleProps> = ({ auditLogs }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'settings'>('audit');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actorFilter, setActorFilter] = useState<'all' | 'Admin' | 'Supervisor' | 'AI Agent'>('all');

  // Business Settings State
  const [minProfitMargin, setMinProfitMargin] = useState<number>(15.0);
  const [priceSurgeThreshold, setPriceSurgeThreshold] = useState<number>(5.0);
  const [autoEscalateDiscount, setAutoEscalateDiscount] = useState<boolean>(true);
  const dailyMonitoringTime = '06:00 AM';

  const filteredLogs = auditLogs.filter((log) => {
    const matchesActor =
      actorFilter === 'all'
        ? true
        : actorFilter === 'Admin'
        ? log.actor.includes('Admin')
        : actorFilter === 'Supervisor'
        ? log.actor.includes('Supervisor')
        : log.actor.includes('Agent') || log.actor.includes('Assistant');

    const matchesSearch =
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.orderId && log.orderId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesActor && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* 1. PAGE HEADER */}
      <div className="module-header-flat">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Settings & Audit
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: '#F8F0DF',
            color: '#18191B',
            padding: '5px 14px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <ShieldCheck size={14} />
            <span>Audit Trail: <strong>{auditLogs.length} Immutable Events</strong></span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metric Strip */}
      <div className="kpi-strip-flat">
        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              Policy Margin Floor
            </div>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              background: '#F8F0DF',
              color: '#18191B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#18191B' }}>{minProfitMargin}%</span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Net Profit</span>
          </div>
        </div>

        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              Price Surge Threshold
            </div>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>+{priceSurgeThreshold}%</span>
            <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Surge Trigger</span>
          </div>
        </div>

        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              Role Hierarchy
            </div>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              background: '#ede9fe',
              color: '#5b21b6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#0a0d10' }}>3 Tiers</span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>RBAC</span>
          </div>
        </div>

        <div className="kpi-cell-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              Monitoring Sweep
            </div>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              background: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 0' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#0a0d10' }}>{dailyMonitoringTime}</span>
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Daily</span>
          </div>
        </div>
      </div>

      {/* 2. FILTERS AND SUB-TAB SWITCHER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              border: activeTab === 'audit' ? '1px solid #c6e5db' : '1px solid #e2e8f0',
              background: activeTab === 'audit' ? '#F8F0DF' : '#ffffff',
              color: activeTab === 'audit' ? '#18191B' : '#64748b',
              fontSize: 11.5,
              fontWeight: activeTab === 'audit' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Decision Audit Trail ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '6px 16px',
              borderRadius: 9999,
              border: activeTab === 'settings' ? '1px solid #c6e5db' : '1px solid #e2e8f0',
              background: activeTab === 'settings' ? '#F8F0DF' : '#ffffff',
              color: activeTab === 'settings' ? '#18191B' : '#64748b',
              fontSize: 11.5,
              fontWeight: activeTab === 'settings' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            System Policies & Settings
          </button>
        </div>

        {activeTab === 'audit' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'Admin', 'Supervisor', 'AI Agent'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setActorFilter(a)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    border: actorFilter === a ? '1px solid #c6e5db' : '1px solid #e2e8f0',
                    background: actorFilter === a ? '#F8F0DF' : '#ffffff',
                    color: actorFilter === a ? '#18191B' : '#64748b',
                    fontSize: 10.5,
                    fontWeight: actorFilter === a ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {a}
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 9999,
              padding: '6px 14px',
              width: 200
            }}>
              <Search size={13} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: 11, background: 'transparent', width: '100%', color: '#1e293b' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT AREA */}
      {activeTab === 'audit' ? (
        <div style={{
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid #e5e9ee',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf1f5', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10' }}>
              Immutable System Decision Log
            </h3>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              Showing {filteredLogs.length} events
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e5e9ee',
                  borderRadius: 18,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                  <div style={{ minWidth: 125, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                    {log.timestamp}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 12.5, color: '#0a0d10' }}>{log.actor}</strong>
                      <span style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: '#18191B',
                        background: '#F8F0DF',
                        padding: '2px 8px',
                        borderRadius: 9999
                      }}>
                        {log.action}
                      </span>
                      {log.orderId && (
                        <span style={{ fontSize: 10.5, color: '#64748b' }}>
                          &bull; Order: {log.orderId}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11.5, color: '#475569', marginTop: 3, margin: '3px 0 0' }}>
                      {log.details}
                    </p>
                  </div>
                </div>

                <span style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <CheckCircle2 size={12} />
                  VERIFIED
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Settings & Stage Configuration Tab */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
          {/* Policy & Business Rules */}
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e5e9ee',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10' }}>
              Pricing & Margin Policies
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 16, border: '1px solid #e5e9ee' }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0a0d10', display: 'block' }}>
                  Minimum Profit Margin Floor (%)
                </label>
                <p style={{ fontSize: 10.5, color: '#64748b', margin: '4px 0 8px' }}>
                  Quotation Agent flags any proposed contract with margins below this threshold.
                </p>
                <input
                  type="number"
                  value={minProfitMargin}
                  onChange={(e) => setMinProfitMargin(+e.target.value)}
                  className="admin-form-input"
                  style={{ width: 120 }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 16, border: '1px solid #e5e9ee' }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0a0d10', display: 'block' }}>
                  Raw Material Surge Threshold (%)
                </label>
                <p style={{ fontSize: 10.5, color: '#64748b', margin: '4px 0 8px' }}>
                  Market Price Agent alerts the Admin when raw material indices rise beyond this percentage.
                </p>
                <input
                  type="number"
                  value={priceSurgeThreshold}
                  onChange={(e) => setPriceSurgeThreshold(+e.target.value)}
                  className="admin-form-input"
                  style={{ width: 120 }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 16, border: '1px solid #e5e9ee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0a0d10' }}>Auto-Escalate Discount Requests</div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>Forward client bargaining directly to General Manager</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoEscalateDiscount}
                  onChange={(e) => setAutoEscalateDiscount(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#111315', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Role Hierarchy & Production Stages */}
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e5e9ee',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0a0d10' }}>
              Role Permissions & Hierarchy
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11.5 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 16, border: '1px solid #e5e9ee' }}>
                <strong style={{ color: '#111315', fontSize: 12 }}>1. Admin (Managing Director)</strong>
                <p style={{ color: '#64748b', fontSize: 11, marginTop: 4, margin: 0 }}>
                  Full authority: Approve quotations, authorize raw material POs, approve price surges, resolve bargaining, invite users, override loom schedules.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 16, border: '1px solid #e5e9ee' }}>
                <strong style={{ color: '#0369a1', fontSize: 12 }}>2. Floor Supervisor (Weaving Master)</strong>
                <p style={{ color: '#64748b', fontSize: 11, marginTop: 4, margin: 0 }}>
                  Daily work reporting: Submit daily meters produced, log worker attendance, record loom maintenance, raise floor alerts.
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 16, border: '1px solid #e5e9ee' }}>
                <strong style={{ color: '#18191B', fontSize: 12 }}>3. Client (Brand Procurement)</strong>
                <p style={{ color: '#64748b', fontSize: 11, marginTop: 4, margin: 0 }}>
                  Self-service: Request new quotations, accept approved contracts, track order stages live, negotiate via bargaining agent.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Eye,
  Bot
} from 'lucide-react';
import type { AgentRun } from '../../types';

interface AIActivityAlertsModuleProps {
  agentRuns: AgentRun[];
  onRetryAgent?: (agentName: AgentRun['agentName'], orderId?: string) => void;
  onApproveAgentRecommendation?: (runId: string) => void;
  onRejectAgentRecommendation?: (runId: string) => void;
}

export const AIActivityAlertsModule: React.FC<AIActivityAlertsModuleProps> = ({
  agentRuns,
  onRetryAgent,
  onApproveAgentRecommendation,
  onRejectAgentRecommendation
}) => {
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<'all' | AgentRun['agentName']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ALERT' | 'SUCCESS'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectRun, setInspectRun] = useState<AgentRun | null>(null);

  // 5 Autonomous Agents specifications
  const AGENT_SPECS = [
    {
      name: 'Feasibility Agent' as const,
      role: 'Resource checks, material deficits, capacity & delivery risk',
      status: 'Active & Synced',
      color: '#0369a1',
      bg: '#e0f2fe'
    },
    {
      name: 'Quotation Agent' as const,
      role: 'Itemized BOM, wastage buffer (4.5%) & suggested margin',
      status: 'Review Required',
      color: '#18191B',
      bg: '#F8F0DF'
    },
    {
      name: 'Market Price Agent' as const,
      role: 'Monitors international commodity index & flags price spikes',
      status: 'Surge Alert',
      color: '#b45309',
      bg: '#fef3c7'
    },
    {
      name: 'Client Assistant' as const,
      role: 'Pre-screens queries, answers FAQs & handles negotiations',
      status: 'Active on Client App',
      color: '#5b21b6',
      bg: '#ede9fe'
    },
    {
      name: 'Monitoring Agent' as const,
      role: 'Runs daily sweep to track stage delays and notify Admin',
      status: 'Daily Sweep Active',
      color: '#15803d',
      bg: '#dcfce7'
    }
  ];

  const totalRuns = agentRuns.length;
  const alertRunsCount = agentRuns.filter((r) => r.status === 'ALERT').length;

  const filteredRuns = agentRuns.filter((r) => {
    const matchesAgent = selectedAgentFilter === 'all' || r.agentName === selectedAgentFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch =
      r.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.orderId && r.orderId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesAgent && matchesStatus && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* 1. PAGE HEADER */}
      <div className="module-header-flat">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            AI Activity & Alerts
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: alertRunsCount > 0 ? '#fef3c7' : '#F8F0DF',
            color: alertRunsCount > 0 ? '#b45309' : '#18191B',
            border: alertRunsCount > 0 ? '1px solid #fde68a' : '1px solid #c6e5db',
            padding: '5px 14px',
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700
          }}>
            {alertRunsCount > 0 ? (
              <>
                <AlertTriangle size={14} color="#b45309" />
                <span>{alertRunsCount} Actionable Alerts Require Admin Sign-Off</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} color="#18191B" />
                <span>All Agent Sweeps Normal</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5 AGENT STATUS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {AGENT_SPECS.map((ag) => {
          const isSelected = selectedAgentFilter === ag.name;

          return (
            <div
              key={ag.name}
              onClick={() => setSelectedAgentFilter(selectedAgentFilter === ag.name ? 'all' : ag.name)}
              style={{
                background: isSelected ? '#F8F0DF' : '#ffffff',
                borderRadius: 20,
                border: isSelected ? '1px solid #c6e5db' : '1px solid #e5e9ee',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: isSelected ? '#18191B' : '#0a0d10' }}>{ag.name}</span>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: ag.status.includes('Alert') ? '#dc2626' : '#10b981'
                }} />
              </div>
              <p style={{ fontSize: 10, color: isSelected ? '#3b6f63' : '#64748b', margin: 0, lineHeight: 1.35, minHeight: 40 }}>
                {ag.role}
              </p>
              <div style={{
                background: ag.bg,
                color: ag.color,
                fontSize: 9.5,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                alignSelf: 'flex-start'
              }}>
                {ag.status}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. FILTERS AND SEARCH */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setSelectedAgentFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              border: selectedAgentFilter === 'all' ? '1px solid #c6e5db' : '1px solid #e2e8f0',
              background: selectedAgentFilter === 'all' ? '#F8F0DF' : '#ffffff',
              color: selectedAgentFilter === 'all' ? '#18191B' : '#64748b',
              fontSize: 11,
              fontWeight: selectedAgentFilter === 'all' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            All Agents ({totalRuns})
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'ALERT' ? 'all' : 'ALERT')}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              border: statusFilter === 'ALERT' ? '1px solid #fde68a' : '1px solid #e2e8f0',
              background: statusFilter === 'ALERT' ? '#fef3c7' : '#ffffff',
              color: statusFilter === 'ALERT' ? '#b45309' : '#64748b',
              fontSize: 11,
              fontWeight: statusFilter === 'ALERT' ? 700 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <AlertTriangle size={13} color="#b45309" />
            <span>Alerts & Actions ({alertRunsCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'SUCCESS' ? 'all' : 'SUCCESS')}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              border: statusFilter === 'SUCCESS' ? '1px solid #c6e5db' : '1px solid #e2e8f0',
              background: statusFilter === 'SUCCESS' ? '#F8F0DF' : '#ffffff',
              color: statusFilter === 'SUCCESS' ? '#18191B' : '#64748b',
              fontSize: 11,
              fontWeight: statusFilter === 'SUCCESS' ? 700 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <CheckCircle2 size={13} color="#18191B" />
            <span>Completed Sweeps</span>
          </button>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 9999,
          padding: '6px 14px',
          width: 240
        }}>
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search agent summary, order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 11.5, background: 'transparent', width: '100%', color: '#1e293b' }}
          />
        </div>
      </div>

      {/* 3. MAIN CONTENT: Chronological Agent Runs Timeline */}
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
            Real-Time AI Multi-Agent Execution Stream
          </h3>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Showing {filteredRuns.length} execution logs
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredRuns.map((run) => {
            const isAlert = run.status === 'ALERT';

            return (
              <div
                key={run.id}
                style={{
                  background: isAlert ? '#fffbeb' : '#f8fafc',
                  border: isAlert ? '1px solid #fde68a' : '1px solid #e5e9ee',
                  borderRadius: 18,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <span style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: isAlert ? '#fef3c7' : '#F8F0DF',
                    color: isAlert ? '#b45309' : '#18191B',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bot size={17} />
                  </span>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 12.5, color: '#0a0d10' }}>{run.agentName}</strong>
                      {run.orderId && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#18191B', background: '#F8F0DF', padding: '2px 8px', borderRadius: 9999 }}>
                          Order {run.orderId}
                        </span>
                      )}
                      <span style={{
                        background: isAlert ? '#fee2e2' : '#dcfce7',
                        color: isAlert ? '#dc2626' : '#15803d',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: 9,
                        fontWeight: 700
                      }}>
                        {run.status}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        {run.timestamp} &bull; {run.durationMs}ms
                      </span>
                    </div>

                    <p style={{ fontSize: 11.5, color: '#475569', marginTop: 4, margin: '4px 0 0' }}>
                      {run.summary}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '4px 12px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#0a0d10',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onClick={() => setInspectRun(run)}
                  >
                    <Eye size={12} />
                    <span>Inspect</span>
                  </button>

                  <button
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '4px 12px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#0a0d10',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onClick={() => onRetryAgent && onRetryAgent(run.agentName, run.orderId)}
                    title="Rerun agent analysis"
                  >
                    <RefreshCw size={12} />
                    <span>Rerun</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspect Modal Drawer */}
      {inspectRun && (
        <div className="modal-overlay" onClick={() => setInspectRun(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>AI AGENT EXECUTION INSPECTOR</span>
                <h2 className="modal-title" style={{ marginTop: 2 }}>{inspectRun.agentName}</h2>
                <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Run ID: {inspectRun.id} &bull; Latency: {inspectRun.durationMs}ms &bull; {inspectRun.timestamp}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setInspectRun(null)}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e5e9ee', borderRadius: 18, padding: 14, marginTop: 12, fontSize: 11.5 }}>
              <div style={{ fontWeight: 700, color: '#0a0d10', marginBottom: 6 }}>Recommendation & Context:</div>
              <p style={{ color: '#475569', lineHeight: 1.4, margin: 0 }}>{inspectRun.summary}</p>
              {inspectRun.orderId && (
                <div style={{ marginTop: 10, color: '#18191B', fontWeight: 700 }}>
                  Impacted Order: {inspectRun.orderId}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="admin-btn-primary"
                style={{ flex: 1, padding: '9px 14px', fontSize: 11.5, justifyContent: 'center' }}
                onClick={() => {
                  onApproveAgentRecommendation && onApproveAgentRecommendation(inspectRun.id);
                  setInspectRun(null);
                }}
              >
                <Check size={14} />
                <span>Approve Recommendation</span>
              </button>
              <button
                style={{
                  flex: 1,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 9999,
                  padding: '9px 14px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  onRejectAgentRecommendation && onRejectAgentRecommendation(inspectRun.id);
                  setInspectRun(null);
                }}
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

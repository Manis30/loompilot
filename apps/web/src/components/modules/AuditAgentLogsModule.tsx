import React, { useState } from 'react';
import { Cpu, ShieldCheck } from 'lucide-react';
import type { AuditEntry, AgentRun } from '../../types';

interface AuditAgentLogsModuleProps {
  auditLogs: AuditEntry[];
  agentRuns: AgentRun[];
}

export const AuditAgentLogsModule: React.FC<AuditAgentLogsModuleProps> = ({
  auditLogs,
  agentRuns
}) => {
  const [subTab, setSubTab] = useState<'audit' | 'agentRuns'>('audit');

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
            Immutable Audit Trail & Multi-Agent Execution Telemetry
          </h3>
          <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>
            <strong>Rule BR-12:</strong> Every approval, purchase decision, state change, and LLM agent output is permanently recorded.
          </p>
        </div>
        <span className="status-pill status-feasible">Audit Verified</span>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className={`view-tab-btn ${subTab === 'audit' ? 'active' : ''}`} onClick={() => setSubTab('audit')}>
          <ShieldCheck size={13} />
          <span>Admin Decisions & System Audit ({auditLogs.length})</span>
        </button>
        <button className={`view-tab-btn ${subTab === 'agentRuns' ? 'active' : ''}`} onClick={() => setSubTab('agentRuns')}>
          <Cpu size={13} />
          <span>AI Agents Execution Runs ({agentRuns.length})</span>
        </button>
      </div>

      {subTab === 'audit' ? (
        <div style={{
          background: 'var(--c-card-white)',
          borderRadius: 16,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {auditLogs.map((log) => (
            <div
              key={log.id}
              style={{
                background: '#faf6f4',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderLeft: '3px solid var(--c-terracotta)'
              }}
            >
              <div>
                <span style={{ fontWeight: 800, color: 'var(--c-terracotta)' }}>{log.action}</span>
                {log.orderId && <span style={{ color: 'var(--c-text-muted)', marginLeft: 6 }}>({log.orderId})</span>}
                <div style={{ color: 'var(--c-text-primary)', marginTop: 2 }}>{log.details}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--c-text-muted)' }}>
                <div>Actor: <strong>{log.actor}</strong></div>
                <div>{log.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--c-card-white)',
          borderRadius: 16,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {agentRuns.map((run) => (
            <div
              key={run.id}
              style={{
                background: '#faf6f4',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderLeft: run.status === 'ALERT' ? '3px solid #dc2626' : '3px solid #16a34a'
              }}
            >
              <div>
                <strong style={{ color: 'var(--c-text-primary)', fontSize: 12 }}>{run.agentName}</strong>
                {run.orderId && <span style={{ color: 'var(--c-terracotta)', fontWeight: 700, marginLeft: 8 }}>{run.orderId}</span>}
                <div style={{ color: 'var(--c-text-secondary)', marginTop: 2 }}>{run.summary}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--c-text-muted)' }}>
                <span className={`status-pill ${run.status === 'ALERT' ? 'status-review' : 'status-feasible'}`} style={{ fontSize: 8.5, padding: '1px 6px' }}>
                  {run.status}
                </span>
                <div style={{ marginTop: 2 }}>{run.durationMs}ms &bull; {run.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

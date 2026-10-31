import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShoppingBag,
  Factory,
  Compass
} from 'lucide-react';

export const GlobalPortalSwitcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isClient = path.startsWith('/client');
  const isSupervisor = path.startsWith('/supervisor');
  const isHub = path === '/hub' || path === '/gateway';
  const isAdmin = !isClient && !isSupervisor && !isHub;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 20,
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 7px',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #e2e8f0',
        borderRadius: 9999,
        boxShadow: '0 4px 18px rgba(16, 24, 40, 0.08)',
        userSelect: 'none'
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#64748b',
          padding: '0 8px 0 6px'
        }}
      >
        LoomPilot Role:
      </span>

      {/* Admin Portal Tab */}
      <button
        type="button"
        onClick={() => navigate('/admin')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isAdmin ? 700 : 500,
          color: '#18191B',
          background: isAdmin ? '#79B4B7' : 'transparent',
          border: isAdmin ? '1px solid #67A4A7' : '1px solid transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <ShieldCheck size={14} color="#18191B" />
        <span>Factory Admin</span>
      </button>

      {/* Client Portal Tab */}
      <button
        type="button"
        onClick={() => navigate('/client/dashboard')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isClient ? 700 : 500,
          color: '#18191B',
          background: isClient ? '#F8F0DF' : 'transparent',
          border: isClient ? '1px solid #79B4B7' : '1px solid transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <ShoppingBag size={14} color="#18191B" />
        <span>Client Portal</span>
      </button>

      {/* Supervisor Portal Tab */}
      <button
        type="button"
        onClick={() => navigate('/supervisor/dashboard')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isSupervisor ? 700 : 500,
          color: '#18191B',
          background: isSupervisor ? '#F8F0DF' : 'transparent',
          border: isSupervisor ? '1px solid #79B4B7' : '1px solid transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Factory size={14} color="#18191B" />
        <span>Mill Supervisor</span>
      </button>

      {/* Unified Hub Tab */}
      <button
        type="button"
        onClick={() => navigate('/hub')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '6px 10px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isHub ? 700 : 500,
          color: '#18191B',
          background: isHub ? '#F8F0DF' : 'transparent',
          border: isHub ? '1px solid #79B4B7' : '1px solid transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        title="Unified Platform Hub"
      >
        <Compass size={14} color="#18191B" />
        <span>Hub</span>
      </button>
    </div>
  );
};


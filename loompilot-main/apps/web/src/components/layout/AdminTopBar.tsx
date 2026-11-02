import React from 'react';
import { Search, Play, TrendingUp, LogOut } from 'lucide-react';
import type { AdminUser } from '../../types';

interface AdminTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  simDay: number;
  simDate: string;
  user: AdminUser;
  onLogout: () => void;
  onSimulateNextDay: () => void;
  onSimulateCottonSpike: () => void;
}

export const AdminTopBar: React.FC<AdminTopBarProps> = ({
  searchQuery,
  onSearchChange,
  simDay,
  simDate,
  user,
  onLogout,
  onSimulateNextDay,
  onSimulateCottonSpike
}) => {
  return (
    <header className="top-bar">
      {/* Brand Logo & Authority Badge */}
      <div className="top-brand" title="LoomPilot - Textile Manufacturing OS">
        <span className="top-brand-text">LOOMPILOT</span>
        <span className="top-brand-badge">ADMIN</span>
      </div>

      {/* Search Input Box */}
      <div className="search-box">
        <input
          type="text"
          placeholder="Search orders, clients, BOM..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search orders and clients"
        />
        <button className="search-submit-btn" aria-label="Search">
          <Search size={14} />
        </button>
      </div>

      {/* Simulation Controls (Compact) */}
      <div className="sim-controls-container" title="Simulate Daily Manufacturing Cycle & Market Events">
        <button className="sim-btn" onClick={onSimulateNextDay} title="Run 1 Production Day & Trigger Daily Agents">
          <Play size={10} fill="currentColor" />
          <span>+1 Day</span>
        </button>
        <button className="sim-btn sim-btn-danger" onClick={onSimulateCottonSpike} title="Simulate Cotton Price Surge (+14.2%)">
          <TrendingUp size={10} />
          <span>Surge +14%</span>
        </button>
      </div>

      {/* Date & Time Widget Pill */}
      <div className="datetime-pill">
        <span style={{ fontWeight: 700, color: 'var(--c-text-primary)' }}>Day {simDay}</span>
        <span style={{ color: 'var(--c-text-muted)' }}>&bull;</span>
        <span style={{ fontWeight: 600, color: 'var(--c-text-secondary)' }}>{simDate}</span>
      </div>

      {/* Admin User Info Pill */}
      <div className="admin-badge-pill" title={`${user.title} - ${user.unit}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--c-terracotta)',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9.5,
          fontWeight: 800
        }}>
          {user.name.split(' ').map((n) => n[0]).join('')}
        </span>
        <span style={{ fontWeight: 600 }}>{user.name}</span>
      </div>

      {/* Logout Button */}
      <button className="logout-pill-btn" onClick={onLogout} title="Sign Out of Admin Portal">
        <LogOut size={13} />
        <span>Logout</span>
      </button>
    </header>
  );
};

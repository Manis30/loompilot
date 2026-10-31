import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileCheck2,
  Boxes,
  Activity,
  HardHat,
  TrendingUp,
  MessageSquare,
  Truck,
  Users,
  ShieldCheck,
  LogOut,
  Layers,
  ShoppingBag,
  Factory
} from 'lucide-react';
import type { AdminUser, AdminNavTab } from '../../types';

export type { AdminNavTab };

export interface AdminSidebarProps {
  currentTab: AdminNavTab;
  onTabChange: (tab: AdminNavTab) => void;
  user: AdminUser;
  pendingQuotesCount?: number;
  openEscalationsCount?: number;
  surgeAlertsCount?: number;
  materialShortagesCount?: number;
  onLogout?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
  user,
  onLogout
}) => {
  const navigate = useNavigate();
  // Compact pill by default; smoothly expands on hover pushing the content
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Clean Navigation Items (no dividers, no badge counter pills as requested)
  const navItems: { id: AdminNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="nav-icon" /> },
    { id: 'orders', label: 'Orders', icon: <ClipboardList className="nav-icon" /> },
    { id: 'quotations', label: 'Quotations', icon: <FileCheck2 className="nav-icon" /> },
    { id: 'procurement', label: 'Procurement', icon: <Boxes className="nav-icon" /> },
    { id: 'production', label: 'Production', icon: <Activity className="nav-icon" /> },
    { id: 'supervisors', label: 'Supervisors', icon: <HardHat className="nav-icon" /> },
    { id: 'priceCentre', label: 'Market Prices', icon: <TrendingUp className="nav-icon" /> },
    { id: 'chat', label: 'Communications', icon: <MessageSquare className="nav-icon" /> },
    { id: 'deliveries', label: 'Deliveries', icon: <Truck className="nav-icon" /> },
    { id: 'users', label: 'Users', icon: <Users className="nav-icon" /> },
    { id: 'audit', label: 'Settings', icon: <ShieldCheck className="nav-icon" /> }
  ];

  return (
    <div
      className={`sidebar-column ${isHovered ? 'expanded' : 'collapsed'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <aside
        className={`sidebar-pillar ${isHovered ? 'expanded' : 'collapsed'}`}
        aria-label="Admin Navigation Pill"
      >
        {/* Top: Capsule Brand Emblem (No divider lines) */}
        <div className="sidebar-top-section">
          <div
            className="brand-header-wrap"
            onClick={() => onTabChange('dashboard')}
            title="LoomPilot OS — Manufacturing Control"
          >
            <div className="brand-emblem-wrap">
              <Layers size={19} />
            </div>
            <span className="brand-name-text">LoomPilot</span>
          </div>
        </div>

        {/* Middle: Navigation Items (Precisely aligned icons, clean labels on hover) */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                className={`nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
                title={item.label}
                aria-label={item.label}
              >
                <span className="nav-icon-box">
                  {item.icon}
                </span>
                <span className="nav-label-text">{item.label}</span>
              </button>
            );
          })}

          {/* Quick External Portal Switchers */}
          <div style={{ height: 1, background: '#eaecf0', margin: '6px 8px', opacity: 0.6 }} />

          <button
            type="button"
            className="nav-btn"
            onClick={() => navigate('/client/dashboard')}
            title="Switch to Client Portal"
            aria-label="Switch to Client Portal"
          >
            <span className="nav-icon-box">
              <ShoppingBag className="nav-icon" />
            </span>
            <span className="nav-label-text">Client Portal</span>
          </button>

          <button
            type="button"
            className="nav-btn"
            onClick={() => navigate('/supervisor/dashboard')}
            title="Switch to Mill Supervisor Portal"
            aria-label="Switch to Mill Supervisor Portal"
          >
            <span className="nav-icon-box">
              <Factory className="nav-icon" />
            </span>
            <span className="nav-label-text">Supervisor Portal</span>
          </button>
        </nav>

        {/* Bottom: User Profile Row (No divider lines) */}
        <div className="sidebar-bottom-section">
          <div
            className="sidebar-user-row"
            title={`${user.name} (Managing Director)`}
            onClick={() => onTabChange('users')}
          >
            <div className="sidebar-user-avatar">JD</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">Managing Director</span>
            </div>
            {onLogout && (
              <button
                className="sidebar-logout-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default AdminSidebar;

import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  Package,
  FileText,
  MessageSquare,
  CreditCard,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Factory,
  ArrowUpRight,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { cn } from '../../utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const { unreadCount, chats } = useApp();
  const location = useLocation();

  // Active negotiation count
  const pendingNegotiations = Object.values(chats).filter(
    (c) => c.status.includes('Revision') || c.status.includes('Review')
  ).length;

  const navItems = [
    { section: 'Operations' },
    { name: 'Overview', to: '/client/dashboard', icon: LayoutDashboard },
    { name: 'Product Catalogue', to: '/client/products', icon: Layers },
    { name: 'Create New Order', to: '/client/orders/new', icon: PlusCircle },
    { name: 'My Orders', to: '/client/orders', icon: Package },
    { section: 'Commercials' },
    {
      name: 'Quotations',
      to: '/client/quotations',
      icon: FileText,
      badge: pendingNegotiations > 0 ? pendingNegotiations : undefined,
    },
    { name: 'Messages & Chat', to: '/client/messages', icon: MessageSquare },
    { name: 'Payments & Invoices', to: '/client/payments', icon: CreditCard },
    { section: 'Account' },
    {
      name: 'Notifications',
      to: '/client/notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { name: 'Settings & Mill', to: '/client/settings', icon: Settings },
  ];

  // Helper to accurately determine active route without prefix bleed
  const isItemActive = (to: string) => {
    const current = location.pathname;
    if (to === '/client/orders/new') {
      return current === '/client/orders/new';
    }
    if (to === '/client/orders') {
      // Active for /client/orders and /client/orders/:id, but NOT for /client/orders/new
      return current === '/client/orders' || (current.startsWith('/client/orders/') && current !== '/client/orders/new');
    }
    if (to === '/client/dashboard') {
      return current === '/client/dashboard';
    }
    return current === to || current.startsWith(to + '/');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-charcoal text-ivory border-r border-white/10 transition-all duration-300',
          collapsed ? 'w-20' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header / Brand Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <Link
            to="/client/dashboard"
            className="flex items-center gap-3 overflow-hidden"
            onClick={onCloseMobile}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-vermilion to-vermilion-hover flex items-center justify-center text-white shadow-vermilion flex-shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
                <line x1="8" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="16" y2="21" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-white leading-tight">
                  Loom<span className="text-vermilion">Pilot</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-light font-semibold">
                  Client Portal
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-muted-light hover:text-white hover:bg-white/10 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
          {navItems.map((item, idx) => {
            if (item.section) {
              if (collapsed) {
                return (
                  <div
                    key={idx}
                    className="pt-3 pb-1 flex justify-center border-t border-white/5 first:border-none"
                  >
                    <span className="w-2 h-0.5 rounded bg-muted-light/40" />
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className="px-3 pt-4 pb-1 text-[10px] uppercase font-bold tracking-wider text-muted-light/70 first:pt-0"
                >
                  {item.section}
                </div>
              );
            }

            const Icon = item.icon!;
            const active = isItemActive(item.to!);

            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/client/orders' || item.to === '/client/orders/new'}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group',
                  active
                    ? 'bg-vermilion text-white shadow-vermilion'
                    : 'text-muted-light hover:text-white hover:bg-white/5'
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon size={19} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="truncate flex-1 text-left">{item.name}</span>
                )}
                {!collapsed && item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white/20 text-white">
                    {item.badge}
                  </span>
                )}
                {collapsed && item.badge !== undefined && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-vermilion ring-2 ring-charcoal" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Client Account Info Footer */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5',
              collapsed && 'justify-center p-1.5'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-charcoal-light border border-white/10 flex items-center justify-center font-bold text-xs text-ivory flex-shrink-0">
              {user?.company.slice(0, 2).toUpperCase() || 'RA'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {user?.company || 'Raymond Apparel'}
                </div>
                <div className="text-[10px] font-mono text-muted-light flex items-center gap-1">
                  <ShieldCheck size={11} className="text-success" />
                  {user?.clientCode || 'RAY-IND-8842'}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

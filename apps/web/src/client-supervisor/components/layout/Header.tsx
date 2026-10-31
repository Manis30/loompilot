import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  User,
  CreditCard,
  RotateCcw,
  LogOut,
  X,
  PhoneCall,
  Mail,
  Building,
  Factory,
  ArrowUpRight,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  onOpenMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobile }) => {
  const { user, logout } = useAuth();
  const { unreadCount, resetDemoData, addToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Map route to human breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return { parent: 'Dashboard', active: 'Overview' };
    if (path.includes('/products')) return { parent: 'Sourcing', active: 'Product Catalogue' };
    if (path.includes('/orders/new')) return { parent: 'Orders', active: 'Create Order' };
    if (path.includes('/tracking')) return { parent: 'Manufacturing', active: 'Production Tracking' };
    if (path.includes('/orders')) return { parent: 'Orders', active: 'My Orders' };
    if (path.includes('/quotations')) return { parent: 'Commercials', active: 'Quotations' };
    if (path.includes('/messages')) return { parent: 'Commercials', active: 'Negotiation Chat' };
    if (path.includes('/payments')) return { parent: 'Finance', active: 'Payments & Invoices' };
    if (path.includes('/notifications')) return { parent: 'Account', active: 'Notifications' };
    if (path.includes('/settings')) return { parent: 'Settings', active: 'Client Profile & Mill' };
    return { parent: 'Portal', active: 'Client View' };
  };

  const breadcrumbs = getBreadcrumbs();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;

    if (q.startsWith('lp-')) {
      navigate('/client/orders');
    } else if (q.startsWith('inv-')) {
      navigate('/client/payments');
    } else {
      navigate('/client/products');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-muted-border px-4 lg:px-8 flex items-center justify-between shadow-sm">
        {/* Left: Mobile Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobile}
            className="lg:hidden p-2 rounded-lg text-charcoal hover:bg-ivory transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline font-medium">{breadcrumbs.parent}</span>
            <span className="hidden sm:inline text-muted-light">/</span>
            <span className="font-bold text-charcoal">{breadcrumbs.active}</span>
          </div>
        </div>

        {/* Center: Global Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <form onSubmit={handleSearch} className="w-full relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders (LP-), fabrics, or invoices (INV-)..."
              className="w-full pl-10 pr-4 py-1.5 text-sm rounded-full bg-ivory border border-muted-border focus:bg-white focus:border-vermilion focus:ring-2 focus:ring-vermilion/10 focus:outline-none transition-all"
            />
          </form>
        </div>

        {/* Right: Actions & User Flyout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mill Support Button */}
          <button
            onClick={() => setSupportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-charcoal bg-ivory border border-muted-border hover:border-vermilion hover:text-vermilion transition-all"
          >
            <HelpCircle size={14} />
            <span className="hidden md:inline">Mill Support</span>
          </button>

          {/* Notifications Bell */}
          <Link
            to="/client/notifications"
            className="relative p-2 rounded-lg text-charcoal hover:bg-ivory border border-muted-border transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-vermilion ring-2 ring-white" />
            )}
          </Link>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded-lg border border-muted-border hover:bg-ivory transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-charcoal text-ivory flex items-center justify-center font-bold text-xs">
                {user?.contactPerson.slice(0, 2).toUpperCase() || 'VM'}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-bold text-charcoal truncate max-w-[120px]">
                  {user?.contactPerson || 'Vikram Malhotra'}
                </div>
                <div className="text-[10px] text-muted truncate max-w-[120px]">
                  {user?.company.split(' ')[0] || 'Raymond'}
                </div>
              </div>
              <ChevronDown size={14} className="text-muted" />
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-card-hover border border-muted-border py-2 z-50 animate-in fade-in slide-in-from-top-2"
                onClick={() => setProfileOpen(false)}
              >
                <div className="px-4 py-2 border-b border-muted-border/60">
                  <div className="text-xs font-bold text-charcoal">
                    {user?.company || 'Raymond Apparel Limited'}
                  </div>
                  <div className="text-[11px] font-mono text-muted">
                    {user?.clientCode || 'RAY-IND-8842'} • {user?.accountTier || 'Tier 1'}
                  </div>
                </div>

                <Link
                  to="/client/settings"
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-charcoal hover:bg-ivory hover:text-vermilion transition-colors"
                >
                  <User size={15} />
                  Client Account Profile
                </Link>

                <Link
                  to="/client/payments"
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-charcoal hover:bg-ivory hover:text-vermilion transition-colors"
                >
                  <CreditCard size={15} />
                  Milestones & Invoices
                </Link>

                <div className="my-1 border-t border-muted-border/60" />

                <button
                  onClick={() => {
                    if (confirm('Reset prototype data to factory sample defaults?')) {
                      resetDemoData();
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-warning hover:bg-warning/10 transition-colors text-left"
                >
                  <RotateCcw size={15} />
                  Reset Prototype Data
                </button>

                <button
                  onClick={() => {
                    logout();
                    navigate('/client/login');
                    addToast('Logged out of demo session.', 'info');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-vermilion hover:bg-vermilion/10 transition-colors text-left"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mill Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-muted-border shadow-2xl p-6 relative">
            <button
              onClick={() => setSupportModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-charcoal hover:bg-ivory transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-vermilion/10 text-vermilion flex items-center justify-center font-bold">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-charcoal">
                  Dedicated Mill Merchandising Desk
                </h3>
                <p className="text-xs text-muted">
                  Assigned Account Manager & Weaving Mill Facility
                </p>
              </div>
            </div>

            <div className="space-y-3.5 mb-6 text-xs">
              <div className="p-3.5 rounded-xl bg-ivory border border-muted-border space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Senior VP — Production Merchandising
                </div>
                <div className="text-sm font-bold text-charcoal">
                  Anil Sharma
                </div>
                <div className="flex items-center gap-4 text-muted pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <PhoneCall size={12} className="text-vermilion" /> +91 98402 11029
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-vermilion" /> anil.sharma@loompilot.com
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-muted-border space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <Building size={12} /> Assigned Weaving Plant
                </div>
                <div className="font-semibold text-charcoal">
                  LoomPilot Facility 1 — High-Speed Air-Jet Shed
                </div>
                <div className="text-muted">
                  SF No. 402, Palladam Weaving Cluster, Tirupur-Coimbatore Highway, Tamil Nadu 641662
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted-border">
              <button
                onClick={() => setSupportModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-charcoal hover:bg-ivory border border-muted-border transition-colors"
              >
                Close
              </button>
              <a
                href="mailto:anil.sharma@loompilot.com?subject=LoomPilot%20Client%20Support%20Request%20-%20Raymond%20Apparel"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-vermilion hover:bg-vermilion-hover transition-colors shadow-sm"
              >
                Send Email Request
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

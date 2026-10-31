import React, { useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  Cpu,
  Activity,
  AlertTriangle,
  Bell,
  User,
  ChevronLeft,
  ChevronRight,
  Menu,
  Building,
  RotateCcw,
  LogOut,
  X,
  CheckCircle2,
  Calendar,
  Factory,
  ArrowUpRight,
  Clock,
  PlusCircle,
} from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useApp } from '../../context/AppContext';
import { cn } from '../../utils/cn';

export const SupervisorLayout: React.FC = () => {
  const {
    profile,
    unreadNotifCount,
    isDailyUpdateModalOpen,
    openDailyUpdateModal,
    closeDailyUpdateModal,
    orders,
    logShiftOutput,
    resetSupervisorData,
  } = useSupervisor();

  const { addToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Daily Shift Update Modal state
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [producedMeters, setProducedMeters] = useState<number>(650);
  const [defectiveMeters, setDefectiveMeters] = useState<number>(12);
  const [shiftNotes, setShiftNotes] = useState('Shift A airjet velocity steady. Warp tension calibrated.');

  const navItems = [
    { name: 'Factory Dashboard', to: '/supervisor/dashboard', icon: LayoutDashboard },
    { name: 'Mill Orders', to: '/supervisor/orders', icon: Package, badge: orders.filter(o => o.status === 'Newly Assigned').length || undefined },
    { name: 'Raw Materials', to: '/supervisor/materials', icon: Layers, badgeAlert: true },
    { name: 'Resource Availability', to: '/supervisor/resources', icon: Cpu },
    { name: 'Production Updates', to: '/supervisor/production', icon: Activity },
    { name: 'Issues & Reports', to: '/supervisor/issues', icon: AlertTriangle, badge: 3 },
    { name: 'Notifications', to: '/supervisor/notifications', icon: Bell, badge: unreadNotifCount > 0 ? unreadNotifCount : undefined },
    { name: 'My Profile', to: '/supervisor/profile', icon: User },
  ];

  const handleDailyUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    logShiftOutput(selectedOrderId, producedMeters, defectiveMeters, shiftNotes);
    addToast(`Logged ${producedMeters}m for order ${selectedOrderId}. Shift records updated.`, 'success');
    closeDailyUpdateModal();
  };

  return (
    <div className="min-h-screen bg-[#FBF6F0] flex flex-col font-sans text-[#252622]">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#252622]/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex flex-1">
        {/* SIDEBAR */}
        <aside
          className={cn(
            'fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#252622] text-[#FBF6F0] border-r border-white/10 transition-all duration-300',
            collapsed ? 'w-20' : 'w-64',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            <Link
              to="/supervisor/dashboard"
              className="flex items-center gap-3 overflow-hidden"
              onClick={() => setMobileOpen(false)}
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#E65338] to-[#D24227] flex items-center justify-center text-white shadow-md shadow-[#E65338]/30 flex-shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12h20" />
                  <path d="M7 6v12" />
                  <path d="M12 4v16" />
                  <path d="M17 6v12" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="font-bold text-base tracking-tight text-white leading-tight">
                    Loom<span className="text-[#E65338]">Pilot</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                    Supervisor Portal
                  </span>
                </div>
              )}
            </Link>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group',
                    isActive
                      ? 'bg-[#E65338] text-white shadow-md shadow-[#E65338]/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
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
                  {!collapsed && item.badgeAlert && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#C78627] text-white">
                      Alert
                    </span>
                  )}
                  {collapsed && item.badge !== undefined && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E65338] ring-2 ring-[#252622]" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Shift Status Footer */}
          <div className="p-3 border-t border-white/10 bg-black/20">
            <div
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5',
                collapsed && 'justify-center p-1.5'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-[#E65338] flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                {profile.avatar}
              </div>
              {!collapsed && (
                <div className="overflow-hidden flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {profile.name}
                  </div>
                  <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20845A]"></span>
                    Shift A &bull; {profile.empId}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN BODY AREA */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 transition-all duration-300',
            collapsed ? 'lg:pl-20' : 'lg:pl-64'
          )}
        >
          {/* HEADER */}
          <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#EAE2D9] px-4 lg:px-8 flex items-center justify-between shadow-sm">
            {/* Left: Mobile Button & Breadcrumbs */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-lg text-[#252622] hover:bg-[#FBF6F0] transition-colors"
                aria-label="Open mobile navigation"
              >
                <Menu size={20} />
              </button>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-semibold text-gray-400 hidden sm:inline">LoomPilot Mill Floor</span>
                <span className="text-gray-300 hidden sm:inline">/</span>
                <span className="font-extrabold text-[#252622]">
                  {navItems.find((n) => n.to === location.pathname)?.name || 'Supervisor'}
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Daily Shift Update Button */}
              <button
                onClick={openDailyUpdateModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm shadow-[#E65338]/30 transition-all"
              >
                <PlusCircle size={14} />
                <span className="hidden sm:inline">Daily Shift Update</span>
              </button>

              {/* Shift & Date Pill */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#FBF6F0] border border-[#EAE2D9] text-gray-700">
                <Calendar size={13} className="text-[#E65338]" />
                <span>Shift A (06:00 - 14:30)</span>
              </div>

              {/* Notifications */}
              <Link
                to="/supervisor/notifications"
                className="relative p-2 rounded-lg text-[#252622] hover:bg-[#FBF6F0] border border-[#EAE2D9] transition-colors"
                title="Shift Notifications"
              >
                <Bell size={18} />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#E65338] ring-2 ring-white" />
                )}
              </Link>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2.5 rounded-lg border border-[#EAE2D9] hover:bg-[#FBF6F0] transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#252622] text-white flex items-center justify-center font-bold text-xs">
                    {profile.avatar}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <div className="text-xs font-bold text-[#252622] truncate max-w-[120px]">
                      {profile.name}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {profile.empId}
                    </div>
                  </div>
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-[#EAE2D9] py-2 z-50 animate-in fade-in"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-[#EAE2D9]/60">
                      <div className="text-xs font-bold text-[#252622]">{profile.name}</div>
                      <div className="text-[11px] text-gray-500">{profile.email}</div>
                      <div className="text-[10px] font-mono text-[#20845A] mt-0.5">
                        &bull; {profile.facility}
                      </div>
                    </div>

                    <Link
                      to="/supervisor/profile"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#252622] hover:bg-[#FBF6F0] transition-colors"
                    >
                      <User size={15} />
                      Supervisor Profile
                    </Link>

                    <div className="my-1 border-t border-[#EAE2D9]/60" />

                    <button
                      onClick={() => {
                        if (confirm('Reset supervisor data to initial factory defaults?')) {
                          resetSupervisorData();
                          addToast('Factory shop floor data reset to initial defaults.', 'info');
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#C78627] hover:bg-[#C78627]/10 transition-colors text-left"
                    >
                      <RotateCcw size={15} />
                      Reset Factory Data
                    </button>

                    <button
                      onClick={() => {
                        navigate('/login');
                        addToast('Logged out of supervisor session.', 'info');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#E65338] hover:bg-[#E65338]/10 transition-colors text-left"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* PAGE CONTENT OUTLET */}
          <main className="flex-1 p-4 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* DAILY SHIFT OPERATIONS UPDATE MODAL */}
      {isDailyUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252622]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#EAE2D9] shadow-2xl p-6 relative">
            <button
              onClick={closeDailyUpdateModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-[#252622] hover:bg-[#FBF6F0] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E65338]/10 text-[#E65338] flex items-center justify-center font-bold">
                <Activity size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#252622]">
                  Daily Shift Operations Update
                </h3>
                <p className="text-xs text-gray-500">
                  Log Shift A personnel, produced meters &amp; loom performance
                </p>
              </div>
            </div>

            <form onSubmit={handleDailyUpdateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Active Manufacturing Order
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-semibold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                >
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.id} — {ord.fabricName} ({ord.currentStage})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Produced Metres Today
                  </label>
                  <input
                    type="number"
                    value={producedMeters}
                    onChange={(e) => setProducedMeters(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-bold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Defective Metres (Greige QC)
                  </label>
                  <input
                    type="number"
                    value={defectiveMeters}
                    onChange={(e) => setDefectiveMeters(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-bold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Shift Operations Log &amp; Notes
                </label>
                <textarea
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EAE2D9]">
                <button
                  type="button"
                  onClick={closeDailyUpdateModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-[#FBF6F0] border border-[#EAE2D9] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md shadow-[#E65338]/30 transition-all"
                >
                  Save Shift Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


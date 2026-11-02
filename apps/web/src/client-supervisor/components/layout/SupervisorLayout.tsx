import React, { useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
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
  Loader2,
} from 'lucide-react';
import { useSupervisor } from '../../context/SupervisorContext';
import { useSubmitSupervisorReportMutation } from '../../../store/api/productionApi';
import { useLogoutStaffMutation } from '../../../store/api/authApi';
import { useAppDispatch } from '../../../store/hooks';
import { logout as authLogout } from '../../../store/slices/authSlice';
import { clearAuthCookies } from '../../../utils/cookieUtils';
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

  const safeProfile = profile || {
    avatar: 'SP',
    name: 'Shift Supervisor',
    empId: 'EMP-001',
    email: 'supervisor@mill.com',
    facility: 'Main Loom Shed',
  };

  const { addToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // 4-Point Daily Shift Update Modal state
  const [reportStep, setReportStep] = useState<1 | 2 | 3 | 4>(1);

  // Point 1: Workforce Headcount
  const [headcountTotal, setHeadcountTotal] = useState<number>(24);
  const [wfWeaving, setWfWeaving] = useState<number>(12);
  const [wfSizing, setWfSizing] = useState<number>(4);
  const [wfDyeing, setWfDyeing] = useState<number>(5);
  const [wfQC, setWfQC] = useState<number>(3);

  // Point 2: Machine Checklist
  const [machineChecklist, setMachineChecklist] = useState<Array<{
    id: string;
    name: string;
    status: 'available' | 'maint' | 'breakdown';
    hours: number;
    remarks: string;
  }>>([
    { id: 'loom_01', name: 'Airjet Loom #1', status: 'available', hours: 8, remarks: 'Running at optimal 850 RPM' },
    { id: 'loom_02', name: 'Airjet Loom #2', status: 'breakdown', hours: 3, remarks: 'Warp yarn tension sensor fault' },
    { id: 'sizing_01', name: 'Sizing Machine #1', status: 'available', hours: 8, remarks: 'Starch concentration calibrated' },
    { id: 'dyeing_01', name: 'Dyeing Softflow Vat #1', status: 'available', hours: 7, remarks: 'Completed reactive batch' },
  ]);

  // Point 3: Raw Material Stock Counts
  const [stockCotton40s, setStockCotton40s] = useState<number>(850);
  const [stockPoly30s, setStockPoly30s] = useState<number>(420);
  const [stockDyes, setStockDyes] = useState<number>(95);
  const [stockStarch, setStockStarch] = useState<number>(150);

  // Point 4: Production Output & Defects
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders?.[0]?.id || '');
  const [selectedStage, setSelectedStage] = useState<string>('loom_weaving');
  const [producedMeters, setProducedMeters] = useState<number>(650);
  const [defectiveMeters, setDefectiveMeters] = useState<number>(12);
  const [shiftNotes, setShiftNotes] = useState('Shift A airjet velocity steady. Warp tension calibrated.');
  const [submitSupervisorReportMutation, { isLoading: isSubmittingReport }] = useSubmitSupervisorReportMutation();
  const [logoutStaffMutation] = useLogoutStaffMutation();
  const dispatch = useAppDispatch();

  const handleSupervisorSignOut = async () => {
    try {
      await logoutStaffMutation().unwrap().catch(() => {});
    } catch {}
    dispatch(authLogout());
    clearAuthCookies();
    try {
      localStorage.removeItem('loompilot_token');
      localStorage.removeItem('loompilot_user');
      localStorage.removeItem('loompilot_realm');
    } catch {}
    addToast('Logged out of supervisor session.', 'info');
    navigate('/login');
  };

  // If not authenticated, redirect to login
  if (!profile) {
    return <Navigate to="/login" replace />;
  }
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

  const handleDailyUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderIdToUse = selectedOrderId || (orders[0]?.id || 'ORD-CURRENT');
    const machinesBreakdown = machineChecklist.filter(m => m.status === 'breakdown');

    try {
      await submitSupervisorReportMutation({
        reportDate: new Date().toISOString().split('T')[0],
        processAreas: ['weaving', 'sizing', 'dyeing', 'finishing'],
        employeesPresentTotal: headcountTotal,
        workforce: [
          { area: 'weaving', count: wfWeaving },
          { area: 'sizing', count: wfSizing },
          { area: 'dyeing', count: wfDyeing },
          { area: 'finishing', count: wfQC },
        ],
        resources: {
          machinesAvail: machineChecklist.filter(m => m.status === 'available').length,
          machinesDown: machinesBreakdown.length,
        },
        stockCounts: [
          { materialId: 'mat_cotton_40s', qty: stockCotton40s },
          { materialId: 'mat_poly_30s', qty: stockPoly30s },
          { materialId: 'mat_dyes', qty: stockDyes },
          { materialId: 'mat_starch', qty: stockStarch },
        ],
        outputs: [
          {
            orderId: orderIdToUse,
            stage: selectedStage,
            produced: producedMeters,
            defective: defectiveMeters,
          },
        ],
        machines: machineChecklist.map(m => ({
          machineId: m.id,
          status: m.status,
          hours: m.hours,
          remarks: m.remarks,
        })),
        issues: machinesBreakdown.map(m => ({
          type: 'machine' as const,
          notes: m.remarks || `Breakdown reported on ${m.name}`,
          machineId: m.id,
        })),
        clientGeneratedId: `sr-${Date.now()}`,
      }).unwrap();
    } catch (err) {
      console.warn('Backend daily report submit warning:', err);
    }

    logShiftOutput(orderIdToUse, producedMeters, defectiveMeters, shiftNotes);
    addToast(`4-Point Daily Shift Report Submitted! Output: ${producedMeters}m. Monitoring Agent recalculated progress & ETA.`, 'success');
    closeDailyUpdateModal();
    setReportStep(1);
  };

  if (!profile) return <Navigate to="/login" replace />;

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
                {safeProfile.avatar}
              </div>
              {!collapsed && (
                <div className="overflow-hidden flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {safeProfile.name}
                  </div>
                  <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20845A]"></span>
                    Shift A &bull; {safeProfile.empId}
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
                    {safeProfile.avatar}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <div className="text-xs font-bold text-[#252622] truncate max-w-[120px]">
                      {safeProfile.name}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {safeProfile.empId}
                    </div>
                  </div>
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-[#EAE2D9] py-2 z-50 animate-in fade-in"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-[#EAE2D9]/60">
                      <div className="text-xs font-bold text-[#252622]">{safeProfile.name}</div>
                      <div className="text-[11px] text-gray-500">{safeProfile.email}</div>
                      <div className="text-[10px] font-mono text-[#20845A] mt-0.5">
                        &bull; {safeProfile.facility}
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
                      onClick={handleSupervisorSignOut}
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

      {/* 4-POINT DAILY SUPERVISOR REPORT MODAL */}
      {isDailyUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252622]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-[#EAE2D9] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                closeDailyUpdateModal();
                setReportStep(1);
              }}
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
                  Supervisor Daily Operations Report
                </h3>
                <p className="text-xs text-gray-500">
                  4-Point Shift Specification: Headcount, Machines, Stock &amp; Outputs
                </p>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="grid grid-cols-4 gap-1.5 mb-5 p-1 bg-[#FBF6F0] rounded-xl border border-[#EAE2D9]">
              {[
                { step: 1, label: '1. Headcount' },
                { step: 2, label: '2. Machines' },
                { step: 3, label: '3. Stock' },
                { step: 4, label: '4. Outputs' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setReportStep(s.step as any)}
                  className={cn(
                    'py-1.5 text-[11px] font-bold rounded-lg transition-all text-center',
                    reportStep === s.step
                      ? 'bg-[#E65338] text-white shadow-sm'
                      : 'text-gray-600 hover:text-[#252622]'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleDailyUpdateSubmit} className="space-y-4 text-xs">
              {/* STEP 1: WORKER HEADCOUNT */}
              {reportStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in">
                  <div className="bg-[#FBF6F0] p-3 rounded-xl border border-[#EAE2D9]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                        Total Employees Present Today
                      </span>
                      <span className="font-mono font-bold text-[#E65338] text-sm">
                        {headcountTotal} Workers
                      </span>
                    </div>
                    <input
                      type="number"
                      value={headcountTotal}
                      onChange={(e) => setHeadcountTotal(Number(e.target.value))}
                      min={1}
                      className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-white font-bold text-sm text-[#252622] focus:outline-none focus:border-[#E65338]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Shop Floor Workforce Deployment By Area
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] text-gray-500 font-medium mb-1">Weaving Shed Crew</span>
                        <input
                          type="number"
                          value={wfWeaving}
                          onChange={(e) => setWfWeaving(Number(e.target.value))}
                          min={0}
                          className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-bold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-gray-500 font-medium mb-1">Warping &amp; Sizing Area</span>
                        <input
                          type="number"
                          value={wfSizing}
                          onChange={(e) => setWfSizing(Number(e.target.value))}
                          min={0}
                          className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-bold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-gray-500 font-medium mb-1">Dyeing &amp; Processing Vat</span>
                        <input
                          type="number"
                          value={wfDyeing}
                          onChange={(e) => setWfDyeing(Number(e.target.value))}
                          min={0}
                          className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-bold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-gray-500 font-medium mb-1">QC Inspection &amp; Packing</span>
                        <input
                          type="number"
                          value={wfQC}
                          onChange={(e) => setWfQC(Number(e.target.value))}
                          min={0}
                          className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-bold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: MACHINE STATUS CHECKLIST */}
              {reportStep === 2 && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="text-[11px] text-gray-500 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900">
                    <strong>Note:</strong> Marking a machine as <strong>Breakdown</strong> automatically creates a maintenance ticket for technicians.
                  </div>

                  <div className="space-y-2.5">
                    {machineChecklist.map((m, idx) => (
                      <div key={m.id} className="p-3 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#252622] text-xs">{m.name}</span>
                          <div className="flex items-center gap-1">
                            {(['available', 'maint', 'breakdown'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => {
                                  const updated = [...machineChecklist];
                                  updated[idx] = { ...updated[idx]!, status: st };
                                  setMachineChecklist(updated);
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all',
                                  m.status === st
                                    ? st === 'available'
                                      ? 'bg-emerald-600 text-white'
                                      : st === 'maint'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'bg-white text-gray-500 border border-[#EAE2D9]'
                                )}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            placeholder="Hours (e.g. 8)"
                            value={m.hours}
                            onChange={(e) => {
                              const updated = [...machineChecklist];
                              updated[idx] = { ...updated[idx]!, hours: Number(e.target.value) };
                              setMachineChecklist(updated);
                            }}
                            className="p-1.5 rounded-lg border border-[#EAE2D9] bg-white font-semibold text-[11px]"
                          />
                          <input
                            type="text"
                            placeholder="Operator remarks / issues"
                            value={m.remarks}
                            onChange={(e) => {
                              const updated = [...machineChecklist];
                              updated[idx] = { ...updated[idx]!, remarks: e.target.value };
                              setMachineChecklist(updated);
                            }}
                            className="col-span-2 p-1.5 rounded-lg border border-[#EAE2D9] bg-white text-[11px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: RAW MATERIAL STOCK CHECK */}
              {reportStep === 3 && (
                <div className="space-y-3.5 animate-in fade-in">
                  <div className="text-[11px] text-gray-500">
                    Verify physical shop floor inventory against ERP recorded levels:
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]">
                      <span className="block font-bold text-gray-700 text-[11px] mb-1">
                        Cotton Yarn 40s Ne (kg)
                      </span>
                      <input
                        type="number"
                        value={stockCotton40s}
                        onChange={(e) => setStockCotton40s(Number(e.target.value))}
                        min={0}
                        className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-white font-bold text-[#252622]"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]">
                      <span className="block font-bold text-gray-700 text-[11px] mb-1">
                        Polyester 30s Yarn (kg)
                      </span>
                      <input
                        type="number"
                        value={stockPoly30s}
                        onChange={(e) => setStockPoly30s(Number(e.target.value))}
                        min={0}
                        className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-white font-bold text-[#252622]"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]">
                      <span className="block font-bold text-gray-700 text-[11px] mb-1">
                        Reactive Dyes Batch (kg)
                      </span>
                      <input
                        type="number"
                        value={stockDyes}
                        onChange={(e) => setStockDyes(Number(e.target.value))}
                        min={0}
                        className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-white font-bold text-[#252622]"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0]">
                      <span className="block font-bold text-gray-700 text-[11px] mb-1">
                        Sizing Chemical Starch (kg)
                      </span>
                      <input
                        type="number"
                        value={stockStarch}
                        onChange={(e) => setStockStarch(Number(e.target.value))}
                        min={0}
                        className="w-full p-2 rounded-xl border border-[#EAE2D9] bg-white font-bold text-[#252622]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PRODUCTION OUTPUT & DEFECTS */}
              {reportStep === 4 && (
                <div className="space-y-3.5 animate-in fade-in">
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

                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Production Stage Output Logged
                    </label>
                    <select
                      value={selectedStage}
                      onChange={(e) => setSelectedStage(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] font-semibold text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                    >
                      <option value="loom_weaving">Stage 4: Loom Weaving</option>
                      <option value="warping_sizing">Stage 3: Warping &amp; Sizing</option>
                      <option value="dyeing_finishing">Stage 5: Dyeing &amp; Finishing</option>
                      <option value="quality_check">Stage 6: Greige Quality Inspection</option>
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
                      rows={2}
                      className="w-full p-2.5 rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] text-[#252622] focus:bg-white focus:outline-none focus:border-[#E65338]"
                    />
                  </div>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-[#EAE2D9]">
                <div>
                  {reportStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setReportStep((prev) => (prev - 1) as any)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-[#FBF6F0] border border-[#EAE2D9] transition-colors"
                    >
                      &larr; Previous Step
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeDailyUpdateModal();
                      setReportStep(1);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-[#FBF6F0] transition-colors"
                  >
                    Cancel
                  </button>

                  {reportStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => setReportStep((prev) => (prev + 1) as any)}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#252622] hover:bg-black transition-all"
                    >
                      Next Step &rarr;
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md shadow-[#E65338]/30 transition-all flex items-center gap-1.5"
                    >
                      {isSubmittingReport ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Submitting 4-Point Report...</span>
                        </>
                      ) : (
                        <span>Submit 4-Point Shift Report</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Building,
  Factory,
  Shield,
  Zap,
  ArrowUpRight,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useLoginStaffMutation, useLoginClientMutation } from '../../../store/api/authApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setCredentials } from '../../../store/slices/authSlice';
import { setAuthCookies, getAuthCookie } from '../../../utils/cookieUtils';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const UnifiedLoginPage: React.FC = () => {
  const { login, directLoginClient } = useAuth();
  const { addToast } = useApp();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.auth);

  const [loginStaff, { isLoading: isStaffLoading }] = useLoginStaffMutation();
  const [loginClient, { isLoading: isClientLoading }] = useLoginClientMutation();

  // Active Tab: 'admin' | 'supervisor' | 'client'
  const [activeRole, setActiveRole] = useState<'admin' | 'supervisor' | 'client'>('admin');

  // Form Fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');

  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSupervisorPassword, setShowSupervisorPassword] = useState(false);
  const [showClientPassword, setShowClientPassword] = useState(false);

  const fillAdminCredentials = () => {
    setAdminEmail('admin@mill.loompilot.local');
    setAdminPassword('AdminSecret123!');
    setFormError(null);
  };

  const fillSupervisorCredentials = () => {
    setSupervisorId('supervisor@mill.loompilot.local');
    setSupervisorPassword('SupervisorSecret123!');
    setFormError(null);
  };

  const fillClientCredentials = () => {
    setClientEmail('client@acme.com');
    setClientPassword('ClientPass123!');
    setFormError(null);
  };

  // If user is already authenticated with a valid role, route directly to their portal
  useEffect(() => {
    const token =
      authState.token ||
      (typeof window !== 'undefined' ? localStorage.getItem('loompilot_token') : null) ||
      getAuthCookie('loompilot_token') ||
      getAuthCookie('access_token');

    let role: string | null = authState.user?.role?.toLowerCase() || null;
    if (!role && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('loompilot_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.role) role = parsed.role.toLowerCase();
        }
      } catch {}
    }
    if (!role) {
      const cookieRole = getAuthCookie('loompilot_role');
      if (cookieRole) role = cookieRole.toLowerCase();
    }

    if (token && role) {
      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (role === 'supervisor') {
        navigate('/supervisor/dashboard', { replace: true });
      } else if (role === 'client') {
        navigate('/client/dashboard', { replace: true });
      }
    }
  }, [authState.token, authState.user, navigate]);

  // 1-Click Direct Demo Logins (Available ONLY when demo mode is enabled)
  const handleDirectAdminLogin = () => {
    if (!isDemoEnabled) {
      setFormError('Direct demo login is disabled in standard operation.');
      return;
    }
    setAdminEmail('admin@mill.loompilot.local');
    setAdminPassword('AdminSecret123!');
    setActiveRole('admin');
  };

  const handleDirectClientLogin = () => {
    if (!isDemoEnabled) {
      setFormError('Direct demo login is disabled in standard operation.');
      return;
    }
    setIsLoading(true);
    const res = directLoginClient();
    if (res.success) {
      addToast('Authenticated as Demo Client.', 'success');
      navigate('/client/dashboard');
    } else {
      setFormError(res.error || 'Demo login failed');
    }
    setIsLoading(false);
  };

  const handleDirectSupervisorLogin = () => {
    if (!isDemoEnabled) {
      setFormError('Direct demo login is disabled in standard operation.');
      return;
    }
    setIsLoading(true);
    addToast('Authenticated as Demo Supervisor.', 'success');
    navigate('/supervisor/dashboard');
    setIsLoading(false);
  };

  // Form Submit Handler (Connected strictly to Backend Authentication & Cookies)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    const configuredTenantId =
      (import.meta as any).env?.VITE_DEFAULT_TENANT_ID ||
      (import.meta as any).env?.VITE_TENANT_ID ||
      undefined;

    if (activeRole === 'admin') {
      try {
        if (!adminEmail.trim() || !adminPassword.trim()) {
          throw new Error('Please enter both administrator email and password.');
        }

        const res = await loginStaff({
          email: adminEmail.trim(),
          password: adminPassword.trim(),
          ...(configuredTenantId ? { tenantId: configuredTenantId } : {}),
        }).unwrap();

        if (!res?.accessToken || !res?.user) {
          throw new Error('Authentication response did not contain valid access token.');
        }

        const authUser = res.user;

        if (authUser.role !== 'admin') {
          throw new Error('Access denied: account does not have administrator privileges.');
        }

        // Store in Redux, LocalStorage, and Cookies
        dispatch(
          setCredentials({
            user: authUser,
            token: res.accessToken,
            realm: 'user',
          })
        );
        setAuthCookies(res.accessToken, 'admin');

        addToast(`Welcome Administrator ${authUser.name}!`, 'success');
        navigate('/admin');
      } catch (err: any) {
        const message =
          err?.data?.error?.message ||
          err?.data?.message ||
          err?.error ||
          err?.message ||
          'Invalid administrator credentials. Please check your email and password.';
        setFormError(message);
        addToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    } else if (activeRole === 'supervisor') {
      try {
        if (!supervisorId.trim() || !supervisorPassword.trim()) {
          throw new Error('Please enter both supervisor ID/email and password.');
        }

        const res = await loginStaff({
          email: supervisorId.trim(),
          password: supervisorPassword.trim(),
          ...(configuredTenantId ? { tenantId: configuredTenantId } : {}),
        }).unwrap();

        if (!res?.accessToken || !res?.user) {
          throw new Error('Authentication response did not contain valid access token.');
        }

        const authUser = res.user;

        if (authUser.role !== 'supervisor') {
          throw new Error('Access denied: account does not have supervisor privileges.');
        }

        // Store in Redux, LocalStorage, and Cookies
        dispatch(
          setCredentials({
            user: authUser,
            token: res.accessToken,
            realm: 'user',
          })
        );
        setAuthCookies(res.accessToken, 'supervisor');

        addToast(`Welcome ${authUser.name}! Connected to Production Floor.`, 'success');
        navigate('/supervisor/dashboard');
      } catch (err: any) {
        const message =
          err?.data?.error?.message ||
          err?.data?.message ||
          err?.error ||
          err?.message ||
          'Invalid supervisor credentials. Please check your ID and password.';
        setFormError(message);
        addToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      // activeRole === 'client'
      try {
        if (!clientEmail.trim() || !clientPassword.trim()) {
          throw new Error('Please enter both client work email and password.');
        }

        const res = await loginClient({
          email: clientEmail.trim(),
          password: clientPassword.trim(),
          ...(configuredTenantId ? { tenantId: configuredTenantId } : {}),
        }).unwrap();

        if (!res?.accessToken || !res?.user) {
          throw new Error('Authentication response did not contain valid access token.');
        }

        const authUser = res.user;

        if (authUser.role !== 'client') {
          throw new Error('Access denied: account does not have client privileges.');
        }

        // Store in Redux, LocalStorage, and Cookies
        dispatch(
          setCredentials({
            user: authUser,
            token: res.accessToken,
            realm: 'client',
          })
        );
        setAuthCookies(res.accessToken, 'client');

        // Update AuthContext profile with confirmed server identity
        login(clientEmail, clientPassword, {
          id: authUser.id,
          clientCode: `CLT-${authUser.id.slice(-6).toUpperCase()}`,
          company: authUser.name || 'Client Corporation',
          brand: authUser.name || 'Commercial Line',
          gstin: '29AABCL1234F1Z5',
          contactPerson: authUser.name,
          designation: 'Authorized Sourcing Representative',
          email: authUser.email,
          phone: '+91 98765 43210',
          shippingPlant: 'Designated Mill Inward Dock',
          billingAddress: 'Corporate Office',
          accountTier: 'Enterprise Verified',
          creditLimit: '₹50,00,000',
          availableCredit: '₹35,00,000',
          relationshipManager: 'Operations Desk (+91 80 4000 1122)',
        });

        addToast(`Authenticated as ${authUser.name}.`, 'success');
        navigate('/client/dashboard');
      } catch (err: any) {
        const message =
          err?.data?.error?.message ||
          err?.data?.message ||
          err?.error ||
          err?.message ||
          'Invalid client credentials. Please check your email and password.';
        setFormError(message);
        addToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isSubmitting = isLoading || isStaffLoading || isClientLoading;

  return (
    <div className="min-h-screen bg-[#FBF6F0] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#E65338] selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Tagline */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E65338]/10 text-[#E65338] text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={14} />
          <span>Unified Access Control</span>
        </div>

        <h1 className="text-3xl font-extrabold text-[#252622] tracking-tight">
          LoomPilot Platform Portal
        </h1>
        <p className="mt-1.5 text-xs text-gray-500 font-medium">
          Secure industrial gateway for factory administrators, supervisors, and enterprise clients
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-xl shadow-black/5 rounded-2xl border border-[#EAE2D9] space-y-6">
          {/* Explicit Demo Direct Logins (Rendered ONLY when VITE_ENABLE_DEMO_LOGIN === 'true') */}
          {isDemoEnabled && (
            <div className="space-y-3 pb-5 border-b border-[#EAE2D9]">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#252622]">
                <Zap size={14} className="text-[#E65338]" />
                <h2>Quick Demo Access</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleDirectAdminLogin}
                  disabled={isSubmitting}
                  className="group relative p-3 rounded-xl border border-[#EAE2D9] hover:border-[#1E3A8A] bg-[#FBF6F0] hover:bg-[#1E3A8A] transition-all duration-200 text-left flex flex-col justify-between shadow-sm disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="p-1.5 rounded-lg bg-white group-hover:bg-white/10 text-[#1E3A8A] group-hover:text-white transition-colors">
                        <Shield size={16} />
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#1E3A8A]/10 text-[#1E3A8A] group-hover:bg-white/20 group-hover:text-white transition-colors">
                        Admin
                      </span>
                    </div>
                    <div className="font-extrabold text-xs text-[#252622] group-hover:text-white transition-colors">
                      Factory Admin
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#EAE2D9]/70 group-hover:border-white/10 flex items-center justify-between text-[11px] font-bold text-[#1E3A8A] group-hover:text-white transition-colors">
                    <span>Fill Admin</span>
                    <ArrowRight size={12} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDirectSupervisorLogin}
                  disabled={isSubmitting}
                  className="group relative p-3 rounded-xl border border-[#EAE2D9] hover:border-[#E65338] bg-[#FBF6F0] hover:bg-[#E65338] transition-all duration-200 text-left flex flex-col justify-between shadow-sm disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="p-1.5 rounded-lg bg-white group-hover:bg-white/10 text-[#E65338] group-hover:text-white transition-colors">
                        <Factory size={16} />
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#E65338]/10 text-[#E65338] group-hover:bg-white/20 group-hover:text-white transition-colors">
                        Shift
                      </span>
                    </div>
                    <div className="font-extrabold text-xs text-[#252622] group-hover:text-white transition-colors">
                      Supervisor
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#EAE2D9]/70 group-hover:border-white/10 flex items-center justify-between text-[11px] font-bold text-[#E65338] group-hover:text-white transition-colors">
                    <span>Supervisor</span>
                    <ArrowUpRight size={12} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDirectClientLogin}
                  disabled={isSubmitting}
                  className="group relative p-3 rounded-xl border border-[#EAE2D9] hover:border-[#252622] bg-[#FBF6F0] hover:bg-[#252622] transition-all duration-200 text-left flex flex-col justify-between shadow-sm disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="p-1.5 rounded-lg bg-white group-hover:bg-white/10 text-[#252622] group-hover:text-white transition-colors">
                        <Building size={16} />
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#252622]/10 text-[#252622] group-hover:bg-white/20 group-hover:text-white transition-colors">
                        Client
                      </span>
                    </div>
                    <div className="font-extrabold text-xs text-[#252622] group-hover:text-white transition-colors">
                      Brand Client
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#EAE2D9]/70 group-hover:border-white/10 flex items-center justify-between text-[11px] font-bold text-[#252622] group-hover:text-white transition-colors">
                    <span>Client</span>
                    <ArrowRight size={12} />
                  </div>
                </button>
              </div>

              <div className="relative my-3 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#EAE2D9]"></div>
                </div>
                <span className="relative px-3 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Or Authenticate With Account
                </span>
              </div>
            </div>
          )}

          {/* Role Selector Tabs (Admin, Supervisor, Client) */}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#252622] mb-2.5">
              Select Portal Role
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#FBF6F0] border border-[#EAE2D9]">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('admin');
                  setFormError(null);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeRole === 'admin'
                    ? 'bg-[#1E3A8A] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#1E3A8A]'
                }`}
              >
                <Shield size={14} />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('supervisor');
                  setFormError(null);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeRole === 'supervisor'
                    ? 'bg-[#E65338] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#E65338]'
                }`}
              >
                <Factory size={14} />
                <span>Supervisor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('client');
                  setFormError(null);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeRole === 'client'
                    ? 'bg-[#252622] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#252622]'
                }`}
              >
                <Building size={14} />
                <span>Client</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-[#E65338]/10 border border-[#E65338]/20 flex items-start gap-2.5 text-xs text-[#E65338] font-medium animate-in fade-in">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeRole === 'admin' && (
              <>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-xs">
                  <div>
                    <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Demo Admin Account</div>
                    <div className="font-mono text-xs text-blue-950 font-semibold">admin@mill.loompilot.local</div>
                  </div>
                  <button
                    type="button"
                    onClick={fillAdminCredentials}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#1E3A8A] text-white hover:bg-[#152B6B] transition-colors shadow-xs"
                  >
                    Use Demo Admin
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@mill.loompilot.local"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Administrator Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showAdminPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="AdminSecret123!"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                      tabIndex={-1}
                      title={showAdminPassword ? "Hide password" : "Show password"}
                    >
                      {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#1E3A8A] hover:bg-[#152B6B] shadow-md transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Verifying Admin Session...' : 'Sign In to Admin Portal'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}

            {activeRole === 'supervisor' && (
              <>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/80 border border-orange-200/70 text-xs">
                  <div>
                    <div className="text-[10px] font-extrabold text-[#E65338] uppercase tracking-wider">Demo Supervisor Account</div>
                    <div className="font-mono text-xs text-orange-950 font-semibold">supervisor@mill.loompilot.local</div>
                  </div>
                  <button
                    type="button"
                    onClick={fillSupervisorCredentials}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#E65338] text-white hover:bg-[#D24227] transition-colors shadow-xs"
                  >
                    Use Demo Supervisor
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Supervisor / Staff ID or Email
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={supervisorId}
                      onChange={(e) => setSupervisorId(e.target.value)}
                      placeholder="supervisor@mill.loompilot.local"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#E65338] focus:ring-2 focus:ring-[#E65338]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Shift Access PIN / Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showSupervisorPassword ? "text" : "password"}
                      value={supervisorPassword}
                      onChange={(e) => setSupervisorPassword(e.target.value)}
                      placeholder="SupervisorSecret123!"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#E65338] focus:ring-2 focus:ring-[#E65338]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupervisorPassword(!showSupervisorPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                      tabIndex={-1}
                      title={showSupervisorPassword ? "Hide password" : "Show password"}
                    >
                      {showSupervisorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md shadow-[#E65338]/30 transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Verifying Shift Access...' : 'Sign In to Supervisor Portal'}</span>
                  <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </>
            )}

            {activeRole === 'client' && (
              <>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-xs">
                  <div>
                    <div className="text-[10px] font-extrabold text-stone-600 uppercase tracking-wider">Demo Client Account</div>
                    <div className="font-mono text-xs text-stone-900 font-semibold">client@acme.com</div>
                  </div>
                  <button
                    type="button"
                    onClick={fillClientCredentials}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#252622] text-white hover:bg-black transition-colors shadow-xs"
                  >
                    Use Demo Client
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Authorized Business Email
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@acme.com"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#252622] focus:ring-2 focus:ring-[#252622]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Enterprise Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showClientPassword ? "text" : "password"}
                      value={clientPassword}
                      onChange={(e) => setClientPassword(e.target.value)}
                      placeholder="ClientPass123!"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#252622] focus:ring-2 focus:ring-[#252622]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientPassword(!showClientPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                      tabIndex={-1}
                      title={showClientPassword ? "Hide password" : "Show password"}
                    >
                      {showClientPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#252622] hover:bg-[#191A16] shadow-md transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Client Portal'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

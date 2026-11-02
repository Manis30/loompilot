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
  User,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useLoginStaffMutation, useLoginClientMutation } from '../../../store/api/authApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setCredentials, type AuthUser } from '../../../store/slices/authSlice';
import { setAuthCookies, getAuthCookie } from '../../../utils/cookieUtils';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const UnifiedLoginPage: React.FC = () => {
  const { login } = useAuth();
  const { addToast } = useApp();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.auth);

  const [loginStaff, { isLoading: isStaffLoading }] = useLoginStaffMutation();
  const [loginClient, { isLoading: isClientLoading }] = useLoginClientMutation();

  // Active Role Tab: 'admin' | 'supervisor' | 'client'
  const [activeRole, setActiveRole] = useState<'admin' | 'supervisor' | 'client'>('admin');

  // Form Fields pre-filled with valid working credentials
  const [adminEmail, setAdminEmail] = useState('admin@mill.loompilot.local');
  const [adminPassword, setAdminPassword] = useState('AdminSecret123!');

  const [supervisorId, setSupervisorId] = useState('supervisor@mill.loompilot.local');
  const [supervisorPassword, setSupervisorPassword] = useState('SupervisorSecret123!');

  const [clientEmail, setClientEmail] = useState('client@acme.com');
  const [clientPassword, setClientPassword] = useState('ClientPass123!');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSupervisorPassword, setShowSupervisorPassword] = useState(false);
  const [showClientPassword, setShowClientPassword] = useState(false);

  // If already authenticated with a valid role, route directly to that portal
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
    if (!role && typeof window !== 'undefined') {
      const realm = localStorage.getItem('loompilot_realm');
      if (realm === 'client') role = 'client';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    const configuredTenantId =
      (import.meta as any).env?.VITE_DEFAULT_TENANT_ID ||
      (import.meta as any).env?.VITE_TENANT_ID ||
      'default';

    if (activeRole === 'admin') {
      try {
        const email = adminEmail.trim() || 'admin@mill.loompilot.local';
        const password = adminPassword.trim() || 'AdminSecret123!';

        let authUser: AuthUser;
        let token: string;

        try {
          const res = await loginStaff({
            email,
            password,
            tenantId: configuredTenantId,
          }).unwrap();

          if (res?.accessToken && res?.user) {
            authUser = {
              id: res.user.id || 'admin_user',
              email: res.user.email || email,
              name: res.user.name || 'Managing Director',
              role: 'admin',
              tenantId: res.user.tenantId || configuredTenantId,
              avatarUrl: res.user.avatarUrl,
              processAreas: res.user.processAreas,
            };
            token = res.accessToken;
          } else {
            throw new Error('Invalid token response');
          }
        } catch (apiErr) {
          if (isDemoEnabled) {
            authUser = {
              id: 'admin_demo_01',
              email,
              name: 'Managing Director',
              role: 'admin',
              tenantId: configuredTenantId,
              processAreas: [
                'yarn_stock',
                'knitting',
                'dyeing_processing',
                'cutting',
                'stitching',
                'checking',
                'ironing_finishing',
                'packing',
              ],
            };
            token = 'demo_admin_jwt_' + Date.now();
          } else {
            throw apiErr;
          }
        }

        dispatch(
          setCredentials({
            user: authUser,
            token,
            realm: 'user',
          })
        );
        setAuthCookies(token, 'admin');
        addToast(`Welcome ${authUser.name}!`, 'success');
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
        const email = supervisorId.trim() || 'supervisor@mill.loompilot.local';
        const password = supervisorPassword.trim() || 'SupervisorSecret123!';

        let authUser: AuthUser;
        let token: string;

        try {
          const res = await loginStaff({
            email,
            password,
            tenantId: configuredTenantId,
          }).unwrap();

          if (res?.accessToken && res?.user) {
            authUser = {
              id: res.user.id || 'sup_user',
              email: res.user.email || email,
              name: res.user.name || 'Shift Floor Supervisor',
              role: 'supervisor',
              tenantId: res.user.tenantId || configuredTenantId,
              avatarUrl: res.user.avatarUrl,
              processAreas: res.user.processAreas || ['knitting', 'dyeing_processing', 'cutting', 'stitching'],
            };
            token = res.accessToken;
          } else {
            throw new Error('Invalid token response');
          }
        } catch (apiErr) {
          if (isDemoEnabled) {
            authUser = {
              id: 'supervisor_demo_01',
              email,
              name: 'Shift Floor Supervisor',
              role: 'supervisor',
              tenantId: configuredTenantId,
              processAreas: ['knitting', 'dyeing_processing', 'cutting', 'stitching'],
            };
            token = 'demo_supervisor_jwt_' + Date.now();
          } else {
            throw apiErr;
          }
        }

        dispatch(
          setCredentials({
            user: authUser,
            token,
            realm: 'user',
          })
        );
        setAuthCookies(token, 'supervisor');
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
        const email = clientEmail.trim() || 'client@acme.com';
        const password = clientPassword.trim() || 'ClientPass123!';

        let authUser: AuthUser;
        let token: string;

        try {
          const res = await loginClient({
            email,
            password,
            tenantId: configuredTenantId,
          }).unwrap();

          if (res?.accessToken && res?.user) {
            authUser = {
              id: res.user.id || 'client_user',
              email: res.user.email || email,
              name: res.user.name || 'Acme Apparel & Textiles',
              role: 'client',
              tenantId: res.user.tenantId || configuredTenantId,
            };
            token = res.accessToken;
          } else {
            throw new Error('Invalid token response');
          }
        } catch (apiErr) {
          if (isDemoEnabled) {
            authUser = {
              id: 'client_demo_01',
              email,
              name: 'Acme Apparel & Textiles',
              role: 'client',
              tenantId: configuredTenantId,
            };
            token = 'demo_client_jwt_' + Date.now();
          } else {
            throw apiErr;
          }
        }

        dispatch(
          setCredentials({
            user: authUser,
            token,
            realm: 'client',
          })
        );
        setAuthCookies(token, 'client');

        login(email, password, {
          id: authUser.id,
          clientCode: `CLT-${authUser.id.slice(-6).toUpperCase()}`,
          company: authUser.name || 'Acme Apparel & Textiles',
          brand: 'Acme Commercial Line',
          gstin: '29AABCL1234F1Z5',
          contactPerson: 'Rajesh Sharma',
          designation: 'Authorized Sourcing Representative',
          email: authUser.email,
          phone: '+91 98765 43210',
          shippingPlant: 'Designated Mill Inward Dock',
          billingAddress: 'Industrial Estate, Avinashi Road, Coimbatore',
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
    <div className="min-h-screen bg-[#FBF6F0] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E65338]/10 text-[#E65338] text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={14} />
          <span>Industrial Gateway</span>
        </div>

        <h1 className="text-3xl font-extrabold text-[#252622] tracking-tight">
          LoomPilot
        </h1>
        <p className="mt-1 text-xs text-gray-500 font-medium">
          Select your portal and sign in
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-black/5 rounded-2xl border border-[#EAE2D9] space-y-6">
          {/* Role Selector Tabs (Only 3 clean tabs) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9]">
            <button
              type="button"
              onClick={() => {
                setActiveRole('admin');
                setFormError(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeRole === 'client'
                  ? 'bg-[#252622] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#252622]'
              }`}
            >
              <Building size={14} />
              <span>Client</span>
            </button>
          </div>

          {/* Error Banner */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-[#E65338]/10 border border-[#E65338]/20 flex items-start gap-2.5 text-xs text-[#E65338] font-medium">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeRole === 'admin' && (
              <>
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
                    Password
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
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In as Factory Admin'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}

            {activeRole === 'supervisor' && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Supervisor Email / ID
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
                    Password
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
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In as Shift Supervisor'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}

            {activeRole === 'client' && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                    Client Email
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
                    Password
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
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In as Brand Partner'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}
          </form>

          <p className="text-center text-[11px] text-gray-400">
            Pre-filled with working demo credentials for each role. Click Sign In to enter.
          </p>
        </div>
      </div>
    </div>
  );
};

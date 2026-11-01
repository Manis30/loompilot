import React, { useState } from 'react';
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
  Zap,
  ArrowUpRight,
  User,
  AlertCircle,
} from 'lucide-react';
import { useLoginStaffMutation, useLoginClientMutation } from '../../../store/api/authApi';
import { useAppDispatch } from '../../../store/hooks';
import { setCredentials } from '../../../store/slices/authSlice';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const UnifiedLoginPage: React.FC = () => {
  const { login, directLoginClient } = useAuth();
  const { addToast } = useApp();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [loginStaff, { isLoading: isStaffLoading }] = useLoginStaffMutation();
  const [loginClient, { isLoading: isClientLoading }] = useLoginClientMutation();

  // Active Tab: 'client' or 'supervisor'
  const [activeRole, setActiveRole] = useState<'client' | 'supervisor'>('client');

  // Form Fields - Unfilled in standard operational mode
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');

  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1-Click Direct Login (Available only in explicit demo configuration)
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

  // Form Submit Handler (Connected strictly to Backend Authentication)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (activeRole === 'client') {
      try {
        if (!clientEmail.trim() || !clientPassword) {
          throw new Error('Please enter both client work email and password.');
        }

        const configuredTenantId =
          (import.meta as any).env?.VITE_DEFAULT_TENANT_ID ||
          (import.meta as any).env?.VITE_TENANT_ID ||
          undefined;

        const res = await loginClient({
          email: clientEmail.trim(),
          password: clientPassword,
          ...(configuredTenantId ? { tenantId: configuredTenantId } : {}),
        }).unwrap();

        if (!res?.accessToken || !res?.user) {
          throw new Error('Authentication response did not contain valid access token.');
        }

        const authUser = res.user;

        if (authUser.role !== 'client') {
          throw new Error('Access denied: account does not have client privileges.');
        }

        dispatch(
          setCredentials({
            user: authUser,
            token: res.accessToken,
            realm: 'client',
          })
        );

        // Update AuthContext profile with confirmed server identity
        login(clientEmail, clientPassword, {
          id: authUser.id,
          clientCode: `CLT-${authUser.id.slice(-6).toUpperCase()}`,
          company: authUser.name || 'Client Corporation',
          brand: authUser.name || 'Commercial Line',
          contactPerson: authUser.name,
          designation: 'Authorized Sourcing Representative',
          email: authUser.email,
          phone: '+91 98765 43210',
          shippingPlant: 'Designated Mill Inward Dock',
          billingAddress: 'Corporate Office',
          accountTier: 'Enterprise Verified',
          accountManager: {
            name: 'Operations Desk',
            email: 'ops@mill.loompilot.local',
            phone: '+91 80 4000 1122',
          },
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
    } else {
      try {
        if (!supervisorId.trim() || !supervisorPassword) {
          throw new Error('Please enter both staff ID and password.');
        }

        const configuredTenantId =
          (import.meta as any).env?.VITE_DEFAULT_TENANT_ID ||
          (import.meta as any).env?.VITE_TENANT_ID ||
          undefined;

        const res = await loginStaff({
          email: supervisorId.trim(),
          password: supervisorPassword,
          ...(configuredTenantId ? { tenantId: configuredTenantId } : {}),
        }).unwrap();

        if (!res?.accessToken || !res?.user) {
          throw new Error('Authentication response did not contain valid access token.');
        }

        const authUser = res.user;

        // Only navigate after the backend accepts credentials and the returned role matches the requested portal
        if (authUser.role !== 'supervisor') {
          throw new Error('Access denied: account does not have supervisor portal privileges.');
        }

        dispatch(
          setCredentials({
            user: authUser,
            token: res.accessToken,
            realm: 'user',
          })
        );

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
          Secure industrial gateway for textile mills, brands, and loom sheds
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-xl shadow-black/5 rounded-3xl border border-[#EAE2D9] sm:px-10 space-y-6">

          {/* Optional Demo Access Cards (Enabled only when VITE_ENABLE_DEMO_LOGIN === 'true') */}
          {isDemoEnabled && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-[#E65338] fill-[#E65338]" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#252622]">
                  1-Click Demo Profiles (Demo Environment)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={handleDirectClientLogin}
                  disabled={isSubmitting}
                  className="group relative p-4 rounded-xl border-2 border-[#EAE2D9] hover:border-[#252622] bg-[#FBF6F0] hover:bg-[#252622] transition-all duration-200 text-left flex flex-col justify-between shadow-sm hover:shadow-md disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-lg bg-white group-hover:bg-white/10 text-[#252622] group-hover:text-white transition-colors">
                        <Building size={18} />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E65338]/10 text-[#E65338] group-hover:bg-[#E65338] group-hover:text-white transition-colors">
                        Client
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-[#252622] group-hover:text-white transition-colors">
                      Demo Client Portal
                    </div>
                    <div className="text-[11px] text-gray-500 group-hover:text-gray-300 mt-0.5 leading-snug">
                      Preloaded brand sourcing workspace
                    </div>
                  </div>
                  <div className="mt-3.5 pt-2.5 border-t border-[#EAE2D9]/70 group-hover:border-white/10 flex items-center justify-between text-xs font-bold text-[#E65338] group-hover:text-white transition-colors">
                    <span>Enter as Demo Client</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDirectSupervisorLogin}
                  disabled={isSubmitting}
                  className="group relative p-4 rounded-xl border-2 border-[#EAE2D9] hover:border-[#E65338] bg-[#FBF6F0] hover:bg-[#E65338] transition-all duration-200 text-left flex flex-col justify-between shadow-sm hover:shadow-md disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-lg bg-white group-hover:bg-white/10 text-[#E65338] group-hover:text-white transition-colors">
                        <Factory size={18} />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#20845A]/10 text-[#20845A] group-hover:bg-white group-hover:text-[#E65338] transition-colors">
                        Supervisor
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-[#252622] group-hover:text-white transition-colors">
                      Demo Floor Supervisor
                    </div>
                    <div className="text-[11px] text-gray-500 group-hover:text-white/80 mt-0.5 leading-snug">
                      Preloaded shift loom management
                    </div>
                  </div>
                  <div className="mt-3.5 pt-2.5 border-t border-[#EAE2D9]/70 group-hover:border-white/10 flex items-center justify-between text-xs font-bold text-[#E65338] group-hover:text-white transition-colors">
                    <span>Enter as Demo Supervisor</span>
                    <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </button>
              </div>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#EAE2D9]"></div>
                </div>
                <span className="relative px-3 bg-white text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Or Authenticate With Credentials
                </span>
              </div>
            </div>
          )}

          {/* Role Selector Tabs */}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#252622] mb-2.5">
              Select Platform Role
            </div>

            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#FBF6F0] border border-[#EAE2D9]">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('client');
                  setFormError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeRole === 'client'
                    ? 'bg-[#252622] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#252622]'
                }`}
              >
                <Building size={14} />
                <span>Textile Brand / Client</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('supervisor');
                  setFormError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeRole === 'supervisor'
                    ? 'bg-[#E65338] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#252622]'
                }`}
              >
                <Factory size={14} />
                <span>Mill Supervisor / Staff</span>
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
            {activeRole === 'client' ? (
              /* Client Form Fields */
              <>
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
                      placeholder="name@company.com"
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
                      type="password"
                      value={clientPassword}
                      onChange={(e) => setClientPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#252622] focus:ring-2 focus:ring-[#252622]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
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
            ) : (
              /* Supervisor Form Fields */
              <>
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
                      type="password"
                      value={supervisorPassword}
                      onChange={(e) => setSupervisorPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#E65338] focus:ring-2 focus:ring-[#E65338]/10 focus:outline-none transition-all font-medium text-[#252622]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md shadow-[#E65338]/30 transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Supervisor Portal'}</span>
                  <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

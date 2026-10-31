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
  CheckCircle2,
  Zap,
  ArrowUpRight,
  User,
  BadgeAlert,
} from 'lucide-react';

export const UnifiedLoginPage: React.FC = () => {
  const { login, directLoginClient } = useAuth();
  const { addToast } = useApp();
  const navigate = useNavigate();

  // Active Tab: 'client' or 'supervisor'
  const [activeRole, setActiveRole] = useState<'client' | 'supervisor'>('client');

  // Form Fields
  const [clientEmail, setClientEmail] = useState('v.malhotra@raymondapparel.in');
  const [clientPassword, setClientPassword] = useState('LoomPilot@2026');

  const [supervisorId, setSupervisorId] = useState('LP-SUP-042');
  const [supervisorPassword, setSupervisorPassword] = useState('ShiftA@2026');

  const [isLoading, setIsLoading] = useState(false);

  // 1-Click Direct Login as Client
  const handleDirectClientLogin = () => {
    setIsLoading(true);
    directLoginClient();
    addToast('Authenticated as Raymond Apparel Limited (Client Portal).', 'success');
    navigate('/client/dashboard');
  };

  // 1-Click Direct Login as Supervisor
  const handleDirectSupervisorLogin = () => {
    setIsLoading(true);
    addToast('Authenticated as Rajesh Kumar (Senior Production Supervisor).', 'success');
    navigate('/supervisor/dashboard');
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (activeRole === 'client') {
      const res = login(clientEmail, clientPassword);
      if (res.success) {
        addToast('Welcome back, Vikram! Authenticated as Raymond Apparel.', 'success');
        navigate('/client/dashboard');
      } else {
        setIsLoading(false);
      }
    } else {
      addToast('Welcome Rajesh Kumar! Connected to Loom Shed Shift A.', 'success');
      navigate('/supervisor/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF6F0] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#E65338] selection:text-white">
      {/* Top Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E65338] to-[#D24227] items-center justify-center text-white shadow-lg shadow-[#E65338]/30 mb-3.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
            <line x1="8" y1="3" x2="8" y2="21" />
            <line x1="16" y1="3" x2="16" y2="21" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#252622] tracking-tight">
          Loom<span className="text-[#E65338]">Pilot</span>
        </h1>
        <p className="mt-1 text-sm text-gray-600 font-medium">
          Unified Textile Manufacturing Operating System
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-[#EAE2D9] space-y-6">

          {/* Section 1: One-Click Instant Direct Login */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-[#E65338] fill-[#E65338]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#252622]">
                1-Click Direct Login (No Typing Required)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Direct Login: Client */}
              <button
                type="button"
                onClick={handleDirectClientLogin}
                disabled={isLoading}
                className="group relative p-4 rounded-xl border-2 border-[#EAE2D9] hover:border-[#252622] bg-[#FBF6F0] hover:bg-[#252622] transition-all duration-200 text-left flex flex-col justify-between shadow-sm hover:shadow-md"
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
                    Client Portal
                  </div>
                  <div className="text-[11px] text-gray-500 group-hover:text-gray-300 mt-0.5 leading-snug">
                    Raymond Apparel Ltd. &bull; Sourcing &amp; Orders
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#EAE2D9]/70 group-hover:border-white/10 flex items-center justify-between text-xs font-bold text-[#E65338] group-hover:text-white transition-colors">
                  <span>Enter as Client</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Direct Login: Supervisor */}
              <button
                type="button"
                onClick={handleDirectSupervisorLogin}
                disabled={isLoading}
                className="group relative p-4 rounded-xl border-2 border-[#EAE2D9] hover:border-[#E65338] bg-[#FBF6F0] hover:bg-[#E65338] transition-all duration-200 text-left flex flex-col justify-between shadow-sm hover:shadow-md"
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
                    Supervisor Portal
                  </div>
                  <div className="text-[11px] text-gray-500 group-hover:text-white/80 mt-0.5 leading-snug">
                    Rajesh Kumar &bull; Shift A Loom Sheds
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#EAE2D9]/70 group-hover:border-white/15 flex items-center justify-between text-xs font-bold text-[#252622] group-hover:text-white transition-colors">
                  <span>Enter as Supervisor</span>
                  <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#EAE2D9] w-full"></div>
            <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 shrink-0">
              Or Sign In with Form
            </span>
          </div>

          {/* Section 2: Form with Role Tab Selector */}
          <div>
            {/* Role Tabs */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9] mb-5">
              <button
                type="button"
                onClick={() => setActiveRole('client')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeRole === 'client'
                    ? 'bg-[#252622] text-white shadow-sm'
                    : 'text-gray-600 hover:text-[#252622]'
                }`}
              >
                <Building size={14} />
                <span>Client Portal</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole('supervisor')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeRole === 'supervisor'
                    ? 'bg-[#E65338] text-white shadow-sm shadow-[#E65338]/30'
                    : 'text-gray-600 hover:text-[#252622]'
                }`}
              >
                <Factory size={14} />
                <span>Supervisor Portal</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeRole === 'client' ? (
                /* Client Form Fields */
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                      Client Work Email
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="v.malhotra@raymondapparel.in"
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
                        type="password"
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#EAE2D9] bg-[#FBF6F0] focus:bg-white focus:border-[#E65338] focus:ring-2 focus:ring-[#E65338]/10 focus:outline-none transition-all font-medium text-[#252622]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#252622] hover:bg-[#191A16] shadow-md transition-all flex items-center justify-center gap-2 group mt-2"
                  >
                    <span>Sign In to Client Portal</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </>
              ) : (
                /* Supervisor Form Fields */
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252622] mb-1.5">
                      Supervisor ID or Email
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={supervisorId}
                        onChange={(e) => setSupervisorId(e.target.value)}
                        placeholder="LP-SUP-042 or rajesh.kumar@loompilot.com"
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
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-md shadow-[#E65338]/30 transition-all flex items-center justify-center gap-2 group mt-2"
                  >
                    <span>Sign In to Supervisor Portal</span>
                    <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </>
              )}
            </form>
          </div>

          {/* System Status Banner */}
          <div className="p-3 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9] flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#20845A] animate-pulse"></span>
              <span className="font-semibold text-gray-700">Platform Active</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Facility 1 &bull; Raymond Sourcing Hub
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


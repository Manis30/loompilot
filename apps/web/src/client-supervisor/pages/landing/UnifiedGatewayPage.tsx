import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Package,
  Activity,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Settings,
  TrendingUp,
  Sparkles,
  Factory,
  ChevronRight,
  ExternalLink,
  FileText,
  AlertTriangle,
  Zap,
  Cpu,
  Boxes,
  Users,
} from 'lucide-react';

export const UnifiedGatewayPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FBF6F0] text-[#252622] font-sans antialiased selection:bg-[#E65338] selection:text-white">
      {/* Top Banner: Global System Bar */}
      <div className="bg-[#252622] text-[#FBF6F0] px-4 py-2 text-xs border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#20845A] animate-pulse"></span>
            <span className="font-semibold tracking-wide uppercase text-[11px] text-gray-300">
              LoomPilot Unified Manufacturing Network
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-300 hidden sm:inline">
              Coimbatore Facility 1 &bull; Raymond Apparel Hub
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span>Shift A (06:00 - 14:30) Active</span>
            <span className="hidden md:inline">&bull;</span>
            <span className="hidden md:inline">12 Air-Jet Looms Operational</span>
            <span className="text-[#E65338] font-bold">100% Synced</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-[#EAE2D9] px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E65338] to-[#D24227] flex items-center justify-center text-white shadow-md shadow-[#E65338]/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
                <line x1="8" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="16" y2="21" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-black tracking-tight flex items-center gap-1.5">
                Loom<span className="text-[#E65338]">Pilot</span>
                <span className="text-[10px] font-bold tracking-widest uppercase bg-[#252622] text-[#FBF6F0] px-2 py-0.5 rounded-full">
                  Unified Platform
                </span>
              </div>
              <div className="text-[11px] text-gray-500 font-medium hidden sm:block">
                End-to-End B2B Textile Manufacturing Operating System
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/client/dashboard"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#252622] hover:bg-[#F5EFEB] border border-[#EAE2D9] transition-all flex items-center gap-1.5"
            >
              <span>Client Portal</span>
              <ArrowRight size={13} />
            </Link>
            <a
              href="/supervisor/"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#E65338] hover:bg-[#D24227] shadow-sm shadow-[#E65338]/30 transition-all flex items-center gap-1.5"
            >
              <span>Supervisor Portal</span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 pt-12 pb-16 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#EAE2D9] shadow-sm text-xs font-bold text-[#E65338]">
            <Sparkles size={14} />
            <span>Two Specialized Repositories, One Integrated Manufacturing Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#252622] max-w-4xl mx-auto leading-tight">
            Seamlessly Bridging Brand Procurement &amp; Mill Shop-Floor Operations
          </h1>

          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
            LoomPilot integrates enterprise textile buyers and shop-floor supervisors into a single synchronized workflow — spanning quotation negotiation, yarn sourcing, air-jet weaving, laboratory QC, and automated milestone settlements.
          </p>

          {/* Quick Metrics Bar */}
          <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
            <div className="bg-white p-3.5 rounded-xl border border-[#EAE2D9] shadow-sm">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Enterprise Client</div>
              <div className="text-base font-extrabold text-[#252622] mt-0.5">Raymond Apparel</div>
              <div className="text-[11px] text-[#20845A] font-semibold flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} /> Tier 1 Priority Access
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#EAE2D9] shadow-sm">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Active Mill Facility</div>
              <div className="text-base font-extrabold text-[#252622] mt-0.5">Coimbatore Hub 1</div>
              <div className="text-[11px] text-[#20845A] font-semibold flex items-center gap-1 mt-1">
                <Activity size={12} /> Shift A • 94.2% Efficiency
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#EAE2D9] shadow-sm">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Live Production Target</div>
              <div className="text-base font-extrabold text-[#252622] mt-0.5">24,500 Metres</div>
              <div className="text-[11px] text-[#C78627] font-semibold flex items-center gap-1 mt-1">
                <Clock size={12} /> 18,500m Woven (75%)
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#EAE2D9] shadow-sm">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Commercial Model</div>
              <div className="text-base font-extrabold text-[#252622] mt-0.5">30 / 40 / 30 Escrow</div>
              <div className="text-[11px] text-gray-600 font-semibold flex items-center gap-1 mt-1">
                <ShieldCheck size={12} className="text-[#20845A]" /> Razorpay Milestone Verified
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Portals Showcase */}
      <section className="px-4 sm:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-[#252622]">
              Choose Your Portal
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Select your persona below to explore the specialized interface tailored to your operational responsibilities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PORTAL CARD 1: CLIENT PORTAL */}
            <div className="bg-white rounded-2xl border-2 border-[#EAE2D9] hover:border-[#E65338] transition-all duration-300 shadow-md hover:shadow-xl p-6 sm:p-8 flex flex-col justify-between group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E65338]/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
              
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#252622] text-[#FBF6F0] flex items-center justify-center font-bold text-sm shadow">
                      <Layers size={22} className="text-[#E65338]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[#E65338] uppercase tracking-wider">
                        Repository: client
                      </span>
                      <h3 className="text-2xl font-black text-[#252622]">
                        Client Portal
                      </h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E65338]/10 text-[#E65338] border border-[#E65338]/20">
                    React 18 &bull; Vite &bull; Tailwind
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Tailored for enterprise fashion &amp; apparel procurement heads, sourcing managers, and merchandisers to specify fabric criteria, negotiate dynamic pricing, monitor mill progress, and release milestone disbursements.
                </p>

                {/* Persona Chip */}
                <div className="bg-[#FBF6F0] p-3.5 rounded-xl border border-[#EAE2D9] mb-6">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Authenticated Persona
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-[#252622]">Vikram Malhotra</div>
                      <div className="text-xs text-gray-500">Senior VP — Sourcing &bull; Raymond Apparel Ltd.</div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-[#EAE2D9]">
                      RAY-IND-8842
                    </span>
                  </div>
                </div>

                {/* Feature Bullets */}
                <div className="space-y-2.5 mb-6 text-xs text-gray-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>Fabric Catalogue &amp; Datasheets:</strong> Technical specs, GSM counts, lab shades</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>4-Step Custom Order Wizard:</strong> Zod-validated yarn construction &amp; plant destination</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>8-Stage Live Production Tracking:</strong> Clickable inspector &amp; daily loom output</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>AI Quotation &amp; Chat Negotiation:</strong> Counter-offers &amp; binding revised orders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>30/40/30 Milestone Payments:</strong> Automated tax invoices &amp; Razorpay checkout</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4 border-t border-[#EAE2D9]">
                <Link
                  to="/client/dashboard"
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#252622] hover:bg-[#E65338] transition-colors flex items-center justify-center gap-2 shadow-md group-hover:shadow-lg"
                >
                  <span>Launch Client Portal</span>
                  <ArrowRight size={16} />
                </Link>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <Link to="/client/orders" className="hover:text-[#E65338] font-medium underline">
                    My Orders
                  </Link>
                  <span>&bull;</span>
                  <Link to="/client/products" className="hover:text-[#E65338] font-medium underline">
                    Catalogue
                  </Link>
                  <span>&bull;</span>
                  <Link to="/client/payments" className="hover:text-[#E65338] font-medium underline">
                    Milestones
                  </Link>
                  <span>&bull;</span>
                  <Link to="/client/login" className="hover:text-[#E65338] font-medium underline">
                    Login / Switch User
                  </Link>
                </div>
              </div>
            </div>

            {/* PORTAL CARD 2: SUPERVISOR PORTAL */}
            <div className="bg-white rounded-2xl border-2 border-[#EAE2D9] hover:border-[#E65338] transition-all duration-300 shadow-md hover:shadow-xl p-6 sm:p-8 flex flex-col justify-between group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#20845A]/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
              
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#E65338] text-white flex items-center justify-center font-bold text-sm shadow">
                      <Factory size={22} className="text-white" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[#E65338] uppercase tracking-wider">
                        Repository: supervisor
                      </span>
                      <h3 className="text-2xl font-black text-[#252622]">
                        Supervisor Portal
                      </h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#20845A]/10 text-[#20845A] border border-[#20845A]/20">
                    Modular JS &bull; Real-time DOM
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Tailored for mill floor operations directors, weaving shed managers, and shift supervisors to track loom RPM velocities, allocate warp beams &amp; weft bobbins, log daily production, and resolve breakages.
                </p>

                {/* Persona Chip */}
                <div className="bg-[#FBF6F0] p-3.5 rounded-xl border border-[#EAE2D9] mb-6">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Authenticated Persona
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-[#252622]">Rajesh Kumar</div>
                      <div className="text-xs text-gray-500">Senior Production Supervisor &bull; Shift A (Morning)</div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-[#EAE2D9]">
                      LP-SUP-042
                    </span>
                  </div>
                </div>

                {/* Feature Bullets */}
                <div className="space-y-2.5 mb-6 text-xs text-gray-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>Loom Shed Telemetry:</strong> Tsudakoma &amp; Picanol air-jets status, RPM, efficiency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>Daily Shift Operations Modal:</strong> Headcount, raw yarn status &amp; daily meters logged</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>Raw Materials &amp; Beams:</strong> Warp beams, weft cones, lot tracking &amp; shortages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>Operator Roster Management:</strong> Skill certifications, assigned looms &amp; shift rota</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-[#20845A] flex-shrink-0" />
                    <span><strong>Issue Ticketing System:</strong> Warp breakages, motor halts &amp; maintenance flags</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4 border-t border-[#EAE2D9]">
                <a
                  href="/supervisor/"
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#E65338] hover:bg-[#D24227] transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#E65338]/30 group-hover:shadow-lg"
                >
                  <span>Launch Supervisor Portal</span>
                  <ArrowUpRight size={16} />
                </a>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <a href="/supervisor/#orders" className="hover:text-[#E65338] font-medium underline">
                    Mill Orders
                  </a>
                  <span>&bull;</span>
                  <a href="/supervisor/#materials" className="hover:text-[#E65338] font-medium underline">
                    Yarn &amp; Beams
                  </a>
                  <span>&bull;</span>
                  <a href="/supervisor/#production" className="hover:text-[#E65338] font-medium underline">
                    Loom Sheds
                  </a>
                  <span>&bull;</span>
                  <a href="/supervisor/#issues" className="hover:text-[#E65338] font-medium underline">
                    Breakdown Alerts
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8-Stage Manufacturing Lifecycle Workflow */}
      <section className="bg-white border-y border-[#EAE2D9] px-4 sm:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#E65338] uppercase tracking-wider">
              End-to-End Operational Lifecycle
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#252622] mt-1">
              Synchronized 8-Stage Manufacturing Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              Every order in LoomPilot transitions through the exact same 8 stages, with actions split intelligently between client procurement and shop floor execution.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { step: '01', name: 'Quote Accepted', owner: 'Client & Admin', color: 'border-[#20845A] bg-[#20845A]/5 text-[#20845A]' },
              { step: '02', name: 'Yarn Sourcing', owner: 'Supervisor', color: 'border-[#E65338] bg-[#E65338]/5 text-[#E65338]' },
              { step: '03', name: 'Warping & Sizing', owner: 'Supervisor', color: 'border-[#C78627] bg-[#C78627]/5 text-[#C78627]' },
              { step: '04', name: 'Loom Weaving', owner: 'Supervisor Shed', color: 'border-[#E65338] bg-[#E65338]/5 text-[#E65338]' },
              { step: '05', name: 'Dyeing & Finish', owner: 'Mill Processing', color: 'border-blue-600 bg-blue-50 text-blue-600' },
              { step: '06', name: 'Quality Check', owner: 'Lab Auditor', color: 'border-purple-600 bg-purple-50 text-purple-600' },
              { step: '07', name: 'Packaging', owner: 'Logistics Lead', color: 'border-amber-600 bg-amber-50 text-amber-600' },
              { step: '08', name: 'Delivered', owner: 'Client Plant', color: 'border-[#20845A] bg-[#20845A]/5 text-[#20845A]' },
            ].map((st) => (
              <div key={st.step} className={`p-3.5 rounded-xl border ${st.color} text-center flex flex-col justify-between`}>
                <div className="text-[10px] font-mono font-extrabold opacity-75">{st.step}</div>
                <div className="font-bold text-xs text-[#252622] my-1.5 leading-tight">{st.name}</div>
                <div className="text-[10px] font-medium text-gray-500">{st.owner}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#252622]">Live State Synchronization:</span>
              <span className="text-gray-600">
                Both portals operate seamlessly under the same origin (<code className="bg-white px-1.5 py-0.5 rounded border border-[#EAE2D9]">localhost:3000</code>).
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#20845A] font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> Zero Cross-Origin Blocking
              </span>
              <span className="text-[#20845A] font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> Unified Build Target
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Credentials Helper */}
      <section className="px-4 sm:px-8 py-16">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-[#EAE2D9] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 text-[#E65338] text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck size={16} />
            <span>Project Reviewer &amp; Evaluator Quick-Start</span>
          </div>
          <h3 className="text-xl font-bold text-[#252622] mb-4">
            Test Personas &amp; Demo Credentials
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9]">
              <div className="text-xs font-bold text-[#252622] mb-1">Client Portal Access</div>
              <div className="text-xs text-gray-600 space-y-1 font-mono">
                <div>Email: <span className="text-[#252622] font-bold">v.malhotra@raymondapparel.in</span></div>
                <div>Password: <span className="text-[#252622] font-bold">Raymond@2026</span> (or any demo input)</div>
                <div>Company: <span className="text-[#252622] font-bold">Raymond Apparel Limited</span></div>
              </div>
              <Link
                to="/client/login"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#E65338] hover:underline"
              >
                Go to Client Login &rarr;
              </Link>
            </div>

            <div className="p-4 rounded-xl bg-[#FBF6F0] border border-[#EAE2D9]">
              <div className="text-xs font-bold text-[#252622] mb-1">Supervisor Portal Access</div>
              <div className="text-xs text-gray-600 space-y-1 font-mono">
                <div>Supervisor ID: <span className="text-[#252622] font-bold">LP-SUP-042</span></div>
                <div>Name: <span className="text-[#252622] font-bold">Rajesh Kumar</span></div>
                <div>Floor: <span className="text-[#252622] font-bold">Loom Shed A &amp; B (Airjet Division)</span></div>
              </div>
              <a
                href="/supervisor/"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#E65338] hover:underline"
              >
                Go to Supervisor Portal &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#252622] text-[#FBF6F0] px-4 sm:px-8 py-10 border-t border-white/10 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E65338] flex items-center justify-center font-bold text-white">
              LP
            </div>
            <div>
              <div className="font-bold text-sm">LoomPilot Unified Manufacturing Platform</div>
              <div className="text-gray-400 text-[11px]">Combining Client RFQ Sourcing &amp; Mill Shop Floor Operations</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-gray-400">
            <Link to="/client/dashboard" className="hover:text-white transition-colors">
              Client Portal
            </Link>
            <a href="/supervisor/" className="hover:text-white transition-colors">
              Supervisor Portal
            </a>
            <Link to="/client/products" className="hover:text-white transition-colors">
              Catalogue
            </Link>
            <Link to="/client/orders" className="hover:text-white transition-colors">
              Orders
            </Link>
          </div>

          <div className="text-gray-400 text-[11px]">
            &copy; {new Date().getFullYear()} LoomPilot OS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};


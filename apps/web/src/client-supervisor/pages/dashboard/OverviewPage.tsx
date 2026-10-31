import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatLakhs, formatMetres, formatNumber } from '../../utils/formatters';
import {
  Package,
  Layers,
  Clock,
  CreditCard,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { RazorpayModal } from '../../components/payments/RazorpayModal';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const { metrics, orders, invoices, activities } = useApp();
  const navigate = useNavigate();

  const [payingInvoiceNumber, setPayingInvoiceNumber] = useState<string | null>(null);

  // Spotlight Order (First active in-production order or first order)
  const spotlightOrder =
    orders.find((o) => o.spotlight) ||
    orders.find((o) => o.status === 'In Production') ||
    orders[0];

  // Pending milestone invoices
  const pendingInvoices = invoices.filter((i) => i.status === 'Pending').slice(0, 3);

  // Sample weekly loom output trend for Recharts
  const loomChartData = [
    { day: 'Mon', metres: 1100, target: 1200 },
    { day: 'Tue', metres: 1250, target: 1200 },
    { day: 'Wed', metres: 1380, target: 1300 },
    { day: 'Thu', metres: 1420, target: 1400 },
    { day: 'Fri', metres: 1350, target: 1400 },
    { day: 'Sat', metres: 1300, target: 1300 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal via-charcoal-light to-charcoal-dark text-white p-6 lg:p-8 shadow-card-hover border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-ivory">
              <span>Account: <strong>{user?.clientCode || 'RAY-IND-8842'}</strong></span>
              <span>•</span>
              <span className="text-warning font-bold">{user?.accountTier || 'Enterprise Tier 1'}</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Good Morning, {user?.company || 'Raymond Apparel'}!
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Here is an overview of your active textile manufacturing orders, mill production progress, and commercial milestones.
            </p>
          </div>

          <div className="flex-shrink-0">
            <Link
              to="/client/orders/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-vermilion hover:bg-vermilion-hover text-white text-sm font-bold shadow-vermilion transition-all hover:-translate-y-0.5"
            >
              <PlusCircle size={18} />
              <span>Create New Order</span>
            </Link>
          </div>
        </div>

        {/* Subtle Decorative Loom Shuttle Glow */}
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-radial-gradient from-vermilion/20 to-transparent pointer-events-none" />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Orders */}
        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card relative overflow-hidden group hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Active Orders</span>
            <div className="w-9 h-9 rounded-xl bg-ivory flex items-center justify-center text-vermilion">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-charcoal">{metrics.activeOrders}</div>
            <div className="text-xs text-muted mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>In Manufacturing & Negotiation</span>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-1 h-full bg-vermilion" />
        </div>

        {/* Total Orders */}
        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Total Orders</span>
            <div className="w-9 h-9 rounded-xl bg-ivory flex items-center justify-center text-charcoal">
              <Layers size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-charcoal">{metrics.totalOrders}</div>
            <div className="text-xs text-muted mt-1">Lifetime contracts placed</div>
          </div>
        </div>

        {/* Production in Progress */}
        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Production in Progress</span>
            <div className="w-9 h-9 rounded-xl bg-ivory flex items-center justify-center text-success">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-charcoal">
              {formatNumber(metrics.productionInProgressMetres)}{' '}
              <span className="text-sm font-semibold text-muted">m</span>
            </div>
            <div className="text-xs text-muted mt-1 flex items-center gap-1">
              <TrendingUp size={13} className="text-success" />
              <span>Across 8 Air-Jet Looms</span>
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Pending Payments</span>
            <div className="w-9 h-9 rounded-xl bg-ivory flex items-center justify-center text-warning">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-warning">
              {formatLakhs(metrics.pendingPaymentsAmount)}
            </div>
            <div className="text-xs text-muted mt-1">{pendingInvoices.length} milestone disbursements due</div>
          </div>
        </div>
      </div>

      {/* Current Order Spotlight */}
      {spotlightOrder && (
        <div className="bg-white rounded-2xl border-2 border-muted-border p-6 shadow-card hover:border-muted transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-muted-border">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-vermilion text-white text-xs font-bold uppercase tracking-wider">
                <Sparkles size={13} />
                Current Order Spotlight
              </span>
              <span className="px-2.5 py-1 rounded-full bg-vermilion/10 text-vermilion text-xs font-bold">
                Stage {spotlightOrder.currentStageNumber} of 8: {spotlightOrder.currentStageName}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-muted bg-ivory px-3 py-1 rounded-lg border border-muted-border">
              {spotlightOrder.id}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-charcoal">{spotlightOrder.productName}</h2>
                <p className="text-xs text-muted mt-1">
                  Shade: <strong className="text-charcoal">{spotlightOrder.colorway}</strong> • Ordered on {spotlightOrder.orderDate}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-ivory border border-muted-border font-medium">
                  GSM: <strong>{spotlightOrder.specifications?.gsm}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-ivory border border-muted-border font-medium">
                  Width: <strong>{spotlightOrder.specifications?.width}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-ivory border border-muted-border font-medium">
                  Weave: <strong>{spotlightOrder.specifications?.weave}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-ivory border border-muted-border font-medium text-vermilion">
                  Target Dispatch: <strong>{spotlightOrder.expectedDelivery}</strong>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-charcoal">Weaving Output Progress</span>
                  <span className="text-vermilion font-bold">{spotlightOrder.progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-ivory border border-muted-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-vermilion to-vermilion-hover transition-all duration-700"
                    style={{ width: `${spotlightOrder.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Link
                  to={`/client/orders/${spotlightOrder.id}/tracking`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors"
                >
                  <Activity size={14} />
                  <span>Track Live Production</span>
                </Link>
                <Link
                  to={`/client/orders/${spotlightOrder.id}`}
                  className="px-4 py-2 rounded-xl bg-ivory hover:bg-white text-charcoal border border-muted-border text-xs font-bold transition-colors"
                >
                  View Order Details
                </Link>
              </div>
            </div>

            {/* Right Mini Stat Grid */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3 p-4 rounded-xl bg-ivory border border-muted-border">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Ordered Quantity</span>
                <div className="text-base font-extrabold text-charcoal mt-0.5">
                  {formatMetres(spotlightOrder.orderedMetres)}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Produced to Date</span>
                <div className="text-base font-extrabold text-success mt-0.5">
                  {formatMetres(spotlightOrder.producedMetres)}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Remaining Metres</span>
                <div className="text-base font-extrabold text-charcoal mt-0.5">
                  {formatMetres(spotlightOrder.remainingMetres)}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Target Dispatch</span>
                <div className="text-base font-extrabold text-vermilion mt-0.5">
                  {spotlightOrder.expectedDelivery}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Production Chart & Activity / Payments Lower Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Loom Telemetry Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-muted-border shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-charcoal text-base">Daily Loom Output Velocity</h3>
              <p className="text-xs text-muted">Actual daily metres woven vs planned mill output targets</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-charcoal">
                <span className="w-2.5 h-2.5 rounded-full bg-vermilion" />
                Actual Output
              </span>
              <span className="flex items-center gap-1.5 text-muted">
                <span className="w-2.5 h-2.5 rounded-full bg-muted-light" />
                Planned Target
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={loomChartData}>
                <defs>
                  <linearGradient id="colorMetres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E65338" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E65338" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#77766F' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#77766F' }} axisLine={false} tickLine={false} domain={[800, 1600]} />
                <Tooltip
                  formatter={(val: any) => [`${val} metres`, 'Volume']}
                  contentStyle={{ backgroundColor: '#252622', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="metres" stroke="#E65338" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMetres)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Upcoming Payments & Recent Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Milestone Payments */}
          <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-charcoal text-sm">Upcoming Milestone Invoices</h3>
                <p className="text-[11px] text-muted">Payments linked to production stage signoffs</p>
              </div>
              <Link to="/client/payments" className="text-xs font-bold text-vermilion hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {pendingInvoices.length > 0 ? (
                pendingInvoices.map((inv) => (
                  <div
                    key={inv.invoiceNumber}
                    className="p-3 rounded-xl bg-ivory border border-muted-border flex items-center justify-between gap-3 hover:border-muted transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-charcoal">{inv.invoiceNumber}</div>
                      <div className="text-[11px] text-muted truncate max-w-[180px]">
                        {inv.productName} • {inv.milestonePhase}
                      </div>
                      <div className="text-[10px] font-semibold text-warning mt-0.5">
                        Due: {inv.dueDate}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-charcoal">{formatCurrency(inv.amount)}</div>
                      <button
                        onClick={() => setPayingInvoiceNumber(inv.invoiceNumber)}
                        className="mt-1 px-3 py-1 rounded-lg bg-vermilion text-white text-[11px] font-bold shadow-sm hover:bg-vermilion-hover transition-colors"
                      >
                        Pay Now
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-muted">All milestone payments are settled!</div>
              )}
            </div>
          </div>

          {/* Recent Operations Activity */}
          <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-charcoal text-sm">Recent Order Activity</h3>
              <Link to="/client/orders" className="text-xs font-bold text-vermilion hover:underline">
                All Orders
              </Link>
            </div>

            <div className="space-y-3 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-border">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="relative text-xs">
                  <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-vermilion ring-2 ring-white" />
                  <div className="font-bold text-charcoal">{act.title}</div>
                  <div className="text-muted text-[11px] mt-0.5 leading-snug">{act.desc}</div>
                  <div className="text-[10px] text-muted-light mt-0.5">{act.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Razorpay Modal */}
      {payingInvoiceNumber && (
        <RazorpayModal
          invoiceNumber={payingInvoiceNumber}
          onClose={() => setPayingInvoiceNumber(null)}
        />
      )}
    </div>
  );
};


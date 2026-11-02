import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useGetClientOrdersQuery } from '../../../store/api/ordersApi';
import { useGetClientProductsQuery } from '../../../store/api/catalogApi';
import { mapApiClientOrder, isMilestoneSettled } from '../../../utils/orderMapper';
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
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { RazorpayModal } from '../../components/payments/RazorpayModal';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const { orders: localOrders, invoices: localInvoices, activities: localActivities } = useApp();
  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    error: ordersError,
    refetch: refetchOrders,
  } = useGetClientOrdersQuery(undefined);
  const { data: productsResponse } = useGetClientProductsQuery(undefined);

  const productsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = productsResponse?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((p: any) => {
        if (p.id || p._id) map.set(String(p.id || p._id), p);
      });
    }
    return map;
  }, [productsResponse]);

  const orders = useMemo(() => {
    const raw = ordersResponse?.data || [];
    if (Array.isArray(raw)) {
      if (raw.length > 0) {
        return raw.map((item) => mapApiClientOrder(item, productsMap));
      }
      if (!isDemo) {
        return [];
      }
    }
    return isDemo ? localOrders : [];
  }, [ordersResponse, productsMap, localOrders]);

  const invoices = useMemo(() => {
    const rawOrders = ordersResponse?.data || [];
    if (Array.isArray(rawOrders) && rawOrders.length > 0) {
      const generated: any[] = [];
      rawOrders.forEach((o: any) => {
        const milestones = o.financials?.milestones || o.quotation?.paymentSchedule || [];
        milestones.forEach((m: any, idx: number) => {
          const isPaid = isMilestoneSettled(m);
          const amountPaise = Number(m.amountPaise) || 0;
          const receivedPaise = Number(m.receivedPaise) || 0;
          generated.push({
            invoiceNumber: `INV-${o.orderNumber || String(o._id || o.id).slice(-6)}-M${idx + 1}`,
            orderId: o.orderNumber || String(o._id || o.id).slice(-8).toUpperCase(),
            backendOrderId: String(o._id || o.id),
            milestoneIndex: idx,
            productName: o.productDescription || o.styleName || o.spec?.fabric || 'Apparel Production',
            milestonePhase: m.milestone || `Milestone ${idx + 1}`,
            issueDate: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending',
            dueDate: m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending',
            amount: amountPaise / 100,
            paidAmount: receivedPaise / 100,
            remainingAmount: Math.max(0, (amountPaise - receivedPaise) / 100),
            status: isPaid ? 'Paid' : 'Pending',
            paidDate: m.receipts?.[0]?.date
              ? new Date(m.receipts[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : undefined,
          });
        });
      });
      return generated;
    }
    return isDemo ? localInvoices : [];
  }, [ordersResponse, localInvoices]);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status === 'In Production' || o.status === 'Awaiting Quotation').length;
    const totalOrders = orders.length;
    const productionInProgressMetres = orders
      .filter((o) => o.status === 'In Production')
      .reduce((sum, o) => sum + (o.orderedMetres || 0), 0);
    const pendingPaymentsAmount = invoices
      .filter((i) => i.status === 'Pending' || (i.status as any) === 'pending')
      .reduce((sum, i) => sum + (i.remainingAmount !== undefined ? i.remainingAmount : (i.amount || 0)), 0);

    return {
      activeOrders,
      totalOrders,
      productionInProgressMetres,
      pendingPaymentsAmount,
    };
  }, [orders, invoices]);

  const activities = useMemo(() => {
    if (!isDemo) {
      if (orders.length === 0) return [];
      const derived: any[] = [];
      orders.forEach((o) => {
        if (o.status === 'Delivered') {
          derived.push({
            id: `act-${o.id}-del`,
            title: `Order ${o.id} Delivered`,
            desc: `${o.productName} (${formatMetres(o.orderedMetres)}) delivered and signed off.`,
            time: o.expectedDelivery || o.orderDate,
          });
        } else if (o.status === 'In Production') {
          derived.push({
            id: `act-${o.id}-prod`,
            title: `Order ${o.id} in Production`,
            desc: `Current stage: ${o.currentStageName} (${o.progressPercent}% complete).`,
            time: `Target: ${o.expectedDelivery}`,
          });
        } else if (o.status === 'Awaiting Quotation') {
          derived.push({
            id: `act-${o.id}-quote`,
            title: `Order ${o.id} Quotation Review`,
            desc: `${o.productName} specifications under commercial review.`,
            time: o.orderDate,
          });
        } else {
          derived.push({
            id: `act-${o.id}-stat`,
            title: `Order ${o.id} Active`,
            desc: `${o.productName} (${formatMetres(o.orderedMetres)}).`,
            time: o.orderDate,
          });
        }
      });
      return derived.slice(0, 4);
    }
    return localActivities;
  }, [orders, localActivities]);

  const [payingInvoiceNumber, setPayingInvoiceNumber] = useState<string | null>(null);

  // Spotlight Order (First active in-production order or first order)
  const spotlightOrder = useMemo(() => {
    return (
      orders.find((o) => o.spotlight) ||
      orders.find((o) => o.status === 'In Production') ||
      orders.find((o) => o.status === 'Awaiting Quotation') ||
      orders[0] ||
      null
    );
  }, [orders]);

  // Pending milestone invoices
  const pendingInvoices = useMemo(() => {
    return invoices.filter((i) => i.status === 'Pending').slice(0, 3);
  }, [invoices]);

  // Sample weekly loom output trend for Recharts in demo mode
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
      {/* Error Banner with Retry */}
      {isOrdersError && (
        <div className="p-4 rounded-2xl bg-danger-bg border border-danger/20 text-danger flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="flex-shrink-0" />
            <div className="text-xs">
              <strong className="block font-bold">Failed to load live client order data</strong>
              <span>
                {((ordersError as any)?.data?.message || (ordersError as any)?.error || 'Could not connect to mill API servers.')}
              </span>
            </div>
          </div>
          <button
            onClick={() => refetchOrders()}
            className="px-3.5 py-1.5 rounded-xl bg-danger text-white text-xs font-bold hover:bg-danger/90 transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal via-charcoal-light to-charcoal-dark text-white p-6 lg:p-8 shadow-card-hover border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-ivory">
              <span>Account: <strong>{user?.clientCode || (isDemo ? 'RAY-IND-8842' : 'Client Account')}</strong></span>
              <span>•</span>
              <span className="text-warning font-bold">{user?.accountTier || (isDemo ? 'Enterprise Tier 1' : 'Commercial Client')}</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Good Morning, {user?.company || user?.contactPerson || (isDemo ? 'Raymond Apparel' : 'Valued Partner')}!
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
              <span className={`w-2 h-2 rounded-full ${metrics.activeOrders > 0 ? 'bg-success' : 'bg-muted-light'}`} />
              <span>{metrics.activeOrders > 0 ? 'In Manufacturing & Review' : 'No active orders'}</span>
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
            <div className="text-xs text-muted mt-1">Contracts placed</div>
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
              <TrendingUp size={13} className={metrics.productionInProgressMetres > 0 ? 'text-success' : 'text-muted'} />
              <span>{metrics.productionInProgressMetres > 0 ? 'Active mill manufacturing volume' : 'No volume in production'}</span>
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
            <div className="text-xs text-muted mt-1">
              {pendingInvoices.length > 0 ? `${pendingInvoices.length} milestone disbursements due` : 'All invoices settled'}
            </div>
          </div>
        </div>
      </div>

      {/* Current Order Spotlight / Empty State */}
      {spotlightOrder ? (
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
      ) : (
        <div className="bg-white rounded-2xl border border-muted-border p-6 shadow-card text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-ivory flex items-center justify-center text-muted mx-auto mb-3">
            <Package size={24} />
          </div>
          <h3 className="text-base font-extrabold text-charcoal">No Active Manufacturing Orders</h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1 mb-4 leading-relaxed">
            {isOrdersLoading
              ? 'Loading client orders from mill backend...'
              : 'You have no manufacturing orders currently in progress. Place a new textile or apparel order to track live mill output.'}
          </p>
          <Link
            to="/client/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors"
          >
            <PlusCircle size={15} />
            <span>Place First Order</span>
          </Link>
        </div>
      )}

      {/* Production Chart & Activity / Payments Lower Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Loom Telemetry Chart / Derived Stage Progress (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-muted-border shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-charcoal text-base">
                {isDemo ? 'Daily Loom Output Velocity' : 'Production Stage Progress'}
              </h3>
              <p className="text-xs text-muted">
                {isDemo
                  ? 'Actual daily metres woven vs planned mill output targets'
                  : 'Derived from persisted milestone inspections and floor routing stages'}
              </p>
            </div>
            {isDemo && (
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
            )}
          </div>

          {isDemo ? (
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
          ) : spotlightOrder && spotlightOrder.stages && spotlightOrder.stages.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-muted-border">
                <span className="font-bold text-charcoal">
                  Active Routing: {spotlightOrder.id} • {spotlightOrder.productName}
                </span>
                <span className="font-bold text-vermilion">
                  {spotlightOrder.progressPercent}% Complete
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {spotlightOrder.stages.map((st) => (
                  <div
                    key={st.step}
                    className={`p-3 rounded-xl border text-xs transition-colors ${
                      st.status === 'completed'
                        ? 'bg-success/5 border-success/30 text-success'
                        : st.status === 'active'
                        ? 'bg-vermilion/5 border-vermilion/30 text-vermilion font-bold shadow-sm'
                        : 'bg-ivory border-muted-border text-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider opacity-75">
                      <span>Stage {st.step}</span>
                      {st.status === 'completed' && <CheckCircle2 size={12} />}
                    </div>
                    <div className="truncate font-semibold mt-1 text-[11px]">{st.name}</div>
                    <div className="text-[10px] mt-1 capitalize font-medium opacity-85">{st.status}</div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-ivory border border-muted-border text-[11px] text-muted flex items-start gap-2 leading-relaxed">
                <Activity size={14} className="text-muted flex-shrink-0 mt-0.5" />
                <span>
                  Telemetry velocity feed is unavailable from backend. Mill production progress is derived strictly from verified manufacturing stages and stage inspection signoffs.
                </span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-ivory/50 rounded-xl border border-dashed border-muted-border text-muted">
              <Activity size={24} className="mb-2 opacity-50" />
              <div className="text-xs font-bold text-charcoal">Loom Telemetry Feed Unavailable</div>
              <div className="text-[11px] text-muted max-w-sm mt-1">
                No active production stages to track. Daily loom velocity will appear once an order enters active manufacturing.
              </div>
            </div>
          )}
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
                <div className="text-center py-4 text-xs text-muted">
                  {orders.length === 0 ? 'No commercial invoices issued.' : 'All milestone payments are settled!'}
                </div>
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

            {activities.length > 0 ? (
              <div className="space-y-3 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-border">
                {activities.map((act) => (
                  <div key={act.id} className="relative text-xs">
                    <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-vermilion ring-2 ring-white" />
                    <div className="font-bold text-charcoal">{act.title}</div>
                    <div className="text-muted text-[11px] mt-0.5 leading-snug">{act.desc}</div>
                    <div className="text-[10px] text-muted-light mt-0.5">{act.time}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted">
                No recent order activity recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Razorpay Modal */}
      {payingInvoiceNumber && (
        <RazorpayModal
          invoiceNumber={payingInvoiceNumber}
          invoiceData={invoices.find((i) => i.invoiceNumber === payingInvoiceNumber)}
          onClose={() => {
            setPayingInvoiceNumber(null);
            refetchOrders();
          }}
        />
      )}
    </div>
  );
};

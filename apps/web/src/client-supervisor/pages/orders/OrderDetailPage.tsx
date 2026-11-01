import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useGetClientOrderByIdQuery } from '../../../store/api/ordersApi';
import { useGetClientProductsQuery } from '../../../store/api/catalogApi';
import { mapApiClientOrder } from '../../../utils/orderMapper';
import { formatCurrency, formatNumber, formatMetres } from '../../utils/formatters';
import {
  ArrowLeft,
  Activity,
  MessageSquare,
  Package,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Clock,
} from 'lucide-react';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { orders } = useApp();
  const navigate = useNavigate();

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

  const { data: orderResponse } = useGetClientOrderByIdQuery(id || '', { skip: !id });
  const liveOrder = useMemo(() => {
    if (orderResponse?.data) {
      return mapApiClientOrder(orderResponse.data, productsMap);
    }
    return null;
  }, [orderResponse, productsMap]);

  const order = liveOrder || orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-charcoal">Order Not Found</h2>
        <p className="text-sm text-muted">The requested manufacturing order ID could not be located.</p>
        <Link to="/client/orders" className="inline-flex items-center gap-2 text-sm font-bold text-vermilion">
          <ArrowLeft size={16} />
          <span>Back to My Orders</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/client/orders"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-charcoal transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to My Orders</span>
        </Link>

        <div className="flex gap-2">
          <Link
            to={`/client/orders/${order.id}/tracking`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors"
          >
            <Activity size={14} />
            <span>Track 8-Stage Production</span>
          </Link>
          <Link
            to="/client/messages"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ivory text-charcoal border border-muted-border text-xs font-bold hover:bg-white transition-colors"
          >
            <MessageSquare size={14} />
            <span>Negotiation Chat</span>
          </Link>
        </div>
      </div>

      {/* Main Order Card */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card p-6 lg:p-8 space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-muted-border">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-charcoal font-mono">{order.id}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                order.status === 'In Production'
                  ? 'bg-success-bg text-success border border-success-border'
                  : 'bg-warning-bg text-warning border border-warning-border'
              }`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              {order.productName} • Ordered on {order.orderDate}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Commercial Commitment</span>
            <div className="text-xl font-extrabold text-charcoal">
              {formatCurrency(order.totalValue)}
            </div>
            <div className="text-xs text-muted font-medium">₹ {order.unitPrice} / metre</div>
          </div>
        </div>

        {/* 4 Stat Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-ivory border border-muted-border text-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Ordered Volume</span>
            <strong className="text-charcoal block text-base font-extrabold mt-0.5">
              {formatMetres(order.orderedMetres)}
            </strong>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Produced to Date</span>
            <strong className="text-success block text-base font-extrabold mt-0.5">
              {formatMetres(order.producedMetres)}
            </strong>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Remaining Metres</span>
            <strong className="text-charcoal block text-base font-extrabold mt-0.5">
              {formatMetres(order.remainingMetres)}
            </strong>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Target Dispatch</span>
            <strong className="text-vermilion block text-base font-extrabold mt-0.5">
              {order.expectedDelivery}
            </strong>
          </div>
        </div>

        {/* Section 1: Fabric Specifications */}
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-charcoal uppercase tracking-wider">
            1. Fabric Construction & Specifications
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-ivory rounded-xl border border-muted-border">
              <span className="text-muted block text-[11px]">Weight (GSM)</span>
              <strong className="text-charcoal font-bold">{order.specifications?.gsm} GSM</strong>
            </div>
            <div className="p-3 bg-ivory rounded-xl border border-muted-border">
              <span className="text-muted block text-[11px]">Finished Width</span>
              <strong className="text-charcoal font-bold">{order.specifications?.width}</strong>
            </div>
            <div className="p-3 bg-ivory rounded-xl border border-muted-border">
              <span className="text-muted block text-[11px]">Weave Architecture</span>
              <strong className="text-charcoal font-bold">{order.specifications?.weave}</strong>
            </div>
            <div className="p-3 bg-ivory rounded-xl border border-muted-border">
              <span className="text-muted block text-[11px]">Colorway / Pantone</span>
              <strong className="text-charcoal font-bold">{order.colorway}</strong>
            </div>
            <div className="p-3 bg-ivory rounded-xl border border-muted-border sm:col-span-2">
              <span className="text-muted block text-[11px]">Special Finishing</span>
              <strong className="text-charcoal font-bold">{order.specifications?.finish}</strong>
            </div>
          </div>
        </div>

        {/* Section 2: Milestone Ledger (30% / 40% / 30%) */}
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-charcoal uppercase tracking-wider">
            2. Commercial Milestone Ledger (Split 30% / 40% / 30%)
          </h3>
          <div className="space-y-2">
            {(order.milestones || []).map((ms) => (
              <div
                key={ms.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-muted-border bg-white text-xs hover:border-muted transition-colors"
              >
                <div>
                  <strong className="text-charcoal block">{ms.phase}</strong>
                  <span className="text-muted text-[11px]">
                    Invoice Ref: {ms.invoiceId} {ms.paidDate ? `• Settled on ${ms.paidDate}` : `• Due ${ms.dueDate}`}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-extrabold text-charcoal text-sm">{formatCurrency(ms.amount)}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                      ms.status === 'paid'
                        ? 'bg-success-bg text-success'
                        : ms.status === 'pending'
                        ? 'bg-warning-bg text-warning'
                        : 'bg-ivory text-muted'
                    }`}
                  >
                    {ms.status === 'paid' ? 'Paid' : ms.status === 'pending' ? 'Pending' : 'Upcoming'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Delivery Facility Destination */}
        <div className="space-y-2">
          <h3 className="text-sm font-extrabold text-charcoal uppercase tracking-wider">
            3. Destination Plant Warehouse
          </h3>
          <div className="p-4 rounded-xl bg-ivory border border-muted-border text-xs text-charcoal flex items-start gap-2.5">
            <MapPin size={16} className="text-vermilion mt-0.5 flex-shrink-0" />
            <span>{order.deliveryAddress}</span>
          </div>
        </div>
      </div>
    </div>
  );
};


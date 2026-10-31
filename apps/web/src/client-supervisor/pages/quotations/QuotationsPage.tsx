import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  FileText,
  MessageSquare,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const QuotationsPage: React.FC = () => {
  const { orders, acceptQuotation, addToast } = useApp();
  const navigate = useNavigate();

  // Quotation orders (Awaiting Quotation or Active Negotiations)
  const quotationOrders = orders.filter(
    (o) => o.status === 'Awaiting Quotation' || o.id === 'LP-2026-8854' || o.id === 'LP-2026-8890'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
            Commercial Quotations & Price Revisions
          </h1>
          <p className="text-sm text-muted mt-1">
            Review binding mill quotation sheets, compare approved volume price revisions, and accept terms to allocate loom capacity.
          </p>
        </div>

        <Link
          to="/client/messages"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ivory text-charcoal border border-muted-border text-xs font-bold hover:bg-white transition-colors flex-shrink-0"
        >
          <MessageSquare size={16} />
          <span>Open Negotiation Chat</span>
        </Link>
      </div>

      {/* Main Quotations List */}
      <div className="space-y-6">
        {quotationOrders.map((order) => {
          const hasRevision = !!order.originalUnitPrice && order.unitPrice < order.originalUnitPrice;
          const totalSavings = hasRevision
            ? (order.originalUnitPrice! - order.unitPrice) * order.orderedMetres
            : 0;

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border-2 border-muted-border shadow-card p-6 lg:p-8 space-y-6 hover:border-muted transition-all"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-muted-border">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-vermilion bg-ivory px-3 py-1 rounded-lg border border-muted-border">
                      {order.id}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-warning-bg text-warning text-xs font-bold border border-warning-border">
                      {hasRevision ? 'Price Revision Approved by Admin' : 'Quotation Issued'}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-charcoal mt-2">{order.productName}</h2>
                  <p className="text-xs text-muted">
                    Volume: <strong>{formatNumber(order.orderedMetres)} metres</strong> • Shade: <strong>{order.colorway}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Quotation Validity</span>
                  <div className="text-xs font-bold text-charcoal flex items-center gap-1 sm:justify-end mt-0.5">
                    <Clock size={13} className="text-warning" />
                    <span>Valid until 03 Nov 2026</span>
                  </div>
                  <div className="text-[11px] text-muted">Delivery: {order.expectedDelivery}</div>
                </div>
              </div>

              {/* Price Breakdown Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl bg-ivory border border-muted-border">
                {/* Original Quote */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Initial Baseline Quote</span>
                  <div className="text-base font-bold text-muted-light line-through mt-0.5">
                    ₹ {order.originalUnitPrice || order.unitPrice} / metre
                  </div>
                  <div className="text-xs text-muted">
                    Total: {formatCurrency(order.originalTotalValue || order.totalValue)}
                  </div>
                </div>

                {/* Approved Revision */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-success">
                    {hasRevision ? 'Admin Approved Rate' : 'Current Unit Rate'}
                  </span>
                  <div className="text-2xl font-extrabold text-success mt-0.5">
                    ₹ {order.unitPrice} <span className="text-sm font-semibold text-muted">/ m</span>
                  </div>
                  <div className="text-xs font-bold text-charcoal">
                    Revised Total: {formatCurrency(order.totalValue)}
                  </div>
                </div>

                {/* Savings / Discount */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Enterprise Cost Savings</span>
                  {hasRevision ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xl font-extrabold text-charcoal">{formatCurrency(totalSavings)}</span>
                      <span className="px-2 py-0.5 rounded-full bg-success-bg text-success text-xs font-bold inline-flex items-center gap-1">
                        <TrendingDown size={12} />
                        Saves ₹2.34L
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted mt-1">Standard mill volume pricing</div>
                  )}
                  <div className="text-[11px] text-muted">Approved by Anil Sharma (Senior VP Merchandising)</div>
                </div>
              </div>

              {/* Commercial Milestone Schedule preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal block">
                  Applicable Milestone Disbursement Schedule (30% / 40% / 30%)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-muted-border">
                    <span className="text-muted block text-[11px]">Milestone 1 — 30% Advance</span>
                    <strong className="text-charcoal block text-sm font-bold">
                      {formatCurrency(Math.round(order.totalValue * 0.3))}
                    </strong>
                    <span className="text-[10px] text-muted">Due upon quote acceptance to start yarn sourcing</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-muted-border">
                    <span className="text-muted block text-[11px]">Milestone 2 — 40% Weaving</span>
                    <strong className="text-charcoal block text-sm font-bold">
                      {formatCurrency(Math.round(order.totalValue * 0.4))}
                    </strong>
                    <span className="text-[10px] text-muted">Due at 50% greige output milestone</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-muted-border">
                    <span className="text-muted block text-[11px]">Milestone 3 — 30% Dispatch</span>
                    <strong className="text-charcoal block text-sm font-bold">
                      {formatCurrency(Math.round(order.totalValue * 0.3))}
                    </strong>
                    <span className="text-[10px] text-muted">Due on final QC laboratory certification</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck size={16} className="text-success" />
                  <span>Accepting creates a binding contract and locks loom capacity</span>
                </div>

                <div className="flex gap-2.5 w-full sm:w-auto">
                  <Link
                    to="/client/messages"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-muted-border bg-ivory hover:bg-white text-xs font-bold text-charcoal transition-colors"
                  >
                    <MessageSquare size={14} />
                    <span>Negotiate in Chat</span>
                  </Link>

                  <button
                    onClick={() => {
                      acceptQuotation(order.id);
                      navigate('/client/payments');
                    }}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-success text-white text-xs font-bold hover:bg-[#1A6C49] shadow-sm transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    <span>Accept Quotation & Issue Advance Invoice</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {quotationOrders.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-muted-border p-6 text-xs text-muted">
            No active quotations pending review. Submit a new order to request quotations.
          </div>
        )}
      </div>
    </div>
  );
};


import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice } from '../../types';
import { formatCurrency, formatLakhs } from '../../utils/formatters';
import {
  Download,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { RazorpayModal } from '../../components/payments/RazorpayModal';
import { useGetClientOrdersQuery } from '../../../store/api/ordersApi';
import { isMilestoneSettled } from '../../../utils/orderMapper';

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const PaymentsPage: React.FC = () => {
  const { payments: localPayments, invoices: localInvoices, addToast } = useApp();
  const { data: ordersResponse, isLoading, isError, error: ordersError, refetch } = useGetClientOrdersQuery(undefined);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  const invoices = useMemo<Invoice[]>(() => {
    const rawOrders = ordersResponse?.data || [];
    if (Array.isArray(rawOrders) && rawOrders.length > 0) {
      const generated: Invoice[] = [];
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
            issueDate: o.createdAt
              ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : o.orderDate
              ? new Date(o.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '01 Nov 2026',
            dueDate: m.dueDate
              ? new Date(m.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '15 Nov 2026',
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

  // Verified payment transactions derived strictly from backend-confirmed receipts
  const payments = useMemo(() => {
    const rawOrders = ordersResponse?.data || [];
    if (Array.isArray(rawOrders) && rawOrders.length > 0) {
      const verifiedList: any[] = [];
      rawOrders.forEach((o: any) => {
        const orderId = o.orderNumber || String(o._id || o.id).slice(-8).toUpperCase();
        const milestones = o.financials?.milestones || [];
        milestones.forEach((m: any, idx: number) => {
          const invoiceNumber = `INV-${o.orderNumber || String(o._id || o.id).slice(-6)}-M${idx + 1}`;
          const receipts = m.receipts || [];
          receipts.forEach((r: any, rIdx: number) => {
            if (r.reversedAt) return; // skip reversed receipts
            verifiedList.push({
              paymentId: r.receiptId || r.razorpayPaymentId || `RCP-${orderId}-M${idx + 1}-${rIdx + 1}`,
              invoiceNumber,
              orderId,
              paymentDate: r.date
                ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Settled',
              amount: (r.amountPaise || m.amountPaise || 0) / 100,
              method: r.mode ? String(r.mode).toUpperCase() : (r.razorpayPaymentId ? 'Razorpay' : 'Direct Transfer'),
              transactionRef: r.razorpayPaymentId || r.ref || 'Settled on Mill Ledger',
              status: 'Success',
            });
          });
        });
      });
      return verifiedList;
    }
    return isDemo ? localPayments : [];
  }, [ordersResponse, localPayments]);

  const totalPaid = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const totalOutstanding = invoices.reduce((acc, i) => acc + (i.remainingAmount || 0), 0);
  const pendingInvoices = invoices.filter((i) => i.status === 'Pending');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
            Payments & Commercial Invoices
          </h1>
          <p className="text-sm text-muted mt-1">
            Manage milestone disbursements, download tax invoices, and complete secure digital payments via Razorpay.
          </p>
        </div>

        <button
          onClick={() => addToast('Downloading Statement.pdf...', 'info')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ivory text-charcoal border border-muted-border text-xs font-bold hover:bg-white transition-colors flex-shrink-0"
        >
          <Download size={15} />
          <span>Download Account Statement</span>
        </button>
      </div>

      {/* Financial Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Amount Paid</span>
          <div className="text-2xl font-extrabold text-success mt-1">
            {formatLakhs(totalPaid)}
          </div>
          <div className="text-xs text-muted mt-1">{payments.length} verified transactions</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card relative overflow-hidden">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Outstanding</span>
          <div className="text-2xl font-extrabold text-warning mt-1">
            {formatLakhs(totalOutstanding)}
          </div>
          <div className="text-xs text-muted mt-1">{pendingInvoices.length} milestone disbursements awaiting payment</div>
          <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Disbursement Structure</span>
          <div className="text-2xl font-extrabold text-charcoal mt-1">
            30 / 40 / 30
          </div>
          <div className="text-xs text-muted mt-1">Advance • Weaving • Dispatch</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Active Invoices</span>
          <div className="text-2xl font-extrabold text-charcoal mt-1">
            {invoices.length}
          </div>
          <div className="text-xs text-muted mt-1">Contract milestones billed</div>
        </div>
      </div>

      {/* Textile Industry Milestone Disbursement Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card border-t-4 border-t-success space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-success">Milestone 1 — 30% Advance</span>
          <h4 className="font-extrabold text-charcoal text-sm">Quote Acceptance & Yarn Sourcing</h4>
          <p className="text-xs text-muted">Locks spinning mill reservoir allocation and starts warping beam preparation.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card border-t-4 border-t-warning space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Milestone 2 — 40% Mid Production</span>
          <h4 className="font-extrabold text-charcoal text-sm">Loom Weaving & Continuous Inspection</h4>
          <p className="text-xs text-muted">Triggered upon crossing 50% greige fabric output on designated loom sheds.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-muted-border shadow-card border-t-4 border-t-muted-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Milestone 3 — 30% Balance</span>
          <h4 className="font-extrabold text-charcoal text-sm">Quality Certification & Pre-Dispatch</h4>
          <p className="text-xs text-muted">Due once final 4-point lab testing passes prior to pallet dispatch from mill.</p>
        </div>
      </div>

      {/* Commercial Invoices Table */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card overflow-hidden space-y-4 p-6">
        <div>
          <h3 className="text-base font-extrabold text-charcoal">Commercial Tax Invoices</h3>
          <p className="text-xs text-muted">GST-compliant manufacturing invoices generated per production milestone</p>
        </div>

        {isLoading && (
          <div className="py-12 text-center text-sm text-muted">
            Loading commercial invoices from mill ledger...
          </div>
        )}

        {isError && (
          <div className="py-8 text-center text-sm text-vermilion space-y-3">
            <div>
              Failed to load commercial invoices from mill server.{' '}
              {((ordersError as any)?.data?.message || (ordersError as any)?.error || '')}
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vermilion text-white text-xs font-bold hover:bg-vermilion-hover transition-colors"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!isLoading && !isError && invoices.length === 0 && (
          <div className="py-12 text-center space-y-2">
            <FileText className="mx-auto text-muted" size={32} />
            <div className="text-sm font-bold text-charcoal">No Commercial Invoices Found</div>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Invoices will be automatically generated upon order submission and quotation acceptance.
            </p>
          </div>
        )}

        {!isLoading && !isError && invoices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ivory border-b border-muted-border text-[11px] font-bold uppercase tracking-wider text-charcoal">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Milestone Deliverable</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Invoice Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-border/60">
                {invoices.map((inv) => (
                  <tr key={inv.invoiceNumber} className="hover:bg-ivory/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-charcoal">{inv.invoiceNumber}</td>

                    <td className="py-3.5 px-4 font-mono font-bold text-vermilion">
                      {inv.orderId}
                      <div className="text-[10px] text-muted font-sans font-normal">{inv.productName}</div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-charcoal">{inv.milestonePhase}</td>

                    <td className="py-3.5 px-4 text-muted">{inv.issueDate}</td>

                    <td className="py-3.5 px-4 font-bold text-charcoal">
                      <span className={inv.status === 'Pending' ? 'text-warning' : ''}>{inv.dueDate}</span>
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-charcoal">{formatCurrency(inv.amount)}</td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          inv.status === 'Paid'
                            ? 'bg-success-bg text-success border border-success-border'
                            : 'bg-warning-bg text-warning border border-warning-border'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => addToast(`Downloading Tax Invoice ${inv.invoiceNumber}.pdf...`, 'info')}
                        className="px-2.5 py-1 rounded-lg border border-muted-border text-xs font-bold text-charcoal hover:bg-white inline-block"
                        title="Download PDF"
                      >
                        PDF
                      </button>

                      {inv.status === 'Pending' ? (
                        <button
                          onClick={() => setActiveInvoice(inv)}
                          className="px-3 py-1 rounded-lg bg-vermilion text-white text-xs font-bold shadow-sm hover:bg-vermilion-hover inline-block"
                        >
                          Pay Now
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-success px-2 py-1">
                          Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disbursement History Table */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card overflow-hidden space-y-4 p-6">
        <div>
          <h3 className="text-base font-extrabold text-charcoal">Disbursement & Settlement History</h3>
          <p className="text-xs text-muted">Verified transaction ledger with digital gateway references</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-ivory border-b border-muted-border text-[11px] font-bold uppercase tracking-wider text-charcoal">
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Invoice Ref</th>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Disbursement Date</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Gateway Reference</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-border/60">
              {payments.length > 0 ? (
                payments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-ivory/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-charcoal">{p.paymentId}</td>
                    <td className="py-3.5 px-4 font-mono text-muted">{p.invoiceNumber}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-vermilion">{p.orderId}</td>
                    <td className="py-3.5 px-4 text-muted">{p.paymentDate}</td>
                    <td className="py-3.5 px-4 font-extrabold text-success">{formatCurrency(p.amount)}</td>
                    <td className="py-3.5 px-4 text-charcoal">{p.method}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-muted">{p.transactionRef}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-success-bg text-success text-[11px] font-bold">
                        Success
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted">
                    No verified disbursement transactions recorded on mill ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Razorpay Checkout Modal */}
      {activeInvoice && (
        <RazorpayModal
          invoiceNumber={activeInvoice.invoiceNumber}
          invoiceData={activeInvoice}
          onClose={() => {
            setActiveInvoice(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

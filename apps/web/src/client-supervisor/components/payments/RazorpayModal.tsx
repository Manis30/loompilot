import React, { useState, useEffect } from 'react';
import { Invoice } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { X, CheckCircle2, XCircle, Shield, Building2, Zap, FileText, CreditCard, Loader2, Clock } from 'lucide-react';
import { useClientCreatePaymentOrderMutation, useGetClientOrderByIdQuery } from '../../../store/api/ordersApi';

interface RazorpayModalProps {
  invoiceNumber: string;
  onClose: () => void;
  invoiceData?: Invoice;
}

// Dynamically load Razorpay checkout script
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const RazorpayModal: React.FC<RazorpayModalProps> = ({ invoiceNumber, onClose, invoiceData }) => {
  const invoice = invoiceData;
  const [clientCreatePaymentOrder] = useClientCreatePaymentOrderMutation();

  const [selectedMethod, setSelectedMethod] = useState<'netbanking' | 'upi' | 'neft' | 'card'>('netbanking');
  const [paymentState, setPaymentState] = useState<'idle' | 'pending_confirmation' | 'success' | 'failed'>('idle');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [txnRef, setTxnRef] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPendingConfirmation = paymentState === 'pending_confirmation';

  const { data: orderDetailsResponse } = useGetClientOrderByIdQuery(
    invoice?.backendOrderId || '',
    {
      skip: !invoice?.backendOrderId || !isPendingConfirmation,
      pollingInterval: isPendingConfirmation ? 2500 : 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  useEffect(() => {
    if (paymentState !== 'pending_confirmation' || !txnRef) return;
    const order = orderDetailsResponse?.data;
    if (!order || invoice?.milestoneIndex === undefined) return;

    const milestone = order.financials?.milestones?.[invoice.milestoneIndex];
    if (!milestone) return;

    const hasMatchingReceipt = (milestone.receipts || []).some(
      (r: any) => !r.reversedAt && (r.razorpayPaymentId === txnRef || r.ref === txnRef)
    );

    if (hasMatchingReceipt) {
      setPaymentState('success');
    }
  }, [orderDetailsResponse, paymentState, txnRef, invoice?.milestoneIndex]);

  if (!invoice) return null;

  const handleLaunchRazorpayCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    const razorpayKey = (import.meta as any).env.VITE_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      setErrorMessage('Payment gateway public key (VITE_RAZORPAY_KEY_ID) is not configured in environment.');
      setPaymentState('failed');
      setIsProcessing(false);
      return;
    }

    if (!invoice.backendOrderId || invoice.milestoneIndex === undefined) {
      setErrorMessage('Invoice is not linked to a persisted backend order milestone.');
      setPaymentState('failed');
      setIsProcessing(false);
      return;
    }

    let orderData: any = null;
    try {
      const res = await clientCreatePaymentOrder({
        id: invoice.backendOrderId,
        milestoneIndex: invoice.milestoneIndex,
      }).unwrap();
      orderData = res?.data;
      if (!orderData?.gatewayOrderId) {
        throw new Error('Backend did not return a valid gateway order ID.');
      }
    } catch (apiErr: any) {
      console.error('Failed to create payment order on backend:', apiErr);
      const msg =
        apiErr?.data?.message ||
        apiErr?.data?.error?.message ||
        apiErr?.error ||
        apiErr?.message ||
        'Failed to initiate payment order on mill server.';
      setErrorMessage(msg);
      setPaymentState('failed');
      setIsProcessing(false);
      return;
    }

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !(window as any).Razorpay) {
        setErrorMessage('Razorpay Checkout SDK failed to load. Please verify network access.');
        setPaymentState('failed');
        setIsProcessing(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: orderData.amountPaise || invoice.amount * 100,
        currency: orderData.currency || 'INR',
        name: 'LoomPilot Mill Payments',
        description: `Settlement for Invoice ${invoice.invoiceNumber}`,
        order_id: orderData.gatewayOrderId,
        handler: (response: any) => {
          const paymentId = response?.razorpay_payment_id || '';
          setTxnRef(paymentId);
          // Backend processes payment capture asynchronously via webhook (/webhooks/razorpay)
          // Do not call payInvoice() or simulate local success without confirmed server verification
          setPaymentState('pending_confirmation');
        },
        prefill: {
          name: 'Factory Accounts',
          email: 'accounts@loompilot.local',
        },
        theme: {
          color: '#0C2340',
        },
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', (errResp: any) => {
        const desc = errResp?.error?.description || 'Payment was declined by the bank or gateway.';
        setErrorMessage(desc);
        setPaymentState('failed');
      });
      rzpInstance.open();
    } catch (err: any) {
      console.error('Razorpay checkout initialization error:', err);
      setErrorMessage('Failed to initialize payment checkout.');
      setPaymentState('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-muted-border font-sans animate-in zoom-in-95">
        {/* Razorpay Brand Header */}
        <div className="bg-[#0C2340] text-white p-5 flex items-start justify-between">
          <div>
            <div className="text-base font-extrabold tracking-tight">LoomPilot Mill Payments</div>
            <div className="text-xs text-[#8BAAC9] mt-0.5">
              {invoice.invoiceNumber} • {invoice.productName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8BAAC9] hover:text-white p-1 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="bg-[#143254] px-5 py-3 text-white flex items-baseline justify-between border-t border-white/10">
          <span className="text-xs text-[#8BAAC9]">Amount Payable:</span>
          <div className="text-xl font-extrabold text-white">{formatCurrency(invoice.amount)}</div>
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {paymentState === 'idle' && (
            <div className="space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Select B2B Settlement Channel
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('netbanking')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedMethod === 'netbanking'
                      ? 'border-[#3395FF] bg-[#F4F9FF] ring-2 ring-[#3395FF]/20'
                      : 'border-muted-border hover:bg-ivory'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EBF4FF] text-[#3395FF] flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-charcoal">Corporate NetBanking</div>
                    <div className="text-[11px] text-muted">HDFC, ICICI, SBI, Axis Corporate Accounts</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('upi')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedMethod === 'upi'
                      ? 'border-[#3395FF] bg-[#F4F9FF] ring-2 ring-[#3395FF]/20'
                      : 'border-muted-border hover:bg-ivory'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EBF4FF] text-[#3395FF] flex items-center justify-center flex-shrink-0">
                    <Zap size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-charcoal">UPI Instant Settlement</div>
                    <div className="text-[11px] text-muted">UPI QR / Corporate VPA</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('neft')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedMethod === 'neft'
                      ? 'border-[#3395FF] bg-[#F4F9FF] ring-2 ring-[#3395FF]/20'
                      : 'border-muted-border hover:bg-ivory'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EBF4FF] text-[#3395FF] flex items-center justify-center flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-charcoal">NEFT / RTGS Virtual Account</div>
                    <div className="text-[11px] text-muted">Direct mill treasury settlement</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('card')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedMethod === 'card'
                      ? 'border-[#3395FF] bg-[#F4F9FF] ring-2 ring-[#3395FF]/20'
                      : 'border-muted-border hover:bg-ivory'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EBF4FF] text-[#3395FF] flex items-center justify-center flex-shrink-0">
                    <CreditCard size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-charcoal">Corporate Purchasing Card</div>
                    <div className="text-[11px] text-muted">Visa, Mastercard Commercial & Diners</div>
                  </div>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleLaunchRazorpayCheckout}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#3395FF] hover:bg-[#1A82F7] shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creating Payment Order...</span>
                    </>
                  ) : (
                    <span>Pay {formatCurrency(invoice.amount)} with Razorpay</span>
                  )}
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2 text-xs font-semibold text-muted hover:text-charcoal border border-muted-border rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Pending Webhook Confirmation Screen */}
          {paymentState === 'pending_confirmation' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Loader2 size={32} className="animate-spin text-amber-600" />
              </div>
              <h3 className="text-lg font-extrabold text-charcoal">Awaiting Settlement Confirmation</h3>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Payment reference <span className="font-mono font-bold text-charcoal">{txnRef}</span> was submitted to gateway. Settlement is awaiting verified server webhook confirmation from mill accounts.
              </p>
              <div className="p-3 bg-ivory rounded-lg text-xs text-charcoal border border-muted-border text-left space-y-1">
                <div className="font-bold text-[11px] uppercase tracking-wider text-muted">Settlement Status</div>
                <div className="text-xs">
                  Invoice remains pending until the backend records the verified receipt. Polling mill ledger automatically.
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-charcoal bg-ivory border border-muted-border hover:bg-white rounded-lg transition-colors mt-2"
              >
                Close & Check Later
              </button>
            </div>
          )}

          {/* Success Screen */}
          {paymentState === 'success' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-success-bg text-success flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-charcoal">Payment Confirmed by Mill!</h3>
              <p className="text-xs text-muted max-w-xs mx-auto">
                {formatCurrency(invoice.amount)} successfully credited to LoomPilot Mill Accounts for {invoice.invoiceNumber}.
              </p>
              <div className="p-3 bg-ivory rounded-lg text-xs font-mono text-charcoal border border-muted-border">
                Gateway Reference: {txnRef}
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-white bg-success hover:bg-success/90 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Failure Screen */}
          {paymentState === 'failed' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center mx-auto">
                <XCircle size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-charcoal">Payment Not Completed</h3>
              <p className="text-xs text-muted max-w-xs mx-auto">
                {errorMessage || 'Transaction could not be processed. No funds were debited.'}
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setPaymentState('idle');
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-vermilion hover:bg-vermilion-hover shadow-vermilion"
                >
                  Retry Payment
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-muted hover:text-charcoal border border-muted-border"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#FAFBFD] border-t border-muted-border/60 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <Shield size={13} className="text-[#3395FF]" />
            <span>Secured by Razorpay • 256-bit TLS Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

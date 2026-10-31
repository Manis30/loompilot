import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { X, CheckCircle2, XCircle, Shield, Building2, Zap, FileText, CreditCard } from 'lucide-react';

interface RazorpayModalProps {
  invoiceNumber: string;
  onClose: () => void;
}

export const RazorpayModal: React.FC<RazorpayModalProps> = ({ invoiceNumber, onClose }) => {
  const { invoices, payInvoice } = useApp();
  const invoice = invoices.find((i) => i.invoiceNumber === invoiceNumber);

  const [selectedMethod, setSelectedMethod] = useState<'netbanking' | 'upi' | 'neft' | 'card'>('netbanking');
  const [paymentState, setPaymentState] = useState<'idle' | 'success' | 'failed'>('idle');
  const [mockTxnRef, setMockTxnRef] = useState('');

  if (!invoice) return null;

  const handleSimulateSuccess = () => {
    const txn = `RZP-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
    setMockTxnRef(txn);
    setPaymentState('success');

    setTimeout(() => {
      let methodLabel = 'Razorpay (Corporate NetBanking)';
      if (selectedMethod === 'upi') methodLabel = 'Razorpay (UPI Corporate)';
      if (selectedMethod === 'neft') methodLabel = 'Razorpay (Virtual Account NEFT)';
      if (selectedMethod === 'card') methodLabel = 'Razorpay (Corporate Card)';

      payInvoice(invoice.invoiceNumber, methodLabel);
      onClose();
    }, 1500);
  };

  const handleSimulateFailure = () => {
    setPaymentState('failed');
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
                    <div className="text-xs font-bold text-charcoal">UPI Instant Corporate VPA</div>
                    <div className="text-[11px] text-muted">Google Pay, PhonePe, BHIM Enterprise</div>
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
                  onClick={handleSimulateSuccess}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#3395FF] hover:bg-[#1A82F7] shadow-md transition-colors"
                >
                  Pay {formatCurrency(invoice.amount)} (Simulate Success)
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={handleSimulateFailure}
                    className="flex-1 py-2 text-xs font-semibold text-muted hover:text-charcoal border border-muted-border rounded-lg transition-colors"
                  >
                    Test Gateway Failure
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 text-xs font-semibold text-muted hover:text-charcoal border border-muted-border rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {paymentState === 'success' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-success-bg text-success flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-charcoal">Payment Successful!</h3>
              <p className="text-xs text-muted max-w-xs mx-auto">
                {formatCurrency(invoice.amount)} successfully credited to LoomPilot Mill Accounts for {invoice.invoiceNumber}.
              </p>
              <div className="p-3 bg-ivory rounded-lg text-xs font-mono text-charcoal border border-muted-border">
                UTR / Reference: {mockTxnRef}
              </div>
            </div>
          )}

          {/* Failure Screen */}
          {paymentState === 'failed' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center mx-auto">
                <XCircle size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-charcoal">Transaction Declined</h3>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Bank authorization timed out or corporate credit card limit was exceeded. No funds were debited.
              </p>
              <button
                onClick={() => setPaymentState('idle')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-vermilion hover:bg-vermilion-hover shadow-vermilion"
              >
                Retry Payment Channel
              </button>
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


import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let borderClass = 'border-l-4 border-l-info-blue';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          borderClass = 'border-l-4 border-l-success';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          borderClass = 'border-l-4 border-l-warning';
        } else if (toast.type === 'error') {
          Icon = XCircle;
          borderClass = 'border-l-4 border-l-vermilion';
        }

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-3.5 bg-charcoal text-white rounded-xl shadow-card-hover border border-white/10 animate-in slide-in-from-right-4 duration-200',
              borderClass
            )}
          >
            <Icon size={18} className="flex-shrink-0 mt-0.5 text-ivory" />
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-light hover:text-white p-0.5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};


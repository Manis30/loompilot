import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useGetClientOrderByIdQuery } from '../../../store/api/ordersApi';
import { useGetClientProductsQuery } from '../../../store/api/catalogApi';
import { mapApiClientOrder } from '../../../utils/orderMapper';
import { PRODUCTION_STAGES_MASTER } from '../../data/mockData';
import { formatNumber, formatMetres } from '../../utils/formatters';
import {
  ArrowLeft,
  Check,
  Activity,
  Layers,
  Calendar,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export const ProductionTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { orders, addToast } = useApp();
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

  // Find order or default to first in production
  const activeOrder = liveOrder || orders.find((o) => o.id === id) || orders.find((o) => o.status === 'In Production') || orders[0];

  const [selectedStageStep, setSelectedStageStep] = useState<number>(
    activeOrder?.currentStageNumber || 4
  );

  if (!activeOrder) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-charcoal">No Manufacturing Orders Available</h2>
        <Link to="/client/orders" className="text-xs font-bold text-vermilion">
          Return to My Orders
        </Link>
      </div>
    );
  }

  const selectedStageMeta = PRODUCTION_STAGES_MASTER.find((s) => s.step === selectedStageStep);
  const selectedStageHistory = (activeOrder.stages || []).find((s) => s.step === selectedStageStep);

  // Daily production telemetry data
  const chartData = activeOrder.dailyProduction || [
    { day: 'Day 1', metres: 1100, target: 1200 },
    { day: 'Day 2', metres: 1250, target: 1200 },
    { day: 'Day 3', metres: 1380, target: 1300 },
    { day: 'Day 4', metres: 1420, target: 1400 },
    { day: 'Day 5', metres: 1350, target: 1400 },
    { day: 'Day 6', metres: 1300, target: 1300 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/client/orders"
              className="p-1.5 rounded-lg text-muted hover:text-charcoal hover:bg-white transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
              Production Tracking
            </h1>
          </div>
          <p className="text-xs text-muted mt-1 pl-8">
            Live manufacturing telemetry across loom sheds, chemical finish ranges, and packaging lines.
          </p>
        </div>

        {/* Contract Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted uppercase">Contract:</label>
          <select
            value={activeOrder.id}
            onChange={(e) => navigate(`/client/orders/${e.target.value}/tracking`)}
            className="py-1.5 px-3 text-xs font-mono font-bold rounded-xl border border-muted-border bg-white text-charcoal shadow-sm focus:outline-none"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} — {o.productName} ({o.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Production Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-muted-border shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Contracted Metres</span>
          <div className="text-xl font-extrabold text-charcoal mt-1">
            {formatMetres(activeOrder.orderedMetres)}
          </div>
          <div className="text-[11px] text-muted mt-0.5">Continuous roll specs</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-muted-border shadow-card relative overflow-hidden">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Produced to Date</span>
          <div className="text-xl font-extrabold text-success mt-1">
            {formatMetres(activeOrder.producedMetres)}
          </div>
          <div className="text-[11px] text-muted mt-0.5">{activeOrder.progressPercent}% completion</div>
          <div className="absolute top-0 left-0 w-1 h-full bg-success" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-muted-border shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Remaining Metres</span>
          <div className="text-xl font-extrabold text-charcoal mt-1">
            {formatMetres(activeOrder.remainingMetres)}
          </div>
          <div className="text-[11px] text-muted mt-0.5">Est. 3-4 days on loom shed</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-muted-border shadow-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Target Dispatch</span>
          <div className="text-xl font-extrabold text-vermilion mt-1">
            {activeOrder.expectedDelivery}
          </div>
          <div className="text-[11px] text-success font-semibold mt-0.5">● On Schedule</div>
        </div>
      </div>

      {/* EXACT 8-STAGE HORIZONTAL PRODUCTION TIMELINE */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-charcoal">
              Production Lifecycle: 8 Manufacturing Stages
            </h3>
            <p className="text-xs text-muted">Click any milestone stage node to inspect mill logs, pick rates, and QA reports</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-vermilion/10 text-vermilion text-xs font-bold self-start sm:self-auto">
            Active: Stage {activeOrder.currentStageNumber} of 8
          </span>
        </div>

        {/* Stepper Track */}
        <div className="relative pt-4 pb-2 overflow-x-auto scrollbar-none">
          <div className="min-w-[760px] flex justify-between items-start relative px-4">
            {/* Horizontal connecting track line */}
            <div className="absolute top-9 left-12 right-12 h-0.5 bg-muted-border -z-0" />

            {PRODUCTION_STAGES_MASTER.map((stage) => {
              const isCompleted = stage.step < activeOrder.currentStageNumber;
              const isActive = stage.step === activeOrder.currentStageNumber;
              const isSelected = stage.step === selectedStageStep;

              const stageHistory = (activeOrder.stages || []).find((s) => s.step === stage.step);

              return (
                <div
                  key={stage.step}
                  onClick={() => setSelectedStageStep(stage.step)}
                  className="flex flex-col items-center cursor-pointer group flex-1 text-center relative z-10"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2 mb-2 ${
                      isActive
                        ? 'bg-vermilion text-white border-vermilion shadow-vermilion ring-4 ring-vermilion/20 animate-pulse'
                        : isCompleted
                        ? 'bg-success text-white border-success'
                        : 'bg-white text-muted border-muted-border group-hover:border-muted'
                    } ${isSelected ? 'scale-110' : ''}`}
                  >
                    {isCompleted ? <Check size={18} strokeWidth={3} /> : stage.step}
                  </div>

                  <span
                    className={`text-xs font-extrabold max-w-[90px] leading-tight ${
                      isActive ? 'text-vermilion' : isSelected ? 'text-charcoal underline' : 'text-charcoal'
                    }`}
                  >
                    {stage.name}
                  </span>

                  <span className="text-[10px] text-muted-light mt-1">
                    {stageHistory ? stageHistory.date : (isCompleted ? 'Completed' : 'Upcoming')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Stage Detail Inspector */}
        {selectedStageMeta && (
          <div className="p-5 rounded-xl bg-ivory border border-muted-border border-l-4 border-l-vermilion space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedStageStep < activeOrder.currentStageNumber
                    ? 'bg-success-bg text-success'
                    : selectedStageStep === activeOrder.currentStageNumber
                    ? 'bg-vermilion/10 text-vermilion'
                    : 'bg-white text-muted border border-muted-border'
                }`}>
                  {selectedStageStep < activeOrder.currentStageNumber
                    ? 'Completed & Certified'
                    : selectedStageStep === activeOrder.currentStageNumber
                    ? 'Active Mill Stage'
                    : 'Scheduled in Sequence'}
                </span>
                <h4 className="text-base font-extrabold text-charcoal mt-1">
                  Stage {selectedStageMeta.step}: {selectedStageMeta.name}
                </h4>
                <p className="text-xs text-muted">{selectedStageMeta.desc}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Recorded Timestamp</span>
                <div className="text-xs font-bold text-charcoal">
                  {selectedStageHistory ? selectedStageHistory.date : 'Pending prior stage completion'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-muted-border text-xs text-charcoal leading-relaxed">
              <strong className="text-charcoal block mb-0.5">Mill Supervisor Notes:</strong>
              <p className="text-muted">{selectedStageHistory?.notes || 'Operating within standard ISO 9001 quality and environmental parameters.'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Production Visualisation & Daily Loom Output Chart */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card p-6 lg:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-charcoal">
              Daily Loom Output & Weaving Velocity
            </h3>
            <p className="text-xs text-muted">Actual daily metres woven vs planned mill output targets across assigned Air-Jet looms</p>
          </div>

          <button
            onClick={() => addToast('Loom shed optical sensors refreshed.', 'success')}
            className="px-3 py-1.5 rounded-lg border border-muted-border text-xs font-semibold hover:bg-ivory text-charcoal self-start sm:self-auto"
          >
            Sync Mill Telemetry
          </button>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#77766F' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#77766F' }} axisLine={false} tickLine={false} domain={[0, 1800]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#252622', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                formatter={(val: any) => [`${val} metres`, 'Volume']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="target" name="Planned Target (m)" fill="#EAE2D9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="metres" name="Actual Woven (m)" fill="#E65338" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};


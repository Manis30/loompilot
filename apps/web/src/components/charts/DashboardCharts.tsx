import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import type { Order, MarketCommodity } from '../../types';

// =========================================================================
// 1. MINI SPARKLINE FOR TOP KPI CARDS
// =========================================================================
export const KpiMiniSparkline: React.FC<{
  data: number[];
  color: string;
  isPositive?: boolean;
}> = ({ data, color, isPositive = true }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {/* Glow point on current day */}
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
          r="3"
          fill={color}
        />
      </svg>
      <span style={{ fontSize: 9.5, fontWeight: 700, color, display: 'flex', alignItems: 'center' }}>
        {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      </span>
    </div>
  );
};

// =========================================================================
// 2. DAILY PRODUCTION OUTPUT VS TARGET (AREA & LINE CHART)
// =========================================================================
export const DailyProductionAreaChart: React.FC = () => {
  const [activeDayIdx, setActiveDayIdx] = useState<number>(6); // Default to today (Oct 29)

  const productionData = [
    { day: '23 Oct', meters: 2450, target: 2700, loomsRunning: 18, uptime: '93.2%', scrap: '1.2%' },
    { day: '24 Oct', meters: 2620, target: 2700, loomsRunning: 18, uptime: '94.5%', scrap: '1.0%' },
    { day: '25 Oct', meters: 2710, target: 2700, loomsRunning: 19, uptime: '96.0%', scrap: '0.9%' },
    { day: '26 Oct', meters: 2690, target: 2700, loomsRunning: 19, uptime: '95.2%', scrap: '1.1%' },
    { day: '27 Oct', meters: 2740, target: 2700, loomsRunning: 19, uptime: '95.8%', scrap: '0.8%' },
    { day: '28 Oct', meters: 2820, target: 2700, loomsRunning: 19, uptime: '97.1%', scrap: '0.9%' },
    { day: '29 Oct (Today)', meters: 2780, target: 2700, loomsRunning: 19, uptime: '96.5%', scrap: '0.9%' }
  ];

  const svgWidth = 460;
  const svgHeight = 150;
  const paddingX = 40;
  const paddingY = 24;

  const minMeters = 2200;
  const maxMeters = 3000;
  const range = maxMeters - minMeters;

  const getX = (idx: number) => paddingX + (idx / (productionData.length - 1)) * (svgWidth - paddingX * 2);
  const getY = (meters: number) => svgHeight - paddingY - ((meters - minMeters) / range) * (svgHeight - paddingY * 2);

  // Path coordinates
  const points = productionData.map((d, idx) => `${getX(idx).toFixed(1)},${getY(d.meters).toFixed(1)}`).join(' ');
  const areaPath = `M ${getX(0)},${getY(productionData[0].meters)} ${points} L ${getX(productionData.length - 1)},${svgHeight - paddingY} L ${getX(0)},${svgHeight - paddingY} Z`;
  const targetY = getY(2700);

  const activePoint = productionData[activeDayIdx];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '4px 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
              Daily Loom Production Output vs Target (7 Days)
            </h3>
            <span className="status-pill status-feasible" style={{ fontSize: 8.5 }}>
              +2.9% Above Target
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--c-text-muted)' }}>
            Combined daily yardage across Shed A & B with 2,700 m/day target benchmark.
          </p>
        </div>

        {/* Selected Day Stats Callout */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-terracotta)' }}>
            {activePoint.meters.toLocaleString()} meters
          </div>
          <div style={{ fontSize: 10, color: activePoint.meters >= activePoint.target ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            {activePoint.meters >= activePoint.target ? `+${activePoint.meters - activePoint.target}m vs target` : `${activePoint.meters - activePoint.target}m below`} ({activePoint.day})
          </div>
        </div>
      </div>

      {/* SVG Interactive Area Chart */}
      <div style={{ position: 'relative', width: '100%', height: svgHeight }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="productionAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#df5538" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#df5538" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          {[2400, 2600, 2800].map((val) => (
            <g key={val}>
              <line
                x1={paddingX}
                y1={getY(val)}
                x2={svgWidth - paddingX}
                y2={getY(val)}
                stroke="#f3ece7"
                strokeWidth="1"
              />
              <text
                x={paddingX - 6}
                y={getY(val) + 3}
                fontSize="9"
                fill="#9ca3af"
                textAnchor="end"
              >
                {val}m
              </text>
            </g>
          ))}

          {/* 2,700m Target Benchmark Line */}
          <line
            x1={paddingX}
            y1={targetY}
            x2={svgWidth - paddingX}
            y2={targetY}
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={svgWidth - paddingX + 4}
            y={targetY + 3}
            fontSize="8.5"
            fill="#6b7280"
            fontWeight="700"
          >
            Target (2.7k)
          </text>

          {/* Area Fill */}
          <path d={areaPath} fill="url(#productionAreaGrad)" />

          {/* Line Stroke */}
          <polyline
            fill="none"
            stroke="var(--c-terracotta)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Interactive Data Dots & Hover Column */}
          {productionData.map((d, idx) => {
            const x = getX(idx);
            const y = getY(d.meters);
            const isHovered = activeDayIdx === idx;

            return (
              <g
                key={d.day}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveDayIdx(idx)}
              >
                {/* Invisible hover hit-zone */}
                <rect
                  x={x - 20}
                  y={0}
                  width={40}
                  height={svgHeight}
                  fill="transparent"
                />

                {/* Vertical cursor guide */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingY}
                    x2={x}
                    y2={svgHeight - paddingY}
                    stroke="var(--c-terracotta)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Data Dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? '5' : '3.5'}
                  fill={isHovered ? '#ffffff' : 'var(--c-terracotta)'}
                  stroke="var(--c-terracotta)"
                  strokeWidth="2.5"
                />

                {/* X-Axis Date Labels */}
                <text
                  x={x}
                  y={svgHeight - 6}
                  fontSize="8.5"
                  fontWeight={isHovered ? '800' : '600'}
                  fill={isHovered ? 'var(--c-terracotta)' : '#9ca3af'}
                  textAnchor="middle"
                >
                  {d.day.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mini Details Strip (Cardless Flat) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #ebdcd3',
        padding: '6px 2px 2px 2px',
        fontSize: 10.5
      }}>
        <span>Day: <strong>{activePoint.day}</strong></span>
        <span>Running Looms: <strong>{activePoint.loomsRunning} Active</strong></span>
        <span>Uptime: <strong>{activePoint.uptime}</strong></span>
        <span>Scrap Rate: <strong style={{ color: '#16a34a' }}>{activePoint.scrap}</strong></span>
      </div>
    </div>
  );
};

// =========================================================================
// 3. ORDER STATUS & PIPELINE DISTRIBUTION (INTERACTIVE DONUT & STAGES)
// =========================================================================
export const OrderStatusDonutChart: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Group orders into real lifecycle orders matching mockups
  const segments = [
    {
      id: 'tx1024',
      label: 'Stitching / In-Prod',
      orderCode: 'TX-1024',
      client: 'ABC Garments',
      meters: 5000,
      color: '#6366f1',
      percentage: 31.25,
      statusPill: 'In Production'
    },
    {
      id: 'tx1025',
      label: 'Dyeing / At Risk',
      orderCode: 'TX-1025',
      client: 'StyleMart',
      meters: 3000,
      color: '#d97706',
      percentage: 18.75,
      statusPill: 'At Risk'
    },
    {
      id: 'tx1026',
      label: 'Finishing / Approved',
      orderCode: 'TX-1026',
      client: 'HomeNest',
      meters: 2000,
      color: '#16a34a',
      percentage: 12.5,
      statusPill: 'Approved'
    },
    {
      id: 'tx1027',
      label: 'Quotation Review',
      orderCode: 'TX-1027',
      client: 'TechCart',
      meters: 4500,
      color: '#2563eb',
      percentage: 28.1,
      statusPill: 'Pending'
    },
    {
      id: 'tx1028',
      label: 'New Intake',
      orderCode: 'TX-1028',
      client: 'KitchenKart',
      meters: 1500,
      color: '#92400e',
      percentage: 9.4,
      statusPill: 'New'
    }
  ];

  const totalMeters = 16000;
  const radius = 55;
  const circumference = 2 * Math.PI * radius; // ~345.57

  let accumulatedPercent = 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '4px 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Order Pipeline & Stage Allocation
          </h3>
          <p style={{ fontSize: 10.5, color: 'var(--c-text-muted)' }}>
            Distribution of {orders.length} commercial contracts across the manufacturing pipeline.
          </p>
        </div>
        <span className="status-pill status-quote" style={{ fontSize: 8.5 }}>
          {totalMeters.toLocaleString()}m Total
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'center' }}>
        {/* SVG Donut Chart */}
        <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto' }}>
          <svg width="130" height="130" viewBox="0 0 130 130">
            <g transform="rotate(-90 65 65)">
              {segments.map((seg, idx) => {
                const strokeDasharray = `${(seg.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                accumulatedPercent += seg.percentage;
                const isHovered = hoveredIdx === idx;

                return (
                  <circle
                    key={seg.id}
                    cx="65"
                    cy="65"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={isHovered ? 16 : 12}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                      transition: 'all 0.25s ease',
                      cursor: 'pointer',
                      filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' : 'none'
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Donut Center Hole Label */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text-primary)' }}>
              {hoveredIdx !== null ? `${segments[hoveredIdx].percentage}%` : `${orders.length} Orders`}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--c-text-muted)' }}>
              {hoveredIdx !== null ? segments[hoveredIdx].orderCode : 'Committed'}
            </span>
          </div>
        </div>

        {/* Legend / Breakdown List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {segments.map((seg, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  background: isHovered ? '#faf6f4' : 'transparent',
                  padding: '4px 6px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10.5,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color }}></span>
                  <strong style={{ color: 'var(--c-text-primary)' }}>{seg.orderCode}</strong>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 9.5 }}>({seg.label})</span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, color: 'var(--c-text-primary)' }}>
                    {seg.meters.toLocaleString()} m
                  </span>
                  <span style={{ fontSize: 9.5, color: 'var(--c-text-muted)', marginLeft: 4 }}>
                    ({seg.percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 4. RAW MATERIAL COMMODITY PRICE SURGE TRENDS (7-DAY LINE CHART)
// =========================================================================
export const MarketPriceTrendChart: React.FC<{ commodities: MarketCommodity[] }> = ({ commodities }) => {
  const [activeComm, setActiveComm] = useState<string>('comm_cotton');

  // 7-day trajectories
  const priceHistory = {
    comm_cotton: [
      { day: '23 Oct', price: 2.45 },
      { day: '24 Oct', price: 2.52 },
      { day: '25 Oct', price: 2.60 },
      { day: '26 Oct', price: 2.68 },
      { day: '27 Oct', price: 2.75 },
      { day: '28 Oct', price: 2.81 },
      { day: '29 Oct', price: 2.85 }
    ],
    comm_dye: [
      { day: '23 Oct', price: 4.15 },
      { day: '24 Oct', price: 4.20 },
      { day: '25 Oct', price: 4.28 },
      { day: '26 Oct', price: 4.35 },
      { day: '27 Oct', price: 4.42 },
      { day: '28 Oct', price: 4.48 },
      { day: '29 Oct', price: 4.50 }
    ],
    comm_poly: [
      { day: '23 Oct', price: 1.68 },
      { day: '24 Oct', price: 1.67 },
      { day: '25 Oct', price: 1.66 },
      { day: '26 Oct', price: 1.65 },
      { day: '27 Oct', price: 1.65 },
      { day: '28 Oct', price: 1.64 },
      { day: '29 Oct', price: 1.65 }
    ]
  };

  const selectedData = priceHistory[activeComm as keyof typeof priceHistory] || priceHistory.comm_cotton;
  const currentCommodity = commodities.find((c) => c.id === activeComm) || commodities[0];

  const svgWidth = 460;
  const svgHeight = 140;
  const paddingX = 40;
  const paddingY = 20;

  const minP = Math.min(...selectedData.map((d) => d.price)) * 0.95;
  const maxP = Math.max(...selectedData.map((d) => d.price)) * 1.05;
  const rangeP = maxP - minP || 1;

  const getX = (idx: number) => paddingX + (idx / (selectedData.length - 1)) * (svgWidth - paddingX * 2);
  const getY = (price: number) => svgHeight - paddingY - ((price - minP) / rangeP) * (svgHeight - paddingY * 2);

  const points = selectedData.map((d, idx) => `${getX(idx).toFixed(1)},${getY(d.price).toFixed(1)}`).join(' ');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '4px 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
              Raw Material Price Trends & Surges (7-Day Volatility)
            </h3>
            {currentCommodity.isSurge && (
              <span className="status-pill status-infeasible" style={{ fontSize: 8.5 }}>
                SURGE ALERT (+{currentCommodity.changeSevenDays}%)
              </span>
            )}
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--c-text-muted)' }}>
            Tracked international spot price indices with surge alarms alerting the Admin.
          </p>
        </div>

        {/* Commodity Selector Pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {commodities.filter((c) => c.category !== 'energy').map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveComm(c.id)}
              style={{
                background: activeComm === c.id ? 'var(--c-terracotta)' : '#faf6f4',
                color: activeComm === c.id ? '#ffffff' : 'var(--c-text-secondary)',
                border: '1px solid #ebdcd3',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: activeComm === c.id ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              {c.name.split(' ')[0]} (${c.price.toFixed(2)})
            </button>
          ))}
        </div>
      </div>

      {/* SVG Line Chart */}
      <div style={{ position: 'relative', width: '100%', height: svgHeight }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* Guide lines */}
          <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#f3ece7" strokeWidth="1" />
          <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#f3ece7" strokeWidth="1" />

          {/* Line Path */}
          <polyline
            fill="none"
            stroke={currentCommodity.isSurge ? '#dc2626' : 'var(--c-terracotta)'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Dots */}
          {selectedData.map((d, idx) => {
            const x = getX(idx);
            const y = getY(d.price);
            const isLast = idx === selectedData.length - 1;

            return (
              <g key={d.day}>
                <circle
                  cx={x}
                  cy={y}
                  r={isLast ? '5' : '3.5'}
                  fill={isLast ? (currentCommodity.isSurge ? '#dc2626' : 'var(--c-terracotta)') : '#ffffff'}
                  stroke={currentCommodity.isSurge ? '#dc2626' : 'var(--c-terracotta)'}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={y - 8}
                  fontSize="8.5"
                  fontWeight="700"
                  fill={isLast ? '#dc2626' : '#6b7280'}
                  textAnchor="middle"
                >
                  ${d.price.toFixed(2)}
                </text>
                <text
                  x={x}
                  y={svgHeight - 4}
                  fontSize="8"
                  fill="#9ca3af"
                  textAnchor="middle"
                >
                  {d.day.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ fontSize: 10, color: 'var(--c-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Current Price: <strong>₹{currentCommodity.price.toFixed(2)} / {currentCommodity.unit}</strong></span>
        <span>7-Day Volatility: <strong>{currentCommodity.volatilityPercent}%</strong></span>
        <span>Impacted Contracts: <strong>Order TX-1024 & TX-1025</strong></span>
      </div>
    </div>
  );
};

// =========================================================================
// 5. WEAVING SHED CAPACITY & LOOM UTILIZATION (STACKED BARS)
// =========================================================================
export const ShedCapacityUtilizationBarChart: React.FC = () => {
  const sheds = [
    {
      name: 'Airjet Shed A (Ramesh Kumar)',
      running: 19,
      idle: 4,
      breakdown: 1,
      total: 24,
      runningPercent: 79.2,
      rpm: 850,
      activeOrder: 'TX-1024'
    },
    {
      name: 'Dyeing & Weaving Shed B (Murugan K.)',
      running: 16,
      idle: 8,
      breakdown: 0,
      total: 24,
      runningPercent: 66.7,
      rpm: 650,
      activeOrder: 'TX-1025'
    }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '4px 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Weaving Shed Capacity & Machine Utilization
          </h3>
          <p style={{ fontSize: 10.5, color: 'var(--c-text-muted)' }}>
            Real-time operational status across 48 total industrial weaving frames.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
          72.9% Mill Efficiency
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sheds.map((shed) => (
          <div key={shed.name} style={{ borderBottom: '1px solid #f0e6e0', padding: '4px 0 8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <strong style={{ fontSize: 11.5, color: 'var(--c-text-primary)' }}>{shed.name}</strong>
                <span style={{ fontSize: 10, color: 'var(--c-text-muted)', marginLeft: 6 }}>&bull; {shed.rpm} RPM Speed</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-terracotta)' }}>
                {shed.running} / {shed.total} Looms ({shed.runningPercent}%)
              </span>
            </div>

            {/* Stacked Capacity Bar */}
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#e5e7eb' }}>
              <div style={{ width: `${(shed.running / shed.total) * 100}%`, background: '#16a34a' }} title={`${shed.running} Running Looms`} />
              <div style={{ width: `${(shed.idle / shed.total) * 100}%`, background: '#94a3b8' }} title={`${shed.idle} Idle Looms`} />
              <div style={{ width: `${(shed.breakdown / shed.total) * 100}%`, background: '#dc2626' }} title={`${shed.breakdown} Breakdown`} />
            </div>

            {/* Legend / Metrics */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text-muted)', marginTop: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }}></span>
                {shed.running} Running
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }}></span>
                {shed.idle} Idle
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }}></span>
                {shed.breakdown} Breakdown
              </span>
              <span style={{ fontWeight: 600, color: 'var(--c-text-primary)' }}>
                Active Order: {shed.activeOrder}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

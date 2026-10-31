import React, { useState, useMemo } from 'react';
import {
  Truck,
  DollarSign,
  Plus,
  Filter,
  SlidersHorizontal,
  MoreHorizontal,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  X
} from 'lucide-react';
import type { Order, DeliveryRecord, PaymentRecord } from '../../types';

interface DeliveriesPaymentsModuleProps {
  orders: Order[];
  onSelectOrder: (id: string) => void;
  onRecordDelivery: (orderId: string, delivery: Omit<DeliveryRecord, 'id'>) => void;
  onRecordPayment: (orderId: string, payment: Omit<PaymentRecord, 'id'>) => void;
}

export const DeliveriesPaymentsModule: React.FC<DeliveriesPaymentsModuleProps> = ({
  orders,
  onSelectOrder,
  onRecordDelivery,
  onRecordPayment
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'deliveries' | 'payments'>('deliveries');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [targetOrderId, setTargetOrderId] = useState<string>(orders[0]?.id || 'TX-1024');
  const [filterText, setFilterText] = useState<string>('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Form states
  const [delQty, setDelQty] = useState<number>(3000);
  const [delInvoice, setDelInvoice] = useState<string>('INV-2026-8901');
  const [delCarrier, setDelCarrier] = useState<string>('VRL Logistics Freight');

  const [payAmount, setPayAmount] = useState<number>(14500);
  const [payType, setPayType] = useState<'advance_30' | 'mid_progress_40' | 'final_balance_30'>('advance_30');
  const [payStatus] = useState<'pending' | 'received'>('received');

  const allDeliveries: { order: Order; delivery: DeliveryRecord }[] = [];
  const allPayments: { order: Order; payment: PaymentRecord }[] = [];

  orders.forEach((o) => {
    o.deliveries.forEach((d) => allDeliveries.push({ order: o, delivery: d }));
    o.payments.forEach((p) => allPayments.push({ order: o, payment: p }));
  });

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    onRecordDelivery(targetOrderId, {
      orderId: targetOrderId,
      date: new Date().toISOString().split('T')[0],
      quantityMeters: delQty,
      invoiceNumber: delInvoice,
      carrier: delCarrier,
      deliveryType: 'partial',
      status: 'delivered'
    });
    setShowAddModal(false);
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    onRecordPayment(targetOrderId, {
      orderId: targetOrderId,
      invoiceNumber: delInvoice,
      amount: payAmount,
      date: new Date().toISOString().split('T')[0],
      type: payType,
      status: payStatus
    });
    setShowAddModal(false);
  };

  const totalDeliveredMeters = allDeliveries.reduce((s, d) => s + d.delivery.quantityMeters, 0);
  const totalPaidRevenue = allPayments.filter((p) => p.payment.status === 'received').reduce((s, p) => s + p.payment.amount, 0);
  const totalPendingBalance = allPayments.filter((p) => p.payment.status === 'pending').reduce((s, p) => s + p.payment.amount, 0);

  const filteredDeliveries = useMemo(() => {
    if (!filterText.trim()) return allDeliveries;
    const q = filterText.toLowerCase();
    return allDeliveries.filter(({ order, delivery }) =>
      delivery.invoiceNumber.toLowerCase().includes(q) ||
      order.clientName.toLowerCase().includes(q) ||
      order.id.toLowerCase().includes(q) ||
      delivery.carrier.toLowerCase().includes(q)
    );
  }, [allDeliveries, filterText]);

  const filteredPayments = useMemo(() => {
    if (!filterText.trim()) return allPayments;
    const q = filterText.toLowerCase();
    return allPayments.filter(({ order, payment }) =>
      payment.invoiceNumber.toLowerCase().includes(q) ||
      order.clientName.toLowerCase().includes(q) ||
      order.id.toLowerCase().includes(q) ||
      payment.type.toLowerCase().includes(q)
    );
  }, [allPayments, filterText]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* 1. Header Banner */}
      <div className="module-header-flat">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Deliveries & Payments
          </h1>
        </div>

        <button
          className="admin-btn-primary"
          style={{ padding: '7px 18px', fontSize: 11.5 }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={14} />
          <span>Record New Entry</span>
        </button>
      </div>

      {/* Untitled UI Top 4 KPI Metric Cards */}
      <div className="untitled-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* KPI 1: Completed Dispatches */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Completed Dispatches</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{allDeliveries.length}</span>
            <span className="untitled-kpi-badge indigo">Shipments</span>
          </div>
        </div>

        {/* KPI 2: Delivered Yardage */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Delivered Yardage</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">{totalDeliveredMeters.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>m</span></span>
            <span className="untitled-kpi-badge success"><ArrowUp size={11} strokeWidth={2.5} /> On Schedule</span>
          </div>
        </div>

        {/* KPI 3: Settled Receipts */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Settled Receipts</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value">${totalPaidRevenue.toLocaleString()}</span>
            <span className="untitled-kpi-badge success">Paid</span>
          </div>
        </div>

        {/* KPI 4: Outstanding Balance */}
        <div className="untitled-kpi-card">
          <div className="untitled-kpi-header">
            <span className="untitled-kpi-title">Outstanding Balance</span>
            <button className="untitled-kpi-menu-btn" title="Options"><MoreVertical size={16} /></button>
          </div>
          <div className="untitled-kpi-body">
            <span className="untitled-kpi-value" style={{ color: totalPendingBalance > 0 ? '#b42318' : '#101828' }}>
              ${totalPendingBalance.toLocaleString()}
            </span>
            <span className={`untitled-kpi-badge ${totalPendingBalance > 0 ? 'warning' : 'success'}`}>
              {totalPendingBalance > 0 ? 'Due' : 'All Clear'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Card (Exact Modern Design System) */}
      <div className="modern-table-card">
        {/* Top Folder Tabs with Count Badges */}
        <div className="modern-table-tabs-bar">
          <button
            type="button"
            className={`modern-table-tab ${activeSubTab === 'deliveries' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('deliveries')}
          >
            <Truck size={14} />
            <span>Dispatch &amp; Delivery Records</span>
            <span className="modern-table-tab-badge">{allDeliveries.length}</span>
          </button>
          <button
            type="button"
            className={`modern-table-tab ${activeSubTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('payments')}
          >
            <DollarSign size={14} />
            <span>Payment Invoices &amp; Receipts</span>
            <span className="modern-table-tab-badge">{allPayments.length}</span>
          </button>
        </div>

        {/* Toolbar with Search Filter, Sliders, and +New CTA */}
        <div className="modern-table-toolbar">
          <div className="modern-table-filter-group">
            <div className="modern-search-pill">
              <Filter size={13} color="#94a3b8" />
              <input
                type="text"
                placeholder={activeSubTab === 'deliveries' ? 'Filter dispatch records by invoice or client...' : 'Filter receipts by invoice or client...'}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="modern-filter-btn"
              title="Toggle filter view"
              onClick={() => setActiveSubTab(prev => prev === 'deliveries' ? 'payments' : 'deliveries')}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>

          <button
            type="button"
            className="modern-action-pill-btn"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} />
            <span>Record New Entry</span>
          </button>
        </div>

        {/* Data Table */}
        <div className="modern-data-table-wrapper">
          {activeSubTab === 'deliveries' ? (
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th className="col-checkbox">
                    <input
                      type="checkbox"
                      className="modern-checkbox"
                      checked={filteredDeliveries.length > 0 && filteredDeliveries.every(d => selectedRowIds.includes(d.delivery.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(Array.from(new Set([...selectedRowIds, ...filteredDeliveries.map(d => d.delivery.id)])));
                        } else {
                          const curIds = new Set(filteredDeliveries.map(d => d.delivery.id));
                          setSelectedRowIds(selectedRowIds.filter(id => !curIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Invoice # <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th>Order &amp; Client</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Dispatched Volume</th>
                  <th>Carrier Freight</th>
                  <th>Dispatch Date</th>
                  <th style={{ width: 44, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>
                      No delivery records found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map(({ order, delivery }) => {
                    const isSelected = selectedRowIds.includes(delivery.id);
                    return (
                      <tr
                        key={delivery.id}
                        className={isSelected ? 'is-selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectOrder(order.id)}
                      >
                        <td
                          className="col-checkbox"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="modern-checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                setSelectedRowIds(selectedRowIds.filter(id => id !== delivery.id));
                              } else {
                                setSelectedRowIds([...selectedRowIds, delivery.id]);
                              }
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: 800, color: '#18191B' }}>
                          #{delivery.invoiceNumber}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#111827' }}>
                              {order.clientName}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>
                              {order.productName} (#{order.id})
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="status-dot-pill fulfilled">
                            {delivery.deliveryType.toUpperCase()} DELIVERED
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                          {delivery.quantityMeters.toLocaleString()} m
                        </td>
                        <td style={{ color: '#475569' }}>
                          {delivery.carrier}
                        </td>
                        <td style={{ color: '#64748b', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                          {delivery.date}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="modern-table-row-action"
                            title="Inspect order"
                            onClick={() => onSelectOrder(order.id)}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th className="col-checkbox">
                    <input
                      type="checkbox"
                      className="modern-checkbox"
                      checked={filteredPayments.length > 0 && filteredPayments.every(p => selectedRowIds.includes(p.payment.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(Array.from(new Set([...selectedRowIds, ...filteredPayments.map(p => p.payment.id)])));
                        } else {
                          const curIds = new Set(filteredPayments.map(p => p.payment.id));
                          setSelectedRowIds(selectedRowIds.filter(id => !curIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Invoice # <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th>Order &amp; Client</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  <th>Payment Type</th>
                  <th>Payment Date</th>
                  <th style={{ width: 44, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>
                      No payment records found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(({ order, payment }) => {
                    const isSelected = selectedRowIds.includes(payment.id);
                    const isReceived = payment.status === 'received';
                    return (
                      <tr
                        key={payment.id}
                        className={isSelected ? 'is-selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectOrder(order.id)}
                      >
                        <td
                          className="col-checkbox"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="modern-checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                setSelectedRowIds(selectedRowIds.filter(id => id !== payment.id));
                              } else {
                                setSelectedRowIds([...selectedRowIds, payment.id]);
                              }
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: 800, color: '#18191B' }}>
                          #{payment.invoiceNumber}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#111827' }}>
                              {order.clientName}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>
                              #{order.id} &bull; {order.productName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-dot-pill ${isReceived ? 'fulfilled' : 'pending'}`}>
                            {payment.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: isReceived ? '#15803d' : '#b45309', fontVariantNumeric: 'tabular-nums' }}>
                          ${payment.amount.toLocaleString()}
                        </td>
                        <td style={{ color: '#475569' }}>
                          {payment.type.replace('_', ' ').toUpperCase()}
                        </td>
                        <td style={{ color: '#64748b', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                          {payment.date}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="modern-table-row-action"
                            title="Inspect order"
                            onClick={() => onSelectOrder(order.id)}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {
        showAddModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h2 className="modal-title">Record Delivery or Payment Receipt</h2>
                <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setActiveSubTab('deliveries')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    border: activeSubTab === 'deliveries' ? '1px solid #c6e5db' : '1px solid #e2e8f0',
                    background: activeSubTab === 'deliveries' ? '#F8F0DF' : '#ffffff',
                    color: activeSubTab === 'deliveries' ? '#18191B' : '#64748b',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Log Delivery Shipment
                </button>
                <button
                  onClick={() => setActiveSubTab('payments')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    border: activeSubTab === 'payments' ? '1px solid #c6e5db' : '1px solid #e2e8f0',
                    background: activeSubTab === 'payments' ? '#F8F0DF' : '#ffffff',
                    color: activeSubTab === 'payments' ? '#18191B' : '#64748b',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Log Payment Receipt
                </button>
              </div>

              {activeSubTab === 'deliveries' ? (
                <form onSubmit={handleCreateDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Order Code</label>
                    <select className="admin-form-input" value={targetOrderId} onChange={(e) => setTargetOrderId(e.target.value)}>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>{o.id} - {o.clientName} ({o.productName})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Dispatched Meters</label>
                    <input type="number" className="admin-form-input" value={delQty} onChange={(e) => setDelQty(+e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Invoice / Gate Pass #</label>
                    <input type="text" className="admin-form-input" value={delInvoice} onChange={(e) => setDelInvoice(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Carrier & Tracking Details</label>
                    <input type="text" className="admin-form-input" value={delCarrier} onChange={(e) => setDelCarrier(e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="submit" className="admin-btn-primary">Record Dispatch</button>
                    <button
                      type="button"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 9999,
                        padding: '8px 16px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreatePayment} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Order Code</label>
                    <select className="admin-form-input" value={targetOrderId} onChange={(e) => setTargetOrderId(e.target.value)}>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>{o.id} - {o.clientName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Received Amount ($)</label>
                    <input type="number" className="admin-form-input" value={payAmount} onChange={(e) => setPayAmount(+e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Milestone Type</label>
                    <select className="admin-form-input" value={payType} onChange={(e: any) => setPayType(e.target.value)}>
                      <option value="advance_30">Advance 30% Deposit</option>
                      <option value="mid_progress_40">Mid-Production 40%</option>
                      <option value="final_balance_30">Final Balance 30% (Post-Delivery)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="submit" className="admin-btn-primary">Record Payment Receipt</button>
                    <button
                      type="button"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 9999,
                        padding: '8px 16px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
};

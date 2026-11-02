import React, { useState, useMemo, useEffect } from 'react';
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
  onRecordDelivery: (orderId: string, delivery: Omit<DeliveryRecord, 'id'> & { invoiceAmount?: number }) => Promise<void>;
  onRecordPayment: (orderId: string, payment: Omit<PaymentRecord, 'id'> & { milestoneIndex?: number; ref?: string; method?: string }) => Promise<void>;
}

const isDemo = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

export const DeliveriesPaymentsModule: React.FC<DeliveriesPaymentsModuleProps> = ({
  orders,
  onSelectOrder,
  onRecordDelivery,
  onRecordPayment
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'deliveries' | 'payments'>('deliveries');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [targetOrderId, setTargetOrderId] = useState<string>(orders[0]?.id || (isDemo ? 'TX-1024' : ''));
  const [filterText, setFilterText] = useState<string>('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Form states - Delivery (no fabricated defaults in normal mode)
  const [delQty, setDelQty] = useState<number | ''>(isDemo ? 3000 : '');
  const [delInvoice, setDelInvoice] = useState<string>(isDemo ? 'INV-2026-8901' : '');
  const [delCarrier, setDelCarrier] = useState<string>(isDemo ? 'VRL Logistics Freight' : '');
  const [delInvoiceAmount, setDelInvoiceAmount] = useState<number | ''>(isDemo ? 67500 : '');

  // Form states - Payment (no fabricated defaults in normal mode)
  const [selectedMilestoneIndex, setSelectedMilestoneIndex] = useState<number>(0);
  const [payAmount, setPayAmount] = useState<number | ''>(isDemo ? 14500 : '');
  const [payRef, setPayRef] = useState<string>(isDemo ? 'PAY-2026-8901' : '');
  const [payMethod, setPayMethod] = useState<'neft' | 'rtgs' | 'upi' | 'cheque' | 'cash' | 'razorpay'>('neft');

  // Form submission feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Synchronize targetOrderId with loaded orders
  useEffect(() => {
    if (orders.length > 0 && (!targetOrderId || !orders.some((o) => o.id === targetOrderId))) {
      setTargetOrderId(orders[0].id);
    }
  }, [orders, targetOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === targetOrderId),
    [orders, targetOrderId]
  );

  const deliveredMetersSoFar = useMemo(() => {
    if (!selectedOrder) return 0;
    if (selectedOrder.deliveredMeters != null && selectedOrder.deliveredMeters > 0) {
      return selectedOrder.deliveredMeters;
    }
    return selectedOrder.deliveries.reduce((sum, d) => sum + d.quantityMeters, 0);
  }, [selectedOrder]);

  const remainingDeliveryMeters = useMemo(() => {
    if (!selectedOrder) return 0;
    return Math.max(0, selectedOrder.quantityMeters - deliveredMetersSoFar);
  }, [selectedOrder, deliveredMetersSoFar]);

  const previousInvoicedAmount = useMemo(() => {
    if (!selectedOrder) return 0;
    return selectedOrder.deliveries.reduce((sum, d) => sum + (d.invoiceAmount || 0), 0);
  }, [selectedOrder]);

  const remainingInvoicedAmount = useMemo(() => {
    if (!selectedOrder || !selectedOrder.quotation?.totalPrice) return 0;
    return Math.max(0, selectedOrder.quotation.totalPrice - previousInvoicedAmount);
  }, [selectedOrder, previousInvoicedAmount]);

  // Derived milestones list for payment
  const milestonesList = useMemo(() => {
    if (!selectedOrder) return [];
    if (selectedOrder.financials?.milestones && selectedOrder.financials.milestones.length > 0) {
      return selectedOrder.financials.milestones.map((m, idx) => {
        const total = m.amountPaise ? m.amountPaise / 100 : 0;
        const received = m.receivedPaise ? m.receivedPaise / 100 : 0;
        const due = m.duePaise ? m.duePaise / 100 : Math.max(0, total - received);
        return {
          index: idx,
          name: m.milestone || `Milestone ${idx + 1}`,
          trigger: m.trigger,
          totalAmount: total,
          receivedAmount: received,
          dueAmount: due,
          status: m.status,
        };
      });
    }
    if (selectedOrder.payments && selectedOrder.payments.length > 0) {
      return selectedOrder.payments.map((p, idx) => ({
        index: p.milestoneIndex ?? idx,
        name: p.milestoneName || p.type.replace(/_/g, ' ').toUpperCase(),
        trigger: 'stage',
        totalAmount: p.amount,
        receivedAmount: p.receivedAmount ?? (p.status === 'received' ? p.amount : 0),
        dueAmount: p.dueAmount ?? (p.status === 'received' ? 0 : p.amount),
        status: p.status,
      }));
    }
    return [];
  }, [selectedOrder]);

  // When selected order changes, select first milestone with remaining due balance
  useEffect(() => {
    if (milestonesList.length > 0) {
      const firstUnpaid = milestonesList.find((m) => m.dueAmount > 0 && m.status !== 'received');
      const targetIndex = firstUnpaid ? firstUnpaid.index : 0;
      setSelectedMilestoneIndex(targetIndex);
      const targetMilestone = milestonesList.find((m) => m.index === targetIndex) || milestonesList[0];
      if (targetMilestone && !isDemo) {
        setPayAmount(targetMilestone.dueAmount > 0 ? targetMilestone.dueAmount : '');
      }
    }
  }, [milestonesList]);

  const selectedMilestone = useMemo(
    () => milestonesList.find((m) => m.index === selectedMilestoneIndex) || milestonesList[0],
    [milestonesList, selectedMilestoneIndex]
  );

  const handleMilestoneChange = (index: number) => {
    setSelectedMilestoneIndex(index);
    const ms = milestonesList.find((m) => m.index === index);
    if (ms && ms.dueAmount > 0) {
      setPayAmount(ms.dueAmount);
    }
  };

  const handleQtyChange = (val: number | '') => {
    setDelQty(val);
    if (val !== '' && val > 0 && selectedOrder?.quotation?.pricePerUnit) {
      setDelInvoiceAmount(+(val * selectedOrder.quotation.pricePerUnit).toFixed(2));
    }
  };

  const allDeliveries: { order: Order; delivery: DeliveryRecord }[] = [];
  const allPayments: { order: Order; payment: PaymentRecord }[] = [];

  orders.forEach((o) => {
    o.deliveries.forEach((d) => allDeliveries.push({ order: o, delivery: d }));
    o.payments.forEach((p) => allPayments.push({ order: o, payment: p }));
  });

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const qty = typeof delQty === 'number' ? delQty : Number(delQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Please enter a valid, positive dispatch quantity (greater than zero).');
      return;
    }

    const invoiceNo = delInvoice.trim();
    if (!invoiceNo) {
      setFormError('Please enter an invoice / gate pass number.');
      return;
    }

    if (remainingDeliveryMeters > 0 && qty > remainingDeliveryMeters) {
      setFormError(
        `Dispatch quantity (${qty.toLocaleString()}m) exceeds remaining unfulfilled volume (${remainingDeliveryMeters.toLocaleString()}m).`
      );
      return;
    }

    if (
      selectedOrder?.deliveries.some(
        (d) => d.invoiceNumber.trim().toLowerCase() === invoiceNo.toLowerCase()
      )
    ) {
      setFormError(`Invoice #${invoiceNo} has already been recorded for this order.`);
      return;
    }

    let finalInvoiceAmount: number | undefined;
    if (delInvoiceAmount !== '') {
      const enteredAmount =
        typeof delInvoiceAmount === 'number' ? delInvoiceAmount : Number(delInvoiceAmount);
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
        setFormError('Please enter a valid, positive invoice amount (greater than zero).');
        return;
      }
      finalInvoiceAmount = enteredAmount;
    } else {
      const derived = selectedOrder?.quotation?.pricePerUnit
        ? +(qty * selectedOrder.quotation.pricePerUnit).toFixed(2)
        : undefined;
      if (!derived || !Number.isFinite(derived) || derived <= 0) {
        setFormError(
          'Please enter a positive invoice amount or ensure order quotation rate is available.'
        );
        return;
      }
      finalInvoiceAmount = derived;
    }

    const orderTotal = selectedOrder?.quotation?.totalPrice || 0;
    if (orderTotal > 0 && previousInvoicedAmount + finalInvoiceAmount > orderTotal) {
      const remainingVal = Math.max(0, orderTotal - previousInvoicedAmount);
      setFormError(
        `Invoice amount (₹${finalInvoiceAmount.toLocaleString()}) exceeds remaining order value (₹${remainingVal.toLocaleString()}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onRecordDelivery(targetOrderId, {
        orderId: targetOrderId,
        date: new Date().toISOString().split('T')[0],
        quantityMeters: qty,
        invoiceNumber: invoiceNo,
        carrier: delCarrier.trim() || 'Standard Carrier',
        deliveryType:
          selectedOrder && qty >= selectedOrder.quantityMeters ? 'full' : 'partial',
        status: 'delivered',
        invoiceAmount: finalInvoiceAmount,
      });

      setShowAddModal(false);
      if (!isDemo) {
        setDelQty('');
        setDelInvoice('');
        setDelCarrier('');
        setDelInvoiceAmount('');
      }
    } catch (err: any) {
      const msg =
        err?.data?.error?.message ||
        err?.data?.message ||
        err?.message ||
        'Server error recording delivery.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setFormError('Please enter a positive payment amount.');
      return;
    }

    const ref = payRef.trim();
    if (!ref) {
      setFormError('Please enter a payment reference / UTR number.');
      return;
    }

    if (selectedMilestone && selectedMilestone.dueAmount !== undefined) {
      if (selectedMilestone.dueAmount <= 0) {
        setFormError(`Milestone '${selectedMilestone.name}' is already fully paid.`);
        return;
      }
      if (amount > selectedMilestone.dueAmount) {
        setFormError(
          `Payment amount ($${amount.toLocaleString()}) exceeds outstanding balance of $${selectedMilestone.dueAmount.toLocaleString()} for '${selectedMilestone.name}'.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onRecordPayment(targetOrderId, {
        orderId: targetOrderId,
        invoiceNumber: ref,
        amount,
        date: new Date().toISOString().split('T')[0],
        type:
          (selectedMilestone?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_') as any) ||
          'advance_30',
        status: 'received',
        milestoneIndex: selectedMilestone?.index ?? selectedMilestoneIndex,
        ref,
        method: payMethod,
      });

      setShowAddModal(false);
      if (!isDemo) {
        setPayAmount('');
        setPayRef('');
      }
    } catch (err: any) {
      const msg =
        err?.data?.error?.message ||
        err?.data?.message ||
        err?.message ||
        'Server error recording payment receipt.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDeliveredMeters = allDeliveries.reduce((s, d) => s + d.delivery.quantityMeters, 0);

  const totalPaidRevenue = useMemo(() => {
    let sum = 0;
    for (const o of orders) {
      if (o.financials?.totalPaidPaise != null) {
        sum += o.financials.totalPaidPaise / 100;
      } else {
        sum += o.payments.filter((p) => p.status === 'received').reduce((acc, p) => acc + p.amount, 0);
      }
    }
    return sum;
  }, [orders]);

  const totalPendingBalance = useMemo(() => {
    let sum = 0;
    for (const o of orders) {
      if (o.financials?.amountDuePaise != null) {
        sum += o.financials.amountDuePaise / 100;
      } else {
        sum += o.payments
          .filter((p) => p.status !== 'received')
          .reduce((acc, p) => acc + (p.dueAmount ?? p.amount), 0);
      }
    }
    return sum;
  }, [orders]);

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
                          {delivery.invoiceNumber ? `#${delivery.invoiceNumber}` : '-'}
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
                          {payment.invoiceNumber ? `#${payment.invoiceNumber}` : '-'}
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
                          <span className={`status-dot-pill ${isReceived ? 'fulfilled' : payment.status === 'partial' ? 'warning' : 'pending'}`}>
                            {payment.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: isReceived ? '#15803d' : '#b45309', fontVariantNumeric: 'tabular-nums' }}>
                          ${payment.amount.toLocaleString()}
                        </td>
                        <td style={{ color: '#475569' }}>
                          {payment.type.replace(/_/g, ' ').toUpperCase()}
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

              {formError && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    color: '#b91c1c',
                    fontSize: 11.5,
                    marginBottom: 12,
                  }}
                >
                  {formError}
                </div>
              )}

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
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                      Dispatched Meters {remainingDeliveryMeters > 0 && <span style={{ color: '#64748b', fontWeight: 500 }}>(Remaining: {remainingDeliveryMeters.toLocaleString()} m)</span>}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={remainingDeliveryMeters > 0 ? remainingDeliveryMeters : undefined}
                      className="admin-form-input"
                      value={delQty}
                      onChange={(e) => handleQtyChange(e.target.value === '' ? '' : +e.target.value)}
                      placeholder="e.g. 500"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Invoice / Gate Pass #</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={delInvoice}
                      onChange={(e) => setDelInvoice(e.target.value)}
                      placeholder="e.g. INV-2026-0042"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                      Invoice Amount (₹) {selectedOrder?.quotation?.pricePerUnit ? (
                        <span style={{ color: '#64748b', fontWeight: 500 }}>
                          (Rate: ₹{selectedOrder.quotation.pricePerUnit}/m {remainingInvoicedAmount > 0 ? `• Max: ₹${remainingInvoicedAmount.toLocaleString()}` : ''})
                        </span>
                      ) : null}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remainingInvoicedAmount > 0 ? remainingInvoicedAmount : undefined}
                      className="admin-form-input"
                      value={delInvoiceAmount}
                      onChange={(e) => setDelInvoiceAmount(e.target.value === '' ? '' : +e.target.value)}
                      placeholder="e.g. 15000"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Carrier & Tracking Details</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={delCarrier}
                      onChange={(e) => setDelCarrier(e.target.value)}
                      placeholder="e.g. VRL Logistics Freight"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="submit" className="admin-btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Recording...' : 'Record Dispatch'}
                    </button>
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
                      disabled={isSubmitting}
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
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Payment Milestone</label>
                    <select
                      className="admin-form-input"
                      value={selectedMilestoneIndex}
                      onChange={(e) => handleMilestoneChange(+e.target.value)}
                    >
                      {milestonesList.length === 0 ? (
                        <option value={0}>No milestones found</option>
                      ) : (
                        milestonesList.map((m) => (
                          <option key={m.index} value={m.index}>
                            {m.name} - Outstanding: ${m.dueAmount.toLocaleString()} ({m.status.toUpperCase()})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                      Received Amount ($) {selectedMilestone ? (
                        <span style={{ color: '#64748b', fontWeight: 500 }}>
                          (Outstanding: ${selectedMilestone.dueAmount.toLocaleString()})
                        </span>
                      ) : null}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedMilestone?.dueAmount && selectedMilestone.dueAmount > 0 ? selectedMilestone.dueAmount : undefined}
                      className="admin-form-input"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value === '' ? '' : +e.target.value)}
                      placeholder="e.g. 5000"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Payment Reference / UTR #</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="e.g. UTR-9823471029"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Payment Method</label>
                    <select
                      className="admin-form-input"
                      value={payMethod}
                      onChange={(e: any) => setPayMethod(e.target.value)}
                    >
                      <option value="neft">NEFT / Bank Transfer</option>
                      <option value="rtgs">RTGS</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                      <option value="razorpay">Razorpay</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="submit" className="admin-btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Recording...' : 'Record Payment Receipt'}
                    </button>
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
                      disabled={isSubmitting}
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

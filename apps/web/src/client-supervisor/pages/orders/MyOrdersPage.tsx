import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatNumber, formatMetres } from '../../utils/formatters';
import { Search, PlusCircle, ArrowRight, Eye, Activity, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { useGetClientOrdersQuery } from '../../../store/api/ordersApi';
import { useGetClientProductsQuery } from '../../../store/api/catalogApi';
import { mapApiClientOrder } from '../../../utils/orderMapper';

export const MyOrdersPage: React.FC = () => {
  const { data: clientOrdersRes, isLoading, isError, error, refetch } = useGetClientOrdersQuery();
  const { data: clientProductsRes } = useGetClientProductsQuery(undefined);

  const productsMap = useMemo(() => {
    const map = new Map<string, any>();
    const raw = clientProductsRes?.data || [];
    if (Array.isArray(raw)) {
      raw.forEach((p: any) => {
        if (p.id || p._id) map.set(String(p.id || p._id), p);
      });
    }
    return map;
  }, [clientProductsRes]);

  const orders = useMemo(() => {
    const rawList = clientOrdersRes?.data || [];
    if (!Array.isArray(rawList)) return [];
    return rawList.map((ord: any) => mapApiClientOrder(ord, productsMap));
  }, [clientOrdersRes, productsMap]);
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date-desc');

  const filteredOrders = useMemo(() => {
    let list = [...orders];

    // Filter
    if (activeFilter === 'active') {
      list = list.filter((o) => o.status === 'In Production' || o.status === 'Awaiting Quotation');
    } else if (activeFilter === 'awaiting_quote') {
      list = list.filter((o) => o.status === 'Awaiting Quotation');
    } else if (activeFilter === 'in_production') {
      list = list.filter((o) => o.status === 'In Production');
    } else if (activeFilter === 'delivered') {
      list = list.filter((o) => o.status === 'Delivered');
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.productName.toLowerCase().includes(q) ||
          o.colorway.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'metres-desc') {
      list.sort((a, b) => b.orderedMetres - a.orderedMetres);
    } else if (sortBy === 'progress-desc') {
      list.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
    }

    return list;
  }, [orders, activeFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
            My Orders
          </h1>
          <p className="text-sm text-muted mt-1">
            Comprehensive archive of your ongoing textile production contracts, completed manufacturing orders, and active quotations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-muted-border bg-white text-charcoal text-xs font-bold hover:bg-ivory transition-colors flex-shrink-0"
            title="Reload orders from backend API"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Orders'}</span>
          </button>
          <Link
            to="/client/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors flex-shrink-0"
          >
            <PlusCircle size={16} />
            <span>Create New Order</span>
          </Link>
        </div>
      </div>

      {/* API Status Banners */}
      {isLoading && (
        <div className="p-4 rounded-2xl bg-ivory border border-muted-border flex items-center gap-3 text-xs text-charcoal font-semibold">
          <RefreshCw size={16} className="animate-spin text-vermilion" />
          <span>Loading client orders from live backend API...</span>
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span>Failed to load live client orders: {String((error as any)?.data?.message || (error as any)?.error || 'Network error')}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-muted-border shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: `All Orders (${orders.length})` },
              { id: 'active', label: 'Active Orders' },
              { id: 'awaiting_quote', label: 'Awaiting Quotation' },
              { id: 'in_production', label: 'In Production' },
              { id: 'delivered', label: 'Delivered' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  activeFilter === f.id
                    ? 'bg-charcoal text-white border-charcoal shadow-sm'
                    : 'bg-ivory text-muted border-muted-border hover:border-vermilion hover:text-vermilion'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order ID or fabric..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-xl border border-muted-border bg-ivory text-charcoal font-semibold focus:outline-none"
            >
              <option value="date-desc">Newest Orders First</option>
              <option value="metres-desc">Highest Quantity</option>
              <option value="progress-desc">Highest Progress</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-ivory border-b border-muted-border text-[11px] font-bold uppercase tracking-wider text-charcoal">
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Fabric Product</th>
                <th className="py-3.5 px-4">Volume</th>
                <th className="py-3.5 px-4">Order Date</th>
                <th className="py-3.5 px-4">Target Dispatch</th>
                <th className="py-3.5 px-4">Production Stage</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-border/60">
              {filteredOrders.map((order) => {
                let statusBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-bg text-success font-bold text-[11px] border border-success-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    In Production
                  </span>
                );

                if (order.status === 'Awaiting Quotation') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-bg text-warning font-bold text-[11px] border border-warning-border">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                      Awaiting Quotation
                    </span>
                  );
                } else if (order.status === 'Delivered') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ivory text-muted font-bold text-[11px] border border-muted-border">
                      Delivered
                    </span>
                  );
                }

                return (
                  <tr key={order.id} className="hover:bg-ivory/50 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-vermilion">
                      <Link to={`/client/orders/${order.id}`} className="hover:underline">
                        {order.id}
                      </Link>
                      <div className="text-[10px] text-muted font-sans font-normal">{order.category}</div>
                    </td>

                    <td className="py-4 px-4">
                      <strong className="text-charcoal block">{order.productName}</strong>
                      <span className="text-[11px] text-muted">{order.colorway}</span>
                    </td>

                    <td className="py-4 px-4">
                      <strong className="text-charcoal block">{formatNumber(order.orderedMetres)} m</strong>
                      <span className="text-[11px] text-muted">{order.producedMetres.toLocaleString()}m ({order.progressPercent}%)</span>
                    </td>

                    <td className="py-4 px-4 text-muted">{order.orderDate}</td>

                    <td className="py-4 px-4 font-bold text-charcoal">{order.expectedDelivery}</td>

                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-vermilion/10 text-vermilion font-bold text-[11px]">
                        Stage {order.currentStageNumber}: {order.currentStageName}
                      </span>
                    </td>

                    <td className="py-4 px-4">{statusBadge}</td>

                    <td className="py-4 px-4 text-right space-x-1.5">
                      <Link
                        to={`/client/orders/${order.id}`}
                        className="px-3 py-1.5 rounded-lg border border-muted-border text-xs font-bold text-charcoal hover:bg-white inline-block"
                      >
                        Details
                      </Link>
                      <Link
                        to={`/client/orders/${order.id}/tracking`}
                        className="px-3 py-1.5 rounded-lg bg-vermilion text-white text-xs font-bold shadow-sm hover:bg-vermilion-hover inline-block"
                        title="Track Production"
                      >
                        Track
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-muted text-xs">
            No manufacturing orders match the selected filter or search term.
          </div>
        )}
      </div>
    </div>
  );
};


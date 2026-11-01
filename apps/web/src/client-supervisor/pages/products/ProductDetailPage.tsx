import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, PlusCircle, Clock, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppSelector } from '../../../store/hooks';
import {
  useGetProductByIdQuery,
  useGetClientProductByIdQuery,
  useGetProductsQuery,
  useGetClientProductsQuery,
} from '../../../store/api/catalogApi';
import { mapApiProductToProduct } from './productMapper';
import { formatNumber } from '../../utils/formatters';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const realm = useAppSelector((state) => state.auth?.realm) || 'client';
  const isClient = realm === 'client';

  // Fetch individual product by ID
  const clientDetailQuery = useGetClientProductByIdQuery(id || '', { skip: !isClient || !id });
  const adminDetailQuery = useGetProductByIdQuery(id || '', { skip: isClient || !id });
  const detailQuery = isClient ? clientDetailQuery : adminDetailQuery;

  // Also query list cache as secondary source
  const clientListQuery = useGetClientProductsQuery(undefined, { skip: !isClient });
  const adminListQuery = useGetProductsQuery(undefined, { skip: isClient });
  const listQuery = isClient ? clientListQuery : adminListQuery;

  const rawItem = useMemo(() => {
    // 1. Check direct detail query response
    const detailData = detailQuery.data as any;
    if (detailData?.data) {
      return detailData.data;
    }
    if (detailData && (detailData.id || detailData._id)) {
      return detailData;
    }

    // 2. Check list query response / cache
    const list = Array.isArray(listQuery.data)
      ? listQuery.data
      : Array.isArray(listQuery.data?.data)
      ? listQuery.data.data
      : [];
    const found = list.find((item: any) => String(item.id || item._id) === id);
    if (found) {
      return found;
    }

    return null;
  }, [detailQuery.data, listQuery.data, id]);

  const product = useMemo(() => {
    return rawItem ? mapApiProductToProduct(rawItem) : null;
  }, [rawItem]);

  const isLoading = (detailQuery.isLoading || listQuery.isLoading) && !product;
  const isError = detailQuery.isError && listQuery.isError && !product;

  const getErrorMessage = (err: any): string => {
    if (!err) return 'Product not found or unavailable';
    if (typeof err === 'string') return err;
    if (err.data?.message) return err.data.message;
    if (err.error) return err.error;
    if (err.message) return err.message;
    return 'Unable to fetch product details from the mill server.';
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 bg-charcoal/10 rounded w-48" />
        <div className="bg-white rounded-2xl border border-muted-border shadow-card p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-4">
              <div className="h-72 bg-charcoal/10 rounded-2xl" />
              <div className="h-28 bg-ivory rounded-xl border border-muted-border" />
            </div>
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <div className="h-3 bg-charcoal/10 rounded w-32" />
                <div className="h-7 bg-charcoal/15 rounded w-3/4" />
                <div className="h-4 bg-charcoal/10 rounded w-full" />
              </div>
              <div className="h-32 bg-ivory rounded-xl" />
              <div className="h-12 bg-charcoal/10 rounded-xl w-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-xl font-bold text-charcoal">Failed to Load Product</h2>
        <p className="text-xs text-red-600 leading-relaxed">
          {getErrorMessage(detailQuery.error || listQuery.error)}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              detailQuery.refetch();
              listQuery.refetch();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-vermilion text-white shadow-vermilion hover:bg-vermilion-hover transition-colors"
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
          <Link
            to="/client/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-ivory border border-muted-border text-charcoal hover:bg-white transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Catalogue</span>
          </Link>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!product) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-charcoal">Fabric Formulation Not Found</h2>
        <p className="text-sm text-muted">The requested fabric formulation ID could not be located in the mill catalogue.</p>
        <Link to="/client/products" className="inline-flex items-center gap-2 text-sm font-bold text-vermilion">
          <ArrowLeft size={16} />
          <span>Return to Product Catalogue</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <Link
          to="/client/products"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-charcoal transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Product Catalogue</span>
        </Link>
      </div>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl border border-muted-border shadow-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8">
          {/* Left: Image & Lead Time (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative h-72 rounded-2xl overflow-hidden shadow-sm bg-ivory">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-charcoal/85 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider">
                {product.category}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-ivory border border-muted-border space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Standard Lead Time & Price Index
              </div>
              <div className="text-lg font-extrabold text-charcoal">
                {product.basePriceRange}
              </div>
              <div className="text-xs text-muted flex items-center gap-1.5">
                <Clock size={13} className="text-vermilion" />
                <span>Production Cycle: <strong>{product.leadTimeWeeks}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Technical Details & Ordering (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <span className="text-xs font-mono font-bold text-vermilion">{product.id}</span>
              <h1 className="text-2xl font-extrabold text-charcoal mt-1">{product.name}</h1>
              <p className="text-sm text-muted mt-2 leading-relaxed">{product.description}</p>
            </div>

            {/* Key Engineered Properties */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal mb-3">
                Key Engineered Properties
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-charcoal">
                    <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Approved Colorways */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal mb-2.5">
                Standard Lab Shade Approvals
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg bg-ivory border border-muted-border text-xs font-medium text-charcoal"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="pt-4 border-t border-muted-border flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/client/orders/new?productId=${product.id}`)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-vermilion text-white text-sm font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors"
              >
                <PlusCircle size={18} />
                <span>Configure Manufacturing Order</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Technical Datasheet Table */}
        <div className="border-t border-muted-border p-6 lg:p-8 bg-ivory/50">
          <h3 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
            <Award size={18} className="text-vermilion" />
            <span>Mill Technical Datasheet</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white border border-muted-border text-xs">
            <div>
              <span className="text-muted block text-[11px]">Yarn Count</span>
              <strong className="text-charcoal font-bold text-sm">{product.yarnCount}</strong>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Construction</span>
              <strong className="text-charcoal font-bold text-sm">{product.construction}</strong>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Finished Width</span>
              <strong className="text-charcoal font-bold text-sm">{product.widthInches}" ({product.widthCm}cm)</strong>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Minimum Order</span>
              <strong className="text-charcoal font-bold text-sm">{formatNumber(product.moq)} units</strong>
            </div>
          </div>
        </div>

        {/* Verified Production Routing Stages (if present in product schema) */}
        {product.routing && product.routing.length > 0 && (
          <div className="border-t border-muted-border p-6 lg:p-8 bg-white">
            <h3 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
              <Clock size={18} className="text-vermilion" />
              <span>Verified Mill Routing & Production Cycle Stages</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-muted-border rounded-xl overflow-hidden">
                <thead className="bg-ivory text-muted uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Step</th>
                    <th className="py-2.5 px-4 font-bold">Production Stage</th>
                    <th className="py-2.5 px-4 font-bold">Standard Minutes / Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-border">
                  {product.routing.map((step, idx) => (
                    <tr key={idx} className="hover:bg-ivory/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-vermilion">#{step.seq}</td>
                      <td className="py-2.5 px-4 font-medium text-charcoal">
                        {step.stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-charcoal">{step.stdMinPerUnit} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

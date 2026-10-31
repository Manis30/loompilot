import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, CheckCircle2, PlusCircle, ShieldCheck, Clock, Award } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { products } = useApp();
  const navigate = useNavigate();

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-charcoal">Fabric Formulation Not Found</h2>
        <p className="text-sm text-muted">The requested fabric formulation ID could not be located.</p>
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
              <span className="text-muted block text-[11px]">Construction (EPI x PPI)</span>
              <strong className="text-charcoal font-bold text-sm">{product.construction}</strong>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Finished Width</span>
              <strong className="text-charcoal font-bold text-sm">{product.widthInches}" ({product.widthCm}cm)</strong>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Minimum Order Yardage</span>
              <strong className="text-charcoal font-bold text-sm">{formatNumber(product.moq)} metres</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


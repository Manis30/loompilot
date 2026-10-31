import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Search, PlusCircle, ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

export const ProductCataloguePage: React.FC = () => {
  const { products } = useApp();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'All Fabrics' },
    { id: 'cotton', label: 'Cotton Fabrics' },
    { id: 'woven', label: 'Woven & Denim' },
    { id: 'blended', label: 'Blended Suiting' },
    { id: 'knitted', label: 'Knitted Fabrics' },
    { id: 'poly', label: 'Polyester Fabrics' },
    { id: 'custom', label: 'Custom Manufacturing' },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === 'all' || p.categoryCode === activeCategory;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.yarnCount.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.weave.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p.gsm).includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
            Textile Product Catalogue
          </h1>
          <p className="text-sm text-muted mt-1">
            Explore mill-manufactured fabrics, industrial weaves, and custom engineered textile blends available for bulk manufacturing contracts.
          </p>
        </div>

        <Link
          to="/client/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors flex-shrink-0"
        >
          <PlusCircle size={16} />
          <span>Request Custom Weave</span>
        </Link>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              activeCategory === cat.id
                ? 'bg-charcoal text-white border-charcoal shadow-sm'
                : 'bg-white text-muted border-muted-border hover:border-vermilion hover:text-vermilion'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search & Results Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-muted-border shadow-card">
        <div className="relative max-w-sm w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by fabric name, weave, or GSM..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
          />
        </div>

        <div className="text-xs text-muted">
          Showing <strong className="text-charcoal font-bold">{filteredProducts.length}</strong> verified mill formulations
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-2xl border border-muted-border shadow-card overflow-hidden flex flex-col group hover:-translate-y-1 hover:shadow-card-hover transition-all"
          >
            {/* Image Preview */}
            <div className="relative h-48 bg-ivory overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-charcoal/85 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-wider">
                {product.category}
              </span>
            </div>

            {/* Content Body */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-charcoal leading-snug group-hover:text-vermilion transition-colors">
                  {product.name}
                </h3>
                <p className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Technical Spec Mini Table */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-ivory border border-muted-border text-[11px]">
                <div>
                  <span className="text-muted block">GSM</span>
                  <strong className="text-charcoal font-bold">{product.gsm} GSM</strong>
                </div>
                <div>
                  <span className="text-muted block">Weave / Knit</span>
                  <strong className="text-charcoal font-bold truncate block">{product.weave}</strong>
                </div>
                <div>
                  <span className="text-muted block">Finished Width</span>
                  <strong className="text-charcoal font-bold">{product.widthInches}" ({product.widthCm}cm)</strong>
                </div>
                <div>
                  <span className="text-muted block">Minimum Order</span>
                  <strong className="text-charcoal font-bold">{formatNumber(product.moq)} m</strong>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex gap-2 pt-1">
                <Link
                  to={`/client/products/${product.id}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-ivory hover:bg-white text-charcoal border border-muted-border text-xs font-bold transition-colors text-center inline-flex items-center justify-center gap-1.5"
                >
                  <Eye size={14} />
                  <span>View Specs</span>
                </Link>

                <button
                  onClick={() => navigate(`/client/orders/new?productId=${product.id}`)}
                  className="flex-1 py-2 px-3 rounded-xl bg-vermilion hover:bg-vermilion-hover text-white text-xs font-bold shadow-vermilion transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>Request Quote</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-muted-border p-6 space-y-3">
          <p className="text-sm font-bold text-charcoal">No fabrics match your search criteria</p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Try adjusting your GSM or weave search keywords, or submit a custom textile R&D request.
          </p>
          <button
            onClick={() => {
              setActiveCategory('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-ivory border border-muted-border text-charcoal hover:bg-white"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};


import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Search, MapPin, RefreshCw } from 'lucide-react';
import { useGetMaterialsQuery } from '../../../store/api/catalogApi';
import { mapApiMaterialToRawMaterial } from './materialMapper';
import { RawMaterial } from '../../types/supervisor';

export const SupervisorMaterialsPage: React.FC = () => {
  const {
    data: materialsResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetMaterialsQuery(undefined);

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Cotton Yarns', 'Warp Beams', 'Chemicals & Dyes', 'Synthetic & Blends'];

  // Extract raw materials array from RTK Query response
  const rawMaterials: any[] = useMemo(() => {
    if (!materialsResponse) return [];
    if (Array.isArray(materialsResponse)) return materialsResponse;
    if (Array.isArray(materialsResponse.data)) return materialsResponse.data;
    return [];
  }, [materialsResponse]);

  // Map API records to supervisor UI RawMaterial shape
  const materials: RawMaterial[] = useMemo(() => {
    return rawMaterials.map(mapApiMaterialToRawMaterial);
  }, [rawMaterials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesCat = categoryFilter === 'All' || m.category === categoryFilter;
      const matchesSearch =
        !searchQuery ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.storageLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.composition.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [materials, categoryFilter, searchQuery]);

  const lowStockCount = useMemo(() => {
    return materials.filter((m) => m.status === 'Low Stock').length;
  }, [materials]);

  const getErrorMessage = (err: any): string => {
    if (!err) return 'Failed to connect to materials inventory service';
    if (typeof err === 'string') return err;
    if (err.data?.message) return err.data.message;
    if (err.error) return err.error;
    if (err.message) return err.message;
    return 'Unable to fetch raw materials. Please verify server connectivity or user authentication.';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#EAE2D9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#252622]">
            Raw Materials &amp; Yarn Lots
          </h1>
          <p className="text-xs text-gray-500">
            Warp beams, yarn spinning lots, starch sizing chemicals &amp; warehouse inventory
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EAE2D9] bg-white text-gray-600 hover:text-[#252622] text-xs font-bold transition-colors disabled:opacity-50"
            title="Refresh warehouse inventory"
          >
            <RefreshCw size={13} className={isLoading || isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {!isLoading && !isError && lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E65338]/10 border border-[#E65338]/20 text-[#E65338] text-xs font-bold">
              <AlertTriangle size={15} />
              <span>{lowStockCount} Low Stock Batch Alert</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-[#252622] text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-[#EAE2D9] hover:bg-[#FBF6F0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search materials, lot IDs, locations..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#EAE2D9] bg-white focus:outline-none focus:border-[#E65338]"
          />
        </div>
      </div>

      {/* Error Banner */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold">Failed to load materials inventory</h4>
              <p className="text-xs text-red-700 mt-1 max-w-xl">{getErrorMessage(error)}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors flex-shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Materials Table */}
      <div className="bg-white rounded-2xl border border-[#EAE2D9] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FBF6F0] border-b border-[#EAE2D9] text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Material / Lot ID</th>
                <th className="py-3.5 px-4">Category &amp; Specs</th>
                <th className="py-3.5 px-4">Warehouse Bay</th>
                <th className="py-3.5 px-4">Allocated Order</th>
                <th className="py-3.5 px-4">In-Stock Quantity</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE2D9]/60">
              {/* Loading Skeleton Rows */}
              {isLoading &&
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 rounded w-28 mb-1.5" />
                      <div className="h-3 bg-gray-100 rounded w-40" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                      <div className="h-3 bg-gray-100 rounded w-32" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 rounded w-28" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-gray-200 rounded w-16 mb-1" />
                      <div className="h-3 bg-gray-100 rounded w-8" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 bg-gray-200 rounded-full w-20" />
                    </td>
                  </tr>
                ))}

              {/* Live Materials Rows */}
              {!isLoading &&
                filteredMaterials.map((mat) => {
                  const isLow = mat.status === 'Low Stock';
                  return (
                    <tr key={mat.id} className="hover:bg-[#FBF6F0]/40 transition-colors">
                      <td className="py-4 px-4 font-mono">
                        <div className="font-extrabold text-[#252622]">{mat.id}</div>
                        <div className="text-[11px] text-gray-500 font-sans">{mat.name}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-700">{mat.category}</span>
                        <div className="text-[10px] text-gray-500">{mat.composition}</div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-gray-700">
                          <MapPin size={13} className="text-[#E65338]" />
                          <span>{mat.storageLocation}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-[#E65338] bg-[#E65338]/10 px-2 py-0.5 rounded">
                          {mat.allocatedOrder}
                        </span>
                        <div className="text-[10px] text-gray-500 mt-0.5">{mat.orderName}</div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-mono font-extrabold text-[#252622] text-sm">
                          {mat.inStockQty.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-500">{mat.unit}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isLow
                              ? 'bg-[#E65338]/10 text-[#E65338] border border-[#E65338]/20'
                              : mat.status === 'Ready for Loom'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-[#20845A]/10 text-[#20845A] border border-[#20845A]/20'
                          }`}
                        >
                          {isLow ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                          <span>{mat.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {/* Empty Filter Results */}
          {!isLoading && !isError && filteredMaterials.length === 0 && materials.length > 0 && (
            <div className="text-center py-12 px-4 space-y-2">
              <p className="text-sm font-bold text-gray-700">No materials match your search filter</p>
              <p className="text-xs text-gray-500">
                Try adjusting your search query or reset the category filter.
              </p>
              <button
                onClick={() => {
                  setCategoryFilter('All');
                  setSearchQuery('');
                }}
                className="mt-2 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#FBF6F0] border border-[#EAE2D9] text-[#252622] hover:bg-white transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Empty Database Results */}
          {!isLoading && !isError && materials.length === 0 && (
            <div className="text-center py-16 px-4 space-y-3">
              <p className="text-sm font-bold text-gray-700">No Raw Materials Found</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No material inventory items exist in this tenant's database records.
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#252622] text-white hover:bg-black transition-colors"
              >
                Reload Materials
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Cpu, Users, Building, Package } from 'lucide-react';

export const ResourcesCatalogModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'materials' | 'machines' | 'workers' | 'suppliers'>('materials');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header Banner */}
      <div style={{
        background: 'var(--c-card-white)',
        borderRadius: 16,
        padding: '12px 18px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeft: '4px solid var(--c-terracotta)'
      }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            Plant Resources, Machinery & Materials Ledger
          </h3>
          <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>
            Central inventory used by the <strong>Feasibility Agent</strong> to compute process capacity, free machines, and stock shortfall dates.
          </p>
        </div>
        <span className="status-pill status-feasible">Live Capacity</span>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className={`view-tab-btn ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          <Package size={13} />
          <span>Raw Materials Ledger</span>
        </button>
        <button className={`view-tab-btn ${activeTab === 'machines' ? 'active' : ''}`} onClick={() => setActiveTab('machines')}>
          <Cpu size={13} />
          <span>Weaving Looms & Machinery</span>
        </button>
        <button className={`view-tab-btn ${activeTab === 'workers' ? 'active' : ''}`} onClick={() => setActiveTab('workers')}>
          <Users size={13} />
          <span>Weavers & Skilled Labor</span>
        </button>
        <button className={`view-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>
          <Building size={13} />
          <span>Suppliers & Spot Market Sources</span>
        </button>
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="modern-table-card">
          <div className="modern-table-toolbar">
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Raw Materials Stock Ledger &amp; Reservations</h4>
          </div>
          <div className="modern-data-table-wrapper">
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th>Material Item</th>
                  <th style={{ textAlign: 'right' }}>Total In Stock</th>
                  <th>Reserved for Orders</th>
                  <th>Free Available Stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Market Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr className="is-selected">
                  <td style={{ fontWeight: 700, color: '#111827' }}>Cotton Fabric (Greige 40s)</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>2,000 m</td>
                  <td style={{ color: '#d97706' }}>1,400 m (TX-1024)</td>
                  <td style={{ color: '#dc2626', fontWeight: 800 }}>600 m</td>
                  <td>
                    <span className="status-dot-pill failed">
                      SHORTFALL
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹120 / m</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#111827' }}>Cotton Yarn 40s Combed</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>520 kg</td>
                  <td style={{ color: '#d97706' }}>500 kg (TX-1024)</td>
                  <td style={{ color: '#16a34a', fontWeight: 800 }}>20 kg</td>
                  <td>
                    <span className="status-dot-pill fulfilled">
                      SUFFICIENT
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹240 / kg</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: '#111827' }}>Reactive Eco-Dyes &amp; Chemicals</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>300 kg</td>
                  <td style={{ color: '#d97706' }}>350 kg (TX-1025)</td>
                  <td style={{ color: '#dc2626', fontWeight: 800 }}>50 kg</td>
                  <td>
                    <span className="status-dot-pill pending">
                      LOW STOCK
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹180 / kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Machinery Tab */}
      {activeTab === 'machines' && (
        <div style={{
          background: 'var(--c-card-white)',
          borderRadius: 16,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12
        }}>
          <div style={{ background: '#faf6f4', padding: 12, borderRadius: 12, border: '1px solid #ebdcd3' }}>
            <strong style={{ fontSize: 12, color: 'var(--c-text-primary)' }}>Airjet Weaving Shed A (Looms 1-12)</strong>
            <p style={{ fontSize: 10.5, color: 'var(--c-text-muted)', marginTop: 2 }}>High-speed poplin & twill weaving</p>
            <div style={{ fontSize: 11, marginTop: 8 }}>
              Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>11 / 12 Operational (92%)</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--c-text-secondary)', marginTop: 2 }}>Speed: 850 RPM &bull; Capacity: 65m/hour/loom</div>
          </div>

          <div style={{ background: '#faf6f4', padding: 12, borderRadius: 12, border: '1px solid #ebdcd3' }}>
            <strong style={{ fontSize: 12, color: 'var(--c-text-primary)' }}>Rapier Loom Shed B (Looms 13-24)</strong>
            <p style={{ fontSize: 10.5, color: 'var(--c-text-muted)', marginTop: 2 }}>Heavy denim & jacquard suiting</p>
            <div style={{ fontSize: 11, marginTop: 8 }}>
              Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>10 / 12 Operational (83%)</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--c-text-secondary)', marginTop: 2 }}>Speed: 550 RPM &bull; Capacity: 40m/hour/loom</div>
          </div>
        </div>
      )}

      {/* Workers Tab */}
      {activeTab === 'workers' && (
        <div style={{
          background: 'var(--c-card-white)',
          borderRadius: 16,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          fontSize: 11
        }}>
          <h4 style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--c-text-primary)', marginBottom: 8 }}>Weaver Staffing & Attendance Summary</h4>
          <p style={{ color: 'var(--c-text-secondary)', lineHeight: 1.4 }}>
            Active Workforce: <strong>48 Total Weavers & Helpers</strong> across 2 rotational 10-hour shifts.<br/>
            30-Day Rolling Attendance: <strong>93.4%</strong> (Incorporated into Feasibility capacity safety buffers).
          </p>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div style={{
          background: 'var(--c-card-white)',
          borderRadius: 16,
          padding: 16,
          boxShadow: 'var(--shadow-card)',
          fontSize: 11,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 10
        }}>
          <div style={{ background: '#faf6f4', padding: 12, borderRadius: 10, border: '1px solid #ebdcd3' }}>
            <strong style={{ fontSize: 12 }}>Vardhman Textiles Ltd. (Ludhiana)</strong>
            <div style={{ color: 'var(--c-text-muted)', marginTop: 2 }}>Lead time: 2 days (Spot Dispatch) &bull; Quality Rating: 98%</div>
            <div style={{ marginTop: 4, fontWeight: 700, color: 'var(--c-terracotta)' }}>Primary source for 10s & 40s Ring Spun Yarn</div>
          </div>

          <div style={{ background: '#faf6f4', padding: 12, borderRadius: 10, border: '1px solid #ebdcd3' }}>
            <strong style={{ fontSize: 12 }}>Atul Dye Chemicals (Gujarat)</strong>
            <div style={{ color: 'var(--c-text-muted)', marginTop: 2 }}>Lead time: 3 days &bull; Quality Rating: 99%</div>
            <div style={{ marginTop: 4, fontWeight: 700, color: 'var(--c-terracotta)' }}>OEKO-TEX Class 1 Eco-Dyes & Indigo</div>
          </div>
        </div>
      )}
    </div>
  );
};

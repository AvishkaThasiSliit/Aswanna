import React from 'react';
import { Truck, Store, Fuel } from 'lucide-react';
import advisoryData from '../data/advisory_data.json';

export default function LogisticsPage() {
  const { vehicles, economic_centres } = advisoryData;

  return (
    <div>
      <div className="page-hero-banner">
        <div className="page-title-wrap">
          <div className="hero-icon-pill" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Truck size={24} />
          </div>
          <div>
            <h2>Dedicated Economic Centres & Logistics Directory</h2>
            <p>Wholesale Trading Centres, Transport Fleets, and Practical Fuel Economy Specifications.</p>
          </div>
        </div>

        <div className="hero-tag-pill" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
          <Store size={15} />
          <span>14 Economic Centres • 8 Transport Vehicles</span>
        </div>
      </div>

      <div className="standalone-view-card">
        <h3>Major Dedicated Economic Centres in Sri Lanka</h3>
        <div className="directory-cards-grid">
          {economic_centres.map(ec => (
            <div key={ec.name} className="directory-card">
              <div className="directory-card-head">
                <h4>{ec.name}</h4>
                <span className="district-badge">{ec.district}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b' }}>
                <strong>Hub Importance:</strong> {ec.role}
              </p>
              <div className="directory-features-list">
                <span className="feature-pill">Wholesale Auctions</span>
                <span className="feature-pill">Commission Traders</span>
                <span className="feature-pill">Weighbridge</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="standalone-view-card">
        <h3>Farmer Vehicle Fleet & Practical Fuel Economy Matrix</h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: 12 }}>
          Benchmarked practical fuel consumptions and typical transport cargo capacities across agrarian corridors.
        </p>

        <div className="data-table-container">
          <table>
            <thead>
              <tr>
                <th>Vehicle Model</th>
                <th>Fuel Type</th>
                <th>Practical Economy</th>
                <th>Max Payload</th>
                <th>Typical Cargo Usage</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong></td>
                  <td>
                    <span
                      className="stat-metric-pill"
                      style={{
                        background: v.fuel_type === 'Diesel' ? '#eff6ff' : '#fffbeb',
                        borderColor: v.fuel_type === 'Diesel' ? '#bfdbfe' : '#fde68a',
                        color: v.fuel_type === 'Diesel' ? '#1e40af' : '#92400e'
                      }}
                    >
                      <Fuel size={12} />
                      {v.fuel_type}
                    </span>
                  </td>
                  <td><strong>{v.practical_fuel_economy}</strong></td>
                  <td>{v.payload_kg.toLocaleString()} kg</td>
                  <td style={{ color: '#64748b' }}>{v.typical_use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

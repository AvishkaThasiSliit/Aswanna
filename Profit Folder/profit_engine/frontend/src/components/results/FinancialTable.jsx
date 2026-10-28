import React from 'react';

export default function FinancialTable({ rows = [], totalCost = 0 }) {
  return (
    <div className="financial-statement-card">
      <div className="card-head">
        <h4>Detailed Production & Freight Accounting Statement</h4>
        <span className="tag">Audit Statement</span>
      </div>

      <div className="table-responsive-box">
        <table className="financial-table">
          <thead>
            <tr>
              <th>Operational Expenditure Head</th>
              <th>Normative Field Basis & Rate</th>
              <th style={{ textAlign: 'right' }}>Expenditure (LKR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <strong>{row.item}</strong>
                </td>
                <td style={{ color: '#64748b' }}>
                  {row.rate || row.unit || 'Standard normative rate'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  LKR {Math.round(row.cost || row.amount || 0).toLocaleString()}
                </td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total Comprehensive Cultivation Outlay</td>
              <td style={{ color: '#64748b' }}>Includes on-farm production and logistics</td>
              <td style={{ textAlign: 'right', color: '#047857', fontWeight: 700, fontSize: 15 }}>
                LKR {Math.round(totalCost).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

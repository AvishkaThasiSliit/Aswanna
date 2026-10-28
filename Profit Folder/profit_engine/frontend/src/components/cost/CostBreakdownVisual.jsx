import React, { useState, useMemo } from 'react';
import { PieChart, Info, CheckCircle2 } from 'lucide-react';

export default function CostBreakdownVisual({ result }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const breakdown = result?.cost_breakdown || [];
  const totalCost = result?.total_cost_incl_imputed || 0;
  const acreage = result?.acreage || 1.0;

  // Compute SVG Donut segments
  const donutSegments = useMemo(() => {
    let accumulated = 0;
    const totalCircumference = 2 * Math.PI * 45; // radius = 45
    return breakdown.map((item, idx) => {
      const strokeDasharray = `${(item.pct / 100) * totalCircumference} ${totalCircumference}`;
      const strokeDashoffset = -accumulated;
      accumulated += (item.pct / 100) * totalCircumference;
      return {
        ...item,
        idx,
        strokeDasharray,
        strokeDashoffset
      };
    });
  }, [breakdown]);

  const activeItem = hoveredIdx !== null ? breakdown[hoveredIdx] : null;

  // Identify dominant cost driver
  const dominantItem = breakdown.reduce((max, item) => item.pct > (max?.pct || 0) ? item : max, null);

  return (
    <div className="cost-breakdown-card">
      <div className="cost-breakdown-card-head">
        <div>
          <h3>Empirical Expenditure Breakdown (DOA Identity)</h3>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
            Audited Department of Agriculture socio-economic survey division for {result?.crop || 'selected crop'}
          </p>
        </div>
        <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
          100% Balanced Identity
        </span>
      </div>

      <div className="cost-donut-split-view">
        {/* Left: Donut Chart */}
        <div className="cost-donut-box">
          <div className="cost-donut-svg-wrapper">
            <svg viewBox="0 0 130 130" width="100%" height="100%">
              <g transform="rotate(-90 65 65)">
                {donutSegments.map((seg) => {
                  const isHovered = hoveredIdx === seg.idx;
                  return (
                    <circle
                      key={seg.idx}
                      cx="65"
                      cy="65"
                      r="45"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={isHovered ? "20" : "16"}
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      style={{
                        cursor: 'pointer',
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        opacity: hoveredIdx === null || isHovered ? 1 : 0.6
                      }}
                      onMouseEnter={() => setHoveredIdx(seg.idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />
                  );
                })}
              </g>
            </svg>

            {/* Donut Center Label */}
            <div className="cost-donut-center">
              <span className="cost-donut-center-lbl">
                {activeItem ? activeItem.name.split(' ')[0] : 'Total Cost'}
              </span>
              <span className="cost-donut-center-val">
                {activeItem 
                  ? `${activeItem.pct.toFixed(1)}%` 
                  : `Rs ${Math.round(totalCost / 1000).toLocaleString()}k`
                }
              </span>
              {activeItem && (
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  Rs {Math.round(activeItem.amount_lkr).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {breakdown.map((item, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: hoveredIdx === idx ? '#f1f5f9' : 'transparent',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '11.5px', color: '#334155', fontWeight: 500 }}>
                    {item.name.split(' ')[0]}
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>
                  {item.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Stacked Progress Bar & Table */}
        <div>
          {/* Horizontal multi-color stacked bar */}
          <div className="cost-stacked-bar">
            {breakdown.map((item, idx) => (
              <div
                key={idx}
                className="cost-stacked-bar-slice"
                style={{ 
                  width: `${item.pct}%`, 
                  background: item.color,
                  opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.5
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                title={`${item.name}: ${item.pct}% (LKR ${Math.round(item.amount_lkr).toLocaleString()})`}
              />
            ))}
          </div>

          {/* Full Financial Table */}
          <table className="cost-fin-table">
            <thead>
              <tr>
                <th>Component Category</th>
                <th>Share</th>
                <th>Total (LKR)</th>
                <th>Per Acre (LKR)</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((item, idx) => {
                const perAcreAmount = acreage > 0 ? item.amount_lkr / acreage : item.amount_lkr;
                return (
                  <tr 
                    key={idx}
                    style={{ background: hoveredIdx === idx ? '#f8fafc' : 'transparent' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{item.pct.toFixed(1)}%</td>
                    <td>LKR {Math.round(item.amount_lkr).toLocaleString()}</td>
                    <td>LKR {Math.round(perAcreAmount).toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total Cultivation Expenditure</td>
                <td>100.0%</td>
                <td>LKR {Math.round(totalCost).toLocaleString()}</td>
                <td>LKR {Math.round(acreage > 0 ? totalCost / acreage : totalCost).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* Dominant Cost Structure Callout */}
          {dominantItem && (
            <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Info size={16} color="#059669" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                <strong>Key Insight:</strong> <strong>{dominantItem.name.split('(')[0].trim()}</strong> forms the primary expenditure anchor ({dominantItem.pct.toFixed(1)}%), representing the highest sensitivity to seasonal price shifts.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

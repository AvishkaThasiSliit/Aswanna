import React, { useMemo } from 'react';
import { TrendingDown, Scale, Info } from 'lucide-react';

export default function CostYieldSensitivityChart({ result, customYield, acreage }) {
  if (!result) return null;

  const benchmarkYield = result.historical_benchmark_yield_kg_ac || 7000;
  const currentYield = customYield ? parseFloat(customYield) : benchmarkYield;
  const totalCost = result.total_cost_incl_imputed || 500000;
  const currentUnitCost = (totalCost / (currentYield * (acreage || 1.0))).toFixed(2);

  // Generate sensitivity curve points from 50% to 160% of benchmark
  const curveData = useMemo(() => {
    const points = [];
    for (let factor = 0.5; factor <= 1.6; factor += 0.1) {
      const y = benchmarkYield * factor;
      const unitCost = totalCost / (y * (acreage || 1.0));
      points.push({ factor, yieldKg: Math.round(y), unitCost: Math.round(unitCost) });
    }
    return points;
  }, [benchmarkYield, totalCost, acreage]);

  // Compute SVG coordinates
  const minCost = Math.min(...curveData.map(d => d.unitCost));
  const maxCost = Math.max(...curveData.map(d => d.unitCost));
  const svgW = 540;
  const svgH = 180;
  const padL = 50;
  const padR = 30;
  const padT = 25;
  const padB = 35;

  const getX = (idx) => padL + (idx / (curveData.length - 1)) * (svgW - padL - padR);
  const getY = (val) => padT + (1 - (val - minCost) / (maxCost - minCost || 1)) * (svgH - padT - padB);

  const pathD = curveData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.unitCost)}`).join(' ');
  const areaD = `${pathD} L ${getX(curveData.length - 1)} ${svgH - padB} L ${padL} ${svgH - padB} Z`;

  // Find position of current yield on curve
  const currentFactor = currentYield / benchmarkYield;
  const clampedFactor = Math.max(0.5, Math.min(1.6, currentFactor));
  const currentX = padL + ((clampedFactor - 0.5) / 1.1) * (svgW - padL - padR);
  const currentY = getY(parseFloat(currentUnitCost));

  return (
    <div className="cost-breakdown-card" style={{ marginTop: 0 }}>
      <div className="cost-breakdown-card-head">
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={18} color="#059669" />
            <span>Yield-to-Cost Efficiency Curve (Economies of Harvest Intensity)</span>
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
            Illustrates how intensifying harvest yield per acre drives down the unit production cost per kilogram.
          </p>
        </div>
        <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
          Current: LKR {currentUnitCost}/kg
        </span>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '200px' }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct, idx) => {
            const y = padT + pct * (svgH - padT - padB);
            return (
              <line key={idx} x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            );
          })}

          {/* Shaded Area */}
          <path d={areaD} fill="url(#curveGradient)" />

          {/* Curve Line */}
          <path d={pathD} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Curve Points */}
          {curveData.map((d, i) => (
            <circle key={i} cx={getX(i)} cy={getY(d.unitCost)} r="3" fill="#ffffff" stroke="#059669" strokeWidth="2" />
          ))}

          {/* Active Yield Marker */}
          <circle cx={currentX} cy={currentY} r="7" fill="#059669" stroke="#ffffff" strokeWidth="2" />
          <circle cx={currentX} cy={currentY} r="12" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />

          {/* Y Axis Labels */}
          <text x={padL - 8} y={padT + 5} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
            Rs {maxCost}
          </text>
          <text x={padL - 8} y={svgH - padB} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
            Rs {minCost}
          </text>

          {/* X Axis Labels */}
          <text x={padL} y={svgH - 12} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
            -50%
          </text>
          <text x={padL + 0.45 * (svgW - padL - padR)} y={svgH - 12} textAnchor="middle" fontSize="10" fill="#047857" fontWeight="700">
            DOA Benchmark ({benchmarkYield} kg)
          </text>
          <text x={svgW - padR} y={svgH - 12} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
            +60%
          </text>
        </svg>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <Info size={16} color="#059669" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
          <strong>Break-even Insight:</strong> At your selected harvest rate ({Math.round(currentYield).toLocaleString()} kg/ac), your unit production cost sits at <strong>LKR {currentUnitCost} per kg</strong>. Any farmgate market price exceeding this threshold yields net operating profit.
        </div>
      </div>
    </div>
  );
}

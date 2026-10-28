import React from 'react';
import { motion } from 'framer-motion';

export default function ProfitTrendChart({ trajectories = [] }) {
  if (!trajectories || trajectories.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>Trajectory forecast renders when live market forecast data is available.</p>
      </div>
    );
  }

  // Calculate scales
  const allValues = trajectories.flatMap(t => [t.revenue || 0, t.cost || 0]);
  const maxVal = Math.max(...allValues, 1000) * 1.15;

  const chartWidth = 560;
  const chartHeight = 180;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const getX = (idx) => paddingLeft + (idx / (trajectories.length - 1 || 1)) * plotWidth;
  const getY = (val) => paddingTop + plotHeight - (val / maxVal) * plotHeight;

  const revPoints = trajectories.map((t, i) => `${getX(i)},${getY(t.revenue || 0)}`).join(' ');
  const costPoints = trajectories.map((t, i) => `${getX(i)},${getY(t.cost || 0)}`).join(' ');

  return (
    <div className="trend-chart-card">
      <div className="chart-head-row">
        <div>
          <h4>4-Week Cumulative Profit & Trajectory Forecast</h4>
          <span className="sub">Simulated forward revenue vs cumulative operational cash burn</span>
        </div>
        <div className="legend-pills-row">
          <span className="chart-legend-pill rev">
            <span className="dot" style={{ background: '#059669' }} /> Revenue
          </span>
          <span className="chart-legend-pill cost">
            <span className="dot" style={{ background: '#e11d48' }} /> Cumulative Outlay
          </span>
        </div>
      </div>

      <div className="svg-trend-container">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((pct, idx) => {
            const y = paddingTop + plotHeight * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* Lines */}
          <motion.polyline
            fill="none"
            stroke="#059669"
            strokeWidth="3"
            points={revPoints}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8 }}
          />

          <motion.polyline
            fill="none"
            stroke="#e11d48"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            points={costPoints}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />

          {/* Data Points */}
          {trajectories.map((t, i) => (
            <g key={i}>
              <circle cx={getX(i)} cy={getY(t.revenue || 0)} r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
              <circle cx={getX(i)} cy={getY(t.cost || 0)} r="4" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />
              <text x={getX(i)} y={chartHeight - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748b">
                {t.week}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

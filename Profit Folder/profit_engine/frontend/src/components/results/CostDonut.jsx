import React, { useState, useMemo } from 'react';
import { computeDonutSegments } from '../../utils/metrics';

export default function CostDonut({ items = [], totalAmount = 0 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const segments = useMemo(() => {
    return computeDonutSegments(items, 45);
  }, [items]);

  return (
    <div className="donut-component-card">
      <div className="card-head">
        <h4>Operational Outlay Categorization</h4>
        <span className="tag">Empirical DOA Model</span>
      </div>

      <div className="donut-layout-split">
        {/* SVG Donut */}
        <div className="donut-chart-view">
          <div className="donut-svg-box">
            <svg viewBox="0 0 130 130" width="100%" height="100%">
              <g transform="rotate(-90 65 65)">
                {segments.map((seg, idx) => {
                  const isHovered = hoveredIdx === idx;
                  return (
                    <circle
                      key={idx}
                      cx="65"
                      cy="65"
                      r="45"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={isHovered ? "18" : "15"}
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{
                        cursor: 'pointer',
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        opacity: hoveredIdx !== null && !isHovered ? 0.6 : 1
                      }}
                    />
                  );
                })}
              </g>
            </svg>

            <div className="donut-center-kpi">
              <span className="center-lbl">Total Outlay</span>
              <span className="center-val">
                LKR {Math.round(totalAmount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Legend List */}
        <div className="donut-legend-wrap">
          {items.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={idx}
                className={`legend-row-item ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="legend-left">
                  <span className="color-dot" style={{ background: item.color }} />
                  <span className="item-name">{item.name}</span>
                </div>
                <div className="legend-right">
                  <span className="item-pct">{item.pct.toFixed(1)}%</span>
                  <span className="item-amount">LKR {Math.round(item.amount).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

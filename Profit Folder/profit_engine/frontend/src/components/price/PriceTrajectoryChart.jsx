import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar, Info, Layers } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { PRICE_COMMODITIES } from '../../data/priceCommoditiesData';

export default function PriceTrajectoryChart() {
  const forecastResult = usePriceStore(s => s.forecastResult);
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);

  const [hoveredPoint, setHoveredPoint] = useState(null);

  const history = forecastResult?.history?.history || [];
  const forecast = forecastResult?.forecast;

  const meta = PRICE_COMMODITIES[selectedCommodity] || {
    displayName: selectedCommodity,
    unit: '1kg'
  };

  const chartData = useMemo(() => {
    if (!history || history.length === 0 || !forecast) {
      return null;
    }

    const prices = history.map(h => h.price);
    const pointForecast = forecast.point_forecast;
    const intervalLo = forecast.interval_80?.lo ?? pointForecast * 0.85;
    const intervalHi = forecast.interval_80?.hi ?? pointForecast * 1.15;

    const allValues = [...prices, pointForecast, intervalLo, intervalHi];
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);

    const padding = (rawMax - rawMin) * 0.15 || 50;
    const minY = Math.max(0, Math.floor((rawMin - padding) / 10) * 10);
    const maxY = Math.ceil((rawMax + padding) / 10) * 10;
    const yRange = maxY - minY || 1;

    const width = 850;
    const height = 300;
    const padLeft = 65;
    const padRight = 85;
    const padTop = 30;
    const padBottom = 40;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Map history points
    const histLen = history.length;
    // Total steps = history points + horizon step
    const totalSteps = histLen + 4; // leave visual room for future forecast horizon

    const points = history.map((pt, i) => {
      const x = padLeft + (i / totalSteps) * plotW;
      const y = padTop + plotH - ((pt.price - minY) / yRange) * plotH;
      return { x, y, price: pt.price, date: pt.date, week: pt.week, isForecast: false };
    });

    const lastHist = points[points.length - 1];

    // Future target point
    const forecastX = padLeft + ((histLen + selectedHorizon - 1) / totalSteps) * plotW;
    const forecastY = padTop + plotH - ((pointForecast - minY) / yRange) * plotH;
    const loY = padTop + plotH - ((intervalLo - minY) / yRange) * plotH;
    const hiY = padTop + plotH - ((intervalHi - minY) / yRange) * plotH;

    const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const areaStr = `${points[0].x.toFixed(1)},${(padTop + plotH).toFixed(1)} ` +
      polylineStr +
      ` ${lastHist.x.toFixed(1)},${(padTop + plotH).toFixed(1)}`;

    // Conformal fan polygon: lastHist -> hiY -> loY -> lastHist
    const fanPolyStr = `${lastHist.x.toFixed(1)},${lastHist.y.toFixed(1)} ` +
      `${forecastX.toFixed(1)},${hiY.toFixed(1)} ` +
      `${forecastX.toFixed(1)},${loY.toFixed(1)}`;

    // Benchmarks
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgY = padTop + plotH - ((avgPrice - minY) / yRange) * plotH;

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      minY,
      maxY,
      avgPrice,
      avgY,
      points,
      lastHist,
      forecastPoint: {
        x: forecastX,
        y: forecastY,
        loY,
        hiY,
        price: pointForecast,
        intervalLo,
        intervalHi,
        date: forecast.target_date,
        week: forecast.target_week,
        isForecast: true
      },
      polylineStr,
      areaStr,
      fanPolyStr
    };
  }, [history, forecast, selectedHorizon]);

  if (!chartData) {
    return (
      <div className="price-chart-panel loading">
        <p>Loading genuine price trajectory data...</p>
      </div>
    );
  }

  const { 
    width, height, padLeft, padRight, padTop, padBottom, 
    minY, maxY, avgPrice, avgY, points, lastHist, 
    forecastPoint, polylineStr, areaStr, fanPolyStr 
  } = chartData;

  return (
    <div className="price-chart-panel">
      <div className="price-chart-head">
        <div>
          <div className="chart-title-row">
            <h3 className="price-chart-title">
              52-Week CBSL Price History & {selectedHorizon}-Week Conformal Forecast
            </h3>
            <span className="price-chart-badge">
              <Calendar size={12} /> Genuine CBSL Weekly Bulletins
            </span>
          </div>
          <p className="price-chart-sub">
            Continuous real weekly market price series for {meta.displayName || selectedCommodity} with shaded 80% conformal confidence fan.
          </p>
        </div>

        <div className="price-chart-legend">
          <div className="legend-item">
            <span className="legend-color-line blue" />
            <span>CBSL Recorded (52 Wks)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color-line emerald-dashed" />
            <span>AI Forecast (Point)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color-box emerald-fan" />
            <span>80% Confidence Fan</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="price-svg-wrapper">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="price-main-svg"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="histAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id="fanGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.30" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padTop + (height - padTop - padBottom) * pct;
            const val = maxY - (maxY - minY) * pct;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - 20}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="Inter, sans-serif"
                >
                  Rs {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* 52-Week Average Line */}
          <line
            x1={padLeft}
            y1={avgY}
            x2={width - 20}
            y2={avgY}
            stroke="#f59e0b"
            strokeDasharray="6 4"
            strokeWidth="1.2"
          />
          <text
            x={width - 25}
            y={avgY - 4}
            fill="#d97706"
            fontSize="9"
            textAnchor="end"
            fontWeight="600"
          >
            52-Wk Avg: Rs {avgPrice.toFixed(0)}
          </text>

          {/* Area Fill */}
          <polygon points={areaStr} fill="url(#histAreaGrad)" />

          {/* Conformal Prediction Fan */}
          <polygon points={fanPolyStr} fill="url(#fanGrad)" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />

          {/* History Polyline */}
          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylineStr}
          />

          {/* Forecast Dotted Line */}
          <line
            x1={lastHist.x}
            y1={lastHist.y}
            x2={forecastPoint.x}
            y2={forecastPoint.y}
            stroke="#059669"
            strokeWidth="3"
            strokeDasharray="5 4"
          />

          {/* 80% Interval Bracket at Target Horizon */}
          <line
            x1={forecastPoint.x}
            y1={forecastPoint.hiY}
            x2={forecastPoint.x}
            y2={forecastPoint.loY}
            stroke="#10b981"
            strokeWidth="2.5"
          />
          <circle cx={forecastPoint.x} cy={forecastPoint.hiY} r="3" fill="#10b981" />
          <circle cx={forecastPoint.x} cy={forecastPoint.loY} r="3" fill="#10b981" />

          {/* Origin and Target Highlight Circles */}
          <circle
            cx={lastHist.x}
            cy={lastHist.y}
            r="5"
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth="2.5"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredPoint(lastHist)}
          />

          <circle
            cx={forecastPoint.x}
            cy={forecastPoint.y}
            r="6"
            fill="#059669"
            stroke="#ffffff"
            strokeWidth="3"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredPoint(forecastPoint)}
          />

          {/* Interactive invisible hover targets for points */}
          {points.filter((_, idx) => idx % 3 === 0 || idx === points.length - 1).map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="8"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint(pt)}
            />
          ))}

          {/* Hover indicator line & dot */}
          {hoveredPoint && (
            <g pointerEvents="none">
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={height - padBottom}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="6"
                fill={hoveredPoint.isForecast ? '#059669' : '#2563eb'}
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Time Labels */}
          {points.length > 0 && (
            <>
              <text x={padLeft} y={height - 15} fill="#64748b" fontSize="10">
                {points[0].date} (Wk {points[0].week})
              </text>
              <text x={lastHist.x - 30} y={height - 15} fill="#2563eb" fontSize="10" fontWeight="600">
                Origin ({lastHist.date})
              </text>
              <text x={forecastPoint.x - 20} y={height - 15} fill="#059669" fontSize="10" fontWeight="700">
                Target ({forecastPoint.date})
              </text>
            </>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div 
            className="chart-hover-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`
            }}
          >
            <div className="tooltip-head">
              {hoveredPoint.isForecast ? '🎯 AI Forecast Target' : `📅 Week ${hoveredPoint.week}`}
            </div>
            <div className="tooltip-val">
              LKR {hoveredPoint.price.toFixed(2)}/{meta.unit || 'kg'}
            </div>
            <div className="tooltip-date">
              {hoveredPoint.date}
            </div>
            {hoveredPoint.isForecast && (
              <div className="tooltip-range">
                80% Range: LKR {hoveredPoint.intervalLo.toFixed(1)} – {hoveredPoint.intervalHi.toFixed(1)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="price-chart-footer-note">
        <Info size={13} color="#0284c7" />
        <span>
          Data Source: Central Bank of Sri Lanka (CBSL) & Hector Kobbekaduwa Agrarian Research and Training Institute (HARTI) verified wholesale bulletins.
        </span>
      </div>
    </div>
  );
}

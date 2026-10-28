import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { DollarSign, Minus, Coins, Percent, Package, Store, Activity, Lock } from 'lucide-react';
import AnimatedNumber from '../common/AnimatedNumber';
import ReadOnlyBadge from '../common/ReadOnlyBadge';

export default function KpiCards({ metrics, liveData }) {
  const isProfit = (metrics?.netProfit || 0) >= 0;

  // Confetti burst on profit celebration
  useEffect(() => {
    if (isProfit && metrics?.netProfit > 0) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#059669', '#34d399', '#fef08a']
        });
      } catch (e) {
        // Safe ignore
      }
    }
  }, [isProfit, metrics?.netProfit]);

  const pricing = liveData?.pricing_context || {};
  const lossPct = liveData?.production_and_logistics?.post_harvest_loss_pct ?? 8.0;

  return (
    <div className="results-kpi-section">
      {/* Primary KPI Row */}
      <div className="kpi-cards-grid main-row">
        {/* Total Revenue */}
        <div className="kpi-card revenue">
          <div className="kpi-card-head">
            <DollarSign size={18} color="#059669" />
            <span className="label">Total Gross Revenue</span>
          </div>
          <div className="kpi-card-val">
            <AnimatedNumber value={metrics?.totalRevenue} prefix="LKR " decimals={0} />
          </div>
          <div className="kpi-card-sub">
            Main Harvest: LKR {Math.round(metrics?.mainRevenue || 0).toLocaleString()}
            {metrics?.leafyEnabled && ` • Side: +LKR ${Math.round(metrics?.leafyGross || 0).toLocaleString()}`}
          </div>
        </div>

        {/* Total Outlay / Cost */}
        <div className="kpi-card costs">
          <div className="kpi-card-head">
            <Minus size={18} color="#e11d48" />
            <span className="label">Total Cultivation & Freight Outlay</span>
          </div>
          <div className="kpi-card-val">
            <AnimatedNumber value={metrics?.totalCost} prefix="LKR " decimals={0} />
          </div>
          <div className="kpi-card-sub">
            On-Farm: LKR {Math.round(metrics?.onFarmCost || 0).toLocaleString()}
            {metrics?.transportCost > 0 && ` • Freight: LKR ${Math.round(metrics?.transportCost).toLocaleString()}`}
          </div>
        </div>

        {/* Estimated Net Profit */}
        <div className={`kpi-card profit ${isProfit ? 'profit-glow' : 'loss-border'}`}>
          <div className="kpi-card-head">
            <Coins size={18} color={isProfit ? "#059669" : "#e11d48"} />
            <span className="label">Estimated Net Farmer Profit</span>
          </div>
          <div className="kpi-card-val" style={{ color: isProfit ? '#047857' : '#be123c' }}>
            <AnimatedNumber value={metrics?.netProfit} prefix="LKR " decimals={0} />
          </div>
          <div className="kpi-card-sub">
            {metrics?.profitMargin?.toFixed(1)}% Realized Operating Profit Margin
          </div>
        </div>
      </div>

      {/* Secondary Operational Metrics Bar */}
      <div className="secondary-metrics-bar">
        <div className="sec-metric-col">
          <div className="sec-metric-icon"><Percent size={15} color="#059669" /></div>
          <div className="sec-metric-content">
            <span className="lbl">Operating Margin</span>
            <span className="num">{metrics?.profitMargin?.toFixed(1)}%</span>
          </div>
        </div>

        <div className="sec-metric-col">
          <div className="sec-metric-icon"><Package size={15} color="#2563eb" /></div>
          <div className="sec-metric-content">
            <span className="lbl">Total Harvest Output</span>
            <span className="num">{Math.round(metrics?.totalHarvestKg || 0).toLocaleString()} kg</span>
          </div>
        </div>

        <div className="sec-metric-col">
          <div className="sec-metric-icon"><Store size={15} color="#d97706" /></div>
          <div className="sec-metric-content">
            <span className="lbl">Realized Selling Price</span>
            <span className="num">LKR {metrics?.avgPrice?.toFixed(2)}/kg</span>
          </div>
        </div>

        <div className="sec-metric-col">
          <div className="sec-metric-icon"><Activity size={15} color="#7c3aed" /></div>
          <div className="sec-metric-content">
            <span className="lbl">Cost per kg Produced</span>
            <span className="num">LKR {metrics?.costPerKgProduced?.toFixed(2)}/kg</span>
          </div>
        </div>
      </div>

      {/* Locked Read-Only Market Values Bar (Section 3 Requirement) */}
      <div className="readonly-market-strip">
        <div className="strip-title">
          <Lock size={13} color="#64748b" />
          <span>Live Market Benchmarks (Read-Only)</span>
        </div>

        <div className="readonly-badges-row">
          <ReadOnlyBadge
            label="Wholesale Retail Price"
            value={`LKR ${(pricing.retail_market_price_lkr_kg || metrics?.avgPrice || 0).toFixed(2)} / kg`}
            subtext="Central Bank of Sri Lanka Bulletins"
            tooltip="Live CBSL Wholesale Bulletin clearing price at destination Economic Centre"
          />

          <ReadOnlyBadge
            label="Collector Farm-Gate Price"
            value={`LKR ${(pricing.farm_gate_price_lkr_kg || 0).toFixed(2)} / kg`}
            subtext="DOA Verified District Price"
            tooltip="Official Department of Agriculture regional farm-gate collector price"
          />

          <ReadOnlyBadge
            label="Post-Harvest Handling Loss"
            value={`${lossPct.toFixed(1)}%`}
            subtext="National Produce Standard"
            tooltip="Scientific agronomic transport and handling transit loss rate"
          />
        </div>
      </div>
    </div>
  );
}

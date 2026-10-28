import React from 'react';
import { motion } from 'framer-motion';
import { Award, Store, Truck, CheckCircle2, ArrowRight } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';

export default function ChannelComparison({ metrics, liveData }) {
  const channelMode = useCalculatorStore(s => s.channelMode);
  const setChannelMode = useCalculatorStore(s => s.setChannelMode);

  const profitMode = useCalculatorStore(s => s.profitMode);

  const chA = liveData?.channel_a_buyer;
  const chB = liveData?.channel_b_market;
  const decision = liveData?.channel_decision;

  const recChannel = decision?.preferred_channel || decision?.recommended_channel || '';
  const isBRecommended = recChannel.toLowerCase().includes('economic') || recChannel.includes('Channel B') ||
    ((chB?.net_economic_profit_lkr ?? chB?.net_profit_lkr ?? 0) >= (chA?.net_economic_profit_lkr ?? chA?.net_profit_lkr ?? 0));

  const chANetProfit = profitMode === 'cash'
    ? (chA?.net_cash_profit_lkr ?? chA?.net_profit_lkr ?? 0)
    : (chA?.net_economic_profit_lkr ?? chA?.net_profit_lkr ?? 0);

  const chBNetProfit = profitMode === 'cash'
    ? (chB?.net_cash_profit_lkr ?? chB?.net_profit_lkr ?? 0)
    : (chB?.net_economic_profit_lkr ?? chB?.net_profit_lkr ?? 0);

  const chAPrice = chA?.farm_gate_price_lkr_kg ?? chA?.buyer_price_lkr_kg ?? 0;
  const chBPrice = chB?.retail_market_price_lkr_kg ?? chB?.market_price_lkr_kg ?? 0;
  const chBFreight = chB?.logistics_deduction_lkr ?? chB?.transport_cost_lkr ?? 0;

  return (
    <div className="channel-comparison-section">
      <div className="section-head-row">
        <div>
          <h3>Sales Channel Comparative Analysis</h3>
          <p>Evaluate whether selling to a farm-gate collector or transporting to an Economic Centre maximizes your take-home profit.</p>
        </div>

        {decision && (
          <div className="ai-recommendation-pill">
            <Award size={15} />
            <span>{decision.preferred_channel ? `Recommended: ${decision.preferred_channel}` : (decision.headline || "AI Channel Recommendation")}</span>
          </div>
        )}
      </div>

      <div className="channel-cards-grid">
        {/* Channel A: Farm Gate Collector */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`channel-card ${channelMode === 'buyer' ? 'active-channel' : ''}`}
          onClick={() => setChannelMode('buyer')}
          role="button"
          tabIndex={0}
        >
          {!isBRecommended && (
            <div className="recommended-ribbon">
              <Award size={12} /> Recommended Channel
            </div>
          )}

          <div className="channel-card-head">
            <div className="channel-badge a">Channel A</div>
            <h4>Farm-Gate Collector</h4>
          </div>

          <p className="channel-desc">
            Direct bulk pickup at your field gate. Zero transport logistics expense or transit handling loss.
          </p>

          <div className="channel-metrics">
            <div className="ch-metric-row">
              <span className="lbl">Farm-Gate Price:</span>
              <span className="val">LKR {Number(chAPrice).toFixed(2)}/kg</span>
            </div>
            <div className="ch-metric-row">
              <span className="lbl">Gross Sales:</span>
              <span className="val">LKR {Math.round(chA?.gross_revenue_lkr || 0).toLocaleString()}</span>
            </div>
            <div className="ch-metric-row">
              <span className="lbl">Freight Cost:</span>
              <span className="val" style={{ color: '#059669', fontWeight: 600 }}>LKR 0 (Zero Freight)</span>
            </div>
            <div className="ch-metric-row highlight">
              <span className="lbl">Channel Net Profit ({profitMode === 'cash' ? 'Cash' : 'Full Economic'}):</span>
              <span className="val" style={{ color: '#059669', fontWeight: 700 }}>
                LKR {Math.round(chANetProfit).toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`btn-select-channel ${channelMode === 'buyer' ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); setChannelMode('buyer'); }}
          >
            {channelMode === 'buyer' ? 'Viewing Active Breakdown' : 'Select Farm-Gate Channel'}
          </button>
        </motion.div>

        {/* Channel B: Dedicated Economic Centre */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`channel-card ${channelMode === 'market' ? 'active-channel' : ''}`}
          onClick={() => setChannelMode('market')}
          role="button"
          tabIndex={0}
        >
          {isBRecommended && (
            <div className="recommended-ribbon">
              <Award size={12} /> Recommended Channel
            </div>
          )}

          <div className="channel-card-head">
            <div className="channel-badge b">Channel B</div>
            <h4>Dedicated Economic Centre</h4>
          </div>

          <p className="channel-desc">
            Wholesale clearing at terminal market auctions. Substantially higher commodity prices offset fuel & freight outlays.
          </p>

          <div className="channel-metrics">
            <div className="ch-metric-row">
              <span className="lbl">Wholesale Clearing:</span>
              <span className="val">LKR {Number(chBPrice).toFixed(2)}/kg</span>
            </div>
            <div className="ch-metric-row">
              <span className="lbl">Gross Sales:</span>
              <span className="val">LKR {Math.round(chB?.gross_revenue_nominal_lkr || 0).toLocaleString()}</span>
            </div>
            <div className="ch-metric-row">
              <span className="lbl">Round-Trip Freight:</span>
              <span className="val" style={{ color: '#e11d48' }}>
                -LKR {Math.round(chBFreight).toLocaleString()}
              </span>
            </div>
            <div className="ch-metric-row highlight">
              <span className="lbl">Channel Net Profit ({profitMode === 'cash' ? 'Cash' : 'Full Economic'}):</span>
              <span className="val" style={{ color: '#047857', fontWeight: 700 }}>
                LKR {Math.round(chBNetProfit).toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`btn-select-channel ${channelMode === 'market' ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); setChannelMode('market'); }}
          >
            {channelMode === 'market' ? 'Viewing Active Breakdown' : 'Select Economic Centre Channel'}
          </button>
        </motion.div>
      </div>

      {decision && (
        <div className="decision-banner-callout">
          <CheckCircle2 size={18} color="#059669" />
          <p>{decision.recommendation_text || decision.explanation || `Recommendation: ${decision.preferred_channel} provides optimal return.`}</p>
        </div>
      )}
    </div>
  );
}

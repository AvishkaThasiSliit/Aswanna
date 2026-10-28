/**
 * Metrics & Econometric Calculations for Aswenna Profit Engine
 */

export function computeCombinedMetrics({
  liveData,
  cropData,
  acreage = 1.0,
  profitMode = 'economic',
  channelMode = 'market',
  enableLeafy = true,
  customYield = ''
}) {
  if (liveData && liveData.status === 'success') {
    const costPred = liveData.cost_prediction;
    const chB = liveData.channel_b_market;
    const chA = liveData.channel_a_buyer;
    const decision = liveData.channel_decision;
    const prod = liveData.production_and_logistics;
    const pricing = liveData.pricing_context;
    const leafy = liveData.leafy_side_income;

    // Leafy greens income
    const leafyEnabled = Boolean(enableLeafy && leafy?.enabled);
    const leafyGross = leafyEnabled ? (leafy.gross_revenue_lkr || 0) : 0;
    const leafyNet = leafyEnabled ? (leafy.net_income_lkr || 0) : 0;
    const leafyCost = leafyGross - leafyNet;

    // Active Channel (Market vs Farm-Gate Buyer)
    const isMarket = channelMode === 'market';
    const mainRevenue = isMarket ? (chB?.gross_revenue_nominal_lkr || 0) : (chA?.gross_revenue_lkr || 0);
    const totalRevenue = mainRevenue + leafyGross;

    // On-farm cultivation cost (yield & scale adjusted from backend)
    const onFarmCost = profitMode === 'economic'
      ? (costPred?.total_cost_incl_imputed ?? (costPred?.predicted_cost_incl_imputed_ac * acreage))
      : (costPred?.total_cost_excl_cash ?? (costPred?.predicted_cost_excl_cash_ac * acreage));

    // Logistics cost applies only to Economic Centre sales
    const transportCost = isMarket ? (prod?.total_logistics_lkr || 0) : 0;
    const totalCost = onFarmCost + transportCost;

    // Main crop profit + leafy greens addition
    const mainCropNet = mainRevenue - totalCost;
    const netProfit = mainCropNet + leafyNet;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const yieldPerAcre = prod?.yield_kg_per_acre || (customYield ? parseFloat(customYield) : (cropData?.typical_yield_kg_ac || 0));
    const totalHarvestKg = prod?.total_harvest_kg || (yieldPerAcre * acreage);
    const avgPrice = isMarket ? (pricing?.retail_market_price_lkr_kg || 0) : (pricing?.farm_gate_price_lkr_kg || 0);
    const breakEvenPrice = totalHarvestKg > 0 ? (totalCost / totalHarvestKg) : 0;
    const costPerKgProduced = prod?.economic_floor_kg || (totalHarvestKg > 0 ? onFarmCost / totalHarvestKg : 0);

    return {
      isOffline: false,
      totalRevenue,
      mainRevenue,
      leafyGross,
      totalCost,
      onFarmCost,
      transportCost,
      leafyCost,
      netProfit,
      mainCropNet,
      leafyNet,
      leafyEnabled,
      profitMargin,
      yieldPerAcre,
      totalHarvestKg,
      costPerKgProduced,
      avgPrice,
      breakEvenPrice,
      channelA: chA,
      channelB: chB,
      channelDecision: decision,
      donutItems: isMarket
        ? (liveData.cost_breakdown_donut || [])
        : (liveData.cost_breakdown_donut || []).filter(d => d.name !== "Transport & Market Logistics"),
      tableRows: isMarket
        ? (liveData.financial_table_rows || [])
        : (liveData.financial_table_rows || []).filter(r => !r.item.includes("Transport")),
      trajectories: liveData.profit_trajectory_weeks || [],
      recommendations: liveData.ai_recommendations || []
    };
  }

  // If liveData is not available, return null to signify offline / waiting
  return null;
}

/**
 * Helper to compute SVG donut circle segments with strokeDasharray and offset
 */
export function computeDonutSegments(items = [], radius = 45) {
  if (!items || items.length === 0) return [];
  let accumulated = 0;
  const circumference = 2 * Math.PI * radius;
  return items.map((item) => {
    const strokeDasharray = `${(item.pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -accumulated;
    accumulated += (item.pct / 100) * circumference;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset
    };
  });
}

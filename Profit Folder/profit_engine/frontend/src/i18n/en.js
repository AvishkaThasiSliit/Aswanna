/**
 * English Language Localization Strings (Sinhala/Tamil ready)
 */

export const i18n = {
  brand: {
    sinhala: "අස්වැන්න",
    english: "Aswenna",
    tagline: "Agricultural Decision Support System",
    subtagline: "Empowering Sri Lankan Smallholder Farmers with Machine Learning"
  },
  nav: {
    calculator: "Farmer Profit Calculator",
    cost: "Cultivation Cost Estimator",
    price: "Market Price Forecaster",
    logistics: "Dedicated Economic Centres",
    advisory: "Intelligence & Advisory",
    dashboard: "Dashboard Overview"
  },
  wizard: {
    title: "Farmer Profit & Harvest Decision Wizard",
    step1Title: "Choose Crop",
    step1Desc: "Select from 24 DOA-cultivated crop varieties",
    step2Title: "Select District",
    step2Desc: "Interactive agro-ecological map of Sri Lanka",
    step3Title: "Conditions & Mode",
    step3Desc: "Season, irrigation regime, and profit accounting basis",
    step4Title: "Your Field",
    step4Desc: "Interactive 3D acreage, planting rows and harvest yield",
    step5Title: "Transport Vehicle",
    step5Desc: "3D fleet selector with fuel tank & cargo bed inspection",
    step6Title: "Market Destination",
    step6Desc: "Geo-routed Dedicated Economic Centres & farm-gate",
    step7Title: "Leafy Greens",
    step7Desc: "Diversification cash-flow side crop for smallholders",
    btnBack: "Back",
    btnNext: "Next Step",
    btnCalculating: "Calculating Optimal Returns...",
    btnCalculate: "Calculate Profit & Advisory",
    btnStartOver: "Start Over / Edit Inputs",
    btnRecalculate: "Recalculate"
  },
  steps: {
    crop: {
      searchPlaceholder: "Search crops by name (e.g., Tomato, Paddy)...",
      typicalYield: "Typical DOA Yield",
      season: "Season"
    },
    district: {
      verifiedBadge: "DOA Verified Growing Zone",
      notVerifiedTooltip: "Not a verified DOA commercial cultivation area for {crop}",
      subRegionsTitle: "Agronomic Irrigation & Sub-Command Zones"
    },
    conditions: {
      seasonTitle: "Cultivation Season",
      mahaLabel: "Maha Season",
      mahaDesc: "Northeast monsoon (Oct – Mar)",
      yalaLabel: "Yala Season",
      yalaDesc: "Southwest monsoon (Apr – Sep)",
      suggestedBadge: "Suggested for current calendar",
      irrigationTitle: "Irrigation Regime",
      irrigatedLabel: "Irrigated",
      irrigatedDesc: "Canal, Mahaweli reservoir, or agro-well supply",
      rainfedLabel: "Rainfed",
      rainfedDesc: "Monsoonal rainfall dependent cultivation",
      unspecifiedLabel: "Unspecified",
      unspecifiedDesc: "Standard regional average agronomic baseline",
      costModeTitle: "Cost & Profit Mode",
      economicLabel: "Full Economic Cost",
      economicDesc: "Includes imputed value of family labour and owned land rent",
      cashLabel: "Out-of-Pocket Cash Cost",
      cashDesc: "Only direct paid expenses (seeds, fertilizer, hired labour, fuel)"
    },
    field: {
      acreageLabel: "Field Acreage (Acres)",
      acreageHint: "Drag slider to preview plant rows in 3D field (0.25 – 10.0 acres)",
      yieldLabel: "Expected Harvest Yield",
      yieldOverride: "Yield Override (kg/ac)",
      yieldReset: "Reset to DOA Benchmark",
      sacksIndicator: "Equivalent Harvest Sacks (50kg bags)"
    },
    vehicle: {
      selectorTitle: "Select Transport Vehicle",
      payloadCapacity: "Payload Capacity",
      fuelEconomy: "Practical Fuel Economy",
      fuelPriceLabel: "Fuel Price (LKR / Litre)",
      fuelType: "Fuel Type",
      typicalCargo: "Typical Cargo Usage",
      clickHotspotHint: "Click hotspots on the 3D model to inspect fuel tank or cargo bed",
      resetCamera: "Reset Camera View"
    },
    location: {
      useCurrentLocation: "Use My Current GPS Location",
      gpsActive: "GPS Location Detected",
      gpsDenied: "GPS unavailable — fallback to district center",
      economicCentresTitle: "Dedicated Economic Centres Ranked by Distance",
      recommendedBadge: "Recommended (Nearest)",
      approxRoadDistance: "Approx. Road Distance",
      travelTime: "Est. Travel Time",
      freightCostPreview: "Freight Cost Preview"
    },
    leafy: {
      toggleTitle: "Add a leafy green side crop for cash-flow?",
      toggleDesc: "Quick-growing cash crops (45-day cycles) generate interim revenue while main crop matures",
      perchesLabel: "Dedicated Side-Crop Perches (1 – 40 perches)",
      extraIncome: "Estimated Extra Net Income"
    }
  },
  results: {
    kpiRevenue: "Total Revenue",
    kpiCost: "Total Costs",
    kpiProfit: "Estimated Net Profit",
    kpiMargin: "Profit Margin",
    kpiYield: "Total Harvest Volume",
    kpiPrice: "Realized Selling Price",
    kpiCostPerKg: "Cost per kg Produced",
    readOnlyBadge: "Live Market Data",
    readOnlyTooltip: "Provided directly by live CBSL / DOA market data. Cannot be edited.",
    channelComparison: "Sales Channel Decision Analysis",
    channelA: "Farm-Gate Collector (Channel A)",
    channelB: "Dedicated Economic Centre (Channel B)",
    recommendedRibbon: "AI Recommended Channel",
    donutTitle: "Expenditure Share by Operational Component",
    trendTitle: "4-Week Profit Trajectory & Market Forecast",
    financialTableTitle: "Comprehensive Financial Statement",
    recommendationsTitle: "AI Agronomic & Market Decision Insights",
    offlineNotice: "Backend currently offline. Showing estimated offline projections."
  }
};

export default i18n;

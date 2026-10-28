#!/usr/bin/env python3
"""
Farmer Profit Advisory Engine (farmer_advisory_engine.py)
=========================================================
Enhanced Agricultural Decision Support System for Sri Lankan Smallholders.

Features:
1. Dual-Channel Profit Analysis:
   - Channel A: Farm-Gate Buyer / Collector (zero transport, buyer takes margin)
   - Channel B: Open Retail / Dedicated Economic Centre (direct market sale)
2. Precision Transport & Fuel Deduction Module:
   - Fleet models: DIMO Batti, DIMO Batta HT2, Tata Ace Gold, Suzuki Carry,
     Mahindra Bolero, Bajaj 3-Wheeler (Petrol/Diesel), Bajaj CT100 Motorbike,
     or Shared Commercial Lorry.
   - Economic Centres: Dambulla, Keppetipola, Nuwara Eliya, Thambuttegama,
     Embilipitiya, Meegoda, Narahenpita, Welisara, Veyangoda, Kandehandiya, etc.
   - Calculates exact round trips, fuel liters consumed, fuel costs, market gate fees,
     and deducts them directly from gross market profit.
3. Multi-Market Route Comparison:
   - Evaluates selling at Local District Hub vs National Mega Terminal (Dambulla) vs Colombo Terminal (Meegoda).
4. Leafy Green Supplemental Income Module ("Pala Varga" Side Income):
   - Fast-turnaround border/bund crops (Gotukola, Kankun, Mukunuwenna, Kathurumurunga, Nivithi, Sarana, Thampala)
   - Generates bi-weekly cash flow during the 3-4 month gestation period of the main crop.
5. Combined Household Portfolio Summary.
"""

from pathlib import Path
from typing import Dict, Any, Optional, List
import math
import pandas as pd
import numpy as np

class FarmerAdvisoryEngine:
    def __init__(self, workspace_dir: Optional[Path] = None):
        if workspace_dir is None:
            workspace_dir = Path(__file__).resolve().parent.parent
        self.workspace_dir = Path(workspace_dir)
        self.profit_dir = self.workspace_dir / "profit_engine"
        
        # Load empirical tables
        self.joined_df = pd.read_csv(self.profit_dir / "joined_cost_price.csv")
        self.crop_map_df = pd.read_csv(self.profit_dir / "crop_map.csv")
        self.vehicles_df = pd.read_csv(self.profit_dir / "vehicles.csv")
        self.vehicles_df['vehicle_name'] = self.vehicles_df['vehicle_name'].astype(str)
        self.vehicles_df['fuel_type'] = self.vehicles_df['fuel_type'].astype(str)
        self.economic_centres_df = pd.read_csv(self.profit_dir / "economic_centres.csv")
        self.economic_centres_df['economic_centre_name'] = self.economic_centres_df['economic_centre_name'].astype(str)
        self.distances_df = pd.read_csv(self.profit_dir / "district_distances.csv")
        self.distances_df['farm_district'] = self.distances_df['farm_district'].astype(str)
        self.distances_df['target_economic_centre'] = self.distances_df['target_economic_centre'].astype(str)
        self.prices_long_df = pd.read_csv(self.workspace_dir / "Price folder" / "etl" / "_output" / "master_prices_long.csv")
        self.prices_long_df['category'] = self.prices_long_df['category'].astype(str)
        self.prices_long_df['product_name'] = self.prices_long_df['product_name'].astype(str)
        self.coc_v2_df = pd.read_csv(self.workspace_dir / "COC folder" / "data" / "processed" / "coc_master_v2.csv")

        # Current baseline fuel prices (LKR / L) in Sri Lanka
        self.default_fuel_prices = {
            "Diesel": 315.0,
            "Petrol": 360.0
        }

    def get_supported_crops(self) -> Dict[str, list]:
        """Returns supported main crops, leafy crops, districts, and vehicles."""
        main_crops = sorted(self.joined_df['Crop'].unique().tolist())
        leafy_crops = sorted(self.prices_long_df[self.prices_long_df['category'] == 'leafy vegetables']['product_name'].unique().tolist())
        vehicles = self.vehicles_df['vehicle_name'].tolist()
        economic_centres = self.economic_centres_df['economic_centre_name'].tolist()
        districts = sorted(self.joined_df['District'].unique().tolist())
        return {
            "main_crops": main_crops,
            "leafy_side_crops": leafy_crops,
            "districts": districts,
            "vehicles": vehicles,
            "economic_centres": economic_centres,
            "seasons": ["Maha", "Yala"]
        }

    def get_available_routes(self, district: str) -> List[Dict[str, Any]]:
        """Returns reachable Economic Centres from a given agrarian district with road distances."""
        routes = self.distances_df[self.distances_df['farm_district'].str.lower() == district.lower()]
        if routes.empty:
            # Fallback to Dambulla as default national center
            return [{
                "target_economic_centre": "Dambulla Dedicated Economic Centre",
                "one_way_distance_km": 85.0,
                "route_type": "National Terminal",
                "default_primary_choice": True
            }]
        return routes.to_dict(orient="records")

    def calculate_logistics_cost(
        self,
        harvest_kg: float,
        vehicle_name: str,
        one_way_distance_km: float,
        diesel_price_lkr: Optional[float] = None,
        petrol_price_lkr: Optional[float] = None,
        market_gate_unloading_fee_per_trip: float = 600.0,
        vehicle_wear_per_km: float = 8.0
    ) -> Dict[str, Any]:
        """
        Calculates exact trips, fuel volume, fuel cost, and total logistics deduction.
        """
        v_match = self.vehicles_df[self.vehicles_df['vehicle_name'].str.lower() == vehicle_name.lower()]
        if v_match.empty:
            # Default to DIMO Batta
            v_match = self.vehicles_df[self.vehicles_df['vehicle_name'].str.contains("DIMO Batta", case=False)]
        
        v_info = v_match.iloc[0]
        fuel_type = v_info['fuel_type']
        km_per_l = float(v_info['km_per_l_avg'])
        payload_kg = float(v_info['payload_kg'])

        # Fuel price
        if fuel_type == "Diesel":
            fuel_price = diesel_price_lkr if diesel_price_lkr is not None else self.default_fuel_prices["Diesel"]
        else:
            fuel_price = petrol_price_lkr if petrol_price_lkr is not None else self.default_fuel_prices["Petrol"]

        # Number of round trips
        # Even small crops take at least 1 trip; larger crops require multiple trips
        trips = max(1, math.ceil(harvest_kg / payload_kg))
        
        # Round trip distance
        round_trip_dist_km = 2.0 * one_way_distance_km
        total_distance_traveled_km = trips * round_trip_dist_km
        
        # Fuel consumed
        total_fuel_litres = total_distance_traveled_km / km_per_l
        total_fuel_cost = total_fuel_litres * fuel_price
        
        # Additional vehicle & terminal costs
        total_vehicle_wear = total_distance_traveled_km * vehicle_wear_per_km
        total_gate_unloading_fees = trips * market_gate_unloading_fee_per_trip
        
        total_logistics_cost = total_fuel_cost + total_vehicle_wear + total_gate_unloading_fees
        cost_per_kg = total_logistics_cost / harvest_kg if harvest_kg > 0 else 0.0

        return {
            "vehicle_name": v_info['vehicle_name'],
            "fuel_type": fuel_type,
            "fuel_price_lkr_per_litre": round(fuel_price, 2),
            "fuel_economy_km_per_l": km_per_l,
            "vehicle_payload_kg": payload_kg,
            "one_way_distance_km": round(one_way_distance_km, 1),
            "round_trip_distance_km": round(round_trip_dist_km, 1),
            "trips_required": trips,
            "total_distance_km": round(total_distance_traveled_km, 1),
            "fuel_litres_consumed": round(total_fuel_litres, 2),
            "total_fuel_cost_lkr": round(total_fuel_cost, 2),
            "vehicle_wear_maintenance_lkr": round(total_vehicle_wear, 2),
            "market_gate_unloading_fees_lkr": round(total_gate_unloading_fees, 2),
            "total_logistics_cost_lkr": round(total_logistics_cost, 2),
            "logistics_cost_per_kg_lkr": round(cost_per_kg, 2)
        }

    def evaluate_main_crop(
        self,
        crop: str,
        district: str,
        season: str,
        acreage: float = 1.0,
        vehicle_name: str = "DIMO Batta HT2",
        target_economic_centre: Optional[str] = None,
        custom_distance_km: Optional[float] = None,
        custom_yield_kg: Optional[float] = None,
        custom_buyer_price: Optional[float] = None,
        custom_retail_price: Optional[float] = None,
        post_harvest_loss_pct: float = 8.0,
        diesel_price_lkr: Optional[float] = None,
        petrol_price_lkr: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Evaluates main crop economics comparing Farm-Gate Buyer vs Target Economic Centre with vehicle fuel deduction.
        """
        # Filter benchmark data
        subset = self.joined_df[
            (self.joined_df['Crop'].str.lower() == crop.lower()) &
            (self.joined_df['District'].str.lower() == district.lower()) &
            (self.joined_df['Season'].str.lower() == season.lower())
        ]
        
        if subset.empty:
            subset = self.joined_df[self.joined_df['Crop'].str.lower() == crop.lower()]
            benchmark_level = "National Crop Median"
        else:
            benchmark_level = f"{district} ({season}) Historical Median"

        if subset.empty:
            raise ValueError(f"Crop '{crop}' not found in pilot database.")

        bench_cost_incl_ac = float(subset['Total_Cost_Incl_Imputed'].median())
        bench_cost_excl_ac = float(subset['Total_Cost_Excl_Imputed'].median())
        bench_yield_ac = float(subset['Average_Yield_kg_ac'].median())
        bench_farm_price = float(subset['Farm_Gate_Price_LKR_kg'].median())
        bench_retail_price = float(subset['avg_retail_price_lkr_kg'].median())
        
        # Applied yield and costs
        yield_per_acre = custom_yield_kg if custom_yield_kg is not None else bench_yield_ac
        total_yield_kg = yield_per_acre * acreage
        
        cost_incl_total = bench_cost_incl_ac * acreage
        cost_excl_total = bench_cost_excl_ac * acreage
        
        farm_gate_price = custom_buyer_price if custom_buyer_price is not None else bench_farm_price
        retail_market_price = custom_retail_price if custom_retail_price is not None else bench_retail_price

        # Determine route & distance
        routes = self.get_available_routes(district)
        if target_economic_centre is not None:
            match_route = [r for r in routes if r['target_economic_centre'].lower() == target_economic_centre.lower()]
            if match_route:
                selected_ec = match_route[0]['target_economic_centre']
                distance_km = match_route[0]['one_way_distance_km']
            else:
                selected_ec = target_economic_centre
                distance_km = custom_distance_km if custom_distance_km is not None else 35.0
        else:
            # Pick default primary choice
            primary_route = [r for r in routes if r.get('default_primary_choice', False)]
            if primary_route:
                selected_ec = primary_route[0]['target_economic_centre']
                distance_km = primary_route[0]['one_way_distance_km']
            else:
                selected_ec = routes[0]['target_economic_centre']
                distance_km = routes[0]['one_way_distance_km']

        if custom_distance_km is not None:
            distance_km = custom_distance_km

        # Calculate exact transport logistics
        logistics = self.calculate_logistics_cost(
            harvest_kg=total_yield_kg,
            vehicle_name=vehicle_name,
            one_way_distance_km=distance_km,
            diesel_price_lkr=diesel_price_lkr,
            petrol_price_lkr=petrol_price_lkr
        )

        # Break-Even Price Floors
        breakeven_cash_floor_kg = cost_excl_total / total_yield_kg if total_yield_kg > 0 else 0.0
        breakeven_economic_floor_kg = cost_incl_total / total_yield_kg if total_yield_kg > 0 else 0.0

        # CHANNEL A: Farm-Gate Buyer
        gross_rev_buyer = total_yield_kg * farm_gate_price
        net_cash_profit_buyer = gross_rev_buyer - cost_excl_total
        net_economic_profit_buyer = gross_rev_buyer - cost_incl_total
        cash_margin_pct_buyer = (net_cash_profit_buyer / gross_rev_buyer * 100) if gross_rev_buyer > 0 else 0.0

        # CHANNEL B: Target Economic Centre
        effective_market_yield_kg = total_yield_kg * (1.0 - (post_harvest_loss_pct / 100.0))
        gross_rev_market_nominal = effective_market_yield_kg * retail_market_price
        
        # Deduct logistics directly
        total_logistics_deduction = logistics['total_logistics_cost_lkr']
        net_rev_market = gross_rev_market_nominal - total_logistics_deduction
        
        net_cash_profit_market = net_rev_market - cost_excl_total
        net_economic_profit_market = net_rev_market - cost_incl_total
        cash_margin_pct_market = (net_cash_profit_market / gross_rev_market_nominal * 100) if gross_rev_market_nominal > 0 else 0.0

        # Channel Decision
        profit_advantage_market = net_economic_profit_market - net_economic_profit_buyer
        spread_per_kg = retail_market_price - farm_gate_price
        farm_share_pct = (farm_gate_price / retail_market_price * 100.0) if retail_market_price > 0 else 0.0
        
        # Max allowable total transport cost per kg
        max_allowable_freight_per_kg = (
            (gross_rev_market_nominal - gross_rev_buyer) / total_yield_kg
        ) if total_yield_kg > 0 else 0.0

        if profit_advantage_market > 0:
            recommendation = (
                f"SELL AT {selected_ec.upper()}: Direct market selling nets an extra Rs {profit_advantage_market:,.0f} "
                f"(+{profit_advantage_market / gross_rev_buyer * 100:.1f}%) in your pocket AFTER deducting "
                f"{logistics['fuel_litres_consumed']:.1f}L of {logistics['fuel_type']} (Rs {logistics['total_fuel_cost_lkr']:,.0f}), "
                f"vehicle wear, and {post_harvest_loss_pct:.0f}% post-harvest sorting loss. "
                f"Transport cost is only Rs {logistics['logistics_cost_per_kg_lkr']:.2f}/kg, well below your maximum allowance of Rs {max_allowable_freight_per_kg:.2f}/kg."
            )
            preferred_channel = f"Economic Centre ({selected_ec})"
        else:
            recommendation = (
                f"SELL TO BUYER AT FARM GATE: Total transport deduction (Rs {total_logistics_deduction:,.0f}) "
                f"and spoilage loss exceed the market gain. Selling to the farm-gate buyer nets Rs {-profit_advantage_market:,.0f} "
                f"more profit with zero fuel expenditure and zero travel risk."
            )
            preferred_channel = "Farm-Gate Buyer"

        return {
            "crop": crop,
            "district": district,
            "season": season,
            "acreage": acreage,
            "target_economic_centre": selected_ec,
            "benchmark_source": benchmark_level,
            "production_metrics": {
                "total_yield_kg": round(total_yield_kg, 1),
                "yield_per_acre_kg": round(yield_per_acre, 1),
                "total_cost_cash_out_of_pocket_lkr": round(cost_excl_total, 2),
                "total_cost_economic_incl_imputed_lkr": round(cost_incl_total, 2),
                "breakeven_cash_floor_lkr_per_kg": round(breakeven_cash_floor_kg, 2),
                "breakeven_economic_floor_lkr_per_kg": round(breakeven_economic_floor_kg, 2),
            },
            "pricing_context": {
                "buyer_farm_gate_price_lkr_kg": round(farm_gate_price, 2),
                "retail_market_price_lkr_kg": round(retail_market_price, 2),
                "spread_lkr_kg": round(spread_per_kg, 2),
                "farmer_share_of_retail_pct": round(farm_share_pct, 1)
            },
            "channel_a_buyer": {
                "channel_name": "Sell to Collector at Farm Gate",
                "gross_revenue_lkr": round(gross_rev_buyer, 2),
                "net_cash_profit_lkr": round(net_cash_profit_buyer, 2),
                "net_economic_profit_lkr": round(net_economic_profit_buyer, 2),
                "cash_margin_pct": round(cash_margin_pct_buyer, 1),
                "transport_deduction_lkr": 0.0
            },
            "channel_b_market": {
                "channel_name": f"Transport to {selected_ec}",
                "effective_market_yield_kg": round(effective_market_yield_kg, 1),
                "nominal_gross_revenue_lkr": round(gross_rev_market_nominal, 2),
                "logistics_deduction_lkr": round(total_logistics_deduction, 2),
                "net_revenue_after_transport_lkr": round(net_rev_market, 2),
                "net_cash_profit_lkr": round(net_cash_profit_market, 2),
                "net_economic_profit_lkr": round(net_economic_profit_market, 2),
                "cash_margin_pct": round(cash_margin_pct_market, 1),
                "logistics_breakdown": logistics
            },
            "decision_verdict": {
                "preferred_channel": preferred_channel,
                "profit_difference_lkr": round(profit_advantage_market, 2),
                "max_allowable_freight_lkr_per_kg": round(max_allowable_freight_per_kg, 2),
                "recommendation_summary": recommendation
            }
        }

    def evaluate_leafy_side_income(
        self,
        leafy_crop: str,
        bed_perches: float = 5.0,
        harvest_cycles_per_season: int = 4,
        bunches_per_cycle_per_perch: float = 35.0,
        custom_price_per_bunch: Optional[float] = None,
        operational_cost_per_perch: float = 800.0
    ) -> Dict[str, Any]:
        """
        Calculates side income from planting leafy greens on field edges / bunds.
        """
        sub = self.prices_long_df[
            (self.prices_long_df['category'] == 'leafy vegetables') &
            (self.prices_long_df['product_name'].str.lower() == leafy_crop.lower())
        ]
        if sub.empty:
            raise ValueError(f"Leafy green '{leafy_crop}' not recognized.")
            
        recent_prices = sub[sub['year'] >= 2024]['price_lkr']
        bench_price = float(recent_prices.mean()) if not recent_prices.empty else float(sub['price_lkr'].mean())
        price_per_bunch = custom_price_per_bunch if custom_price_per_bunch is not None else bench_price

        bunches_per_cycle = bed_perches * bunches_per_cycle_per_perch
        total_bunches_season = bunches_per_cycle * harvest_cycles_per_season
        
        gross_income_season = total_bunches_season * price_per_bunch
        gross_income_per_cycle = bunches_per_cycle * price_per_bunch
        
        total_input_cost = bed_perches * operational_cost_per_perch
        net_side_profit = gross_income_season - total_input_cost
        
        return {
            "leafy_crop": leafy_crop,
            "bed_area_perches": bed_perches,
            "harvest_cycles": harvest_cycles_per_season,
            "bunches_per_cycle": round(bunches_per_cycle, 0),
            "total_bunches_season": round(total_bunches_season, 0),
            "price_per_bunch_lkr": round(price_per_bunch, 2),
            "gross_income_per_cycle_lkr": round(gross_income_per_cycle, 2),
            "total_gross_income_lkr": round(gross_income_season, 2),
            "total_production_cost_lkr": round(total_input_cost, 2),
            "net_side_profit_lkr": round(net_side_profit, 2),
            "agronomic_note": (
                f"Harvesting every 3-4 weeks delivers Rs {gross_income_per_cycle:,.0f} bi-weekly cash flow, "
                f"providing immediate liquidity for household groceries and daily farm wages."
            )
        }

    def evaluate_farm_portfolio(
        self,
        main_crop: str,
        district: str,
        season: str,
        main_acreage: float = 1.0,
        vehicle_name: str = "DIMO Batta HT2",
        target_economic_centre: Optional[str] = None,
        leafy_crop: Optional[str] = "Mukunuwenna",
        leafy_perches: float = 5.0
    ) -> Dict[str, Any]:
        """
        Synthesizes main crop, transport route, vehicle fuel deduction, and leafy side crop into a single advisory plan.
        """
        main_res = self.evaluate_main_crop(
            crop=main_crop,
            district=district,
            season=season,
            acreage=main_acreage,
            vehicle_name=vehicle_name,
            target_economic_centre=target_economic_centre
        )
        
        if leafy_crop:
            leafy_res = self.evaluate_leafy_side_income(leafy_crop=leafy_crop, bed_perches=leafy_perches)
            leafy_profit = leafy_res["net_side_profit_lkr"]
            leafy_gross = leafy_res["total_gross_income_lkr"]
        else:
            leafy_res = None
            leafy_profit = 0.0
            leafy_gross = 0.0

        best_channel = main_res["decision_verdict"]["preferred_channel"]
        if "Economic Centre" in best_channel:
            main_net_cash = main_res["channel_b_market"]["net_cash_profit_lkr"]
            main_net_econ = main_res["channel_b_market"]["net_economic_profit_lkr"]
            main_gross = main_res["channel_b_market"]["nominal_gross_revenue_lkr"]
        else:
            main_net_cash = main_res["channel_a_buyer"]["net_cash_profit_lkr"]
            main_net_econ = main_res["channel_a_buyer"]["net_economic_profit_lkr"]
            main_gross = main_res["channel_a_buyer"]["gross_revenue_lkr"]

        total_household_gross = main_gross + leafy_gross
        total_household_net_cash = main_net_cash + leafy_profit
        total_household_net_econ = main_net_econ + leafy_profit

        return {
            "summary_header": f"Farm Household Profit Plan: {main_acreage}ac {main_crop} + {leafy_perches}p {leafy_crop} in {district} ({season}) using {vehicle_name}",
            "main_crop_analysis": main_res,
            "leafy_side_crop_analysis": leafy_res,
            "combined_portfolio": {
                "recommended_strategy": f"Cultivate {main_acreage} ac of {main_crop} + {leafy_perches} perches of {leafy_crop}. {best_channel}.",
                "total_household_gross_revenue_lkr": round(total_household_gross, 2),
                "total_household_net_cash_profit_lkr": round(total_household_net_cash, 2),
                "total_household_net_economic_profit_lkr": round(total_household_net_econ, 2),
                "leafy_green_profit_share_pct": round((leafy_profit / total_household_net_cash * 100), 1) if total_household_net_cash > 0 else 0.0,
                "cash_flow_timeline": (
                    f"Weeks 1–12: Earn Rs {leafy_profit:,.0f} from {leafy_crop} across 4 mini-harvests to fund farming expenses. "
                    f"Week 12+: Realize Rs {main_net_cash:,.0f} lump-sum from {main_crop} harvest via {best_channel}."
                )
            }
        }


if __name__ == "__main__":
    engine = FarmerAdvisoryEngine()
    print("Testing Farmer Advisory Engine with vehicle fuel deductions...")
    
    # Example 1: Badulla Tomato with DIMO Batta HT2 to Keppetipola EC
    r1 = engine.evaluate_farm_portfolio(
        main_crop="Tomato",
        district="Badulla",
        season="Maha",
        main_acreage=1.0,
        vehicle_name="DIMO Batta HT2",
        target_economic_centre="Keppetipola Economic Centre",
        leafy_crop="Gotukola",
        leafy_perches=5.0
    )
    print("\n" + "="*80)
    print(r1["summary_header"])
    print("="*80)
    logistics1 = r1["main_crop_analysis"]["channel_b_market"]["logistics_breakdown"]
    print(f"Vehicle: {logistics1['vehicle_name']} ({logistics1['fuel_type']}) | Payload: {logistics1['vehicle_payload_kg']} kg")
    print(f"Destination: Keppetipola EC (Distance: {logistics1['one_way_distance_km']} km one-way)")
    print(f"Trips Required: {logistics1['trips_required']} round-trips ({logistics1['total_distance_km']} km total)")
    print(f"Fuel Consumed: {logistics1['fuel_litres_consumed']} Litres Diesel @ Rs {logistics1['fuel_price_lkr_per_litre']}/L = Rs {logistics1['total_fuel_cost_lkr']:,.2f}")
    print(f"Total Logistics Deduction: Rs {logistics1['total_logistics_cost_lkr']:,.2f} (Rs {logistics1['logistics_cost_per_kg_lkr']:.2f}/kg)")
    print(f"Decision Verdict: {r1['main_crop_analysis']['decision_verdict']['recommendation_summary']}")

    # Example 2: Smallholder with Three-Wheeler
    r2 = engine.evaluate_main_crop(
        crop="Tomato",
        district="Badulla",
        season="Maha",
        acreage=0.25,
        vehicle_name="Bajaj RE 4S / 4-stroke Three-Wheeler",
        target_economic_centre="Keppetipola Economic Centre"
    )
    print("\n" + "="*80)
    print("Smallholder (0.25 ac) with Bajaj RE Petrol Three-Wheeler to Keppetipola:")
    print("="*80)
    logistics2 = r2["channel_b_market"]["logistics_breakdown"]
    print(f"Yield: {r2['production_metrics']['total_yield_kg']} kg | Trips: {logistics2['trips_required']} round trips")
    print(f"Fuel: {logistics2['fuel_litres_consumed']} L Petrol = Rs {logistics2['total_fuel_cost_lkr']:,.2f}")
    print(f"Net Cash Profit at Market: Rs {r2['channel_b_market']['net_cash_profit_lkr']:,.2f} vs Buyer: Rs {r2['channel_a_buyer']['net_cash_profit_lkr']:,.2f}")
    print(f"Profit Advantage: +Rs {r2['decision_verdict']['profit_difference_lkr']:,.2f}")

import json
from pathlib import Path
import pandas as pd
import numpy as np

def export():
    base_dir = Path(r"c:\Users\MSI\Desktop\Research\Profit Folder\profit_engine")
    joined_df = pd.read_csv(base_dir / "joined_cost_price.csv")
    vehicles_df = pd.read_csv(base_dir / "vehicles.csv")
    ec_df = pd.read_csv(base_dir / "economic_centres.csv")
    dist_df = pd.read_csv(base_dir / "district_distances.csv")
    prices_long_df = pd.read_csv(Path(r"c:\Users\MSI\Desktop\Research\Profit Folder\Price folder\etl\_output\master_prices_long.csv"))
    coc_df = pd.read_csv(base_dir.parent / "COC folder" / "data" / "processed" / "coc_model_ready.csv")

    # Build crop summaries for pilot joined crops
    crops_summary = {}
    for crop in sorted(joined_df['Crop'].unique()):
        c_sub = joined_df[joined_df['Crop'] == crop]
        # Dist-season breakdown
        dist_options = sorted(c_sub['District'].unique().tolist())
        seasons = sorted(c_sub['Season'].unique().tolist())
        
        # Medians
        yield_median = float(c_sub['Average_Yield_kg_ac'].median())
        cost_incl_median = float(c_sub['Total_Cost_Incl_Imputed'].median())
        cost_excl_median = float(c_sub['Total_Cost_Excl_Imputed'].median())
        farm_p_median = float(c_sub['Farm_Gate_Price_LKR_kg'].median())
        ret_p_median = float(c_sub['avg_retail_price_lkr_kg'].median())
        
        # Per kg floors
        cash_floor = cost_excl_median / yield_median if yield_median > 0 else 0
        econ_floor = cost_incl_median / yield_median if yield_median > 0 else 0
        
        crops_summary[crop] = {
            "crop": crop,
            "districts": dist_options,
            "seasons": seasons,
            "typical_yield_kg_ac": round(yield_median, 1),
            "typical_cost_incl_ac": round(cost_incl_median, 2),
            "typical_cost_excl_ac": round(cost_excl_median, 2),
            "typical_farm_price_kg": round(farm_p_median, 2),
            "typical_retail_price_kg": round(ret_p_median, 2),
            "cash_floor_kg": round(cash_floor, 2),
            "econ_floor_kg": round(econ_floor, 2)
        }

    # Build verified agronomic districts & cost profiles for ALL 23 crops from DOA survey records
    crop_districts_map = {}
    crop_cost_profiles = {}
    for crop, grp in coc_df.groupby('Crop'):
        dists = sorted(grp['District'].unique().tolist())
        crop_districts_map[crop] = dists

        l_shares = (grp['Labour_Cost'] / grp['Total_Cost_Incl_Imputed']).dropna()
        m_shares = (grp['Material_Cost'] / grp['Total_Cost_Incl_Imputed']).dropna()
        k_shares = (grp['Machinery_Cost'] / grp['Total_Cost_Incl_Imputed']).dropna()

        l_med = float(l_shares.median())
        m_med = float(m_shares.median())
        k_med = float(k_shares.median())
        total_med = l_med + m_med + k_med

        l_pct = round((l_med / total_med) * 100.0, 1)
        m_pct = round((m_med / total_med) * 100.0, 1)
        k_pct = round(100.0 - l_pct - m_pct, 1)

        cash_ratio = round(float((grp['Total_Cost_Excl_Imputed'] / grp['Total_Cost_Incl_Imputed']).dropna().median()), 2)
        bench_yield = round(float(grp['Average_Yield_kg_ac'].dropna().median()), 1)

        crop_cost_profiles[crop] = {
            'labour_pct': l_pct,
            'material_pct': m_pct,
            'machinery_pct': k_pct,
            'cash_ratio': cash_ratio,
            'benchmark_yield_kg_ac': bench_yield,
            'valid_districts': dists
        }

    # Vehicles list
    vehicles_list = []
    for _, r in vehicles_df.iterrows():
        vehicles_list.append({
            "id": r['vehicle_id'],
            "name": r['vehicle_name'],
            "fuel_type": r['fuel_type'],
            "km_per_l": float(r['km_per_l_avg']),
            "payload_kg": float(r['payload_kg']),
            "typical_use": r['typical_use']
        })

    # Economic Centres list
    ec_list = []
    for _, r in ec_df.iterrows():
        ec_list.append({
            "id": r['economic_centre_id'],
            "name": r['economic_centre_name'],
            "district": r['district'],
            "role": r['primary_role'],
            "crops": r['major_crops_traded'],
            "notes": r['notes']
        })

    # District distances mapping
    dist_map = {}
    for dist, grp in dist_df.groupby('farm_district'):
        routes = []
        for _, r in grp.iterrows():
            routes.append({
                "centre_name": r['target_economic_centre'],
                "distance_km": float(r['one_way_distance_km']),
                "route_type": r['route_type'],
                "is_default": bool(r['default_primary_choice'])
            })
        dist_map[dist] = routes

    # Leafy greens
    leafy_sub = prices_long_df[prices_long_df['category'] == 'leafy vegetables']
    leafy_list = []
    for prod in sorted(leafy_sub['product_name'].unique()):
        p_grp = leafy_sub[leafy_sub['product_name'] == prod]
        unit = p_grp['unit'].iloc[0]
        recent = p_grp[p_grp['year'] >= 2024]['price_lkr']
        avg_p = float(recent.mean()) if not recent.empty else float(p_grp['price_lkr'].mean())
        leafy_list.append({
            "name": prod,
            "unit": unit,
            "avg_price_lkr": round(avg_p, 2),
            "bunches_per_perch_cycle": 35.0,
            "cycles_per_season": 4,
            "operational_cost_per_perch": 800.0
        })

    data_payload = {
        "crops": crops_summary,
        "crop_districts_map": crop_districts_map,
        "crop_cost_profiles": crop_cost_profiles,
        "vehicles": vehicles_list,
        "economic_centres": ec_list,
        "district_routes": dist_map,
        "leafy_greens": leafy_list,
        "fuel_defaults": {
            "Diesel": 315.0,
            "Petrol": 360.0
        }
    }

    out_json = base_dir / "frontend" / "src" / "data" / "advisory_data.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data_payload, f, indent=2)
    print(f"Exported data payload to {out_json}")

if __name__ == "__main__":
    export()

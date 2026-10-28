from fastapi.testclient import TestClient
import json
import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add profit_engine to sys.path
sys.path.insert(0, str(Path(r"c:\Users\MSI\Desktop\Research\Profit Folder")))
from profit_engine.api import app

with TestClient(app) as client:
    print("1. Testing GET /health ...")
    r_health = client.get("/health")
    print("Status code:", r_health.status_code)
    print("Health body:", r_health.json())

    print("\n2. Testing POST /api/advisory-predict ...")
    req_body = {
        "crop": "Tomato",
        "district": "Badulla",
        "season": "Maha",
        "year_start": 2025,
        "usd_lkr_rate": 310.0,
        "irrigation_type": "Irrigated",
        "forecast_horizon_weeks": 4,
        "acreage": 1.0,
        "vehicle_id": "dimo_batta_ht2",
        "target_economic_centre": "Keppetipola Economic Centre",
        "diesel_price": 315.0,
        "petrol_price": 360.0,
        "post_harvest_loss_pct": 8.0,
        "enable_leafy": True,
        "leafy_crop": "Gotukola",
        "leafy_perches": 5.0
    }

    r_predict = client.post("/api/advisory-predict", json=req_body)
    print("Predict status code:", r_predict.status_code)
    if r_predict.status_code == 200:
        data = r_predict.json()
        print("\n--- LIVE ML PREDICTION RESPONSE ---")
        print("Cost per acre (predicted):", data['cost_prediction']['predicted_cost_incl_imputed_ac'])
        print("Cost 80% interval:", data['cost_prediction']['interval_80'])
        print("Top Cost Drivers:", data['cost_prediction']['top_drivers'])
        print("Retail Price Forecast (Rs/kg):", data['price_forecast']['point_forecast_lkr_kg'])
        print("Price 80% conformal interval:", data['price_forecast']['interval_80'])
        print("Price model used:", data['price_forecast']['model_used'])
        print("Cash Floor (Rs/kg):", data['production_and_logistics']['cash_floor_kg'])
        print("Logistics Total (Rs):", data['production_and_logistics']['total_logistics_lkr'])
        print("Cost Model Version:", data['cost_prediction']['model_version'])
        print("Preferred Channel:", data['channel_decision']['preferred_channel'])
        print("Profit Advantage Econ (Rs):", data['channel_decision']['profit_advantage_econ_lkr'])
        print("Recommendation:", data['channel_decision']['recommendation_text'])
    else:
        print("Error:", r_predict.text)

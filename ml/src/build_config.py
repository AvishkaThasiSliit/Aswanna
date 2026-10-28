"""
ml/src/build_config.py
Generates:
1. ml/config/operation_stage_map.json - Operation to cultivation stage and SO3 category mapping.
2. ml/config/stage_windows.json - Cultivation stage timing windows (fraction of cycle length [0, 1])
   with explicit ASSUMPTION status and widened uncertainty ranges.
"""

import json
from pathlib import Path

def build_operation_stage_map():
    config = {
        "metadata": {
            "description": "Mapping from DoA survey raw operation names to 5 canonical cultivation stages and SO3 cost categories.",
            "status": "ASSUMPTION - confirm with DoA",
            "stages": [
                "land_preparation",
                "planting",
                "fertilizer_basal",
                "crop_care",
                "harvest"
            ],
            "fertilizer_splits": {
                "Paddy": {"basal_share": 0.264, "top_dress_share": 0.736, "status": "measured from coc_model_ready.csv"},
                "Maize": {"basal_share": 0.154, "top_dress_share": 0.846, "status": "measured from coc_model_ready.csv", "flag": "weak: N=5"},
                "Tomato": {"basal_share": 0.30, "top_dress_share": 0.70, "status": "assumption"},
                "Green Chilli": {"basal_share": 0.25, "top_dress_share": 0.75, "status": "assumption"}
            },
            "machinery_fuel_split": {
                "machinery_share": 0.70,
                "fuel_share": 0.30,
                "notes": "Derived from machinery via 70/30 split from SO1 integration; not independently learned."
            },
            "unresolved_bucket": {
                "name": "unresolved",
                "description": "Separate tracking bucket for unclassified materials and ambiguous operations. Excluded from canonical 8-category spend curves."
            }
        },
        "patterns": [
            {
                "pattern": r"(sowing|transplant|broadcast|seeding|planting|nursery|seedling)",
                "stage": "planting",
                "material_category": "seed",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "Crop establishment, nursery management, and seed paddy/seedlings."
            },
            {
                "pattern": r"(basal|manure|compost)",
                "stage": "fertilizer_basal",
                "material_category": "fertilizer",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "Explicit basal nutrient and organic matter application at planting."
            },
            {
                "pattern": r"(fertilizer|urea|tsp|mop)",
                "stage": "fertilizer",
                "material_category": "fertilizer",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "General fertilizer application representing full-season aggregate (split into basal and top-dressing)."
            },
            {
                "pattern": r"(weed|pest|disease|spray|weedicide|pesticide|fungicide|insecticide)",
                "stage": "crop_care",
                "material_category": "agrochemical",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "Mid-cycle chemical protection, weed control, and pest spraying."
            },
            {
                "pattern": r"(watermanage|water manage|irrigation|watering)",
                "stage": "crop_care",
                "material_category": "irrigation",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "Water issuing and canal/tube-well irrigation."
            },
            {
                "pattern": r"(harvest|thresh|drying|dry|processing|transport|store|bagging|winnowing)",
                "stage": "harvest",
                "material_category": "other",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "Reaping, threshing, packaging gunny bags, transport to mill/store."
            },
            {
                "pattern": r"(land prep|plough|plow|rotavat|bund|ridg|bed|harrow|level|tillage|digging hole)",
                "stage": "land_preparation",
                "material_category": "UNRESOLVED_MATERIAL_SPLIT",
                "status": "ASSUMPTION - confirm with DoA",
                "notes": "Primary tillage, plowing, and bund plastering."
            }
        ]
    }
    return config


def build_stage_windows():
    config = {
        "metadata": {
            "description": "Normalized cycle progress timing windows [start_fraction, end_fraction] for 5 cultivation stages across focus crops.",
            "note": "Fraction t in [0.0, 1.0] representing normalized cycle progress (Days After Sowing / Total Cycle Days).",
            "citation_status": "All stage windows are marked 'assumption' with widened ranges; no institute homepage citations."
        },
        "crops": {
            "Paddy": {
                "cycle_length_days": 105,
                "variety_benchmark": "Standard 3.5-month improved lowland variety (Bg 352, Bg 358)",
                "stages": {
                    "land_preparation": {
                        "window": [0.00, 0.20],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Initial 1st/2nd plowing, bund plastering, and puddling prior to seeding."
                    },
                    "planting": {
                        "window": [0.05, 0.25],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Direct broadcasting or transplanting."
                    },
                    "fertilizer_basal": {
                        "window": [0.05, 0.25],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Basal fertilizer incorporated during final leveling or within first 14 DAS."
                    },
                    "crop_care": {
                        "window": [0.15, 0.80],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Early weed control, 1st & 2nd top dressings, water management through reproductive phase."
                    },
                    "harvest": {
                        "window": [0.80, 1.00],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Combine harvesting, threshing, drying, and field transport."
                    }
                }
            },
            "Maize": {
                "cycle_length_days": 115,
                "variety_benchmark": "Hybrid / Open-pollinated field maize (Bhadra, Pacific 984)",
                "stages": {
                    "land_preparation": {
                        "window": [0.00, 0.20],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Plowing, harrowing, and ridge/furrow formation prior to planting."
                    },
                    "planting": {
                        "window": [0.05, 0.25],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Direct seed dibbling at 2 seeds per hill, thinning, and gap filling."
                    },
                    "fertilizer_basal": {
                        "window": [0.05, 0.25],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Basal fertilizer applied in planting furrows at sowing."
                    },
                    "crop_care": {
                        "window": [0.15, 0.80],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Critical weed-free period and split top-dressings up to tasseling/silking."
                    },
                    "harvest": {
                        "window": [0.80, 1.00],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Cob picking, de-husking, sun drying, and mechanical shelling."
                    }
                }
            },
            "Tomato": {
                "cycle_length_days": 110,
                "variety_benchmark": "Semi-determinate table tomato (Thilina, Lanka Sour)",
                "stages": {
                    "land_preparation": {
                        "window": [0.00, 0.22],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Deep plowing, bed preparation, and basal organic manure incorporation."
                    },
                    "planting": {
                        "window": [0.08, 0.28],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Transplanting nursery seedlings into field with establishment watering."
                    },
                    "fertilizer_basal": {
                        "window": [0.08, 0.28],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Basal fertilizer applied before or at transplanting."
                    },
                    "crop_care": {
                        "window": [0.18, 0.80],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Staking, split top dressings, and spray rounds."
                    },
                    "harvest": {
                        "window": [0.65, 1.00],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Multiple staggered pickings commencing from 70 DAS through 110 DAS."
                    }
                }
            },
            "Green Chilli": {
                "cycle_length_days": 140,
                "variety_benchmark": "Open-pollinated green chilli (MI-2, MICH-1, MICH-2)",
                "stages": {
                    "land_preparation": {
                        "window": [0.00, 0.22],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Primary tillage, ridge and furrow formation, nursery beds."
                    },
                    "planting": {
                        "window": [0.08, 0.28],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Field transplanting 21-day nursery seedlings."
                    },
                    "fertilizer_basal": {
                        "window": [0.08, 0.28],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Basal fertilizer incorporated into ridges before transplanting."
                    },
                    "crop_care": {
                        "window": [0.18, 0.80],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Weeding, earthing up, split top dressings, and intensive insect pest sprays."
                    },
                    "harvest": {
                        "window": [0.60, 1.00],
                        "status": "assumption",
                        "source": "ASSUMPTION",
                        "notes": "Continuous weekly pod pickings from 85 DAS through final harvest at 140 DAS."
                    }
                }
            }
        }
    }
    return config


def main():
    config_dir = Path("ml/config")
    config_dir.mkdir(parents=True, exist_ok=True)

    op_map = build_operation_stage_map()
    op_map_file = config_dir / "operation_stage_map.json"
    with open(op_map_file, "w", encoding="utf-8") as f:
        json.dump(op_map, f, indent=2)
    print(f"Saved: {op_map_file}")

    windows = build_stage_windows()
    windows_file = config_dir / "stage_windows.json"
    with open(windows_file, "w", encoding="utf-8") as f:
        json.dump(windows, f, indent=2)
    print(f"Saved: {windows_file}")


if __name__ == "__main__":
    main()

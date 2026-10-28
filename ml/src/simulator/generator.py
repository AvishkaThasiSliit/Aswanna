"""
ml/src/simulator/generator.py
Independent daily-spend cultivation simulator.
Strictly decoupled from prior builders and does not use piecewise-linear knots.

Simulates per cycle:
- Farm size, farmer liquidity, risk attitude, farmer efficiency effect
- Category spend phasing from mixtures of Gamma / logistic bursts
- Split fertilizer pulses (basal + top dressings)
- Latent weather shocks: late monsoon planting delay, top-dress wash-out reapplication
- Harvest labour surge and early-failure truncation
- Final cost = predicted baseline * lognormal error (sigma ~ 0.12) * farmer effect
- Output ground truth: daily expenses, true continuous phasing curves, true final cost
- Tagged synthetic: true
"""

import math
from typing import Dict, List, Any, Optional
import numpy as np

import hashlib
import json

CATEGORIES = [
    "seed",
    "fertilizer",
    "agrochemical",
    "labour",
    "machinery",
    "fuel",
    "irrigation",
    "other"
]

SCENARIO_CONFIGS = {
    "S1": {
        "scenario": "S1",
        "name": "prior-aligned",
        "description": "Continuous bursts aligned with survey priors",
        "parameters": {
            "labour": {"prep_share": 0.35, "prep_center": 0.08, "weed_share": 0.25, "weed_center": 0.35, "harvest_share": 0.40, "harvest_center": 0.88},
            "machinery": {"prep_share": 0.60, "prep_center": 0.07, "harvest_share": 0.40, "harvest_center": 0.90},
            "fuel": {"machinery_weight": 0.85, "linear_weight": 0.15},
            "irrigation": {"start_tau": 0.20, "end_tau": 0.80},
            "other": {"harvest_center": 0.92, "harvest_slope": 30.0}
        }
    },
    "S2": {
        "scenario": "S2",
        "name": "prior-misaligned",
        "description": "Multi-burst rotational operations diverging from survey priors",
        "parameters": {
            "labour": {"prep_share": 0.30, "prep_center": 0.08, "weed_share": 0.30, "weed_center": 0.35, "harvest_share": 0.40, "harvest_center": 0.88},
            "machinery": {"prep_share": 0.35, "prep_center": 0.07, "mid_share": 0.25, "mid_center": 0.42, "harvest_share": 0.40, "harvest_center": 0.90},
            "fuel": {"prep_share": 0.35, "prep_center": 0.07, "pumping_share": 0.35, "pumping_center": 0.45, "harvest_share": 0.30, "harvest_center": 0.90},
            "irrigation": {"soak_share": 0.40, "soak_center": 0.06, "panicle_share": 0.40, "panicle_center": 0.50, "final_share": 0.20, "final_center": 0.75},
            "other": {"early_share": 0.45, "early_center": 0.04, "late_share": 0.55, "late_center": 0.92}
        }
    }
}


def get_scenario_config_hash(scenario: str = "S2") -> str:
    cfg = SCENARIO_CONFIGS.get(scenario, SCENARIO_CONFIGS["S2"])
    dumped = json.dumps(cfg, sort_keys=True)
    return hashlib.sha256(dumped.encode("utf-8")).hexdigest()


# Baseline cost per acre benchmarks (LKR) for standard 1-acre cycle
DEFAULT_PER_ACRE_BASELINE = {
    "Paddy": {
        "total": 145000.0,
        "shares": {
            "seed": 0.08,
            "fertilizer": 0.22,
            "agrochemical": 0.12,
            "labour": 0.32,
            "machinery": 0.16,
            "fuel": 0.07,
            "irrigation": 0.01,
            "other": 0.02
        }
    }
}


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -25.0, 25.0)))


def gamma_cdf(t: np.ndarray, shape: float, scale: float) -> np.ndarray:
    """Vectorized gamma CDF approximation using standard scipy or numerical regularized gamma."""
    # Using numpy array and standard numerical approximation
    from scipy.stats import gamma
    return gamma.cdf(t, a=shape, scale=scale)


class DailySpendSimulator:
    """
    Independent generator of synthetic farm cultivation cycles.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def generate_cycle(
        self,
        cycle_id: str,
        crop: str = "Paddy",
        season: str = "Maha",
        year: int = 2024,
        regime_shift: bool = False,
        cycle_length_days: int = 105,
        scenario: str = "S2",
        mid_cycle_shock: bool = False,
        gradual_shock: bool = False
    ) -> Dict[str, Any]:
        """
        Generates a single cultivation cycle with daily expense ledger and true ground truth.
        """
        rng = self.rng

        # 1. Farm & Farmer characteristics
        land_size_acres = round(float(rng.lognormal(mean=0.2, sigma=0.4)), 2)
        land_size_acres = max(0.5, min(5.0, land_size_acres))

        liquidity = rng.choice(["low", "medium", "high"], p=[0.25, 0.55, 0.20])
        risk_attitude = rng.choice(["risk_averse", "neutral", "aggressive"], p=[0.30, 0.50, 0.20])

        # Farmer efficiency effect (multiplier on cost): mean 1.0, std ~8%
        # If mid_cycle_shock or gradual_shock is True, no upfront latent multiplier (farmer starts on budget)
        farmer_effect = 1.0 if (mid_cycle_shock or gradual_shock) else float(rng.lognormal(mean=0.0, sigma=0.08))

        # Baseline predicted cost (SO1 mimic)
        crop_bench = DEFAULT_PER_ACRE_BASELINE.get(crop, DEFAULT_PER_ACRE_BASELINE["Paddy"])
        per_acre_total = crop_bench["total"]

        # SO1 predicts baseline using historical/pre-season rates
        so1_baseline_predicted = round(per_acre_total * land_size_acres, 2)

        # Baseline prediction error: SO1 has ~12-15% residual error
        so1_error = 1.0 if (mid_cycle_shock or gradual_shock) else float(rng.lognormal(mean=0.0, sigma=0.12))

        # True cycle final target budget
        true_final_cost_target = so1_baseline_predicted * so1_error * farmer_effect

        # 2. Latent Weather Shocks
        # Regime shift has higher probability of extreme weather
        prob_late_monsoon = 0.40 if regime_shift else 0.15
        late_monsoon = bool(rng.random() < prob_late_monsoon)
        planting_delay_days = int(rng.integers(7, 21)) if late_monsoon else 0

        prob_topdress_washout = 0.30 if regime_shift else 0.10
        washout_shock = bool(rng.random() < prob_topdress_washout)

        # Early failure truncation (drought / pest devastation leading to abandonment)
        prob_early_failure = 0.05 if regime_shift else 0.02
        early_failure = bool(rng.random() < prob_early_failure)
        failure_day = int(rng.integers(35, 75)) if early_failure else cycle_length_days

        effective_cycle_days = failure_day

        # Liquidity delay on purchases (low liquidity delays non-urgent inputs by 3-7 days)
        liquidity_delay = 5 if liquidity == "low" else 0

        # 3. Construct Continuous True Phasing Curves F_c(t) for t in [0, cycle_length_days]
        days = np.arange(cycle_length_days + 1, dtype=np.float64)
        t_norm = days / float(cycle_length_days)

        true_curves = {}

        # a) Seed: Sharp burst around planting (shifted by late monsoon)
        plant_center = (10.0 + planting_delay_days) / cycle_length_days
        true_curves["seed"] = sigmoid((t_norm - plant_center) * 35.0)

        # b) Fertilizer: Mixture of basal pulse + 2 top dressings
        basal_center = (12.0 + planting_delay_days) / cycle_length_days
        top1_center = (28.0 + planting_delay_days + liquidity_delay) / cycle_length_days
        top2_center = (55.0 + planting_delay_days + liquidity_delay) / cycle_length_days

        basal_share = 0.264
        top1_share = 0.40
        top2_share = 0.336

        fert_curve = (
            basal_share * sigmoid((t_norm - basal_center) * 25.0) +
            top1_share * sigmoid((t_norm - top1_center) * 20.0) +
            top2_share * sigmoid((t_norm - top2_center) * 20.0)
        )

        # If washout occurs, extra re-application pulse around day 40
        if washout_shock:
            washout_pulse_center = (42.0 + planting_delay_days) / cycle_length_days
            fert_curve += 0.25 * sigmoid((t_norm - washout_pulse_center) * 20.0)

        true_curves["fertilizer"] = fert_curve

        # c) Agrochemical: Gamma burst during tillering and flowering
        ag_shape = 3.5
        ag_scale = (0.45 * cycle_length_days) / ag_shape
        true_curves["agrochemical"] = gamma_cdf(days, shape=ag_shape, scale=ag_scale)

        # d) Labour
        if scenario == "S1":
            prep_burst = 0.35 * sigmoid((t_norm - 0.08) * 25.0)
            weed_burst = 0.25 * sigmoid((t_norm - (0.35 + planting_delay_days/cycle_length_days)) * 18.0)
            harvest_burst = 0.40 * sigmoid((t_norm - 0.88) * 20.0)
            true_curves["labour"] = prep_burst + weed_burst + harvest_burst

            # e) Machinery: Bimodal tillage burst + harvest combine burst
            mach_prep = 0.60 * sigmoid((t_norm - (0.07 + planting_delay_days/cycle_length_days)) * 25.0)
            mach_harvest = 0.40 * sigmoid((t_norm - 0.90) * 25.0)
            true_curves["machinery"] = mach_prep + mach_harvest

            # f) Fuel: Correlated with machinery + ongoing pumping
            true_curves["fuel"] = 0.85 * true_curves["machinery"] + 0.15 * t_norm

            # g) Irrigation: Linear water fee issuing during reproductive phase
            true_curves["irrigation"] = np.clip((t_norm - 0.20) / 0.60, 0.0, 1.0)

            # h) Other: Bags, twine, transport at harvest
            true_curves["other"] = sigmoid((t_norm - 0.92) * 30.0)
        else:  # S2: Prior-misaligned / multi-burst rotational operations
            prep_burst = 0.30 * sigmoid((t_norm - 0.08) * 25.0)
            weed_burst = 0.30 * sigmoid((t_norm - (0.35 + planting_delay_days/cycle_length_days)) * 18.0)
            harvest_burst = 0.40 * sigmoid((t_norm - 0.88) * 20.0)
            true_curves["labour"] = prep_burst + weed_burst + harvest_burst

            # e) Machinery: Tillage burst + mid-season rotary weeding/pumping machinery + harvest combine
            mach_prep = 0.35 * sigmoid((t_norm - (0.07 + planting_delay_days/cycle_length_days)) * 25.0)
            mach_mid = 0.25 * sigmoid((t_norm - (0.42 + planting_delay_days/cycle_length_days)) * 18.0)
            mach_harvest = 0.40 * sigmoid((t_norm - 0.90) * 25.0)
            true_curves["machinery"] = mach_prep + mach_mid + mach_harvest

            # f) Fuel: Pumping for water management in mid-season + tractor/combine operations
            fuel_prep = 0.35 * sigmoid((t_norm - (0.07 + planting_delay_days/cycle_length_days)) * 25.0)
            fuel_pumping = 0.35 * sigmoid((t_norm - 0.45) * 15.0)
            fuel_harvest = 0.30 * sigmoid((t_norm - 0.90) * 25.0)
            true_curves["fuel"] = fuel_prep + fuel_pumping + fuel_harvest

            # g) Irrigation: Rotational water issue (initial canal wetting pulse + panicle turns)
            irr_soak = 0.40 * sigmoid((t_norm - 0.06) * 30.0)
            irr_panicle = 0.40 * sigmoid((t_norm - 0.50) * 20.0)
            irr_final = 0.20 * sigmoid((t_norm - 0.75) * 20.0)
            true_curves["irrigation"] = irr_soak + irr_panicle + irr_final

            # h) Other: Land rent token deposit (early) + packaging/transport bags (late)
            other_early = 0.45 * sigmoid((t_norm - 0.04) * 35.0)
            other_late = 0.55 * sigmoid((t_norm - 0.92) * 25.0)
            true_curves["other"] = other_early + other_late

        # Normalize all true curves to satisfy F(0)=0.0 and F(T)=1.0
        for cat in CATEGORIES:
            curve = true_curves[cat]
            c_min = curve[0]
            c_max = curve[-1]
            if c_max > c_min:
                norm_c = (curve - c_min) / (c_max - c_min)
            else:
                norm_c = t_norm
            true_curves[cat] = np.maximum.accumulate(np.clip(norm_c, 0.0, 1.0))

        # 4. Generate Daily Expense Ledger
        cat_shares = crop_bench["shares"]
        expenses = []
        daily_category_spend = {c: np.zeros(cycle_length_days + 1) for c in CATEGORIES}

        # Truncate at failure day if early failure occurred
        sim_days = min(effective_cycle_days, cycle_length_days)

        for cat in CATEGORIES:
            cat_budget = true_final_cost_target * cat_shares[cat]
            if regime_shift and cat == "fertilizer":
                cat_budget *= 1.40  # +40% fertilizer price shock in regime shift
            if cat == "fertilizer" and washout_shock:
                cat_budget *= 1.25  # Reapplication penalty

            curve = true_curves[cat]
            # Daily increments in expected spend
            daily_increments = np.diff(np.insert(curve[:sim_days + 1], 0, 0.0))

            # Group increments into realistic discrete transaction events
            accumulated_pending = 0.0
            for d in range(1, sim_days + 1):
                inc = daily_increments[d] * cat_budget
                accumulated_pending += inc

                # Threshold for writing a discrete bill / expense
                threshold = 800.0 if cat in ["fuel", "irrigation", "labour"] else 3000.0
                if d == sim_days or accumulated_pending >= threshold:
                    if accumulated_pending > 50.0:
                        # Transaction noise +/- 10%
                        t_noise = float(rng.uniform(0.92, 1.08))
                        actual_txn = round(accumulated_pending * t_noise, 2)
                        daily_category_spend[cat][d] += actual_txn
                        expenses.append({
                            "day": int(d),
                            "tau": round(float(d / cycle_length_days), 4),
                            "category": cat,
                            "amount": actual_txn,
                            "description": f"Simulated {cat} expense on day {d}",
                            "synthetic": True
                        })
                        accumulated_pending = 0.0

        # Mid-cycle unexpected shock injection (if mid_cycle_shock or gradual_shock is True)
        shock_day_val = None
        shock_type_val = None
        if mid_cycle_shock:
            shock_type_val = "lump_sum"
            shock_day_val = int(rng.integers(40, 81))
            shock_amount = round(so1_baseline_predicted * 0.35, 2)
            expenses.append({
                "day": shock_day_val,
                "tau": round(float(shock_day_val / cycle_length_days), 4),
                "category": "agrochemical",
                "amount": shock_amount,
                "description": f"Unexpected emergency lump-sum shock on day {shock_day_val}",
                "synthetic": True,
                "mid_cycle_shock_event": True,
                "shock_type": "lump_sum"
            })
            expenses.sort(key=lambda x: x["day"])
        elif gradual_shock:
            shock_type_val = "gradual"
            shock_day_val = int(rng.integers(40, 81))
            total_shock = round(so1_baseline_predicted * 0.35, 2)
            duration_days = 20
            daily_shock_rate = round(total_shock / float(duration_days), 2)
            for d in range(shock_day_val, min(shock_day_val + duration_days, cycle_length_days + 1)):
                expenses.append({
                    "day": d,
                    "tau": round(float(d / cycle_length_days), 4),
                    "category": "agrochemical",
                    "amount": daily_shock_rate,
                    "description": f"Gradual emergency treatment on day {d} (day {d - shock_day_val + 1}/20)",
                    "synthetic": True,
                    "mid_cycle_shock_event": True,
                    "shock_type": "gradual"
                })
            expenses.sort(key=lambda x: x["day"])

        # Compute actual realized total
        actual_total_cost = round(float(sum(e["amount"] for e in expenses)), 2)

        # Package ground truth
        record = {
            "synthetic": True,
            "cycle_id": cycle_id,
            "crop": crop,
            "season": season,
            "year": year,
            "regime_shift": regime_shift,
            "mid_cycle_shock": mid_cycle_shock,
            "gradual_shock": gradual_shock,
            "cycle_length_days": cycle_length_days,
            "land_size_acres": land_size_acres,
            "latent_parameters": {
                "liquidity": liquidity,
                "risk_attitude": risk_attitude,
                "farmer_effect": round(farmer_effect, 4),
                "so1_error": round(so1_error, 4),
                "late_monsoon": late_monsoon,
                "planting_delay_days": planting_delay_days,
                "washout_shock": washout_shock,
                "early_failure": early_failure,
                "failure_day": failure_day,
                "mid_cycle_shock_day": shock_day_val,
                "shock_type": shock_type_val
            },
            "so1_baseline_predicted": so1_baseline_predicted,
            "true_final_cost": actual_total_cost,
            "exceeded_budget_10pct": bool(actual_total_cost > 1.10 * so1_baseline_predicted),
            "true_curves": {
                cat: [round(float(v), 4) for v in true_curves[cat]]
                for cat in CATEGORIES
            },
            "expenses": expenses
        }
        return record

    def generate_cohort(
        self,
        n_cycles: int,
        season: str = "Maha",
        year: int = 2024,
        regime_shift: bool = False,
        prefix: str = "cycle",
        scenario: str = "S2",
        mid_cycle_shock: bool = False,
        gradual_shock: bool = False
    ) -> List[Dict[str, Any]]:
        """Generates a list of simulated cycles."""
        cycles = []
        for i in range(n_cycles):
            cid = f"{prefix}_{season}_{year}_{i:04d}"
            c = self.generate_cycle(
                cycle_id=cid,
                crop="Paddy",
                season=season,
                year=year,
                regime_shift=regime_shift,
                scenario=scenario,
                mid_cycle_shock=mid_cycle_shock,
                gradual_shock=gradual_shock
            )
            cycles.append(c)
        return cycles

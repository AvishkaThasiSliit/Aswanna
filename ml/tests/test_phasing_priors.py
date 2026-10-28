"""
ml/tests/test_phasing_priors.py
Pytest suite verifying:
1. Parser row counts on the 2 hand-checked workbooks match the golden numbers.
2. Monotonicity and boundary conditions (Fc(0) = 0.0, Fc(1.0) = 1.0) across all prior curves.
3. Separate unresolved bucket and metadata flags (fuel derived from machinery, irrigation placeholder).
4. Determinism: identical random seed produces identical float curves.
"""

import json
from pathlib import Path
import openpyxl
import numpy as np
import pytest

from ml.src.parse_operations import parse_operations_from_sheet
from ml.src.build_phasing_priors import (
    run_vectorized_monte_carlo,
    CATEGORIES,
    ALL_TRACKED_CATEGORIES,
    STAGES,
    KNOTS,
    preaggregate_sheet_costs,
)


def test_hand_checked_workbook_1_ofc_maha():
    """
    Workbook 1: 2014-15 Maha OFC Final sheet.
    Golden counts: exactly 24 valid sheets parsed, 230 operation rows extracted.
    """
    wb_path = Path("Profit Folder/COC folder/data/raw_surveys/2014-15 Maha/OFC/2014-15M COC _DC_ OFC_Final sheet.xlsx")
    assert wb_path.exists(), f"Workbook not found at {wb_path}"

    wb = openpyxl.load_workbook(wb_path, data_only=True)
    parsed_sheets = 0
    total_records = 0

    for sheetname in wb.sheetnames:
        sheet = wb[sheetname]
        records, skip_reason = parse_operations_from_sheet(sheet, wb_path, sheetname)
        if records:
            parsed_sheets += 1
            total_records += len(records)

    assert parsed_sheets == 24, f"Expected 24 valid sheets, got {parsed_sheets}"
    assert total_records == 230, f"Expected 230 operation records, got {total_records}"


def test_hand_checked_workbook_2_paddy_yala():
    """
    Workbook 2: 2015 Yala Paddy Final sheet.
    Golden counts: exactly 14 valid sheets parsed, 184 operation rows extracted.
    """
    wb_path = Path("Profit Folder/COC folder/data/raw_surveys/2015 Yala/Paddy/Copy of 15Y COC-DC-Paddy Final Sheet.xlsx")
    assert wb_path.exists(), f"Workbook not found at {wb_path}"

    wb = openpyxl.load_workbook(wb_path, data_only=True)
    parsed_sheets = 0
    total_records = 0

    for sheetname in wb.sheetnames:
        sheet = wb[sheetname]
        records, skip_reason = parse_operations_from_sheet(sheet, wb_path, sheetname)
        if records:
            parsed_sheets += 1
            total_records += len(records)

    assert parsed_sheets == 14, f"Expected 14 valid sheets, got {parsed_sheets}"
    assert total_records == 184, f"Expected 184 operation records, got {total_records}"


def test_prior_curves_monotonicity_and_boundaries():
    """
    Asserts for all 4 focus crops and all 8 canonical categories:
    - Knots start at 0.0, end at 1.0, length 11.
    - Fc(0.0) == 0.0 and Fc(1.0) == 1.0 for p10, p50, p90.
    - Strict monotonicity: F(t_i) <= F(t_{i+1}) across all knots.
    - Percentile ordering: p10 <= p50 <= p90 at each knot.
    - All values bounded in [0.0, 1.0].
    """
    prior_path = Path("ml/artifacts/phasing_priors_v0.json")
    assert prior_path.exists(), f"Prior artifact not found at {prior_path}"

    with open(prior_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    crops = data.get("crops", {})
    focus_crops = ["Paddy", "Maize", "Tomato", "Green Chilli"]
    expected_knots = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

    for crop in focus_crops:
        assert crop in crops, f"Crop {crop} missing in crops"
        crop_data = crops[crop]

        categories = crop_data["categories"]
        for cat in CATEGORIES:
            assert cat in categories, f"Category {cat} missing for crop {crop}"
            cat_data = categories[cat]
            assert cat_data["knots"] == expected_knots

            for band_name in ["p10", "p50", "p90"]:
                band = cat_data[band_name]
                assert len(band) == 11, f"{crop} {cat} {band_name} must have 11 knots"
                assert band[0] == 0.0, f"{crop} {cat} {band_name} Fc(0) must be 0.0, got {band[0]}"
                assert band[-1] == 1.0, f"{crop} {cat} {band_name} Fc(1.0) must be 1.0, got {band[-1]}"

                for val in band:
                    assert 0.0 <= val <= 1.0, f"{crop} {cat} {band_name} value {val} out of bounds"

                for i in range(len(band) - 1):
                    assert band[i] <= band[i + 1] + 1e-9, (
                        f"{crop} {cat} {band_name} violated monotonicity at knot {i}: "
                        f"{band[i]} > {band[i+1]}"
                    )

            for i in range(11):
                p10_v = cat_data["p10"][i]
                p50_v = cat_data["p50"][i]
                p90_v = cat_data["p90"][i]
                assert p10_v <= p50_v + 1e-9, f"{crop} {cat} p10 ({p10_v}) > p50 ({p50_v}) at knot {i}"
                assert p50_v <= p90_v + 1e-9, f"{crop} {cat} p50 ({p50_v}) > p90 ({p90_v}) at knot {i}"


def test_unresolved_bucket_and_metadata_flags():
    """
    Verifies:
    1. A separate 'unresolved_bucket' exists for each crop, excluded from the 8 canonical categories.
    2. Category metadata flags:
       - 'fuel' is flagged as 'derived from machinery, not independently learned'.
       - 'irrigation' is flagged as 'no data - placeholder'.
    3. Global metadata contains the explicit uncertainty interpretation statement.
    """
    prior_path = Path("ml/artifacts/phasing_priors_v0.json")
    with open(prior_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data["metadata"]
    assert "uncertainty_interpretation" in meta
    assert "timing window uncertainty" in meta["uncertainty_interpretation"].lower()
    assert "not a prediction interval" in meta["uncertainty_interpretation"].lower()

    crops = data["crops"]
    for crop_name, crop_data in crops.items():
        assert "unresolved_bucket" in crop_data, f"Crop {crop_name} missing unresolved_bucket"
        unres = crop_data["unresolved_bucket"]
        assert "cost_share_pct" in unres
        assert unres["cost_share_pct"] >= 0.0
        assert "p50" in unres

        categories = crop_data["categories"]
        assert "unresolved" not in categories, f"'unresolved' should not be in canonical 8 categories for {crop_name}"

        # Fuel check
        fuel_data = categories["fuel"]
        assert fuel_data["derived_from_machinery_not_independently_learned"] is True
        assert fuel_data["status"] == "derived_from_machinery"

        # Irrigation check
        irr_data = categories["irrigation"]
        assert irr_data["independently_learned"] is False
        assert irr_data["status"] == "no_data_placeholder"

        # Standard learned category check
        seed_data = categories["seed"]
        assert seed_data["status"] == "survey_weighted_timing_assumed"


def test_monte_carlo_determinism():
    """
    Asserts that given the same seed, run_vectorized_monte_carlo yields
    strictly identical float arrays.
    """
    windows_path = Path("ml/config/stage_windows.json")
    with open(windows_path, "r", encoding="utf-8") as f:
        stage_windows = json.load(f)["crops"]["Paddy"]

    rng = np.random.default_rng(123)
    tensor = rng.uniform(100.0, 5000.0, size=(10, len(STAGES), len(ALL_TRACKED_CATEGORIES)))
    n_sheets = 10

    res1 = run_vectorized_monte_carlo(tensor, n_sheets, stage_windows, n_draws=200, seed=42)
    res2 = run_vectorized_monte_carlo(tensor, n_sheets, stage_windows, n_draws=200, seed=42)

    for cat in CATEGORIES:
        for band in ["p10", "p50", "p90"]:
            arr1 = np.array(res1[cat][band])
            arr2 = np.array(res2[cat][band])
            assert np.array_equal(arr1, arr2), f"Float mismatch in {cat} {band} with same seed 42"

    res3 = run_vectorized_monte_carlo(tensor, n_sheets, stage_windows, n_draws=200, seed=999)
    diffs = [
        np.max(np.abs(np.array(res1[cat]["p50"]) - np.array(res3[cat]["p50"])))
        for cat in CATEGORIES
    ]
    assert max(diffs) > 0.0, "Different seeds should produce different Monte Carlo outputs"


def test_knot_monotonicity():
    """Asserts that all category prior curves are monotonically non-decreasing."""
    prior_path = Path("ml/artifacts/phasing_priors_v0.json")
    with open(prior_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for crop, c_data in data["crops"].items():
        for cat, cat_data in c_data["categories"].items():
            for b in ["p10", "p50", "p90"]:
                band = cat_data[b]
                for i in range(len(band) - 1):
                    assert band[i] <= band[i + 1] + 1e-9, f"{crop} {cat} {b} violates monotonicity at {i}"


def test_known_ratios():
    """Asserts measured and assumption basal fertilizer ratios."""
    prior_path = Path("ml/artifacts/phasing_priors_v0.json")
    with open(prior_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Paddy measured basal ratio at tau=0.20 is 0.264
    paddy_fert = data["crops"]["Paddy"]["categories"]["fertilizer"]["p50"]
    assert paddy_fert[2] == pytest.approx(0.264, abs=1e-3)
    # Maize measured basal ratio at tau=0.20 is 0.154
    maize_fert = data["crops"]["Maize"]["categories"]["fertilizer"]["p50"]
    assert maize_fert[2] == pytest.approx(0.154, abs=1e-3)


def test_no_negative_values():
    """Asserts that no values in any prior curve or band are negative."""
    prior_path = Path("ml/artifacts/phasing_priors_v0.json")
    with open(prior_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for crop, c_data in data["crops"].items():
        for cat, cat_data in c_data["categories"].items():
            for b in ["p10", "p50", "p90"]:
                assert all(v >= 0.0 for v in cat_data[b]), f"Negative value found in {crop} {cat} {b}"


def test_golden_workbook_counts():
    """Combined verification of sheet counts and operation rows across both golden workbooks."""
    wb1 = Path("Profit Folder/COC folder/data/raw_surveys/2014-15 Maha/OFC/2014-15M COC _DC_ OFC_Final sheet.xlsx")
    wb2 = Path("Profit Folder/COC folder/data/raw_surveys/2015 Yala/Paddy/Copy of 15Y COC-DC-Paddy Final Sheet.xlsx")
    assert wb1.exists() and wb2.exists()

    book1 = openpyxl.load_workbook(wb1, data_only=True)
    sheets1 = [s for s in book1.sheetnames if parse_operations_from_sheet(book1[s], wb1, s)[0]]
    assert len(sheets1) == 24

    book2 = openpyxl.load_workbook(wb2, data_only=True)
    sheets2 = [s for s in book2.sheetnames if parse_operations_from_sheet(book2[s], wb2, s)[0]]
    assert len(sheets2) == 14


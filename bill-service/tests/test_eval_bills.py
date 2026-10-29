import pytest
from pathlib import Path
import sys

BILL_SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(BILL_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(BILL_SERVICE_DIR))

from eval.eval_bills import (
    wilson_score_interval,
    normalise_vendor_string,
    calculate_token_overlap,
    evaluate_total,
    evaluate_date,
    evaluate_vendor,
    enforce_test_split_lock,
    check_tesseract_engine
)

def test_wilson_score_interval_bounds():
    # 0 successes out of 20
    low, high = wilson_score_interval(0, 20)
    assert low == 0.0
    assert 0.15 <= high <= 0.20

    # 10 out of 20 (50%)
    low, high = wilson_score_interval(10, 20)
    assert 0.29 <= low <= 0.32
    assert 0.68 <= high <= 0.72

    # 20 out of 20 (100%)
    low, high = wilson_score_interval(20, 20)
    assert 0.80 <= low <= 0.85
    assert high == 1.0

def test_silent_total_error_detection():
    # Wrong total without review flags -> SILENT ERROR (primary failure)
    outcome = evaluate_total(
        pred_total=1500.0,
        true_total=2500.0,
        status="ok",
        reasons=[]
    )
    assert outcome == "silent_error"

    # Wrong total WITH review flag -> wrong_flagged (safe failure)
    outcome_flagged = evaluate_total(
        pred_total=1500.0,
        true_total=2500.0,
        status="needs_review",
        reasons=["largest_amount_fallback"]
    )
    assert outcome_flagged == "wrong_flagged"

    # Correct total
    outcome_correct = evaluate_total(
        pred_total=2500.0,
        true_total=2500.0,
        status="ok",
        reasons=[]
    )
    assert outcome_correct == "correct"

    # Missing total
    outcome_missing = evaluate_total(
        pred_total=None,
        true_total=2500.0,
        status="needs_review",
        reasons=["missing_total"]
    )
    assert outcome_missing == "no_value"

def test_date_outcomes():
    # Correct date
    assert evaluate_date("2026-10-15", "2026-10-15", "ok", []) == "correct"

    # Wrong date without flag -> silent error
    assert evaluate_date("2026-10-15", "2026-10-25", "ok", []) == "silent_error"

    # Wrong date with ambiguous_date flag -> wrong_flagged
    assert evaluate_date("2026-10-12", "2026-12-10", "needs_review", ["ambiguous_date"]) == "wrong_flagged"

    # Missing date
    assert evaluate_date(None, "2026-10-15", "needs_review", ["missing_date"]) == "no_value"

def test_vendor_normalisation_and_overlap():
    exact, overlap = evaluate_vendor("Dambulla Agro Chemicals (Pvt) Ltd.", "dambulla agro chemicals pvt ltd")
    assert exact is True
    assert overlap == 1.0

    exact, overlap = evaluate_vendor("Dambulla Agro", "Dambulla Chemicals")
    assert exact is False
    assert 0.33 <= overlap <= 0.5

def test_split_lock_creates_on_first_run(tmp_path):
    # Verify real logs/bill-eval-test.lock does not exist
    real_lock = BILL_SERVICE_DIR.parent / "logs" / "bill-eval-test.lock"
    assert not real_lock.exists(), "Real logs/bill-eval-test.lock must NOT exist before test"

    temp_logs = tmp_path / "temp_logs"
    lock_file = enforce_test_split_lock(temp_logs, force_new_run=False)
    assert lock_file.exists()
    assert lock_file.parent == temp_logs

    # Confirm real lock was not touched
    assert not real_lock.exists(), "Real logs/bill-eval-test.lock must NOT be created"

def test_split_lock_refuses_when_lock_exists(tmp_path):
    temp_logs = tmp_path / "temp_logs"
    lock_file = temp_logs / "bill-eval-test.lock"
    temp_logs.mkdir(parents=True, exist_ok=True)
    lock_file.write_text("existing-lock", encoding="utf-8")

    # Second run without force_new_run must raise RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        enforce_test_split_lock(temp_logs, force_new_run=False)
    assert "TEST SPLIT LOCKED" in str(exc_info.value)
    assert "--force-new-run" in str(exc_info.value)

def test_split_lock_force_new_run_overrides(tmp_path):
    temp_logs = tmp_path / "temp_logs"
    lock_file = temp_logs / "bill-eval-test.lock"
    temp_logs.mkdir(parents=True, exist_ok=True)
    lock_file.write_text("existing-lock", encoding="utf-8")

    # With force_new_run=True, must succeed without raising
    res_lock = enforce_test_split_lock(temp_logs, force_new_run=True)
    assert res_lock == lock_file
    assert res_lock.exists()

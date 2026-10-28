"""
Comprehensive Unit Tests for Aswanna Voice Learned Extractor (Task E1)
Covers:
  1. Generator determinism
  2. Leakage guard (forbidden amounts and real sentences)
  3. Parser cases (English numbers, commas, words, near-miss tokens)
  4. Wrapper never invents a number not literally in transcript
  5. Gating never promotes L over R
  6. Run-once guard
"""

import copy
import json
import pytest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data.generate import (
    generate_dataset,
    normalize_text,
    FORBIDDEN_AMOUNTS,
    LeakageError,
    build_synthetic_item,
    load_english_keyword_map
)
from number_parser import (
    parse_amount_span,
    parse_english_number_words,
    parse_digits_with_commas,
    is_number_literally_in_transcript
)
from learned_extract import extract_expenses_learned, get_learned_extractor
from systems import extract_g_batch
from eval_real import check_run_once_guard


# ─── 1. Generator Determinism ──────────────────────────────────────────────────
def test_generator_determinism():
    data1 = generate_dataset(num_samples=25, seed=42, apply_noise=True)
    data2 = generate_dataset(num_samples=25, seed=42, apply_noise=True)
    
    assert len(data1) == len(data2) == 25
    for s1, s2 in zip(data1, data2):
        assert s1["sentence"] == s2["sentence"]
        assert s1["tokens"] == s2["tokens"]
        assert s1["labels"] == s2["labels"]
        assert s1["expected"] == s2["expected"]


# ─── 2. Leakage Guard ──────────────────────────────────────────────────────────
def test_leakage_guard_forbidden_amounts():
    # Verify no generated sample contains any forbidden amount
    dataset = generate_dataset(num_samples=100, seed=123, apply_noise=True)
    for sample in dataset:
        for exp in sample["expected"]:
            amt = exp.get("totalAmount")
            assert amt not in FORBIDDEN_AMOUNTS, f"Forbidden amount {amt} leaked into dataset!"
            
    # Verify explicit rejection if forbidden amount is injected
    import random
    rng = random.Random(999)
    cat_terms = load_english_keyword_map()
    # All allowed amounts are made forbidden to guarantee instant trigger
    all_forbidden = set(FORBIDDEN_AMOUNTS).union(set(cat_terms.keys())).union(set(range(1, 100000)))
    with pytest.raises(LeakageError):
        build_synthetic_item(rng, cat_terms, forbidden_amounts=all_forbidden)


def test_leakage_guard_real_sentences():
    # Generate one sample to get its exact normalized sentence
    sample = generate_dataset(num_samples=1, seed=42, apply_noise=False)[0]
    forbidden = {normalize_text(sample["sentence"])}
    
    # Attempting to generate with this sentence in forbidden_sentences raises LeakageError
    with pytest.raises(LeakageError):
        generate_dataset(num_samples=5, seed=42, apply_noise=False, forbidden_sentences=forbidden)


# ─── 3. Parser Cases ───────────────────────────────────────────────────────────
def test_parser_digits_with_commas():
    assert parse_digits_with_commas("14,000") == 14000
    assert parse_digits_with_commas("8,500") == 8500
    assert parse_digits_with_commas("2500") == 2500
    assert parse_digits_with_commas("350.50") == 350.5
    # Malformed or mixed
    assert parse_digits_with_commas("14000x") is None
    assert parse_digits_with_commas("abc") is None
    assert parse_digits_with_commas("-500") is None


def test_parser_english_number_words_generative():
    # Thousands (1-14) and hundreds (0-9)
    units = [
        "", "one", "two", "three", "four", "five", "six", "seven",
        "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"
    ]
    for k in range(1, 15):
        t_word = units[k] + " thousand"
        for h in range(0, 10):
            h_word = "" if h == 0 else units[h] + " hundred"
            phrase = f"{t_word} {h_word}".strip()
            expected = k * 1000 + h * 100
            assert parse_english_number_words(phrase) == expected


def test_parser_near_miss_returns_none_never_truncated():
    # Inserting an unknown token inside English number words returns None
    assert parse_english_number_words("two thousand blarg five hundred") is None
    assert parse_english_number_words("five thousand foo") is None
    assert parse_english_number_words("two thousand and unknown") is None
    assert parse_english_number_words("three hundred blarg") is None
    assert parse_amount_span("two thousand blarg five hundred rupees") is None
    assert parse_amount_span("500foo") is None


# ─── 4. Wrapper Never Invents Numbers ──────────────────────────────────────────
def test_wrapper_literal_presence_check():
    assert is_number_literally_in_transcript(5000, "paid 5000 for fertilizer") is True
    assert is_number_literally_in_transcript(5000, "paid 5,000 for fertilizer") is True
    assert is_number_literally_in_transcript(5000, "paid five thousand for fertilizer") is True
    # Invented number
    assert is_number_literally_in_transcript(9999, "paid five thousand for fertilizer") is False
    assert is_number_literally_in_transcript(1234, "bought seeds for 5000 rupees") is False


def test_wrapper_rejects_hallucinated_number(monkeypatch):
    extractor = get_learned_extractor()
    transcript = "bought urea fertilizer for three thousand rupees"
    
    # Extract normally
    res = extractor.extract_expenses(transcript)
    assert len(res["items"]) == 1
    assert res["items"][0]["totalAmount"] == 3000
    
    # Monkeypatch parse_amount_span inside learned_extract to simulate a model hallucinating a non-literal value (9999)
    monkeypatch.setattr("learned_extract.parse_amount_span", lambda s: 9999)
    
    res_hallucinated = extractor.extract_expenses(transcript)
    assert len(res_hallucinated["items"]) == 1
    # Literal guard must catch this and set totalAmount to None, forcing needs_review
    assert res_hallucinated["items"][0]["totalAmount"] is None
    assert res_hallucinated["items"][0]["status"] == "needs_review"
    assert "amount_unresolved" in res_hallucinated["items"][0]["reasons"]


# ─── 5. Gating Never Promotes L Over R ─────────────────────────────────────────
def test_gating_never_promotes_l_over_r():
    r_results = [{
        "items": [{
            "description": "fertilizer",
            "category": "fertilizer",
            "quantity": None,
            "unit": None,
            "totalAmount": 5000,
            "status": "ok",
            "reasons": []
        }]
    }]
    
    # L predicts a completely different amount and category
    l_results = [{
        "items": [{
            "description": "fertilizer",
            "category": "seed",
            "quantity": None,
            "unit": None,
            "totalAmount": 99999,
            "status": "ok",
            "reasons": []
        }]
    }]
    
    g_results = extract_g_batch(r_results, l_results)
    assert len(g_results) == 1
    g_item = g_results[0]["items"][0]
    
    # G MUST keep R's values!
    assert g_item["totalAmount"] == 5000
    assert g_item["category"] == "fertilizer"
    # G MUST mark needs_review and add learned_disagrees
    assert g_item["status"] == "needs_review"
    assert "learned_disagrees" in g_item["reasons"]


# ─── 6. Run-Once Guard ─────────────────────────────────────────────────────────
def test_run_once_guard(tmp_path):
    mock_lock = tmp_path / "mock.lock"
    
    # First run: lock doesn't exist, should create lock
    check_run_once_guard(mock_lock, "hash123", force=False)
    assert mock_lock.exists()
    
    # Second run without force: must raise SystemExit
    with pytest.raises(SystemExit):
        check_run_once_guard(mock_lock, "hash123", force=False)
        
    # Second run with force: should succeed
    check_run_once_guard(mock_lock, "hash123", force=True)
    assert mock_lock.exists()

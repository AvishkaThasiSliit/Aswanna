import pytest
from decimal import Decimal
from hypothesis import given, strategies as st
import sys
from pathlib import Path

bill_service_dir = str(Path(__file__).resolve().parent.parent)
if bill_service_dir not in sys.path:
    sys.path.insert(0, bill_service_dir)

try:
    from parse_bill import (
        parse_bill_text,
        extract_dates,
        detect_digit_confusions,
        is_total_grounded,
        ALLOWED_CATEGORIES,
    )
except ImportError:
    from bill_service.parse_bill import (
        parse_bill_text,
        extract_dates,
        detect_digit_confusions,
        is_total_grounded,
        ALLOWED_CATEGORIES,
    )

def test_allowed_categories_matches_app_spec():
    expected = ["seed", "fertilizer", "agrochemical", "labour", "machinery", "fuel", "irrigation", "other"]
    assert set(ALLOWED_CATEGORIES) == set(expected)

def test_total_standard_comma_decimal():
    ocr_text = """
    AGRO STORES KURUNEGALA
    Date: 25/10/2026
    Paddy Seed 2 bags    1250.00
    Total: 1,250.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1250.0
    assert res["vendor"] == "AGRO STORES KURUNEGALA"
    assert res["date"] == "2026-10-25"
    assert "missing_total" not in res["reasons"]
    for it in res["items"]:
        assert it["category"] in ALLOWED_CATEGORIES

def test_total_space_separated_with_rs():
    ocr_text = """
    GAMPAHA FARM CHEMICALS
    Date: 2026-05-18
    Weedicide 1 bottle   1250.00
    Grand Total Rs. 1 250.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1250.0
    assert "missing_total" not in res["reasons"]
    for it in res["items"]:
        assert it["category"] in ALLOWED_CATEGORIES

def test_subtotal_vs_tax_vs_total():
    ocr_text = """
    CEYLON AGRO DEPOT
    Date: 28/09/2026
    Fertilizer Urea     1000.00
    Sub Total           1000.00
    VAT 10%              100.00
    Grand Total         1100.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1100.0
    assert res["total"] != 1000.0
    assert res["total"] != 100.0

def test_cash_change_exclusion():
    ocr_text = """
    POLONNARUWA HARDWARE
    Date: 15/08/2026
    Water Pump Hose     3750.00
    Total               3750.00
    Cash                5000.00
    Change              1250.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 3750.0
    assert res["total"] != 5000.0
    assert res["total"] != 1250.0

def test_ambiguous_date():
    ocr_text = """
    SEED MART
    Date: 03/04/2026
    Total: 500.00
    """
    res = parse_bill_text(ocr_text)
    # Sri Lanka default DD/MM/YYYY -> 2026-04-03
    assert res["date"] == "2026-04-03"
    assert res["status"] == "needs_review"
    assert "ambiguous_date" in res["reasons"]

def test_unambiguous_date():
    ocr_text = """
    SEED MART
    Date: 25/04/2026
    Total: 500.00
    """
    res = parse_bill_text(ocr_text)
    assert res["date"] == "2026-04-25"
    assert "ambiguous_date" not in res["reasons"]

def test_digit_confusion_detection():
    ocr_text = """
    AGRI PHARMACY
    Date: 12/10/2026
    Urea 12O0
    Total: l250.00
    Tax: 12S0
    """
    confusions = detect_digit_confusions(ocr_text)
    assert len(confusions) > 0
    res = parse_bill_text(ocr_text)
    assert res["status"] == "needs_review"
    assert "ocr_digit_confusion" in res["reasons"]

def test_missing_total():
    ocr_text = """
    JUST A MEMO
    Welcome to our store
    No prices listed here
    Thank you
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] is None
    assert res["status"] == "needs_review"
    assert "missing_total" in res["reasons"]

def test_category_matching_and_allowed_list():
    ocr_text = """
    FARM SUPPLY SHOP
    Date: 10/10/2026
    Hybrid Seed Paddy   2000.00
    Total               2000.00
    """
    res = parse_bill_text(ocr_text)
    assert len(res["items"]) >= 1
    # Must be one of the 8 canonical categories ("seed", not "seeds")
    assert res["items"][0]["category"] == "seed"
    assert res["items"][0]["category"] in ALLOWED_CATEGORIES

def test_unknown_item_gets_other_and_category_unsure():
    ocr_text = """
    GENERAL HARDWARE
    Date: 12/10/2026
    Random Unmapped Trinket   750.00
    Total                     750.00
    """
    res = parse_bill_text(ocr_text)
    assert len(res["items"]) >= 1
    assert res["items"][0]["category"] == "other"
    assert "category_unsure" in res["items"][0]["reasons"]
    assert "category_unsure" in res["reasons"]
    assert res["status"] == "needs_review"

def test_items_sum_mismatch():
    ocr_text = """
    FARM SHOP
    Date: 10/10/2026
    Paddy Seed          500.00
    Fertilizer          600.00
    Total               1500.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1500.0
    assert "sum_mismatch" in res["reasons"]
    assert res["status"] == "needs_review"

def test_grounding_whole_number_token_250_vs_12500():
    # A total of 250 is NOT grounded by the text "12500"
    assert not is_total_grounded(Decimal("250.00"), "Amount 12500")
    assert not is_total_grounded(Decimal("250"), "12500")
    assert not is_total_grounded(Decimal("250"), "Invoice 1,250.00")
    # But it is grounded when appearing as whole token
    assert is_total_grounded(Decimal("250.00"), "Total: 250.00")
    assert is_total_grounded(Decimal("250"), "Total Rs. 250")
    assert is_total_grounded(Decimal("1250.00"), "Total: 1,250.00")

def test_parser_ungrounded_total_rejected():
    # If a parser candidate is not in the text as a whole token, it must be rejected
    ocr_text = "AGRO STORE\nItems purchased 12500\nThank you"
    res = parse_bill_text(ocr_text)
    # The largest candidate 12500 is grounded, but if someone tested total=250 it wouldn't be grounded
    assert is_total_grounded(Decimal("12500"), ocr_text)
    assert not is_total_grounded(Decimal("250"), ocr_text)

def test_total_qty_and_total_items_are_not_money():
    ocr_text = """
    AGRO MEGA MART
    Date: 15/09/2026
    Paddy Seed 2 bags    800.00
    Weedicide 1 bottle   450.00
    Total Qty 3
    Total items 2
    Total: 1250.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1250.0
    assert res["total"] != 3.0
    assert res["total"] != 2.0

    # If only quantity totals exist without money total
    ocr_qty_only = """
    DISPATCH NOTE
    Item A
    Item B
    Total Qty 5
    Total items 3
    """
    res_qty = parse_bill_text(ocr_qty_only)
    assert res_qty["total"] is None
    assert "missing_total" in res_qty["reasons"]

def test_discount_and_rounding_lines_excluded():
    ocr_text = """
    AGRI PHARMACY
    Date: 20/08/2026
    Fertilizer Urea     1000.00
    Sub Total           1000.00
    Discount              50.00
    Round off             -0.05
    Total                949.95
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 949.95
    assert res["total"] != 50.0
    assert res["total"] != 0.05

def test_balance_due_vs_total_conflict():
    ocr_text = """
    IRRIGATION SERVICES
    Date: 10/07/2026
    Water Pump Repair   5000.00
    Total               5000.00
    Advance Paid        2000.00
    Balance Due         3000.00
    """
    res = parse_bill_text(ocr_text)
    # Total and Balance Due differ -> ambiguous, never guess
    assert res["status"] == "needs_review"
    assert "ambiguous_balance_due" in res["reasons"]

def test_conflicting_totals():
    ocr_text = """
    SUPER AGRO STORE
    Date: 12/06/2026
    Seed Bag             800.00
    Total               1200.00
    Net Total           1500.00
    """
    res = parse_bill_text(ocr_text)
    # Conflicting total lines -> flagged, do not pick silently
    assert res["total"] is None
    assert "conflicting_totals" in res["reasons"]
    assert res["status"] == "needs_review"

def test_qty_x_price_amount_row():
    ocr_text = """
    FERTILIZER OUTLET
    Date: 04/05/2026
    Urea 2 x 500.00 = 1000.00
    Total 1000.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1000.0
    assert len(res["items"]) >= 1
    item = res["items"][0]
    assert item["quantity"] == 2.0
    assert item["amount"] == 1000.0
    assert item["category"] == "fertilizer"
    assert item["category"] in ALLOWED_CATEGORIES

def test_sinhala_total_keyword():
    ocr_text = """
    කෘෂි සේවා මධ්‍යස්ථානය
    දිනය: 2026-10-15
    බීජ වී 1500.00
    මුළු මුදල 1500.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1500.0
    assert res["vendor"] == "කෘෂි සේවා මධ්‍යස්ථානය"
    assert res["date"] == "2026-10-15"

@given(st.integers(min_value=100, max_value=999999))
def test_property_grounding_total_digits_must_exist(amount_cents):
    total_dec = Decimal(amount_cents) / Decimal(100)
    total_str = f"{total_dec:.2f}"
    ocr_text = f"FARM STORE\nDate: 25/10/2026\nItem expense {total_str}\nTotal: {total_str}"
    res = parse_bill_text(ocr_text)
    if res["total"] is not None:
        assert is_total_grounded(Decimal(str(res["total"])), ocr_text)

def test_grounding_formats_spec():
    # Grounding formats required by TASK BILL-1e A2
    t1250 = Decimal("1250.00")
    t1250_5 = Decimal("1250.50")
    assert is_total_grounded(t1250, "Total: Rs.1,250.00")
    assert is_total_grounded(t1250, "Total: Rs.1250")
    assert is_total_grounded(t1250, "Total: LKR 1250")
    assert is_total_grounded(t1250, "Amount: 1250/=")
    assert is_total_grounded(t1250, "Amount: Rs 1,250/=")
    assert is_total_grounded(t1250, "Net: 1 250.00")
    assert is_total_grounded(t1250, "Total 1250.\nNext line")
    assert is_total_grounded(t1250_5, "Total: 1250.5")

    # Anti-collision grounding tests
    assert not is_total_grounded(Decimal("250"), "Amount 12500")
    assert not is_total_grounded(Decimal("25"), "Amount 2500.00")

def test_conflicting_totals_record_behavior_discount_and_net_total():
    # TASK BILL-3d F2: "Total 1200 / Discount 100 / Net Total 1100" with "Date: 12/10/2026"
    # Net Total outranks Total and arithmetic 1200 - 100 = 1100 is consistent, yielding 1100.0
    ocr_text = """
    FARM DEPOT
    Date: 12/10/2026
    Total 1200
    Discount 100
    Net Total 1100
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 1100.0
    assert res["date"] == "2026-10-12"
    assert "conflicting_totals" not in res["reasons"]
    assert "ambiguous_date" in res["reasons"]
    assert res["vendor"] == "FARM DEPOT"
    assert res["status"] == "needs_review"  # due to ambiguous date

def test_conflicting_totals_record_behavior_total_and_net_total():
    # TASK BILL-3d F2: "Total 1200 / Net Total 1500" with unambiguous date
    # Arithmetic 1200 != 1500 without discount/tax, stays conflicting and null
    ocr_text = """
    FARM DEPOT
    Date: 25/10/2026
    Total 1200
    Net Total 1500
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] is None
    assert res["date"] == "2026-10-25"
    assert "conflicting_totals" in res["reasons"]
    assert "ambiguous_date" not in res["reasons"]
    assert res["vendor"] == "FARM DEPOT"
    assert res["status"] == "needs_review"

def test_bill1f_grounding_whitespace_cases():
    # (a) "Total 1,250.00\n123 Main Street" still grounds 1250
    assert is_total_grounded(Decimal("1250"), "Total 1,250.00\n123 Main Street") is True
    # (b) "Urea 2 100.00" must NOT ground a total of 2100
    assert is_total_grounded(Decimal("2100"), "Urea 2 100.00") is False
    # (c) "Total 1 250.00" still grounds 1250
    assert is_total_grounded(Decimal("1250"), "Total 1 250.00") is True
    # (d) earlier cases all still pass
    assert is_total_grounded(Decimal("1250"), "Rs.1,250.00") is True
    assert is_total_grounded(Decimal("1250"), "Rs.1250") is True
    assert is_total_grounded(Decimal("1250"), "LKR 1250") is True
    assert is_total_grounded(Decimal("1250"), "1250/=") is True
    assert is_total_grounded(Decimal("1250"), "Rs 1,250/=") is True
    assert is_total_grounded(Decimal("1250"), "Total 1250.") is True
    assert is_total_grounded(Decimal("1250.50"), "1250.5") is True
    assert is_total_grounded(Decimal("250"), "12500") is False
    assert is_total_grounded(Decimal("25"), "2500.00") is False

def test_field_independence_unambiguous_date_with_conflicting_total():
    # Field independence: conflicting total does not skip date, vendor, or items
    ocr_text = """
    AGRO DEPOT
    Date: 25/10/2026
    Paddy Seed 2 bags    600.00
    Total: 1200.00
    Grand Total: 1500.00
    """
    res = parse_bill_text(ocr_text)
    assert res["vendor"] == "AGRO DEPOT"
    assert res["date"] == "2026-10-25"
    assert "ambiguous_date" not in res["reasons"]
    assert res["total"] is None
    assert "conflicting_totals" in res["reasons"]
    assert len(res["items"]) >= 1
    assert res["items"][0]["amount"] == 600.0

def test_f1_metadata_exclusion_and_fallback_candidate_rules():
    # Hand-written OCR text with generic receipt vocabulary only
    # F1: Lines with Tel, Phone, Mob, Hotline, Bill No, Invoice, Inv No, Reg, VAT No, Date, Time,
    # or phone-number patterns (0xx-xxxxxxx, +94...) never provide candidate totals or item amounts.
    ocr_text = """
    RURAL SUPPLY OUTLET
    Tel: 011-2345678
    Hotline: +94 77 1234567
    Reg No: 98765432
    VAT No: 45678901
    Date: 2026-05-10
    Time: 14:35
    Bill No: INV-2026-9999
    Garden Trowel    750.00
    Total           750.00
    """
    res = parse_bill_text(ocr_text)
    assert res["total"] == 750.0
    assert len(res["items"]) == 1
    assert res["items"][0]["description"] == "Garden Trowel"
    assert res["items"][0]["amount"] == 750.0

    # Test fallback candidate rule: without currency marker or decimal part, plain integer fails
    ocr_fallback_no_decimal = """
    GENERAL MERCHANDISE
    Tel: 025-2234567
    Item Alpha 500
    Item Beta 400
    """
    res_fallback = parse_bill_text(ocr_fallback_no_decimal)
    assert res_fallback["total"] is None
    assert "total_missing" in res_fallback["reasons"]

    # With currency marker (Rs or /=) or decimal part, fallback succeeds
    ocr_fallback_valid = """
    GENERAL MERCHANDISE
    Tel: 025-2234567
    Item Alpha    Rs. 500
    Item Beta     Rs. 1500
    """
    res_valid = parse_bill_text(ocr_fallback_valid)
    assert res_valid["total"] == 1500.0
    assert "largest_amount_fallback" in res_valid["reasons"]

def test_f2_total_precedence_and_arithmetic_consistency():
    # Hand-written OCR text with generic receipt vocabulary
    # 1. Grand Total outranks Total and Subtotal when arithmetic is consistent:
    # Subtotal 3000 - Discount 200 + Tax 150 = Grand Total 2950
    ocr_consistent = """
    FARM DEPOT
    Date: 2026-06-15
    Subtotal 3000.00
    Discount 200.00
    VAT 150.00
    Total 3000.00
    Grand Total 2950.00
    """
    res_c = parse_bill_text(ocr_consistent)
    assert res_c["total"] == 2950.0
    assert "conflicting_totals" not in res_c["reasons"]

    # 2. Arithmetic inconsistent: Subtotal 3000, Grand Total 2500 with no discount/tax
    ocr_inconsistent = """
    FARM DEPOT
    Date: 2026-06-15
    Subtotal 3000.00
    Grand Total 2500.00
    """
    res_inc = parse_bill_text(ocr_inconsistent)
    assert res_inc["total"] is None
    assert "conflicting_totals" in res_inc["reasons"]

    # 3. Two conflicting equal-rank lines (Amount Payable 1000 vs Amount Due 1200)
    ocr_equal_rank_conflict = """
    FARM DEPOT
    Date: 2026-06-15
    Amount Payable 1000.00
    Amount Due 1200.00
    """
    res_eq = parse_bill_text(ocr_equal_rank_conflict)
    assert res_eq["total"] is None
    assert "conflicting_totals" in res_eq["reasons"]

def test_f3_vendor_header_extraction_clean_and_merged():
    # Hand-written OCR text with generic receipt vocabulary
    # 1. Vendor line merged with address on same line before Tel line
    ocr_merged = """
    SUNSHINE AGRO SUPPLIES 45 Station Road, Anuradhapura
    Tel: 025-2244556
    Date: 2026-07-20
    Hand Sprayer 1200.00
    Total 1200.00
    """
    res1 = parse_bill_text(ocr_merged)
    assert res1["vendor"] == "SUNSHINE AGRO SUPPLIES"

    # 2. Words like STORES and CENTER must not be filtered
    ocr_stores = """
    CENTRAL HARDWARE STORES
    88 Market Street
    Tel: 011-2233445
    Rubber Hose 800.00
    Total 800.00
    """
    res2 = parse_bill_text(ocr_stores)
    assert res2["vendor"] == "CENTRAL HARDWARE STORES"

    ocr_center = """
    NORTHERN FARMERS SERVICE CENTER
    Tel: 021-2223344
    Irrigation Pipe 1500.00
    Total 1500.00
    """
    res3 = parse_bill_text(ocr_center)
    assert res3["vendor"] == "NORTHERN FARMERS SERVICE CENTER"

def test_f4_column_separators_and_qty_at_price_rows():
    # Hand-written OCR text with generic receipt vocabulary
    # Column separators "|" and "||" stripped; multi-line "qty @ price each || amount" row parsed
    ocr_cols = """
    COMMUNITY AGRI MART
    Date: 2026-08-10 || Bill No: INV-100
    Tel: 033-2244556
    Heavy Duty Garden Hoe ||
    2 @ 850.00 each || Rs.1,700.00
    Watering Can 10L
    1 x 1,200.00 || Rs.1,200.00
    Total || Rs.2,900.00
    """
    res = parse_bill_text(ocr_cols)
    assert res["total"] == 2900.0
    assert len(res["items"]) == 2
    # Check that || is stripped from descriptions
    assert "|" not in res["items"][0]["description"]
    assert "|" not in res["items"][1]["description"]
    assert res["items"][0]["description"] == "Heavy Duty Garden Hoe"
    assert res["items"][0]["quantity"] == 2.0
    assert res["items"][0]["amount"] == 1700.0
    assert res["items"][1]["description"] == "Watering Can 10L"
    assert res["items"][1]["quantity"] == 1.0
    assert res["items"][1]["amount"] == 1200.0


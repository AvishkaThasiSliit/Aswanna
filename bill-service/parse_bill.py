import os
import re
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

KEYWORD_MAP_PATH = Path(__file__).resolve().parent.parent / "shared" / "voice" / "keywordMap.json"
CATEGORY_MAP_JS_PATH = Path(__file__).resolve().parent.parent / "shared" / "categoryMap.js"

# Total keyword hierarchy (Precedence: Rank 1 > Rank 2 > Rank 3)
RANK1_TOTAL_KEYWORDS = [
    r"grand\s+total",
    r"net\s+total",
    r"net\s+amount",
    r"total\s+payable",
    r"amount\s+payable",
    r"amount\s+due",
    r"balance\s+due",
    r"net\s+due",
]

RANK2_TOTAL_KEYWORDS = [
    r"මුළු\s*මුදල",
    r"එකතුව",
    r"මුළු",
    r"\btotal\b",
]

RANK3_SUBTOTAL_KEYWORDS = [
    r"sub\s*total",
    r"sub-total",
    r"subtotal",
]

EXPLICIT_TOTAL_KEYWORDS = RANK1_TOTAL_KEYWORDS + RANK2_TOTAL_KEYWORDS
BALANCE_DUE_KEYWORDS = [
    r"balance\s+due",
    r"amount\s+due",
    r"net\s+due",
]
SUBTOTAL_KEYWORDS = RANK3_SUBTOTAL_KEYWORDS

NON_MONETARY_TOTAL_KEYWORDS = [
    r"\btotal\s+(?:qty|quantity|items?|pieces?|pcs|lines?|count)\b",
    r"\b(?:qty|quantity|items?|pieces?|pcs|lines?|count)\s+total\b",
]

DISCOUNT_KEYWORDS = [r"\bdiscount\b", r"\bdisc\b", r"less\s+discount", r"\brebate\b"]
ROUNDING_KEYWORDS = [r"\brounding\b", r"round\s*off", r"round\s+off"]
TAX_KEYWORDS = [r"\btax\b", r"\bvat\b", r"\bgst\b", r"\bnbt\b", r"service\s+charge"]
PAYMENT_KEYWORDS = [r"cash\s+tendered", r"cash", r"tendered", r"change", r"balance", r"paid", r"card", r"advance\s+paid"]

METADATA_LINE_PATTERNS = [
    r"\btel(?:\.|\b|:)",
    r"\bphone\b",
    r"\bmob(?:\.|\b|:)",
    r"\bmobile\b",
    r"\bhotline\b",
    r"\bbill\s*no(?:\.|\b|:)",
    r"\binvoice\b",
    r"\binv\s*no(?:\.|\b|:)",
    r"\breg(?:\.|\b|:)",
    r"\bvat\s*no(?:\.|\b|:)",
    r"\bdate(?:\.|\b|:)",
    r"\btime(?:\.|\b|:)",
]
PHONE_PATTERN = re.compile(r"(?:(?:\+94|0094|0)\s*(?:[1-9]\d|\d{2})[-\s]?\d{6,7}\b)")

def is_metadata_line(line: str) -> bool:
    line_low = line.lower()
    for pat in METADATA_LINE_PATTERNS:
        if re.search(pat, line_low):
            return True
    if PHONE_PATTERN.search(line):
        return True
    return False

GENERIC_HEADERS = {
    "invoice", "tax invoice", "receipt", "cash receipt", "bill", "cash bill",
    "retail invoice", "sales invoice", "estimate", "quotation", "statement",
    "official receipt", "welcome", "thank you", "dispatch note", "order", "cash memo"
}

def load_allowed_categories() -> List[str]:
    """
    Read allowed categories directly from shared/categoryMap.js
    (as enforced by server/src/models/Expense.js).
    """
    if CATEGORY_MAP_JS_PATH.exists():
        try:
            content = CATEGORY_MAP_JS_PATH.read_text(encoding="utf-8")
            m = re.search(r"categoryMap\s*=\s*\{([^}]+)\}", content)
            if m:
                keys = re.findall(r"['\"]?([a-zA-Z0-9_-]+)['\"]?\s*:", m.group(1))
                if keys:
                    return keys
        except Exception:
            pass
    return ["seed", "fertilizer", "agrochemical", "labour", "machinery", "fuel", "irrigation", "other"]

ALLOWED_CATEGORIES = load_allowed_categories()
_CATEGORY_TERMS = None

def load_category_keywords() -> Dict[str, List[str]]:
    global _CATEGORY_TERMS
    if _CATEGORY_TERMS is not None:
        return _CATEGORY_TERMS

    # Map to the strict 8 categories defined in shared/categoryMap.js
    category_map: Dict[str, List[str]] = {cat: [] for cat in ALLOWED_CATEGORIES}

    if KEYWORD_MAP_PATH.exists():
        try:
            with open(KEYWORD_MAP_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            for cat, term_list in data.items():
                cat_lower = cat.lower()
                target_cat = "other"
                if cat_lower in ["seed", "seeds"]:
                    target_cat = "seed"
                elif cat_lower in ["fertilizer", "fertilizers"]:
                    target_cat = "fertilizer"
                elif cat_lower in ["agrochemical", "agrochemicals", "chemical", "chemicals", "pesticide", "weedicide"]:
                    target_cat = "agrochemical"
                elif cat_lower in ["labour", "labor"]:
                    target_cat = "labour"
                elif cat_lower in ["machinery", "tractor", "equipment"]:
                    target_cat = "machinery"
                elif cat_lower in ["fuel", "diesel", "petrol"]:
                    target_cat = "fuel"
                elif cat_lower in ["irrigation", "water"]:
                    target_cat = "irrigation"
                elif cat_lower in ALLOWED_CATEGORIES:
                    target_cat = cat_lower

                for item in term_list:
                    if isinstance(item, dict) and "term" in item:
                        category_map[target_cat].append(item["term"].lower())
                    elif isinstance(item, str):
                        category_map[target_cat].append(item.lower())
        except Exception:
            pass

    _CATEGORY_TERMS = category_map
    return _CATEGORY_TERMS

def match_category(description: str) -> Tuple[str, bool]:
    """
    Returns (category, is_unsure).
    Category is guaranteed to be one of ALLOWED_CATEGORIES.
    Unknown or unmapped items return ('other', True).
    """
    categories = load_category_keywords()
    desc_low = description.lower()
    best_cat = "other"
    longest_match = 0

    for cat, terms in categories.items():
        if cat == "other":
            continue
        for term in terms:
            if term in desc_low:
                if len(term) > longest_match:
                    longest_match = len(term)
                    best_cat = cat

    if best_cat == "other" or longest_match == 0:
        return "other", True
    return best_cat, False

def detect_digit_confusions(text: str) -> List[str]:
    confusions = []
    # Pattern for numbers mixed with O/o (instead of 0), l/I (instead of 1), S/s (instead of 5)
    pattern = re.compile(r"\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[OlISs])[A-Za-z0-9]{2,}\b")
    for match in pattern.finditer(text):
        token = match.group()
        if re.match(r"^\d+(st|nd|rd|th|kg|g|l|ml)$", token, re.IGNORECASE):
            continue
        if re.match(r"^[A-Za-z]+\d+$", token) and len(token) <= 4:
            continue
        if any(c in token for c in "OlISs"):
            confusions.append(token)
    return confusions

def parse_decimal_cents(amt_str: str) -> Optional[Decimal]:
    """Parse monetary string into Decimal cents, then to Decimal amount."""
    cleaned = re.sub(r"(?i)[^0-9.,]", "", amt_str)
    if not cleaned:
        return None

    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) == 2:
            cleaned = parts[0] + "." + parts[1]
        else:
            cleaned = cleaned.replace(",", "")

    try:
        val = Decimal(cleaned)
        cents = (val * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return cents / Decimal(100)
    except Exception:
        return None

def is_total_grounded(total: Decimal, ocr_text: str) -> bool:
    """
    A total is grounded only if its normalised amount (thousands separators removed)
    appears as a whole number token in the OCR text.
    Uses only same-line horizontal space (not newlines), and only as part of matching
    the candidate amount itself (the amount's own digit groups, e.g. '1 250.00' for 1250),
    never by rewriting the whole OCR text.
    Handles 'Total 1,250.00\\n123 Main Street', 'Total 1 250.00', 'Rs.1,250.00',
    'Rs.1250', 'LKR 1250', '1250/=', 'Rs 1,250/=', 'Total 1250.' at line end, and '1250.5'.
    Rejects 'Urea 2 100.00' for total 2100, '12500' for 250, and '2500.00' for 25.
    """
    if not ocr_text or total is None:
        return False

    cents = (total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    int_part = int(total)
    cents_part = int(cents % 100)

    int_str = str(int_part)
    groups = []
    s = int_str
    while len(s) > 3:
        groups.insert(0, s[-3:])
        s = s[:-3]
    groups.insert(0, s)

    comma_grouped = r",".join(groups)
    space_grouped = r"[ \t]".join(groups)

    if cents_part == 0:
        cents_pat = r"(?:\.00?|\.(?!\d))?"
    elif cents_part % 10 == 0:
        single_d = cents_part // 10
        cents_pat = rf"\.{single_d}0?"
    else:
        cents_pat = rf"\.{cents_part:02d}"

    suf = r"(?:[/][=-])?"
    num_pat = rf"(?:{int_str}|{comma_grouped})" if len(groups) > 1 else int_str

    # Boundaries:
    # Not preceded by digit, nor digit+comma, nor digit+space, nor dot preceded by non-letter
    # Not followed by digit, nor comma+digit, nor space+3digits
    lb = r"(?<!\d)(?<!\d,)(?<!\d[ \t])(?<!(?<![A-Za-z])\.)"
    la = r"(?!\d)(?!,\d)(?![ \t]\d{3}\b)"

    # 1. Standard pattern: ungrouped (1250) or comma-grouped (1,250) anywhere with boundaries
    std_pat = rf"{lb}{num_pat}{cents_pat}{suf}{la}"
    if re.search(std_pat, ocr_text):
        return True

    # 2. Space-grouped pattern (e.g. '1 250.00'):
    # Requires currency or total context prefix, or currency suffix (/= or /-)
    if len(groups) > 1:
        ctx_prefix = r"(?:(?:Rs\.?|LKR|රු\.?|Total|Grand\s+total|Net\s+total|Net|Amount|Balance|Due|Payable|මුළු\s*මුදල|එකතුව|මුළු)\s*[:.-]?\s*)"
        space_pat_with_prefix = rf"{ctx_prefix}{space_grouped}{cents_pat}{suf}{la}"
        space_pat_with_suffix = rf"{lb}{space_grouped}{cents_pat}[/][=-]{la}"
        if re.search(space_pat_with_prefix, ocr_text, re.IGNORECASE) or re.search(space_pat_with_suffix, ocr_text):
            return True

    return False

def extract_dates(text: str) -> Tuple[Optional[str], bool, Optional[str]]:
    lines = text.splitlines()
    MONTH_NAMES = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
        "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
        "january": "01", "february": "02", "march": "03", "april": "04", "june": "06",
        "july": "07", "august": "08", "september": "09", "october": "10", "november": "11", "december": "12"
    }

    # 1. Named Month: 12 Oct 2026 or 12-Oct-2026
    named_month_pat = re.compile(r"\b(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})\b", re.IGNORECASE)
    for line in lines:
        m = named_month_pat.search(line)
        if m:
            d_str, mon_str, y_str = m.group(1), m.group(2).lower(), m.group(3)
            if mon_str in MONTH_NAMES:
                month = MONTH_NAMES[mon_str]
                day = f"{int(d_str):02d}"
                year = f"20{y_str}" if len(y_str) == 2 else y_str
                return f"{year}-{month}-{day}", False, m.group(0)

    # 2. YYYY-MM-DD
    iso_pat = re.compile(r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b")
    for line in lines:
        m = iso_pat.search(line)
        if m:
            year, m_str, d_str = m.group(1), m.group(2), m.group(3)
            month_val = int(m_str)
            day_val = int(d_str)
            if 1 <= month_val <= 12 and 1 <= day_val <= 31:
                return f"{year}-{month_val:02d}-{day_val:02d}", False, m.group(0)

    # 3. DD/MM/YYYY or MM/DD/YYYY
    dmy_pat = re.compile(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b")
    for line in lines:
        m = dmy_pat.search(line)
        if m:
            p1, p2, y_str = int(m.group(1)), int(m.group(2)), m.group(3)
            year = f"20{y_str}" if len(y_str) == 2 else y_str
            if 1 <= p1 <= 31 and 1 <= p2 <= 12:
                day = p1
                month = p2
                ambiguous = (p1 <= 12 and p2 <= 12 and p1 != p2)
                return f"{year}-{month:02d}-{day:02d}", ambiguous, m.group(0)
            elif 1 <= p2 <= 31 and 1 <= p1 <= 12:
                return f"{year}-{p1:02d}-{p2:02d}", True, m.group(0)

    return None, False, None

def extract_vendor(text: str) -> Optional[str]:
    """
    Extract vendor from the first non-numeric header lines before Tel or Date lines.
    Case-insensitive, does not filter domain terms like STORES or CENTER.
    Splits off street addresses if grouped on the same line by OCR.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    header_lines = []
    for l in lines:
        low = l.lower()
        if re.search(r"\b(tel|phone|mob|mobile|hotline|date|bill\s*no|inv\s*no)\b", low) or PHONE_PATTERN.search(l):
            m = re.search(r"\b(tel|phone|mob|mobile|hotline|date|bill\s*no|inv\s*no)\b", low)
            if m:
                prefix = l[:m.start()].strip()
                if prefix and len(prefix) >= 3:
                    header_lines.append(prefix)
            break
        if re.match(r"^[-=_*#\s]{3,}$", l):
            continue
        header_lines.append(l)
        if len(header_lines) >= 4:
            break

    for line in header_lines:
        low = line.lower()
        if low in GENERIC_HEADERS:
            continue
        # Split off address if merged on same line (e.g. '33 Hospital Road', 'Colombo Road', '88 Market Road', '5@ Commercial Zone')
        parts = re.split(
            r"\s+(?=(?:no\.?\s*)?\d+[^\w\s]?\s+[A-Za-z]+|\b[A-Za-z]+\s+(?:road|street|lane|ave|avenue|highway|rd|st|zone)\b)",
            line,
            flags=re.IGNORECASE
        )
        candidate = parts[0].strip()
        candidate = re.sub(r"[,:\-–]+$", "", candidate).strip()
        if len(candidate) >= 3 and re.search(r"[A-Za-z\u0D80-\u0DFF]{3,}", candidate):
            if not re.match(r"^\d+[\s\d./-]*$", candidate):
                return candidate

    return None

def extract_amounts_from_line(line: str) -> List[Tuple[Decimal, str]]:
    amounts = []
    pat = re.compile(r"(?:(?:Rs\.?|LKR)\s*)?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\b", re.IGNORECASE)
    for m in pat.finditer(line):
        token = m.group(1).replace(" ", "")
        if "." not in token and "," not in token and len(token) <= 2:
            continue
        dec = parse_decimal_cents(token)
        if dec and dec > 0:
            amounts.append((dec, m.group(0)))
    return amounts

def is_valid_fallback_amount(dec: Decimal, raw: str, line: str) -> bool:
    """
    Fallback candidates must have a decimal part or a currency marker (Rs, LKR, /=);
    otherwise rejected (F1).
    """
    if "." in raw and re.search(r"\.\d+", raw):
        return True
    if re.search(r"(?i)(?:rs\.?|lkr|රු\.?|/[=-])", raw):
        return True
    # Check if currency marker is immediately adjacent in line
    if re.search(rf"(?:(?:Rs\.?|LKR|රු\.?)\s*{re.escape(raw)}|{re.escape(raw)}\s*(?:/[=-]|Rs\.?|LKR))", line, re.IGNORECASE):
        return True
    return False

def parse_bill_text(ocr_text: str, ocr_words: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Pure function parsing OCR text into the canonical Aswanna bill extraction schema.
    """
    reasons: List[str] = []
    status = "ok"

    if not ocr_text or not ocr_text.strip():
        return {
            "source": "bill",
            "vendor": None,
            "date": None,
            "total": None,
            "items": [],
            "status": "needs_review",
            "reasons": ["empty_ocr_text"],
            "rawText": "",
            "confidence": 0.0
        }

    # 1. Check for digit confusions
    confusions = detect_digit_confusions(ocr_text)
    if confusions:
        reasons.append("ocr_digit_confusion")
        status = "needs_review"

    # 2. Date extraction
    iso_date, is_ambiguous, date_match = extract_dates(ocr_text)
    if is_ambiguous:
        reasons.append("ambiguous_date")
        status = "needs_review"

    # 3. Vendor extraction
    vendor = extract_vendor(ocr_text)

    # 4. Total Extraction with Precedence and Consistency (F1 & F2)
    lines = [l.strip() for l in ocr_text.splitlines() if l.strip()]

    rank1_matches: List[Tuple[Decimal, str, str]] = []  # (amount, raw, line)
    rank2_matches: List[Tuple[Decimal, str, str]] = []
    rank3_matches: List[Tuple[Decimal, str, str]] = []
    discount_val: Optional[Decimal] = None
    tax_val: Optional[Decimal] = None
    rounding_val: Optional[Decimal] = None

    for idx, line in enumerate(lines):
        # F1: Lines containing Tel, Phone, Mob, Hotline, Bill No, Invoice, Inv No, Reg, VAT No, Date or Time,
        # and phone-number patterns (0xx-xxxxxxx, +94...), never provide candidate totals or item amounts.
        if is_metadata_line(line):
            continue

        line_low = line.lower()

        # Exclude non-monetary total lines ("Total Qty 5", "Total items 3")
        if any(re.search(kw, line_low) for kw in NON_MONETARY_TOTAL_KEYWORDS):
            continue

        # Check discount and tax lines
        if any(re.search(kw, line_low) for kw in DISCOUNT_KEYWORDS):
            amts = extract_amounts_from_line(line)
            if amts:
                discount_val = amts[-1][0]
            continue
        if any(re.search(kw, line_low) for kw in TAX_KEYWORDS):
            amts = extract_amounts_from_line(line)
            if amts:
                tax_val = amts[-1][0]
            continue
        if any(re.search(kw, line_low) for kw in ROUNDING_KEYWORDS):
            m_round = re.search(r"(-)?\s*(?:(?:Rs\.?|LKR)\s*)?([0-9]+(?:\.[0-9]+)?)", line)
            if m_round:
                sign = -1 if m_round.group(1) == "-" or "-" in line else 1
                try:
                    rounding_val = Decimal(m_round.group(2)) * sign
                except Exception:
                    pass
            continue
        # Check Rank 1: Net Total, Grand Total, Amount Payable, Amount Due, Balance Due
        is_rank1 = any(re.search(r"\b" + kw + r"\b", line_low) for kw in RANK1_TOTAL_KEYWORDS)
        if is_rank1:
            amts = extract_amounts_from_line(line)
            if amts:
                rank1_matches.append((amts[-1][0], amts[-1][1], line))
            elif idx + 1 < len(lines) and not is_metadata_line(lines[idx + 1]):
                next_amts = extract_amounts_from_line(lines[idx + 1])
                if next_amts:
                    rank1_matches.append((next_amts[-1][0], next_amts[-1][1], line))
            continue

        # Check Rank 3: Subtotal (checked before Rank 2 so 'Sub Total' is not caught by '\btotal\b')
        is_rank3 = any(re.search(r"\b" + kw + r"\b", line_low) for kw in RANK3_SUBTOTAL_KEYWORDS)
        if is_rank3:
            amts = extract_amounts_from_line(line)
            if amts:
                rank3_matches.append((amts[-1][0], amts[-1][1], line))
            elif idx + 1 < len(lines) and not is_metadata_line(lines[idx + 1]):
                next_amts = extract_amounts_from_line(lines[idx + 1])
                if next_amts:
                    rank3_matches.append((next_amts[-1][0], next_amts[-1][1], line))
            continue

        # Exclude payment/tendered lines (now safe because Balance Due was handled in Rank 1)
        if any(re.search(r"\b" + kw + r"\b", line_low) for kw in PAYMENT_KEYWORDS):
            continue

        # Check Rank 2: Total, මුළු මුදල, එකතුව, මුළු
        is_rank2 = any(re.search(r"\b" + kw + r"\b", line_low) for kw in RANK2_TOTAL_KEYWORDS)
        if is_rank2:
            amts = extract_amounts_from_line(line)
            if amts:
                rank2_matches.append((amts[-1][0], amts[-1][1], line))
            elif idx + 1 < len(lines) and not is_metadata_line(lines[idx + 1]):
                next_amts = extract_amounts_from_line(lines[idx + 1])
                if next_amts:
                    rank2_matches.append((next_amts[-1][0], next_amts[-1][1], line))
            continue

    total_val: Optional[Decimal] = None
    total_matched_raw: Optional[str] = None

    subtotal_val = rank3_matches[0][0] if rank3_matches else None
    rank2_val = rank2_matches[0][0] if rank2_matches else None

    # Total precedence: Rank 1 > Rank 2 > Rank 3 (F2)
    # Accept the chosen line only if the arithmetic is consistent where the lines exist
    # (subtotal minus discount plus tax equals the chosen total, exact cents),
    # or if there is a single top-ranked line with no conflicting equal-rank line.
    # Otherwise keep conflicting_totals and null.
    if rank1_matches:
        distinct_r1 = {m[0] for m in rank1_matches}
        if len(distinct_r1) > 1:
            reasons.append("conflicting_totals")
            status = "needs_review"
            total_val = None
        else:
            cand1 = rank1_matches[0][0]
            is_bal_due = any(re.search(r"balance\s+due", m[2].lower()) for m in rank1_matches)
            if is_bal_due and rank2_val is not None and rank2_val != cand1:
                # Ambiguity between Total and Balance Due
                reasons.append("ambiguous_balance_due")
                reasons.append("conflicting_totals")
                status = "needs_review"
                total_val = None
            else:
                base = subtotal_val if subtotal_val is not None else rank2_val
                if base is not None and base != cand1:
                    expected = base - (discount_val or Decimal(0)) + (tax_val or Decimal(0)) + (rounding_val or Decimal(0))
                    if expected == cand1:
                        total_val = cand1
                        total_matched_raw = rank1_matches[0][1]
                    else:
                        reasons.append("conflicting_totals")
                        status = "needs_review"
                        total_val = None
                else:
                    total_val = cand1
                    total_matched_raw = rank1_matches[0][1]
                if is_bal_due and total_val is not None:
                    reasons.append("balance_due_used_as_total")
                    status = "needs_review"
    elif rank2_matches:
        distinct_r2 = {m[0] for m in rank2_matches}
        if len(distinct_r2) > 1:
            reasons.append("conflicting_totals")
            status = "needs_review"
            total_val = None
        else:
            cand2 = rank2_matches[0][0]
            if subtotal_val is not None and subtotal_val != cand2:
                expected = subtotal_val - (discount_val or Decimal(0)) + (tax_val or Decimal(0)) + (rounding_val or Decimal(0))
                if expected == cand2:
                    total_val = cand2
                    total_matched_raw = rank2_matches[0][1]
                else:
                    reasons.append("conflicting_totals")
                    status = "needs_review"
                    total_val = None
            else:
                total_val = cand2
                total_matched_raw = rank2_matches[0][1]
    elif rank3_matches:
        distinct_r3 = {m[0] for m in rank3_matches}
        if len(distinct_r3) == 1:
            total_val = rank3_matches[0][0]
            total_matched_raw = rank3_matches[0][1]
        else:
            reasons.append("conflicting_totals")
            status = "needs_review"
            total_val = None
    else:
        # Fallback to largest non-payment, non-discount amount if total still missing (F1)
        candidate_amounts = []
        for line in lines:
            if is_metadata_line(line):
                continue
            line_low = line.lower()
            if any(re.search(kw, line_low) for kw in NON_MONETARY_TOTAL_KEYWORDS):
                continue
            if any(re.search(r"\b" + kw + r"\b", line_low) for kw in PAYMENT_KEYWORDS + TAX_KEYWORDS + DISCOUNT_KEYWORDS + ROUNDING_KEYWORDS + RANK3_SUBTOTAL_KEYWORDS):
                continue
            amts = extract_amounts_from_line(line)
            for dec, raw in amts:
                if is_valid_fallback_amount(dec, raw, line):
                    candidate_amounts.append((dec, raw))

        if candidate_amounts:
            candidate_amounts.sort(key=lambda x: x[0], reverse=True)
            total_val = candidate_amounts[0][0]
            total_matched_raw = candidate_amounts[0][1]
            reasons.append("largest_amount_fallback")
            status = "needs_review"
        else:
            reasons.append("total_missing")
            reasons.append("missing_total")
            status = "needs_review"

    # Line Items extraction (best effort) (F1 & F4)
    items: List[Dict[str, Any]] = []
    pending_desc: Optional[str] = None

    for line in lines:
        if is_metadata_line(line):
            pending_desc = None
            continue

        line_low = line.lower()

        # If a total keyword is embedded later in the line (e.g. at the end of item list), truncate line
        split_match = re.search(r"\b(?=sub\s*total|subtotal|total\s+items|total\s+qty|grand\s+total|net\s+total|total\b)\b", line_low)
        if split_match and split_match.start() > 5:
            line = line[:split_match.start()].strip()
            line_low = line.lower()
        elif any(re.search(r"\b" + kw + r"\b", line_low) for kw in EXPLICIT_TOTAL_KEYWORDS + BALANCE_DUE_KEYWORDS + SUBTOTAL_KEYWORDS + TAX_KEYWORDS + PAYMENT_KEYWORDS + DISCOUNT_KEYWORDS + ROUNDING_KEYWORDS):
            pending_desc = None
            continue

        if any(re.search(kw, line_low) for kw in NON_MONETARY_TOTAL_KEYWORDS):
            pending_desc = None
            continue
        if vendor and vendor.lower() in line_low:
            pending_desc = None
            continue
        if date_match and date_match.lower() in line_low:
            pending_desc = None
            continue
        if re.match(r"^[-=_*#\s]{3,}$", line):
            continue

        # Handle "qty @ price each || amount" or "qty x price = amount" row pattern
        mult_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:x|@)\s*([0-9.,]+)\s*(?:each)?\s*(?:\|{1,2})?\s*(?:(?:Rs\.?|LKR)\s*)?([0-9.,]+(?:/[=-])?)", line, re.IGNORECASE)
        if mult_match:
            try:
                qty = float(mult_match.group(1))
                unit_price = float(parse_decimal_cents(mult_match.group(2)) or 0)
                amt_dec = parse_decimal_cents(mult_match.group(3))
                if amt_dec and amt_dec > 0:
                    prefix = line[:mult_match.start()].strip()
                    # Strip column separators | and ||
                    prefix = re.sub(r"\|+", " ", prefix).strip()
                    if prefix and len(prefix) >= 3 and not re.match(r"^\d+$", prefix):
                        desc = prefix
                    elif pending_desc:
                        desc = pending_desc
                    else:
                        desc = "Expense item"

                    # Strip column separators and currency from description
                    desc = re.sub(r"\|+", " ", desc)
                    desc = re.sub(r"(?i)\b(rs\.?|lkr)\b", "", desc).strip()
                    desc = re.sub(r"\s+", " ", desc).strip()
                    if len(desc) < 2:
                        desc = "Expense item"

                    item_cat, is_unsure = match_category(desc)
                    item_reasons = ["line_item_unverified"]
                    if is_unsure:
                        item_reasons.append("category_unsure")
                        reasons.append("category_unsure")
                        status = "needs_review"

                    items.append({
                        "category": item_cat,
                        "quantity": qty,
                        "amount": float(amt_dec),
                        "description": desc,
                        "date": iso_date,
                        "status": "needs_review",
                        "reasons": item_reasons,
                        "source": "bill"
                    })
                    pending_desc = None
                    continue
            except Exception:
                pass

        amts = extract_amounts_from_line(line)
        if amts:
            item_amt = amts[-1][0]
            raw_amt_str = amts[-1][1]
            idx_amt = line.rfind(raw_amt_str)
            desc = line[:idx_amt].strip() if idx_amt != -1 else line.replace(raw_amt_str, "").strip()
            # Strip column separators | and ||
            desc = re.sub(r"\|+", " ", desc)
            desc = re.sub(r"(?i)\b(rs\.?|lkr)\b", "", desc).strip()
            desc = re.sub(r"\s+", " ", desc).strip()
            if len(desc) < 2:
                if pending_desc:
                    desc = pending_desc
                else:
                    desc = "Expense item"

            qty = None
            qty_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:x|bags?|kg|pkts?|packets?|units?|bottles?|liters?|l)\b", desc, re.IGNORECASE)
            if qty_match:
                try:
                    qty = float(qty_match.group(1))
                except Exception:
                    pass

            item_cat, is_unsure = match_category(desc)
            item_reasons = ["line_item_unverified"]
            if is_unsure:
                item_reasons.append("category_unsure")
                reasons.append("category_unsure")
                status = "needs_review"

            items.append({
                "category": item_cat,
                "quantity": qty,
                "amount": float(item_amt),
                "description": desc,
                "date": iso_date,
                "status": "needs_review",
                "reasons": item_reasons,
                "source": "bill"
            })
            pending_desc = None
        else:
            # Line without amounts: candidate description for the next row
            cleaned = re.sub(r"\|+", " ", line).strip()
            if len(cleaned) >= 3 and not re.match(r"^\d+$", cleaned):
                pending_desc = cleaned

    # 5. Check sum of items vs total
    if items and total_val is not None:
        items_sum = sum(Decimal(str(it["amount"])) for it in items)
        if items_sum != total_val:
            reasons.append("sum_mismatch")
            status = "needs_review"

    # 6. A2 Grounding: whole number token validation
    if total_val is not None:
        if not is_total_grounded(total_val, ocr_text):
            total_val = None
            reasons.append("total_not_in_ocr_text")
            status = "needs_review"

    # Calculate average confidence if word list provided
    confidence = None
    if ocr_words:
        confs = [w["confidence"] for w in ocr_words if "confidence" in w and w["confidence"] is not None]
        if confs:
            confidence = round(sum(confs) / len(confs), 2)

    return {
        "source": "bill",
        "vendor": vendor,
        "date": iso_date,
        "total": float(total_val) if total_val is not None else None,
        "items": items,
        "status": status,
        "reasons": sorted(list(set(reasons))),
        "rawText": ocr_text,
        "confidence": confidence
    }

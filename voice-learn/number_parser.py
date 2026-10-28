"""
Deterministic English Number Parser (Task E1)
Mirrors rule-based parser behavior for English numbers.
Parses digits with commas, and English number words.
Enforces near-miss protection: any unknown token inside a phrase returns None, never a truncated value.
Verifies literal presence of extracted numbers in source transcript.
"""

import re
from typing import Optional, Union

ENGLISH_NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
    "hundred": 100,
    "thousand": 1000
}


def parse_english_number_words(phrase: str) -> Optional[int]:
    """
    Parses English number words into an integer.
    If any token is not a recognized number word, returns None (never a partial/truncated amount).
    """
    if not phrase or not isinstance(phrase, str):
        return None
        
    words = phrase.lower().strip().split()
    if not words:
        return None
        
    total = 0
    current = 0
    matched_any = False
    
    for w in words:
        if w == "and":
            # Optional conjunction inside compound numbers (e.g., 'two thousand and five hundred')
            continue
        if w in ENGLISH_NUMBER_WORDS:
            matched_any = True
            val = ENGLISH_NUMBER_WORDS[w]
            if val == 100:
                current = (current if current > 0 else 1) * 100
            elif val == 1000:
                current = (current if current > 0 else 1) * 1000
                total += current
                current = 0
            else:
                current += val
        else:
            # Unknown or near-miss token: abort entirely to prevent truncated numbers
            return None
            
    if not matched_any:
        return None
    return total + current


def parse_digits_with_commas(span: str) -> Optional[Union[int, float]]:
    """
    Parses numeric digits with optional comma separators and decimals.
    Returns None if malformed or containing letters/invalid characters.
    """
    if not span or not isinstance(span, str):
        return None
        
    clean = span.strip()
    # Check for valid digit pattern: optional commas, optional single decimal
    if not re.match(r"^\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$", clean):
        return None
        
    try:
        val_str = clean.replace(",", "")
        if "." in val_str:
            val = float(val_str)
        else:
            val = int(val_str)
        return val if val > 0 else None
    except ValueError:
        return None


def parse_amount_span(span: str) -> Optional[Union[int, float]]:
    """
    Attempts to parse an amount span either from digits or number words.
    Returns None if unparseable or near-miss.
    """
    if not span or not isinstance(span, str):
        return None
        
    clean = span.strip()
    
    # Check if purely digits/commas
    digit_res = parse_digits_with_commas(clean)
    if digit_res is not None:
        return digit_res
        
    # Check if number words
    word_res = parse_english_number_words(clean)
    if word_res is not None:
        return word_res
        
    # Check if string has leading/trailing currency or unit that can be cleanly stripped
    stripped = re.sub(r"^(?:rs\.?|lkr)\s*", "", clean, flags=re.I)
    stripped = re.sub(r"\s*(?:rupees|rs\.?|lkr)$", "", stripped, flags=re.I).strip()
    if stripped != clean:
        digit_res = parse_digits_with_commas(stripped)
        if digit_res is not None:
            return digit_res
        word_res = parse_english_number_words(stripped)
        if word_res is not None:
            return word_res
            
    return None


def is_number_literally_in_transcript(amount: Union[int, float], transcript: str) -> bool:
    """
    Verifies that the numeric amount literally appears in the source transcript
    either as digits (formatted or unformatted) or as English number words.
    Prevents the learned extractor from hallucinating values.
    """
    if not transcript or amount is None:
        return False
        
    trans_lower = transcript.lower()
    
    # 1. Direct integer string check
    if isinstance(amount, (int, float)):
        int_val = int(amount)
        if str(int_val) in trans_lower:
            return True
        # Formatted with commas check (e.g. 14,000)
        formatted_comma = f"{int_val:,}"
        if formatted_comma in trans_lower:
            return True
            
    # 2. Check if words representation appears in transcript
    # Check all word spans in transcript
    words = trans_lower.split()
    for i in range(len(words)):
        for j in range(i + 1, min(i + 8, len(words) + 1)):
            phrase = " ".join(words[i:j])
            p_val = parse_english_number_words(phrase)
            if p_val == amount:
                return True
                
    return False

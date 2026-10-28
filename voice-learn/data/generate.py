"""
Synthetic Data Generator for Aswanna Voice Learned Extractor (Task E1)
Deterministic, seeded generation with BIO token labeling and declared ASR noise augmentation.
Includes strict leakage guards against real captured fixtures and forbidden amounts.
"""

import json
import os
import re
import random
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

# Leakage Guard Constants
FORBIDDEN_AMOUNTS = {14000, 8500, 7500, 12000, 3200, 6000, 6800, 4500, 2500, 5000, 1500, 1200}

# Stated ASR Noise Probabilities (declared before evaluation)
NOISE_PROBABILITIES = {
    "drop_currency": 0.35,
    "digit_noise": 0.15,
    "merge_numbers": 0.10,
    "phonetic_sub": 0.20,
    "drop_connector": 0.25,
    "corrupt_verb": 0.20,
}

PHONETIC_SUBSTITUTIONS = {
    "urea": "you rear",
    "fertilizer": "fertile iser",
    "paddy": "party",
    "diesel": "d sell",
    "tractor": "track tour",
    "plowing": "plough in",
    "weeding": "reading",
    "herbicide": "her beside",
    "bowser": "browser",
    "combine": "come bine",
    "rotavator": "rota vator",
    "chemical": "came call",
    "seedling": "seed ling",
}

VERB_CORRUPTIONS = {
    "paid": "pay",
    "bought": "boat",
    "spent": "spend",
    "purchased": "purchase",
    "used": "use",
    "gave": "give",
    "cost": "coast",
}

ALLOWED_AMOUNTS = [
    350, 400, 650, 750, 800, 950, 1100, 1300, 1600, 1800, 2100, 2200, 2400,
    2700, 2800, 3100, 3300, 3500, 3800, 4200, 4400, 4600, 4900, 5100, 5300,
    5500, 6200, 6500, 7000, 7200, 7800, 8200, 8700, 9000, 9500, 10500, 11000,
    11500, 13000, 13500, 15000, 16000, 17500, 18000, 19000, 21000, 22000,
    24000, 26000, 28000, 30000, 35000, 40000, 45000, 50000
]

# Ensure no allowed amounts overlap with forbidden amounts
assert not any(a in FORBIDDEN_AMOUNTS for a in ALLOWED_AMOUNTS), "Allowed amounts overlap with forbidden amounts!"

ALLOWED_QUANTITIES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50]
QTY_WORDS = {
    1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
    8: "eight", 10: "ten", 12: "twelve", 15: "fifteen", 20: "twenty"
}

ALLOWED_UNITS = [
    "kg", "kgs", "bags", "liters", "l", "bottles", "hours", "days",
    "acres", "packets", "workers", "labourers"
]

CURRENCIES = ["rupees", "rs", "lkr"]
CONNECTORS = ["and", "also", "then", "plus"]
DATE_WORDS = ["today", "yesterday", "last week", "on monday", "this morning"]
VERBS = ["paid", "spent", "bought", "purchased", "used", "gave", "cost"]


class LeakageError(Exception):
    """Raised when synthetic generation violates leakage guard."""
    pass


def normalize_text(text: str) -> str:
    """Normalizes text by lowercasing, stripping punctuation, and collapsing whitespace."""
    if not text:
        return ""
    cleaned = re.sub(r"[^a-z0-9]", " ", text.lower())
    return " ".join(cleaned.split())


def load_real_captured_sentences(fixtures_dir: Optional[Path] = None) -> set:
    """
    Loads normalized transcripts from real captured fixture files for leakage check.
    Does not copy or use them for template generation.
    """
    if fixtures_dir is None:
        fixtures_dir = Path(__file__).resolve().parent.parent.parent / "server" / "eval" / "fixtures" / "voice"
    
    forbidden = set()
    files = [
        "real-asr.captured.json",
        "real-asr.repeat1.captured.json",
        "real-asr.take3.clean.json",
        "real-asr.take3.captured.json"
    ]
    for fn in files:
        fp = fixtures_dir / fn
        if fp.exists():
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for r in data:
                        raw = r.get("rawTranscript")
                        prompt = r.get("promptText")
                        if raw:
                            forbidden.add(normalize_text(raw))
                        if prompt:
                            forbidden.add(normalize_text(prompt))
                        for alt in r.get("alternatives", []):
                            forbidden.add(normalize_text(alt))
            except Exception:
                pass
    return forbidden


def load_english_keyword_map(keyword_map_path: Optional[Path] = None) -> Dict[str, List[str]]:
    """Loads English terms from shared/voice/keywordMap.json grouped by category."""
    if keyword_map_path is None:
        keyword_map_path = Path(__file__).resolve().parent.parent.parent / "shared" / "voice" / "keywordMap.json"
    
    with open(keyword_map_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    category_terms = {}
    for cat, entries in data.items():
        terms = []
        for e in entries:
            if e.get("lang") == "en":
                t = e.get("term", "").strip().lower()
                if t:
                    terms.append(t)
        if terms:
            category_terms[cat] = sorted(list(set(terms)))
    return category_terms


def number_to_words_amount(n: int) -> str:
    """Converts common agricultural expense amounts into English words."""
    ones = {
        1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven",
        8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen",
        14: "fourteen", 15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen",
        19: "nineteen"
    }
    tens = {
        20: "twenty", 30: "thirty", 40: "forty", 50: "fifty", 60: "sixty",
        70: "seventy", 80: "eighty", 90: "ninety"
    }
    
    if n < 20:
        return ones.get(n, str(n))
    if n < 100:
        t = (n // 10) * 10
        r = n % 10
        return f"{tens[t]} {ones[r]}" if r > 0 else tens[t]
    if n < 1000:
        h = n // 100
        r = n % 100
        rest = f" {number_to_words_amount(r)}" if r > 0 else ""
        return f"{ones[h]} hundred{rest}"
    
    # 1000 and above
    k = n // 1000
    r = n % 1000
    k_str = f"{number_to_words_amount(k)} thousand"
    if r == 0:
        return k_str
    if r < 100:
        return f"{k_str} and {number_to_words_amount(r)}"
    return f"{k_str} {number_to_words_amount(r)}"


def build_synthetic_item(
    rng: random.Random,
    category_terms: Dict[str, List[str]],
    forbidden_amounts: set
) -> Dict[str, Any]:
    """Generates an individual expense component with metadata."""
    category = rng.choice(list(category_terms.keys()))
    item_term = rng.choice(category_terms[category])
    
    # Choose amount strictly outside forbidden_amounts
    amount = rng.choice(ALLOWED_AMOUNTS)
    if amount in forbidden_amounts:
        raise LeakageError(f"Leakage violation: Amount {amount} in forbidden set!")
    
    has_qty = rng.random() < 0.65
    qty = rng.choice(ALLOWED_QUANTITIES) if has_qty else None
    unit = rng.choice(ALLOWED_UNITS) if has_qty else None
    
    qty_as_word = rng.random() < 0.35 and qty in QTY_WORDS
    qty_str = QTY_WORDS[qty] if (has_qty and qty_as_word) else (str(qty) if has_qty else None)
    
    amount_as_word = rng.random() < 0.30
    if amount_as_word:
        amount_str = number_to_words_amount(amount)
    else:
        # 20% chance of comma formatting
        amount_str = f"{amount:,}" if rng.random() < 0.20 else str(amount)
        
    currency = rng.choice(CURRENCIES) if rng.random() < 0.85 else None
    
    return {
        "category": category,
        "item_term": item_term,
        "quantity": qty,
        "qty_str": qty_str,
        "unit": unit,
        "amount": amount,
        "amount_str": amount_str,
        "currency": currency,
    }


def tokenize_with_tag(text: str, tag: str) -> List[Tuple[str, str]]:
    """Tokenizes text and applies BIO tagging."""
    tokens = [t for t in re.findall(r"\w+|[^\w\s]", text) if t.strip()]
    if not tokens:
        return []
    if tag == "O":
        return [(t, "O") for t in tokens]
    res = [(tokens[0], f"B-{tag}")]
    for t in tokens[1:]:
        res.append((t, f"I-{tag}"))
    return res


def assemble_sentence(
    rng: random.Random,
    items: List[Dict[str, Any]],
    apply_noise: bool = True
) -> Tuple[List[Tuple[str, str]], List[Dict[str, Any]], str]:
    """
    Assembles 1-3 expense items into a coherent sentence with token BIO tags.
    Applies declared ASR noise augmentation if apply_noise is True.
    """
    token_pairs: List[Tuple[str, str]] = []
    
    # Optional leading date
    if rng.random() < 0.25:
        date_word = rng.choice(DATE_WORDS)
        token_pairs.extend(tokenize_with_tag(date_word, "O"))
    
    for idx, it in enumerate(items):
        if idx > 0:
            connector = rng.choice(CONNECTORS)
            token_pairs.extend(tokenize_with_tag(connector, "O"))
            
        template_type = rng.choice(["verb_qty_item_amt", "verb_item_amt", "item_amt", "verb_amt_item"])
        verb = rng.choice(VERBS)
        
        # Noise: corrupt verb
        if apply_noise and idx == 0 and rng.random() < NOISE_PROBABILITIES["corrupt_verb"]:
            verb = VERB_CORRUPTIONS.get(verb, verb)
            
        item_text = it["item_term"]
        # Noise: phonetic substitution
        if apply_noise and rng.random() < NOISE_PROBABILITIES["phonetic_sub"]:
            for original, sub in PHONETIC_SUBSTITUTIONS.items():
                if original in item_text:
                    item_text = item_text.replace(original, sub)
                    break
        
        amount_text = it["amount_str"]
        # Noise: digit noise
        if apply_noise and re.match(r"^\d+$", amount_text) and rng.random() < NOISE_PROBABILITIES["digit_noise"]:
            if len(amount_text) > 3 and rng.random() < 0.5:
                corrupted = amount_text[:-1]  # drop last digit
            else:
                corrupted = amount_text + "0"  # append digit
            try:
                c_val = int(corrupted)
                if c_val not in FORBIDDEN_AMOUNTS and c_val > 0:
                    amount_text = corrupted
                    it["amount"] = c_val
            except ValueError:
                pass
                
        currency_text = it["currency"]
        # Noise: drop currency
        if apply_noise and currency_text and rng.random() < NOISE_PROBABILITIES["drop_currency"]:
            currency_text = None
            
        drop_conn = apply_noise and (rng.random() < NOISE_PROBABILITIES["drop_connector"])
        
        if template_type == "verb_qty_item_amt" and it["qty_str"] and it["unit"]:
            token_pairs.extend(tokenize_with_tag(verb, "O"))
            token_pairs.extend(tokenize_with_tag(it["qty_str"], "QTY"))
            token_pairs.extend(tokenize_with_tag(it["unit"], "UNIT"))
            if not drop_conn:
                token_pairs.extend(tokenize_with_tag("of", "O"))
            token_pairs.extend(tokenize_with_tag(item_text, "ITEM"))
            if not drop_conn:
                token_pairs.extend(tokenize_with_tag("for", "O"))
            token_pairs.extend(tokenize_with_tag(amount_text, "AMOUNT"))
            if currency_text:
                token_pairs.extend(tokenize_with_tag(currency_text, "O"))
        elif template_type == "verb_amt_item":
            token_pairs.extend(tokenize_with_tag(verb, "O"))
            token_pairs.extend(tokenize_with_tag(amount_text, "AMOUNT"))
            if currency_text:
                token_pairs.extend(tokenize_with_tag(currency_text, "O"))
            if not drop_conn:
                token_pairs.extend(tokenize_with_tag("for", "O"))
            token_pairs.extend(tokenize_with_tag(item_text, "ITEM"))
        elif template_type == "item_amt":
            if it["qty_str"] and it["unit"]:
                token_pairs.extend(tokenize_with_tag(it["qty_str"], "QTY"))
                token_pairs.extend(tokenize_with_tag(it["unit"], "UNIT"))
            token_pairs.extend(tokenize_with_tag(item_text, "ITEM"))
            token_pairs.extend(tokenize_with_tag(amount_text, "AMOUNT"))
            if currency_text:
                token_pairs.extend(tokenize_with_tag(currency_text, "O"))
        else:  # verb_item_amt
            token_pairs.extend(tokenize_with_tag(verb, "O"))
            if it["qty_str"] and it["unit"]:
                token_pairs.extend(tokenize_with_tag(it["qty_str"], "QTY"))
                token_pairs.extend(tokenize_with_tag(it["unit"], "UNIT"))
            token_pairs.extend(tokenize_with_tag(item_text, "ITEM"))
            if not drop_conn:
                token_pairs.extend(tokenize_with_tag("for", "O"))
            token_pairs.extend(tokenize_with_tag(amount_text, "AMOUNT"))
            if currency_text:
                token_pairs.extend(tokenize_with_tag(currency_text, "O"))
                
    # Build raw transcript sentence from tokens
    sentence_text = " ".join([t[0] for t in token_pairs])
    return token_pairs, items, sentence_text


def generate_dataset(
    num_samples: int,
    seed: int,
    apply_noise: bool = True,
    forbidden_sentences: Optional[set] = None
) -> List[Dict[str, Any]]:
    """
    Generates a deterministic synthetic dataset with strict leakage enforcement.
    """
    rng = random.Random(seed)
    category_terms = load_english_keyword_map()
    
    if forbidden_sentences is None:
        forbidden_sentences = load_real_captured_sentences()
        
    dataset = []
    attempts = 0
    max_attempts = num_samples * 20
    
    while len(dataset) < num_samples and attempts < max_attempts:
        attempts += 1
        num_items = rng.choices([1, 2, 3], weights=[0.60, 0.30, 0.10])[0]
        
        items = []
        has_leakage = False
        for _ in range(num_items):
            it = build_synthetic_item(rng, category_terms, FORBIDDEN_AMOUNTS)
            if it["amount"] in FORBIDDEN_AMOUNTS:
                has_leakage = True
                break
            items.append(it)
            
        if has_leakage:
            continue
            
        token_pairs, final_items, sentence_text = assemble_sentence(rng, items, apply_noise=apply_noise)
        
        # Leakage Guard: verify normalised text does not equal any real captured sentence
        norm = normalize_text(sentence_text)
        if norm in forbidden_sentences:
            raise LeakageError(f"Leakage detected: Generated sentence '{sentence_text}' matches real captured transcript!")
            
        # Structure ground truth expected items
        expected_items = []
        for it in final_items:
            expected_items.append({
                "description": it["item_term"],
                "category": it["category"],
                "quantity": it["quantity"],
                "unit": it["unit"],
                "totalAmount": it["amount"]
            })
            
        dataset.append({
            "id": f"syn_{seed}_{len(dataset)}",
            "sentence": sentence_text,
            "tokens": [t[0] for t in token_pairs],
            "labels": [t[1] for t in token_pairs],
            "expected": expected_items
        })
        
    if len(dataset) < num_samples:
        raise RuntimeError(f"Could only generate {len(dataset)} samples out of {num_samples} requested.")
        
    return dataset


if __name__ == "__main__":
    train_data = generate_dataset(2000, seed=42, apply_noise=True)
    val_data = generate_dataset(400, seed=1337, apply_noise=True)
    out_dir = Path(__file__).resolve().parent
    with open(out_dir / "train.json", "w", encoding="utf-8") as f:
        json.dump(train_data, f, indent=2)
    with open(out_dir / "val.json", "w", encoding="utf-8") as f:
        json.dump(val_data, f, indent=2)
    print(f"Generated {len(train_data)} train samples and {len(val_data)} validation samples.")

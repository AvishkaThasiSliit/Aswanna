"""
Learned Expense Extractor Wrapper (Task E1)
Loads trained CRF tagger and category classifier.
Extracts structured items from transcripts with deterministic amount parsing
and strict literal-presence guarantees.
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

import joblib

from number_parser import parse_amount_span, is_number_literally_in_transcript
from train import sent2features

CANONICAL_CATEGORIES = [
    "seed", "fertilizer", "agrochemical", "labour",
    "machinery", "fuel", "irrigation", "other"
]


class LearnedExtractor:
    """Wrapper encapsulating CRF sequence tagger and character-ngram category classifier."""
    
    def __init__(self, models_dir: Optional[Path] = None):
        if models_dir is None:
            models_dir = Path(__file__).resolve().parent / "models"
        tagger_path = models_dir / "tagger.joblib"
        cat_path = models_dir / "category_clf.joblib"
        
        if not tagger_path.exists() or not cat_path.exists():
            raise FileNotFoundError(f"Model files not found in {models_dir}. Please run train.py first.")
            
        self.tagger = joblib.load(tagger_path)
        self.category_clf = joblib.load(cat_path)

    def tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        return [t for t in re.findall(r"\w+|[^\w\s]", text) if t.strip()]

    def extract_spans(self, tokens: List[str], labels: List[str]) -> List[Dict[str, Any]]:
        """Extracts chunked entities from BIO sequence."""
        chunks = []
        curr_label = None
        curr_tokens = []
        curr_start = 0
        
        for idx, (tok, label) in enumerate(zip(tokens, labels)):
            if label.startswith("B-"):
                if curr_label:
                    chunks.append({"type": curr_label, "text": " ".join(curr_tokens), "start": curr_start, "end": idx})
                curr_label = label[2:]
                curr_tokens = [tok]
                curr_start = idx
            elif label.startswith("I-"):
                tag = label[2:]
                if curr_label == tag:
                    curr_tokens.append(tok)
                else:
                    if curr_label:
                        chunks.append({"type": curr_label, "text": " ".join(curr_tokens), "start": curr_start, "end": idx})
                    curr_label = tag
                    curr_tokens = [tok]
                    curr_start = idx
            else:
                if curr_label:
                    chunks.append({"type": curr_label, "text": " ".join(curr_tokens), "start": curr_start, "end": idx})
                    curr_label = None
                    curr_tokens = []
                    
        if curr_label:
            chunks.append({"type": curr_label, "text": " ".join(curr_tokens), "start": curr_start, "end": len(tokens)})
            
        return chunks

    def extract_expenses(
        self,
        transcript: str,
        alternatives: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Extracts structured expenses from transcript.
        Never produces a number that is not literally present in the transcript text.
        """
        if not transcript or not isinstance(transcript, str) or not transcript.strip():
            return {"items": [], "warnings": ["empty_transcript"]}
            
        tokens = self.tokenize(transcript)
        if not tokens:
            return {"items": [], "warnings": ["no_tokens"]}
            
        features = sent2features(tokens)
        labels = self.tagger.predict([features])[0]
        chunks = self.extract_spans(tokens, labels)
        
        item_spans = [c for c in chunks if c["type"] == "ITEM"]
        amount_spans = [c for c in chunks if c["type"] == "AMOUNT"]
        qty_spans = [c for c in chunks if c["type"] == "QTY"]
        unit_spans = [c for c in chunks if c["type"] == "UNIT"]
        
        extracted_items = []
        
        # Associate items and amounts by positional proximity
        max_entries = max(len(item_spans), len(amount_spans), 1)
        
        for i in range(max_entries):
            it_chunk = item_spans[i] if i < len(item_spans) else None
            amt_chunk = amount_spans[i] if i < len(amount_spans) else None
            qty_chunk = qty_spans[i] if i < len(qty_spans) else None
            unit_chunk = unit_spans[i] if i < len(unit_spans) else None
            
            # 1. Description & Category
            if it_chunk:
                desc = it_chunk["text"]
                try:
                    cat = self.category_clf.predict([desc.lower()])[0]
                    cat = str(cat)
                    if cat not in CANONICAL_CATEGORIES:
                        cat = None
                except Exception:
                    cat = None
            else:
                desc = transcript
                cat = None
                
            # 2. Quantity & Unit
            qty = None
            if qty_chunk:
                try:
                    qty = float(qty_chunk["text"].replace(",", ""))
                except ValueError:
                    # check if word number
                    from number_parser import parse_english_number_words
                    qty = parse_english_number_words(qty_chunk["text"])
                    
            unit = unit_chunk["text"].lower() if unit_chunk else None
            
            # 3. Amount parsing & Literal presence enforcement
            amount = None
            if amt_chunk:
                parsed_amt = parse_amount_span(amt_chunk["text"])
                if parsed_amt is not None:
                    # STRICT GUARD: number must be literally present in transcript
                    if is_number_literally_in_transcript(parsed_amt, transcript):
                        amount = parsed_amt
                    else:
                        # Model hallucinated / mutated amount
                        amount = None
                        
            # Determine status & reasons
            reasons = []
            if amount is None:
                reasons.append("amount_unresolved")
            if cat is None:
                reasons.append("category_uncertain")
                
            status = "ok" if (amount is not None and cat is not None) else "needs_review"
            
            # Only add item if it has either item description or amount
            if it_chunk or amt_chunk:
                extracted_items.append({
                    "description": desc,
                    "category": cat,
                    "quantity": qty,
                    "unit": unit,
                    "unitPrice": None,
                    "totalAmount": amount,
                    "currency": "LKR",
                    "status": status,
                    "reasons": reasons
                })
                
        # Alternative disagreement check
        if alternatives and extracted_items:
            alt_amounts = []
            for alt in alternatives:
                alt_res = self.extract_expenses(alt, alternatives=None)
                alt_amts = sorted([it["totalAmount"] for it in alt_res["items"] if it.get("totalAmount") is not None])
                alt_amounts.append(alt_amts)
            
            primary_amts = sorted([it["totalAmount"] for it in extracted_items if it.get("totalAmount") is not None])
            if alt_amounts and any(a != primary_amts for a in alt_amounts):
                for it in extracted_items:
                    if "asr_alternatives_disagree" not in it["reasons"]:
                        it["reasons"].append("asr_alternatives_disagree")
                    it["status"] = "needs_review"
                    
        return {"items": extracted_items, "warnings": []}


# Global singleton instance for quick calls
_EXTRACTOR: Optional[LearnedExtractor] = None

def get_learned_extractor() -> LearnedExtractor:
    global _EXTRACTOR
    if _EXTRACTOR is None:
        _EXTRACTOR = LearnedExtractor()
    return _EXTRACTOR

def extract_expenses_learned(transcript: str, alternatives: Optional[List[str]] = None) -> Dict[str, Any]:
    extractor = get_learned_extractor()
    return extractor.extract_expenses(transcript, alternatives=alternatives)

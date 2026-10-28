"""
Model Training Script for Aswanna Voice Learned Extractor (Task E1)
Trains:
  (a) Token-level CRF tagger for BIO span extraction (ITEM, QTY, UNIT, AMOUNT)
  (b) Character n-gram category classifier for item text -> 8 canonical categories
Saves models to voice-learn/models/ and logs sizes & training metrics to logs/e1-train.txt.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple

import joblib
import numpy as np
import sklearn_crfsuite
from sklearn_crfsuite import metrics as crf_metrics
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score

from number_parser import ENGLISH_NUMBER_WORDS

CURRENCIES = {"rupees", "rs", "lkr"}
UNITS = {"kg", "kgs", "bags", "liters", "l", "bottles", "hours", "days", "acres", "packets", "workers", "labourers"}
VERBS = {"paid", "spent", "bought", "purchased", "used", "gave", "cost", "pay", "spend", "boat", "use", "give"}


def word2features(sent: List[str], i: int) -> Dict[str, Any]:
    word = sent[i]
    w_lower = word.lower()
    
    features = {
        "bias": 1.0,
        "word.lower": w_lower,
        "word[-3:]": w_lower[-3:],
        "word[-2:]": w_lower[-2:],
        "word[:3]": w_lower[:3],
        "word[:2]": w_lower[:2],
        "word.isupper": word.isupper(),
        "word.istitle": word.istitle(),
        "word.isdigit": word.isdigit(),
        "word.has_comma": "," in word,
        "word.is_num_word": w_lower in ENGLISH_NUMBER_WORDS,
        "word.is_currency": w_lower in CURRENCIES,
        "word.is_unit": w_lower in UNITS,
        "word.is_verb": w_lower in VERBS,
    }
    
    if i > 0:
        prev_word = sent[i - 1]
        pw_lower = prev_word.lower()
        features.update({
            "-1:word.lower": pw_lower,
            "-1:word.istitle": prev_word.istitle(),
            "-1:word.isdigit": prev_word.isdigit(),
            "-1:word.is_num_word": pw_lower in ENGLISH_NUMBER_WORDS,
            "-1:word.is_unit": pw_lower in UNITS,
            "-1:word.is_verb": pw_lower in VERBS,
        })
    else:
        features["BOS"] = True
        
    if i > 1:
        prev2 = sent[i - 2].lower()
        features.update({
            "-2:word.lower": prev2,
            "-2:word.isdigit": sent[i - 2].isdigit(),
        })
        
    if i < len(sent) - 1:
        next_word = sent[i + 1]
        nw_lower = next_word.lower()
        features.update({
            "+1:word.lower": nw_lower,
            "+1:word.istitle": next_word.istitle(),
            "+1:word.isdigit": next_word.isdigit(),
            "+1:word.is_num_word": nw_lower in ENGLISH_NUMBER_WORDS,
            "+1:word.is_unit": nw_lower in UNITS,
            "+1:word.is_currency": nw_lower in CURRENCIES,
        })
    else:
        features["EOS"] = True
        
    if i < len(sent) - 2:
        next2 = sent[i + 2].lower()
        features.update({
            "+2:word.lower": next2,
            "+2:word.isdigit": sent[i + 2].isdigit(),
        })
        
    return features


def sent2features(sent: List[str]) -> List[Dict[str, Any]]:
    return [word2features(sent, i) for i in range(len(sent))]


def train_models():
    base_dir = Path(__file__).resolve().parent
    data_dir = base_dir / "data"
    models_dir = base_dir / "models"
    logs_dir = base_dir.parent / "logs"
    models_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    train_file = data_dir / "train.json"
    val_file = data_dir / "val.json"
    
    if not train_file.exists() or not val_file.exists():
        print("Data files not found. Generating...")
        from data.generate import generate_dataset
        train_data = generate_dataset(2000, seed=42, apply_noise=True)
        val_data = generate_dataset(400, seed=1337, apply_noise=True)
        with open(train_file, "w", encoding="utf-8") as f:
            json.dump(train_data, f, indent=2)
        with open(val_file, "w", encoding="utf-8") as f:
            json.dump(val_data, f, indent=2)
    else:
        with open(train_file, "r", encoding="utf-8") as f:
            train_data = json.load(f)
        with open(val_file, "r", encoding="utf-8") as f:
            val_data = json.load(f)
            
    print(f"Loaded {len(train_data)} train samples and {len(val_data)} validation samples.")
    
    start_time = time.time()
    
    # ─── 1. Prepare Tagger Data ─────────────────────────────────────────────────
    X_train = [sent2features(s["tokens"]) for s in train_data]
    y_train = [s["labels"] for s in train_data]
    
    X_val = [sent2features(s["tokens"]) for s in val_data]
    y_val = [s["labels"] for s in val_data]
    
    # Train CRF Tagger
    tagger_start = time.time()
    crf = sklearn_crfsuite.CRF(
        algorithm="lbfgs",
        c1=0.1,
        c2=0.1,
        max_iterations=100,
        all_possible_transitions=True,
        verbose=False
    )
    crf.fit(X_train, y_train)
    tagger_time = time.time() - tagger_start
    print(f"Tagger trained in {tagger_time:.2f}s")
    
    # Evaluate Tagger on Validation
    y_pred = crf.predict(X_val)
    labels = list(crf.classes_)
    labels.remove("O")
    sorted_labels = sorted(labels, key=lambda name: (name[1:], name[0]))
    tagger_report = crf_metrics.flat_classification_report(y_val, y_pred, labels=sorted_labels, digits=4)
    tagger_f1_micro = crf_metrics.flat_f1_score(y_val, y_pred, average="micro", labels=sorted_labels)
    tagger_f1_macro = crf_metrics.flat_f1_score(y_val, y_pred, average="macro", labels=sorted_labels)
    
    # ─── 2. Prepare Category Classifier Data ─────────────────────────────────────
    cat_texts_train = []
    cat_labels_train = []
    for s in train_data:
        for exp in s.get("expected", []):
            desc = exp.get("description")
            cat = exp.get("category")
            if desc and cat:
                cat_texts_train.append(desc.lower().strip())
                cat_labels_train.append(cat)
                
    cat_texts_val = []
    cat_labels_val = []
    for s in val_data:
        for exp in s.get("expected", []):
            desc = exp.get("description")
            cat = exp.get("category")
            if desc and cat:
                cat_texts_val.append(desc.lower().strip())
                cat_labels_val.append(cat)
                
    clf_start = time.time()
    category_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)),
        ("clf", LogisticRegression(C=5.0, max_iter=1000, random_state=42))
    ])
    category_pipeline.fit(cat_texts_train, cat_labels_train)
    clf_time = time.time() - clf_start
    print(f"Category classifier trained in {clf_time:.2f}s")
    
    cat_pred_val = category_pipeline.predict(cat_texts_val)
    cat_acc = accuracy_score(cat_labels_val, cat_pred_val)
    cat_report = classification_report(cat_labels_val, cat_pred_val, digits=4)
    
    total_time = time.time() - start_time
    
    # ─── 3. Save Models ──────────────────────────────────────────────────────────
    tagger_path = models_dir / "tagger.joblib"
    cat_path = models_dir / "category_clf.joblib"
    
    joblib.dump(crf, tagger_path, compress=3)
    joblib.dump(category_pipeline, cat_path, compress=3)
    
    tagger_size_kb = tagger_path.stat().st_size / 1024
    cat_size_kb = cat_path.stat().st_size / 1024
    
    # ─── 4. Log to logs/e1-train.txt ──────────────────────────────────────────────
    log_content = []
    log_content.append("=" * 70)
    log_content.append("ASWANNA TASK E1: LEARNED EXTRACTOR TRAINING LOG")
    log_content.append("=" * 70)
    log_content.append(f"Training Samples:   {len(train_data)}")
    log_content.append(f"Validation Samples: {len(val_data)}")
    log_content.append(f"Tagger Model:       CRF (L-BFGS, c1=0.1, c2=0.1, max_iter=100)")
    log_content.append(f"Category Model:     Char-WB TF-IDF (2-4 ngrams) + LogisticRegression(C=5.0)")
    log_content.append("-" * 70)
    log_content.append(f"Tagger Training Time:     {tagger_time:.2f} seconds")
    log_content.append(f"Classifier Training Time: {clf_time:.2f} seconds")
    log_content.append(f"Total Training Time:      {total_time:.2f} seconds")
    log_content.append("-" * 70)
    log_content.append(f"Tagger Model Size:        {tagger_size_kb:.1f} KB ({tagger_path.name})")
    log_content.append(f"Category Model Size:      {cat_size_kb:.1f} KB ({cat_path.name})")
    log_content.append("=" * 70)
    log_content.append("\n### TAGGER VALIDATION EVALUATION (PER-LABEL BIO METRICS):")
    log_content.append(f"Micro F1: {tagger_f1_micro:.4f} | Macro F1: {tagger_f1_macro:.4f}\n")
    log_content.append(tagger_report)
    log_content.append("\n### CATEGORY CLASSIFIER VALIDATION EVALUATION:")
    log_content.append(f"Accuracy: {cat_acc * 100:.2f}%\n")
    log_content.append(cat_report)
    log_content.append("=" * 70)
    
    log_str = "\n".join(log_content)
    log_file = logs_dir / "e1-train.txt"
    with open(log_file, "w", encoding="utf-8") as f:
        f.write(log_str)
        
    print(log_str)
    print(f"Training completed. Log written to {log_file}")


if __name__ == "__main__":
    train_models()

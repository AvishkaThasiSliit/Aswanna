# Task E1: Learned Expense Extractor vs. Frozen Rule-Based Extractor

> **Notice:** OFFLINE RESEARCH ONLY. No application, server, client, or route changes were made. The production rule-based pipeline remains frozen and untouched.

---

## 1. Executive Summary

This research study evaluates whether a small, learned machine-learning pipeline can outperform or safely gate the frozen deterministic rule-based extractor (`extractExpenses`) for agricultural expense voice transcripts in English.

### Key Findings
1. **Model Efficiency:** The complete learned pipeline consists of a linear-chain Conditional Random Field (**CRF**) tagger (29.3 KB) and a character n-gram Logistic Regression category classifier (22.8 KB). Total training time was **3.34 seconds** on CPU.
2. **Real Audio Performance (N=36 recordings, 42 items across 3 takes):**
   - **System R (Frozen Rules):** 50.0% Amount Correct (21/42), 66.7% Category Correct (28/42), 59.5% Needs Review (25/42), **2 Silent Errors** (severe ASR misrecognitions passed as `ok`).
   - **System L (Learned Alone):** 64.3% Amount Correct (27/42), 66.7% Category Correct (28/42), 97.6% Needs Review (41/42), **0 Silent Errors**.
   - **System G (Gated R with L disagreement):** 50.0% Amount Correct (21/42), 66.7% Category Correct (28/42), 71.4% Needs Review (30/42), **2 Silent Errors**.
3. **Silent Errors in Real ASR:**
   Both silent errors in R and G stem from catastrophic speech-to-text bit errors where the ASR engine transcribed spurious leading digits (`"405000 irrigation"` for 4,500; `"88500 tractor flowing yesterday"` for 8,500). Gating failed to catch these two instances because L also extracted the literal corrupted number strings present in the transcript.
4. **Synthetic vs. Real Gap:** On synthetic validation data (596 items), System R suffered 70 silent errors (42.3% amount accuracy), while System L achieved 86.6% amount accuracy and 99.5% category accuracy with only 1 silent error. On real speech, ASR acoustic corruption significantly reduced accuracy for all systems.

---

## 2. Models & Architecture

Two lightweight models were trained using scikit-learn and python-crfsuite in `voice-service/.venv`:

```
┌────────────────────────────────────────────────────────┐
│  Raw Speech Transcript (e.g. "bought urea for 3500 rs")│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
          ┌───────────────────────────────────┐
          │   CRF Sequence Tagger (29.3 KB)   │
          │  Token-level Context Window (±2)  │
          └────────────────┬──────────────────┘
                           │
              BIO Spans: ITEM, QTY, UNIT, AMOUNT
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ Char-WB TF-IDF (2-4 ng) │ │  Deterministic English  │
│  Logistic Regression    │ │      Number Parser      │
│   Category Classifier   │ │ (Near-Miss & Literal    │
│        (22.8 KB)        │ │    Presence Guards)     │
└────────────┬────────────┘ └────────────┬────────────┘
             │                           │
             ▼                           ▼
          Category                     Amount
             └─────────────┬─────────────┘
                           │
                           ▼
           Structured Expense Item Output
```

### (a) Token-Level CRF Tagger (`sklearn_crfsuite.CRF`)
- **Algorithm:** L-BFGS with elastic net regularization ($c_1 = 0.1, c_2 = 0.1$, `max_iterations=100`, `all_possible_transitions=True`).
- **Feature Set:** Token lowercase, prefixes (2, 3 chars), suffixes (2, 3 chars), titlecase/digit/uppercase indicators, comma presence, membership in English number words, currency words, unit words, and verb vocabularies; context window features spanning $w_{-2}, w_{-1}, w_{+1}, w_{+2}$.
- **Labels (BIO):** `B-ITEM`, `I-ITEM`, `B-QTY`, `I-QTY`, `B-UNIT`, `I-UNIT`, `B-AMOUNT`, `I-AMOUNT`, `O`.
- **Model Size:** 29.3 KB (`tagger.joblib`). Training time: 2.84 s.

### (b) Category Classifier (`Pipeline`)
- **Feature Extraction:** Sub-word character n-grams (`analyzer='char_wb'`, `ngram_range=(2, 4)`).
- **Classifier:** Multinomial Logistic Regression ($C=5.0$, `max_iter=1000`, `random_state=42`).
- **Classes:** 8 canonical agricultural categories (`seed`, `fertilizer`, `agrochemical`, `labour`, `machinery`, `fuel`, `irrigation`, `other`).
- **Model Size:** 22.8 KB (`category_clf.joblib`). Training time: 0.15 s.

### (c) Deterministic Number Parser & Transcript Literal Guard
- Span-to-number parser converting digit strings with commas (e.g. `"14,000"` $\to 14000$) and English number words (thousands 1–14, hundreds 0–9).
- **Near-Miss Invariant:** Inserting any non-numeric or interrupted word (e.g. `"two thousand blarg five hundred"`) immediately returns `None`, never a truncated value.
- **Literal Presence Guard:** The model is prohibited from emitting any numeric amount unless that exact value is literally present in the raw transcript text either as digits or spoken number words.

---

## 3. Synthetic Training Data & ASR Noise Augmentation

### Dataset Construction (`voice-learn/data/generate.py`)
- **Training Set:** 2,000 synthetic sentences (`seed=42`).
- **Validation Set:** 400 synthetic sentences (`seed=1337`).
- **Vocabulary:** English terms extracted strictly from [shared/voice/keywordMap.json](file:///d:/Aswanna/shared/voice/keywordMap.json).
- **Sentence Templates:** 1 to 3 expenses per sentence, combining verbs, quantities, units, item terms, amounts, currency cues, connectors, and optional relative dates.

### Declared ASR Noise Types & Probabilities
Noise augmentations were applied to simulate speech recognition artifacts:
1. `drop_currency` ($p = 0.35$): Deletion of currency tokens (`rupees`, `rs`).
2. `digit_noise` ($p = 0.15$): Insertion or deletion of trailing digits inside numeric strings.
3. `merge_numbers` ($p = 0.10$): Concatenation or spacing loss between adjacent numbers.
4. `phonetic_sub` ($p = 0.20$): Phonetic and acoustic substitutions observed in web speech recognition (e.g., *urea* $\to$ *you rear*, *fertilizer* $\to$ *fertile iser*, *diesel* $\to$ *d sell*, *tractor* $\to$ *track tour*, *bowser* $\to$ *browser*).
5. `drop_connector` ($p = 0.25$): Deletion of connecting prepositions (`for`, `of`, `and`).
6. `corrupt_verb` ($p = 0.20$): Tense or phonetic corruption of leading action verbs (*paid* $\to$ *pay*, *bought* $\to$ *boat*, *spent* $\to$ *spend*).

> **Important Disclosure on Independence:**  
> The noise types and phonetic substitutions above were informed by the author's prior observations of desktop Chrome speech-to-text transcripts. Therefore, the real-transcript evaluation is **NOT fully independent** of the noise design.

### Leakage Guard
To prevent benchmark contamination, `voice-learn/data/generate.py` enforces two strict guards:
1. **Forbidden Amounts:** Refuses to emit any sentence containing amounts from the benchmark test set:  
   `{14000, 8500, 7500, 12000, 3200, 6000, 6800, 4500, 2500, 5000, 1500, 1200}`.
2. **Transcript De-duplication:** Automatically checks every generated sentence against normalized transcripts from all real captured fixtures (`real-asr*.json`), immediately raising `LeakageError` upon any collision.
3. Verified by unit tests in `voice-learn/tests/test_learned.py`.

---

## 4. Empirical Evaluation Results

All numbers below are extracted directly from verified logs ([logs/e1-train.txt](file:///d:/Aswanna/logs/e1-train.txt) and [logs/e1-real-eval.txt](file:///d:/Aswanna/logs/e1-real-eval.txt)).

### 4.1. Training & Validation Set Metrics
- **Tagger Validation (BIO Token Level, N=2,571 tokens):**
  - Micro F1: `1.0000`, Macro F1: `1.0000`
  - Per-label F1: `B-AMOUNT`: 1.0000, `I-AMOUNT`: 1.0000, `B-ITEM`: 1.0000, `I-ITEM`: 1.0000, `B-QTY`: 1.0000, `B-UNIT`: 1.0000.
- **Category Classifier Validation (N=596 items):**
  - Accuracy: `100.00%` across all 8 canonical classes.

---

### 4.2. Real Audio Transcript Evaluation (3 Takes, N=36 recordings, 42 items)

Evaluated across three genuine recording sessions of 12 spoken English agricultural expense phrases:
- **Take 1:** `real-asr.captured.json` (Session 1)
- **Take 2:** `real-asr.repeat1.captured.json` (Repeat 1)
- **Take 3:** `real-asr.take3.clean.json` (Take 3 Clean)

| System | Dataset / Take | Items | Amount Correct | Category Correct | Needs Review | Silent Errors |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **R (Rules)** | Take 1 (Session 1) | 14 | 11/14 (78.6%) | 11/14 (78.6%) | 4/14 (28.6%) | 0 |
| **L (Learned)**| Take 1 (Session 1) | 14 | 11/14 (78.6%) | 9/14 (64.3%) | 14/14 (100.0%) | 0 |
| **G (Gated)**  | Take 1 (Session 1) | 14 | 11/14 (78.6%) | 11/14 (78.6%) | 9/14 (64.3%) | 0 |
| | | | | | | |
| **R (Rules)** | Take 2 (Repeat 1) | 14 | 7/14 (50.0%) | 11/14 (78.6%) | 10/14 (71.4%) | 1 |
| **L (Learned)**| Take 2 (Repeat 1) | 14 | 11/14 (78.6%) | 12/14 (85.7%) | 14/14 (100.0%) | 0 |
| **G (Gated)**  | Take 2 (Repeat 1) | 14 | 7/14 (50.0%) | 11/14 (78.6%) | 10/14 (71.4%) | 1 |
| | | | | | | |
| **R (Rules)** | Take 3 (Take 3 Clean)| 14 | 3/14 (21.4%) | 6/14 (42.9%) | 11/14 (78.6%) | 1 |
| **L (Learned)**| Take 3 (Take 3 Clean)| 14 | 5/14 (35.7%) | 7/14 (50.0%) | 13/14 (92.9%) | 0 |
| **G (Gated)**  | Take 3 (Take 3 Clean)| 14 | 3/14 (21.4%) | 6/14 (42.9%) | 11/14 (78.6%) | 1 |
| | | | | | | |
| **R (Rules)** | **ALL TAKES COMBINED** | **42** | **21/42 (50.0%)** | **28/42 (66.7%)** | **25/42 (59.5%)** | **2** |
| **L (Learned)**| **ALL TAKES COMBINED** | **42** | **27/42 (64.3%)** | **28/42 (66.7%)** | **41/42 (97.6%)** | **0** |
| **G (Gated)**  | **ALL TAKES COMBINED** | **42** | **21/42 (50.0%)** | **28/42 (66.7%)** | **30/42 (71.4%)** | **2** |

---

### 4.3. Silent Errors Listing
A **Silent Error** occurs when an extractor returns `status: "ok"`, but the extracted amount or category is incorrect relative to ground truth:

1. **Prompt ID `VP-CAP-009` (Take 2):**
   - **Transcript:** `"405000 irrigation"`
   - **Expected:** Amount = `4500`, Category = `'irrigation'`
   - **Extracted (R & G):** Amount = `405000`, Category = `'irrigation'`, Status = `'ok'`
   - **Issue:** ASR inserted `"40"` before `"5000"`, producing a plausible but massively inflated number. Because the number was solitary and matched the category keyword, R marked it `ok` under the lone number rule.
2. **Prompt ID `VP-CAP-002` (Take 3):**
   - **Transcript:** `"88500 tractor flowing yesterday"`
   - **Expected:** Amount = `8500`, Category = `'machinery'`
   - **Extracted (R & G):** Amount = `88500`, Category = `'machinery'`, Status = `'ok'`
   - **Issue:** ASR acoustic bit-flip duplicated the leading digit `"8"`, producing `"88500"`. Extracted with status `'ok'`.

---

### 4.4. Phrase-Level Bootstrap Analysis (G vs. R)
A non-parametric bootstrap resampling ($B=10,000$ iterations) was performed over the **12 distinct spoken phrases**:

- **Mean Difference in Silent Errors ($\Delta_{\text{silent}} = G - R$):** `+0.0000` (95% CI: `[+0.0000, +0.0000]`)
- **Mean Difference in Needs Review ($\Delta_{\text{nr}} = G - R$):** `+0.4167` (95% CI: `[+0.1667, +0.6667]`)

> **Statistical Caveat:**  
> Because the real evaluation corpus contains only 12 distinct phrases spoken by a single speaker, these bootstrap confidence intervals are **strictly descriptive** of this specific recorded sample. They do not constitute statistically significant proof of generalization across broad agricultural populations.

---

### 4.5. Synthetic Validation Set Gap Analysis

To measure the distribution shift between synthetic and real audio data:

| System | Dataset | Items | Amount Correct | Category Correct | Needs Review | Silent Errors |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **R (Rules)** | Synthetic Validation | 596 | 252/596 (42.3%) | 367/596 (61.6%) | 211/596 (35.4%) | **70** |
| **L (Learned)**| Synthetic Validation | 596 | 516/596 (86.6%) | 593/596 (99.5%) | 80/596 (13.4%) | **1** |
| **G (Gated)**  | Synthetic Validation | 596 | 252/596 (42.3%) | 367/596 (61.6%) | 302/596 (50.7%) | **0** |

**Interpretation:**
On synthetic data matching its training distribution, the learned model (L) achieves **86.6%** amount accuracy and **99.5%** category accuracy, suppressing silent errors in G to **0**. However, when faced with real acoustic artifacts and out-of-vocabulary misrecognitions in real audio, L becomes highly conservative, marking 97.6% of items as `needs_review`.

---

## 5. Verification Commands & Regression Evidence

All tests and regression benchmarks executed and logged with exit code 0:

```powershell
# 1. Learned Extractor Test Suite (10 unit tests)
voice-service\.venv\Scripts\pytest voice-learn/tests *> logs\e1-pytest.txt
# Output: 10 passed in 3.39s (Exit Code: 0)

# 2. Full Application Test Suite (Server + Client)
npm test *> logs\e1-test.txt
# Server: 19 test suites, 442 passed (Exceeds 335 baseline)
# Client: 22 test files, 126 passed (Exceeds 121 baseline)
# Total: 568 passed, 0 failed (Exit Code: 0)

# 3. Core Variance & Feasibility Evaluation Harness
node server/eval/evaluate.js *> logs\e1-eval.txt
# Output: 65/65 checks passed (10 scenarios + CRUD latency) (Exit Code: 0)
```

### Disk Space Verification
- Initial free space on `D:\`: **3.60 GB** (logged in [logs/e1-disk.txt](file:///d:/Aswanna/logs/e1-disk.txt)).
- Final free space on `D:\`: **3.31 GB** (logged in [logs/e1-disk-after.txt](file:///d:/Aswanna/logs/e1-disk-after.txt)).
- No residual scratch wheels or temporary files remain.

---

## 6. What is NOT Verified & Scope Boundaries

1. **English Only:** This learned pipeline operates strictly on English vocabulary. Sinhala and Tamil natural language extraction are completely unaddressed and unverified by these models.
2. **Single Speaker Bias:** All real speech transcripts were collected from a single male speaker using desktop Chrome speech-to-text. Performance on female voices, non-native accents, or mobile device microphones is completely unverified.
3. **No Ground Truth Fine-Tuning:** The models were trained exclusively on synthetic templates without using real farmer transcripts for gradient descent.
4. **Safety Policy Recommendation:** While System L demonstrated 0 silent errors on this test set, its 97.6% `needs_review` rate renders it impractical as a standalone replacement for System R without further acoustic domain adaptation. Gating System R with L (System G) increases `needs_review` by +41.7% without fixing the 2 catastrophic ASR number insertion errors. Farmer confirmation remains strictly mandatory.

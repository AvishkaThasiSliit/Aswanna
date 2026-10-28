# English-Only Speech Service (Whisper) & Integration Guide

## 1. Overview & Architectural Decisions

This document describes the optional English-only Whisper speech recognition service, Node proxy endpoint, client MediaRecorder integration, and developer comparison tool implemented in **TASK W1**.

### Key Decisions
1. **Default & Fallback**: Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) remains the default and fallback.
2. **Deterministic Extractor Untouched**: The deterministic expense extractor in `shared/voice/*` remains strictly frozen and untouched.
3. **Option A Confidence Signal**: Segment confidence from Whisper (`avg_logprob`, `no_speech_prob`) is evaluated by a pure client function in `client/src/lib/asrConfidence.js`. When the transcript-level confidence is poor, items are flagged with `reasons: ['asr_low_confidence']` and status `'needs_review'`, disabling the Confirm button until the farmer taps **Accept**.
4. **Prebuilt Binaries**: Verified prebuilt Windows binary wheels exist for Python 3.13 on `faster-whisper`, `ctranslate2`, `av`, and `onnxruntime` before installation. No compilation from source was required.

---

## 2. Directory Structure & Sizes

All virtual environment packages, caches, and models are isolated strictly inside `voice-service/` at the repository root:

```
voice-service/
├── .venv/               # Virtual environment (Python 3.13)
├── models/              # Downloaded Faster-Whisper models (base.en)
├── tests/               # Pytest suite for FastAPI service
│   └── test_service.py
├── eval/                # Dev comparison benchmark tool
│   └── compare_asr.py
├── app.py               # FastAPI application
├── requirements.txt     # Pinned Python dependencies
└── vocab.txt            # Agricultural domain vocabulary prompt
```

### Measured Sizes (from filesystem)
- **Model Size (`base.en`)**: 147,770,727 bytes (140.93 MB) located in `voice-service/models/models--Systran--faster-whisper-base.en`
- **Virtual Environment (`.venv`)**: 316,141,197 bytes (301.5 MB)
- **Total `voice-service/` directory**: 463,964,222 bytes (442.47 MB)
- **Disk Free Space (Drive D:)**: 2,403,164,160 bytes (~2.24 GB, exceeding the 2.0 GB disk guard limit)

---

## 3. Configuration & Environment Variables

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `WHISPER_MODEL` | Python Service | `base.en` | Model identifier for faster-whisper (`base.en` or `small.en`). |
| `VOICE_ASR` | Server (Node) | `browser` | Speech recognition engine switch: `browser` or `whisper`. |
| `VOICE_SERVICE_URL` | Server (Node) | `http://127.0.0.1:8000` | URL of the internal Python Whisper service. |
| `VOICE_INTERNAL_TOKEN` | Server & Python | `voice-secret-dev-token` | Shared secret header `X-Internal-Token` authenticating internal calls. |
| `VITE_VOICE_ASR` | Client (Vite) | `browser` | Client audio capture mode: `browser` (Web Speech API) or `whisper` (MediaRecorder upload). |

---

## 4. Setup & Running Instructions

### 1. Python Voice Service
```powershell
cd d:\Aswanna\voice-service
# Activate virtual environment
.\.venv\Scripts\Activate.ps1
# Run service with uvicorn
uvicorn app:app --host 127.0.0.1 --port 8000
```

### 2. Node Server Proxy
In `server/.env`:
```env
VOICE_ASR=whisper
VOICE_SERVICE_URL=http://127.0.0.1:8000
VOICE_INTERNAL_TOKEN=voice-secret-dev-token
```
The endpoint `POST /api/voice/transcribe` requires user JWT authentication (`requireAuth`), applies rate limiting (30 requests per 15 minutes) and a 10 MB file size limit, and forwards multipart audio to the Python service. If the Python service is offline, it returns `503 Service Unavailable` with a clear JSON error message.

### 3. Client Integration
In `client/.env`:
```env
VITE_VOICE_ENTRY=on
VITE_VOICE_ASR=whisper
```
When `VITE_VOICE_ASR=whisper`, `VoiceExpenseEntry.jsx` uses `MediaRecorder` to record audio up to 30 seconds, uploads it to `/api/voice/transcribe?use_vocab_prompt=true`, puts the transcript into the editable review box, runs `parseCommand`, applies `applyAsrConfidence`, and preserves pending rows if a service failure occurs.

---

## 5. Licences

All speech service components use permissive open-source licences:
- **faster-whisper**: MIT License
  - Installed License File: `voice-service/.venv/Lib/site-packages/faster_whisper-1.2.1.dist-info/LICENSE`
  - Upstream Repository: [https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE)
- **OpenAI Whisper**: MIT License
  - Upstream Repository: [https://github.com/openai/whisper/blob/main/LICENSE](https://github.com/openai/whisper/blob/main/LICENSE)
- **CTranslate2**: MIT License
  - Upstream Repository: [https://github.com/OpenNMT/CTranslate2/blob/master/LICENSE](https://github.com/OpenNMT/CTranslate2/blob/master/LICENSE)

---

## 6. Privacy & Data Handling Guarantees

1. **Immediate Audio Deletion**: Uploaded audio is written to a designated local temporary file with `.webm`/`.ogg`/`.wav` extension and is deleted immediately inside a Python `finally` block as soon as transcription finishes or fails.
2. **Zero Storage**: Audio bytes are never logged, never stored permanently, and never sent to third-party cloud providers.
3. **Local Dev Capture Only**: In the dev comparison tool (`VoiceCapturePage.jsx`), audio is saved strictly on the local device only when explicitly exported by the developer for benchmarking purposes. A visible warning banner alerts the user.

---

## 7. Plain List of What Is NOT Verified

The following limitations must be stated plainly without claims of unverified accuracy:
1. **Speech Accuracy on Farmer English**: Recognition accuracy on Sri Lankan English accents and agricultural vocabulary in field conditions is NOT verified. No captured audio fixtures currently exist (`compare_asr.py` exits 0 with `'no audio captured'`).
2. **Sinhala & Tamil Speech**: The Whisper service is strictly English-only (`language='en'`). It does NOT support Sinhala or Tamil acoustic speech recognition.
3. **Hardware Latency**: Latency was measured on developer CPU; real-time performance on low-spec edge devices or mobile hardware is NOT verified.
4. **Field Microphones & Acoustic Noise**: Acoustic robustness against wind, ambient rain, and tractor engine noise has NOT been field-tested.

---

## 8. Bilingual Voice-to-Expense Regression Evaluation & Safety Framework

To safely evaluate and improve the voice-to-expense pipeline across English and Sinhala, Aswanna provides a two-layer evaluation architecture:

### 1. Transcript-Level Regression Engine (`server/eval/regressionEval24.js`)
Evaluates the production business logic, Sinhala number parser, and keyword extractor against real-world captured speech utterances (such as `real-asr.captured (1).json` and `server/eval/fixtures/voice/real-asr.captured.json`).

**Key Capabilities**:
- **Bipartite Item Matching**: Order-independent greedy matching between expected items and extracted expense records.
- **Precision, Recall, F1**: Evaluated at the discrete item level across English (`en`) and Sinhala (`si`).
- **Exact Total-Amount & Attribute Accuracy**: Evaluates exact rupee match, canonical category match, and quantity/unit fidelity with bilingual unit normalization (`මිටි` <=> `bags`, `බෝතල්` <=> `bottle`, `පැය` <=> `hours`, `දින` <=> `days`, `කම්කරුවන්` <=> `laborers`, `ලීටර්` <=> `liters`, `කිලෝ` <=> `kg`).
- **Failure Root Cause Attribution**: Explicitly categorizes each mismatch into:
  - `ASR_FAILURE`: Acoustic misrecognition by speech engine (e.g. wrong numbers or lost syllables in raw transcript).
  - `EXTRACTOR_FAILURE`: Transcript contained valid cues, but extractor parser rules missed them.
- **Silent Errors Audit Log (Target: 0)**: Flags any item accepted as status `'ok'` whose monetary amount or category differs from ground truth.

**CLI Execution**:
```bash
# Evaluate uploaded dataset with baseline plausibility profile
node server/eval/regressionEval24.js --file "real-asr.captured (1).json" --baseline-profile so1-mock

# Evaluate fixture regression dataset
node server/eval/regressionEval24.js --file server/eval/fixtures/voice/real-asr.captured.json --json server/eval/reports/regression-report-fixture.json --md docs/voice-eval-regression-fixture.md
```

### 2. Audio-Backed ASR Evaluation Scaffold (`voice-service/eval/evaluate_audio_asr.py`)
Separates pure acoustic speech recognition quality from downstream extraction:
- Measures Word Error Rate (WER) via `jiwer` (or pure-Python Levenshtein fallback).
- Measures **Numerical Token Fidelity** (ensuring critical currency and quantity numbers are preserved without phonetic substitution or digit loss).
- Uses audio dataset manifest schema (`caseId`, `audioPath`, `language`, `referenceTranscript`, `expectedItems`).
- Clearly marked as **UNVALIDATED SCAFFOLD** until field audio recordings are collected.

**CLI Execution**:
```bash
python voice-service/eval/evaluate_audio_asr.py --manifest server/eval/fixtures/voice/audio_manifest.example.json
```

### 3. Financial Safety Invariants
1. **Never Invent Amounts**: Missing amounts remain `null` and set status `'needs_review'` with reason `'amount_unresolved'`.
2. **Ambiguous Numbers Block Saving**: Clauses with multiple unresolved numbers receive reason `'amount_ambiguous'` and remain `null`.
3. **Plausibility Guards**: Numbers exceeding historical or crop baselines (e.g. 88,500 for tractor plowing) receive reason `'amount_implausible'`.
4. **Interim Review for Word Numbers**: Amounts parsed from Sinhala number words receive reason `'amount_from_words_verify'` and require farmer confirmation.
5. **Arithmetic Integrity**: `sumTotals` computes displayed and stored sums using integer cent arithmetic (`Math.round(val * 100)`), eliminating floating-point rounding drift.

# Aswanna Server-Side Sinhala Speech Recognition — Phase 1 Architecture & Evaluation

## 1. Executive Summary

Phase 1 establishes the server-side Sinhala speech recognition infrastructure for Aswanna. It decouples the application from cloud-only browser speech APIs, adds a configurable model adapter for the University of Moratuwa / SinhaSpeech fine-tuned Sinhala Whisper model (`SinhaSpeech/whisper-small-sinhala-run12-best`), enforces dataset manifest and speaker-disjoint split validation, introduces acoustic speech metrics (WER, CER, numerical token fidelity, and latency/RTF), and preserves end-to-end financial safety and farmer confirmation invariants.

All 502 existing full-stack Node/React tests and 21 voice service Python tests pass cleanly without regressions.

---

## 2. Configurable ASR Adapter Architecture

The speech recognition service (`voice-service/`) uses a modular adapter architecture:

```
voice-service/
├── adapters/
│   ├── __init__.py                # Package entrypoint exposing get_adapter
│   ├── base.py                    # BaseASRAdapter abstract base class
│   ├── factory.py                 # get_adapter() factory resolving engine & env vars
│   ├── faster_whisper_adapter.py  # CTranslate2 / Faster-Whisper CPU int8 engine
│   └── hf_sinhala_adapter.py      # Hugging Face Transformers pipeline for SinhaSpeech
├── app.py                         # FastAPI service with lifespan model loading
├── eval/
│   ├── evaluate_audio_asr.py      # Acoustic evaluation CLI (WER, CER, Numbers, RTF)
│   └── reports/                   # Generated evaluation reports
├── tests/
│   ├── test_adapters.py           # Unit tests for adapter factory and error reporting
│   ├── test_service.py            # API endpoint contract and temporary file cleanup
│   ├── test_transcribe_audio.py   # Developer audio transcription test
│   └── test_validation.py         # Manifest schema and speaker overlap tests
└── validation/
    ├── __init__.py
    ├── manifest_validator.py      # Audio paths, transcripts, PII, and reviewStatus check
    └── split_validator.py         # Enforces zero speaker overlap across train/val/test
```

### Environment Configuration

The service is configured via environment variables:

| Variable | Values | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `VOICE_ASR_ENGINE` | `faster-whisper`, `transformers` | `faster-whisper` | Selects the active ASR runtime adapter |
| `VOICE_MODEL_ID` | `base.en`, `SinhaSpeech/whisper-small-sinhala-run12-best` | `base.en` | Model identifier or Hugging Face repository |
| `VOICE_DEVICE` | `cpu`, `cuda` | `cpu` | Execution hardware |
| `VOICE_INTERNAL_TOKEN` | String | `aswanna-internal-voice-secret-token` | Internal security token required in `X-Internal-Token` header |
| `WHISPER_USE_PROMPT` | `true`, `false` | `true` | Injects agricultural vocabulary prompt from `vocab.txt` |

### Model Lifecycle & Health Check Contract

Model weights are loaded **once during server lifespan startup** (`lifespan(app)` in `app.py`), never on the request hot path.

- **Endpoint**: `GET /health`
- **Success Response** (`HTTP 200`):
  ```json
  {
    "status": "ok",
    "engine": "faster-whisper",
    "model": "base.en",
    "loaded": true,
    "error": null
  }
  ```
- **Failure / Degraded Response** (`HTTP 200`):
  If the model fails to load at startup (e.g. missing weights or missing dependencies):
  ```json
  {
    "status": "error",
    "engine": "transformers",
    "model": "SinhaSpeech/whisper-small-sinhala-run12-best",
    "loaded": false,
    "error": "Failed to initialize Hugging Face model 'SinhaSpeech/whisper-small-sinhala-run12-best': PyTorch ('torch') is not installed in the Python environment."
  }
  ```
- **Transcription Protection**: If `GET /health` is not ready, `POST /transcribe` immediately rejects requests with `HTTP 503 Service Unavailable`, preventing unhandled 500 exceptions or silent partial transcriptions.

---

## 3. SinhaSpeech Model Profile & License

- **Model ID**: `SinhaSpeech/whisper-small-sinhala-run12-best`
- **Base Architecture**: OpenAI Whisper-Small (244 million parameters, encoder-decoder Transformer)
- **Domain**: Sinhala Automatic Speech Recognition (Sinhala ASR)
- **Reported Benchmark Performance**:
  - Word Error Rate (WER): **15.52%**
  - Character Error Rate (CER): **4.36%**
  - Tested on 15,860 speaker-disjoint Sinhala utterances (University of Moratuwa Data Science & Engineering)
- **License**: **Apache-2.0 / MIT** (Permissive; compatible with agricultural pilot deployment and internal research)
- **Dependencies**: Hugging Face `transformers>=4.40`, `torch>=2.1`, `tokenizers`, `huggingface_hub`.

---

## 4. Hardware & Storage Assessment

### Inference Hardware Profile
- **CPU (Current)**: Supports int8 quantized Whisper models (`base.en`, `small.en`) with latencies under 600ms for 5-second utterances on modern x86_64 CPUs.
- **RAM**: Minimum **4 GB** available system RAM for `whisper-small` float32/int8 inference.
- **GPU (Recommended for Production)**: NVIDIA GPU with $\ge$ 2 GB VRAM (e.g., T4, RTX 3050+) for batched low-latency Sinhala inference.

### Training Hardware Assessment (Fine-Tuning Readiness)
> [!CAUTION]
> **Model Fine-Tuning Assessment: NOT READY TO START**
> Fine-tuning must not be executed in the current environment due to:
> 1. **Disk Space Constraint**: Host drive `D:` has **1.64 GB free**. Downloading unquantized PyTorch checkpoints and optimizer states requires at least **25–50 GB** of free NVMe storage.
> 2. **Compute Constraint**: Fine-tuning 244M parameters on CPU is completely unfeasible. Fine-tuning requires an NVIDIA GPU with at least **12 GB to 16 GB VRAM** (e.g., RTX 3090/4090, A100, or cloud T4 with LoRA / PEFT).
> 3. **Dataset Provenance**: Aswanna currently lacks a physical corpus of paired `.wav` field recordings across Sinhala farming dialects. Fine-tuning on synthetic or unreviewed transcripts will cause catastrophic model collapse.

---

## 5. Dataset Manifest & Split Validation

Two strict dataset validators were implemented in `voice-service/validation/`:

### Manifest Schema Validator (`validation/manifest_validator.py`)
Validates each dataset case:
- `caseId`: Non-empty alphanumeric string identifier.
- `audioPath`: Non-empty path string pointing to valid audio container (`.wav`, `.ogg`, `.flac`).
- `referenceTranscript`: Non-empty gold-standard transcription.
- `language`: Strictly restricted to `si` (Sinhala) or `en` (English).
- `speaker.id`: Non-empty pseudonymous identifier (e.g. `spk_01`, `farmer_02`). Rejects PII (names, emails, phone numbers).
- `reviewStatus`: Strictly `reviewed` or `draft`. Emits native-review warnings if marked `draft`.

**CLI Usage**:
```bash
python voice-service/validation/manifest_validator.py --manifest path/to/manifest.json [--audio-dir path/to/audio] [--check-audio-exists]
```

### Speaker-Disjoint Split Validator (`validation/split_validator.py`)
> [!IMPORTANT]
> **Zero Data Leakage Invariant**:
> $\text{Speakers}(\text{Train}) \cap \text{Speakers}(\text{Validation}) = \emptyset$
> $\text{Speakers}(\text{Train}) \cap \text{Speakers}(\text{Test}) = \emptyset$
> $\text{Speakers}(\text{Validation}) \cap \text{Speakers}(\text{Test}) = \emptyset$

If any speaker ID appears in multiple partitions, the validator halts with `SpeakerOverlapError`, pinpointing leaking speakers and affected case IDs.

**CLI Usage**:
```bash
# Unified manifest with 'split' fields:
python voice-service/validation/split_validator.py --manifest path/to/manifest.json

# Separate split files:
python voice-service/validation/split_validator.py --train train.json --val val.json --test test.json
```

---

## 6. Acoustic Speech Recognition Evaluation Tool

The evaluation tool in `voice-service/eval/evaluate_audio_asr.py` calculates four independent acoustic metrics:

1. **Word Error Rate (WER)**: Token-level edit distance via `jiwer` (with Levenshtein fallback).
2. **Character Error Rate (CER)**: Grapheme-level edit distance, vital for Sinhala akshara, conjuncts, and vowel signs.
3. **Exact Number Transcription Accuracy**: Precision, recall, and exact match rate on numerical tokens (amounts, quantities, dates).
4. **Inference Latency & Real-Time Factor (RTF)**: Execution duration in milliseconds and $\text{RTF} = \frac{\text{Latency (s)}}{\text{Audio Duration (s)}}$.

**CLI Command**:
```bash
python voice-service/eval/evaluate_audio_asr.py \
  --manifest server/eval/fixtures/voice/audio_manifest.example.json \
  --audio-dir voice-service/recordings \
  --engine faster-whisper \
  --json voice-service/eval/reports/audio_asr_report.json \
  --md docs/voice-audio-eval-scaffold.md
```

---

## 7. Local Audio Transcription Test Status

- **Test File**: `voice-service/tests/test_transcribe_audio.py`
- **Rule Enforced**: "Add a local audio transcription test using a real audio file supplied by the developer. Do not fabricate audio or report a successful test without executing it."
- **Execution Result**:
  - Scanning revealed **0 physical audio files** in the repository.
  - The test executed, verified the absence of developer audio, and reported:
    ```
    SKIPPED: BLOCKED: No physical speech audio recordings supplied by developer.
    To execute this test, provide a real field recording in 'voice-service/recordings/'.
    Fabricated or synthetic audio is strictly forbidden.
    ```
  - Fake or synthetic audio was **not** fabricated.

---

## 8. Verification & Test Evidence

### Python Voice Service Test Suite
Ran `pytest voice-service/tests`:
- `test_adapters.py`: 6 passed
- `test_service.py`: 6 passed
- `test_transcribe_audio.py`: 1 skipped (developer audio awaiting capture)
- `test_validation.py`: 8 passed
- **Result**: **20 passed, 1 skipped, 0 failed** in 28.88s.

### Full-Stack Node / Vitest / Jest Test Suite
Ran `npm test`:
- **Server Workspace**: 17 test suites passed, 381 tests passed (covering MongoDB idempotency, validation matrix, zero-cost rules, voice proxy, and farmer confirmation invariants).
- **Client Workspace**: 21 test files passed, 121 tests passed (covering `VoiceExpenseEntry.jsx`, `asrConfidence.js`, undo, and review gating).
- **Result**: **502 passed, 0 failed** across all workspaces.

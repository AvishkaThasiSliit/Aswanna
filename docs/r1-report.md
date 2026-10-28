# Task R1: Held-out English Test Preparation Report

**Execution Timestamp:** 2026-10-28T05:52:00Z  
**Disk Space (D:):** 3.37 GB free of 296.62 GB (Threshold: >= 1.0 GB - PASSED)  
**Safety & Guard Invariants:**  
- `shared/voice`: 100% bit-exact match against `logs/freeze-v2-hashes.txt` (VERIFIED)  
- `eval_real.py`: Not executed  
- Model training: None executed  

---

## 0. Pytest Count & Historical Discrepancy Analysis

### Current Test Counts per File
Executed command:
```powershell
& 'voice-service\.venv\Scripts\pytest.exe' -v voice-service voice-learn
```

Command Output:
```text
voice-service/tests/test_adapters.py::test_factory_resolves_faster_whisper PASSED [  2%]
voice-service/tests/test_adapters.py::test_factory_resolves_hf_sinhala_whisper PASSED [  5%]
voice-service/tests/test_adapters.py::test_factory_rejects_unknown_engine PASSED [  8%]
voice-service/tests/test_adapters.py::test_hf_adapter_metadata PASSED    [ 11%]
voice-service/tests/test_adapters.py::test_hf_adapter_startup_failure_reports_informative_error PASSED [ 14%]
voice-service/tests/test_adapters.py::test_hf_adapter_transcription_with_mocked_pipeline PASSED [ 17%]
voice-service/tests/test_audio_decodability.py::test_decoder_backed_valid_wav_decodes_frames PASSED [ 20%]
voice-service/tests/test_audio_decodability.py::test_decoder_backed_rejects_corrupted_bitstream PASSED [ 23%]
voice-service/tests/test_audio_decodability.py::test_decoder_backed_rejects_truncated_magic PASSED [ 26%]
voice-service/tests/test_service.py::test_health_check_returns_model_and_status PASSED [ 29%]
voice-service/tests/test_service.py::test_transcribe_rejects_missing_or_invalid_internal_token PASSED [ 32%]
voice-service/tests/test_service.py::test_transcribe_rejects_empty_audio PASSED [ 35%]
voice-service/tests/test_service.py::test_transcribe_rejects_invalid_audio_content PASSED [ 38%]
voice-service/tests/test_service.py::test_transcribe_rejects_oversized_audio PASSED [ 41%]
voice-service/tests/test_service.py::test_transcribe_plumbing_and_temp_file_cleanup PASSED [ 44%]
voice-service/tests/test_transcribe_audio.py::test_real_developer_audio_transcription SKIPPED [ 47%]
voice-service/tests/test_validation.py::test_manifest_validation_passes_valid_cases PASSED [ 50%]
voice-service/tests/test_validation.py::test_manifest_validation_rejects_missing_audio_or_transcript PASSED [ 52%]
voice-service/tests/test_validation.py::test_manifest_validation_rejects_unsupported_language PASSED [ 55%]
voice-service/tests/test_validation.py::test_manifest_validation_rejects_pii_in_speaker_id PASSED [ 58%]
voice-service/tests/test_validation.py::test_manifest_validation_rejects_invalid_review_status PASSED [ 61%]
voice-service/tests/test_split_validator_passes_speaker_disjoint_splits PASSED [ 64%]
voice-service/tests/test_split_validator_catches_speaker_leakage_between_train_and_test PASSED [ 67%]
voice-service/tests/test_split_validator_catches_leakage_in_unified_manifest PASSED [ 70%]
voice-learn/tests/test_learned.py::test_generator_determinism PASSED     [ 73%]
voice-learn/tests/test_learned.py::test_leakage_guard_forbidden_amounts PASSED [ 76%]
voice-learn/tests/test_learned.py::test_leakage_guard_real_sentences PASSED [ 79%]
voice-learn/tests/test_learned.py::test_parser_digits_with_commas PASSED [ 82%]
voice-learn/tests/test_learned.py::test_parser_english_number_words_generative PASSED [ 85%]
voice-learn/tests/test_learned.py::test_parser_near_miss_returns_none_never_truncated PASSED [ 88%]
voice-learn/tests/test_learned.py::test_wrapper_literal_presence_check PASSED [ 91%]
voice-learn/tests/test_learned.py::test_wrapper_rejects_hallucinated_number PASSED [ 94%]
voice-learn/tests/test_learned.py::test_gating_never_promotes_l_over_r PASSED [ 97%]
voice-learn/tests/test_learned.py::test_run_once_guard PASSED            [100%]

================== 33 passed, 1 skipped, 1 warning in 36.78s ==================
```

### Breakdown by Folder and File:
- **`voice-service/tests` (23 passed, 1 skipped):**
  - `test_adapters.py`: 6 passed
  - `test_audio_decodability.py`: 3 passed
  - `test_service.py`: 6 passed
  - `test_transcribe_audio.py`: 1 skipped
  - `test_validation.py`: 8 passed
- **`voice-learn/tests` (10 passed):**
  - `test_learned.py`: 10 passed
- **Total Combined:** 33 passed, 1 skipped.

### Reason for 1 Skipped Test:
`voice-service/tests/test_transcribe_audio.py::test_real_developer_audio_transcription` checks whether real developer audio is supplied in `voice-service/recordings/` or `test_audio/`. In line 54:
```python
pytest.skip(
    "BLOCKED: No physical speech audio recordings supplied by developer. "
    "To execute this test, provide a real field recording in 'voice-service/recordings/'. "
    "Fabricated or synthetic audio is strictly forbidden."
)
```

### Explanation for "10 -> 23 passed":
- In **Task E1**, pytest was invoked targeting only `voice-learn/tests` (`test_learned.py`), which contains exactly 10 tests (`logs/e1-pytest.txt`: `10 passed in 3.39s`).
- In **Task F3**, pytest was invoked targeting `voice-service/tests`, which contains 24 tests across 5 files (23 passed, 1 skipped).
- When both suites are run together, the total is 33 passed, 1 skipped.

---

## 1. Held-Out English Dataset (`heldout-en.json`)

Created `server/eval/fixtures/voice/heldout-en.json` containing 30 new English phrases.

### Coverage & Criteria:
- **Categories (8/8):** `agrochemical`, `fertilizer`, `fuel`, `irrigation`, `labour`, `machinery`, `other`, `seed`.
- **Magnitude Diversity:**
  - Hundreds (<1,000): 6 phrases
  - Thousands (1,000–9,999): 8 phrases
  - 10k+ (10,000–99,999): 9 phrases
  - 100k+ (>=100,000): 4 phrases
- **Non-divisible Total / Quantity (Fractional Unit Price):** 8 phrases (requirement: >= 6).
- **Follow-up Commands:** 3 commands (`correct`, `remove`, `query`).

### Automatic Rejection Filter:
Evaluated against 186 existing phrases across `dev.json`, `commands.dev.json`, `real-asr.captured.json`, `real-asr.repeat1.captured.json`, `real-asr.take3.captured.json`, `real-asr.take3.clean.json`, and `voicePrompts.json`.
- **Rejections caught and excluded:**
  1. `[REJECTED]` *"Bought 2 bags of urea fertilizer for 14000 rupees"* $\rightarrow$ Matched in `dev.json` (Exact string equality)
  2. `[REJECTED]` *"Bought 2 bags of urea fertilizer for 14500 rupees"* $\rightarrow$ Matched in `dev.json` (Token-set Jaccard similarity = 0.800 $\ge$ 0.8)

### Complete Content of `server/eval/fixtures/voice/heldout-en.json`:
```json
[
  {
    "id": "HE-01",
    "language": "en",
    "type": "expense",
    "text": "Purchased 7 packets of chilli seeds for 5000 rupees",
    "expected": {
      "items": [
        {
          "category": "seed",
          "quantity": 7,
          "unit": "packets",
          "totalAmount": 5000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (5000/7)"
  },
  {
    "id": "HE-02",
    "language": "en",
    "type": "expense",
    "text": "Paid 850 rupees for vegetable seed seedlings",
    "expected": {
      "items": [
        {
          "category": "seed",
          "quantity": null,
          "unit": null,
          "totalAmount": 850
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude hundreds"
  },
  {
    "id": "HE-03",
    "language": "en",
    "type": "expense",
    "text": "Bought certified seed paddy bags for 24000 rupees",
    "expected": {
      "items": [
        {
          "category": "seed",
          "quantity": null,
          "unit": null,
          "totalAmount": 24000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 10k+"
  },
  {
    "id": "HE-04",
    "language": "en",
    "type": "expense",
    "text": "Bought 3 bags of compost fertilizer for 1000 rupees",
    "expected": {
      "items": [
        {
          "category": "fertilizer",
          "quantity": 3,
          "unit": "bags",
          "totalAmount": 1000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (1000/3)"
  },
  {
    "id": "HE-05",
    "language": "en",
    "type": "expense",
    "text": "Spent 600 rupees on organic manure",
    "expected": {
      "items": [
        {
          "category": "fertilizer",
          "quantity": null,
          "unit": null,
          "totalAmount": 600
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude hundreds"
  },
  {
    "id": "HE-06",
    "language": "en",
    "type": "expense",
    "text": "Paid 18500 rupees for mop fertilizer sacks",
    "expected": {
      "items": [
        {
          "category": "fertilizer",
          "quantity": null,
          "unit": null,
          "totalAmount": 18500
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 10k+"
  },
  {
    "id": "HE-07",
    "language": "en",
    "type": "expense",
    "text": "Ordered bulk npk fertilizer for 115000 rupees",
    "expected": {
      "items": [
        {
          "category": "fertilizer",
          "quantity": null,
          "unit": null,
          "totalAmount": 115000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 100k+"
  },
  {
    "id": "HE-08",
    "language": "en",
    "type": "expense",
    "text": "Purchased 3 bottles of pesticide chemical for 2500 rupees",
    "expected": {
      "items": [
        {
          "category": "agrochemical",
          "quantity": 3,
          "unit": "bottles",
          "totalAmount": 2500
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (2500/3)"
  },
  {
    "id": "HE-09",
    "language": "en",
    "type": "expense",
    "text": "Paid 450 rupees for spray bottle insecticide",
    "expected": {
      "items": [
        {
          "category": "agrochemical",
          "quantity": null,
          "unit": null,
          "totalAmount": 450
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude hundreds"
  },
  {
    "id": "HE-10",
    "language": "en",
    "type": "expense",
    "text": "Spent 7200 rupees on paddy weedicide",
    "expected": {
      "items": [
        {
          "category": "agrochemical",
          "quantity": null,
          "unit": null,
          "totalAmount": 7200
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude thousands"
  },
  {
    "id": "HE-11",
    "language": "en",
    "type": "expense",
    "text": "Purchased wholesale fungicide chemicals for 125000 rupees",
    "expected": {
      "items": [
        {
          "category": "agrochemical",
          "quantity": null,
          "unit": null,
          "totalAmount": 125000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 100k+"
  },
  {
    "id": "HE-12",
    "language": "en",
    "type": "expense",
    "text": "Paid 6 laborers daily wage for 25000 rupees",
    "expected": {
      "items": [
        {
          "category": "labour",
          "quantity": 6,
          "unit": "laborers",
          "totalAmount": 25000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (25000/6)"
  },
  {
    "id": "HE-13",
    "language": "en",
    "type": "expense",
    "text": "Spent 950 rupees for casual laborer tea and meals",
    "expected": {
      "items": [
        {
          "category": "labour",
          "quantity": null,
          "unit": null,
          "totalAmount": 950
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude hundreds"
  },
  {
    "id": "HE-14",
    "language": "en",
    "type": "expense",
    "text": "Paid 8000 rupees daily wage for field weeding",
    "expected": {
      "items": [
        {
          "category": "labour",
          "quantity": null,
          "unit": null,
          "totalAmount": 8000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude thousands"
  },
  {
    "id": "HE-15",
    "language": "en",
    "type": "expense",
    "text": "Settled harvest workers seasonal contract for 180000 rupees",
    "expected": {
      "items": [
        {
          "category": "labour",
          "quantity": null,
          "unit": null,
          "totalAmount": 180000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 100k+"
  },
  {
    "id": "HE-16",
    "language": "en",
    "type": "expense",
    "text": "Hired combine harvester 7 hours for 50000 rupees",
    "expected": {
      "items": [
        {
          "category": "machinery",
          "quantity": 7,
          "unit": "hours",
          "totalAmount": 50000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (50000/7)"
  },
  {
    "id": "HE-17",
    "language": "en",
    "type": "expense",
    "text": "Paid 4500 rupees for rotavator machinery service",
    "expected": {
      "items": [
        {
          "category": "machinery",
          "quantity": null,
          "unit": null,
          "totalAmount": 4500
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude thousands"
  },
  {
    "id": "HE-18",
    "language": "en",
    "type": "expense",
    "text": "Paid 35000 rupees for full day tractor ploughing",
    "expected": {
      "items": [
        {
          "category": "machinery",
          "quantity": null,
          "unit": null,
          "totalAmount": 35000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 10k+"
  },
  {
    "id": "HE-19",
    "language": "en",
    "type": "expense",
    "text": "Paid 220000 rupees for seasonal harvester machinery hire",
    "expected": {
      "items": [
        {
          "category": "machinery",
          "quantity": null,
          "unit": null,
          "totalAmount": 220000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 100k+"
  },
  {
    "id": "HE-20",
    "language": "en",
    "type": "expense",
    "text": "Bought 3 cans of diesel fuel for 10000 rupees",
    "expected": {
      "items": [
        {
          "category": "fuel",
          "quantity": 3,
          "unit": "cans",
          "totalAmount": 10000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (10000/3)"
  },
  {
    "id": "HE-21",
    "language": "en",
    "type": "expense",
    "text": "Spent 350 rupees for two stroke engine petrol",
    "expected": {
      "items": [
        {
          "category": "fuel",
          "quantity": null,
          "unit": null,
          "totalAmount": 350
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude hundreds"
  },
  {
    "id": "HE-22",
    "language": "en",
    "type": "expense",
    "text": "Paid 6500 rupees for machinery engine oil",
    "expected": {
      "items": [
        {
          "category": "fuel",
          "quantity": null,
          "unit": null,
          "totalAmount": 6500
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude thousands"
  },
  {
    "id": "HE-23",
    "language": "en",
    "type": "expense",
    "text": "Purchased 7 coils of irrigation pipe for 45000 rupees",
    "expected": {
      "items": [
        {
          "category": "irrigation",
          "quantity": 7,
          "unit": "coils",
          "totalAmount": 45000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (45000/7)"
  },
  {
    "id": "HE-24",
    "language": "en",
    "type": "expense",
    "text": "Paid 3200 rupees for emergency water bowser",
    "expected": {
      "items": [
        {
          "category": "irrigation",
          "quantity": null,
          "unit": null,
          "totalAmount": 3200
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude thousands"
  },
  {
    "id": "HE-25",
    "language": "en",
    "type": "expense",
    "text": "Settled community irrigation canal water fee for 15000 rupees",
    "expected": {
      "items": [
        {
          "category": "irrigation",
          "quantity": null,
          "unit": null,
          "totalAmount": 15000
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude 10k+"
  },
  {
    "id": "HE-26",
    "language": "en",
    "type": "expense",
    "text": "Bought 3 rolls of fencing wire for 10000 rupees",
    "expected": {
      "items": [
        {
          "category": "other",
          "quantity": 3,
          "unit": "rolls",
          "totalAmount": 10000
        }
      ]
    },
    "fractional_unit_price": true,
    "notes": "Fractional unit price (10000/3)"
  },
  {
    "id": "HE-27",
    "language": "en",
    "type": "expense",
    "text": "Paid 750 rupees for repair glue and pvc pipe joint fittings",
    "expected": {
      "items": [
        {
          "category": "other",
          "quantity": null,
          "unit": null,
          "totalAmount": 750
        }
      ]
    },
    "fractional_unit_price": false,
    "notes": "Magnitude hundreds"
  },
  {
    "id": "HE-CMD-01",
    "language": "en",
    "type": "command",
    "text": "Change fertilizer amount to 15000",
    "expected_command": {
      "intent": "correct",
      "field": "amount",
      "target": "fertilizer",
      "newValue": 15000
    },
    "notes": "Follow-up command: correct"
  },
  {
    "id": "HE-CMD-02",
    "language": "en",
    "type": "command",
    "text": "Remove the tractor plowing expense",
    "expected_command": {
      "intent": "remove",
      "target": "tractor plowing"
    },
    "notes": "Follow-up command: remove"
  },
  {
    "id": "HE-CMD-03",
    "language": "en",
    "type": "command",
    "text": "What is the total expense amount",
    "expected_command": {
      "intent": "query",
      "kind": "total"
    },
    "notes": "Follow-up command: query"
  }
]
```

- **SHA256 (`logs/heldout-en-hash.txt`):**
  `69e1dd17272ae1abc25a0653e2ee32bb505a0745530b405b3279427e32081166  server/eval/fixtures/voice/heldout-en.json`
- **Lock File (`logs/heldout-en.lock`):**
  `LOCKED: 69e1dd17272ae1abc25a0653e2ee32bb505a0745530b405b3279427e32081166`

---

## 2. Capture Pipeline (`/dev/voice-capture`)

1. **Storage Isolation:**
   - Dedicated folder: `voice-capture-audio/`
   - Added to root `.gitignore` (verified: `git check-ignore -v voice-capture-audio/dummy.wav` returns `.gitignore:14:voice-capture-audio/`).
   - Does **not** touch `private_dataset_storage/`.
2. **Backend Dev Route:**
   - `server/src/routes/devVoiceCapture.js` mounted at `/api/dev/voice-capture`.
   - `GET /prompts`: Serves `server/eval/fixtures/voice/heldout-en.json`.
   - `POST /save`: Saves base64-encoded audio chunk directly into `voice-capture-audio/<promptId>.<ext>`.
3. **Frontend Capture Page (`client/src/dev/VoiceCapturePage.jsx`):**
   - Defaults to `heldout-en.json` with dynamic mount sync from `/api/dev/voice-capture/prompts`.
   - Simultaneous `MediaRecorder` uploads audio automatically upon completion.
   - Chrome Web Speech API captures `rawTranscript`, `confidence`, and `alternatives`.
   - "Download JSON" exports pairing of `promptId`, `promptText`, `chromeTranscript`, `alternatives`, `audioFilename`, and `expected`.

---

## 3. One-Shot Evaluation Pipeline (`voice-learn/eval_heldout_en.py`)

- **ASR Engines:** Whisper `base.en` (raw), Whisper `base.en` (with vocabulary prompt), Chrome Web Speech API.
- **Extractor:** Aswanna Extractor v2 (`extractExpenses` and `parseCommand`).
- **Reporting Metrics:**
  - Correct value
  - Wrong value shown (silent error vs flagged with `needs_review`)
  - No value (unresolved)
- **Lock Enforcement:** Refuses execution if `logs/heldout-en-eval.lock` exists unless explicitly bypassed via `--force-new-run`.

---

## 4. Runbook Specification

Created `docs/runbook-heldout-en.md` with:
- Quiet-room recording protocol (acoustics, microphone placement, conversational cadence).
- Single shared `VOICE_INTERNAL_TOKEN` generation and environment variable configuration across terminals.
- Terminal commands for starting Whisper, Aswanna server, and Aswanna Vite client.
- Browser recording instructions on `/dev/voice-capture` and one-shot evaluation execution.

---

## 5. Synthetic Dry Run & Latency Check

A 3-second synthetic audio file (`temp/synthetic_3s.wav`, 96,044 bytes, 16,000 Hz mono PCM) was generated to test the end-to-end pipeline.

### Command Executed:
```powershell
& 'voice-service\.venv\Scripts\python.exe' voice-learn\eval_heldout_en.py --synthetic-dry-run d:\Aswanna\temp\synthetic_3s.wav
```

### Exact Command Output:
```text
======================================================================
SYNTHETIC DRY RUN — END-TO-END PLUMBING & LATENCY CHECK
NOTE: Tested on synthetic audio. Says nothing about accuracy.
======================================================================
Audio File            : synthetic_3s.wav (96044 bytes)
Audio Duration        : 3.00 s
Whisper Model Load    : 1343 ms
Whisper Transcription : 1131 ms
Extractor v2 Execution: 741 ms
End-to-End Latency    : 1872 ms
Transcript Output     : ""
Extractor Result      : {"type": "expense", "result": {"items": [], "warnings": []}}

Dry run completed successfully. Plumbing verified.
```
> [!NOTE]
> This dry run verifies that the audio decoding, Whisper transcription, and Node extractor v2 plumbing function synchronously end-to-end without errors. Because synthetic audio was used, this dry run **says nothing about transcription accuracy or speech recognition quality**.

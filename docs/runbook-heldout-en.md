# Runbook: Held-out English Evaluation (Whisper vs Chrome vs Extractor v2)

This runbook specifies the step-by-step execution protocol for collecting and evaluating the 30 new held-out English phrases using the local Whisper service, Google Chrome's Web Speech API, and Aswanna Extractor v2.

---

## 1. Quiet-Room Recording Checklist

Before starting any recording session, complete this physical and environmental checklist:
1. **Room Acoustics:** Select an interior room away from open windows, fans, air conditioners, and outdoor road/traffic noise.
2. **Microphone Setup:** Use a dedicated headset or directional microphone positioned 2–3 inches (5–8 cm) from the corner of the mouth to minimize plosives and breathing puffs.
3. **Audio Levels:** Test microphone input levels in Windows Sound settings to avoid clipping or digital distortion (peaks should stay between -6 dB and -3 dB).
4. **Pacing and Pronunciation:** Speak clearly at a natural conversational cadence. Do not pause artificially inside multi-word phrases or numbers.
5. **No Synthetic / Fabricated Speech:** All audio must be recorded by a real human speaker reading the designated prompt on `/dev/voice-capture`.

---

## 2. Environment Configuration

Generate a single cryptographically random token for authentication between the Node server and the Python Whisper service:

```powershell
# In PowerShell: Generate a 32-byte secret token
$env:VOICE_INTERNAL_TOKEN = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
Write-Host "Generated VOICE_INTERNAL_TOKEN: $env:VOICE_INTERNAL_TOKEN"
```

Use this **exact same token** in all terminals below.

---

## 3. Terminal Execution Commands

### Terminal 1 — Start Python Whisper Voice Service
In the repo root (`D:\Aswanna`):
```powershell
$env:VOICE_INTERNAL_TOKEN = "<PASTE_YOUR_GENERATED_TOKEN_HERE>"
$env:PORT = "8000"
& "voice-service\.venv\Scripts\uvicorn.exe" app:app --app-dir voice-service --host 127.0.0.1 --port 8000
```
*Verify output indicates:* `Application startup complete. Uvicorn running on http://127.0.0.1:8000`.

---

### Terminal 2 — Start Aswanna Backend Server
In the repo root (`D:\Aswanna`):
```powershell
$env:VOICE_INTERNAL_TOKEN = "<PASTE_YOUR_GENERATED_TOKEN_HERE>"
$env:VOICE_CAPTURE = "on"
$env:PORT = "4000"
npm start --workspace=server
```
*Verify output indicates:* `Server listening on port 4000`.

---

### Terminal 3 — Start Aswanna Vite Frontend
In the repo root (`D:\Aswanna`):
```powershell
$env:VITE_VOICE_CAPTURE = "on"
npm run dev --workspace=client
```
*Verify output indicates:* `Local: http://localhost:3000/`.

---

## 4. Recording in Chrome

1. Open Google Chrome and navigate to:
   ```text
   http://localhost:3000/dev/voice-capture
   ```
2. When prompted by Chrome, grant microphone permissions.
3. The page will load the 30 new held-out phrases from `server/eval/fixtures/voice/heldout-en.json` (27 expense phrases covering all 8 categories and mixed magnitudes, plus 3 follow-up commands).
4. For each phrase (`HE-01` through `HE-CMD-03`):
   - Click the microphone button to start recording.
   - Read the English phrase displayed on screen clearly.
   - Click the stop button (or allow speech recognition to conclude automatically).
   - The browser simultaneously captures:
     - The Google Chrome Web Speech API transcript and confidence score.
     - Top ASR alternative hypotheses.
     - The MediaRecorder audio stream, which is automatically posted to `/api/dev/voice-capture/save` and written directly into `voice-capture-audio/<phrase_id>.<ext>`.
5. Once all 30 phrases have been spoken, click **"Download JSON"** (or **"Export JSON"**).
   - Save the exported file to:
     ```text
     D:\Aswanna\voice-capture-audio\real-asr.captured.json
     ```
   - This file pairs each phrase ID with its Chrome transcript, alternatives, expected ground-truth labels, and corresponding audio filename.

---

## 5. Running the One-Shot Evaluation Script

Once audio recording and JSON export are completed, run the evaluation script:

```powershell
& "voice-service\.venv\Scripts\python.exe" voice-learn\eval_heldout_en.py --json voice-capture-audio\real-asr.captured.json
```

### What the Evaluation Script Does:
1. Validates the run-once lock (`logs/heldout-en-eval.lock`).
2. Transcribes each audio file in `voice-capture-audio/` with Whisper `base.en` (both raw and with the agricultural vocabulary prompt).
3. Runs Aswanna Extractor v2 against:
   - Chrome Web Speech transcripts
   - Whisper raw transcripts
   - Whisper + Vocab transcripts
4. Scores each phrase against the ground-truth held-out labels:
   - Category (correct / wrong / none)
   - Quantity (correct / wrong / none)
   - Amount (correct / wrong / none)
   - Value status (correct value / wrong value shown (silent vs flagged) / no value)
5. Writes per-item JSON results to `logs/heldout-en-eval-results.json`.
6. Prints a comparative summary table and establishes the run-once lock `logs/heldout-en-eval.lock`.

### Refusal to Re-run (Lock Enforcement):
If executed a second time, the script will exit immediately with:
```text
ERROR: Run-once lock file exists at: logs/heldout-en-eval.lock
Refusing to run twice without explicit override.
Use --force-new-run to proceed with a fresh evaluation.
```
To explicitly re-run:
```powershell
& "voice-service\.venv\Scripts\python.exe" voice-learn\eval_heldout_en.py --json voice-capture-audio\real-asr.captured.json --force-new-run
```

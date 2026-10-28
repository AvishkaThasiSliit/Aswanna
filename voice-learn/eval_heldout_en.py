#!/usr/bin/env python3
"""
Held-out English Evaluation Script (Whisper vs Chrome vs Extractor v2)
Requirement 3 of Task R1:
- Runs Whisper (with and without vocab prompt) on recorded audio in voice-capture-audio/
- Runs extractor v2 on Chrome transcripts and Whisper transcripts
- Writes per-item results to JSON and prints summary table
- Refuses to run twice (lock file) unless --force-new-run is given
"""

import os
import sys
import json
import time
import argparse
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SERVICE_ROOT = REPO_ROOT / "voice-service"
FIXTURES_FILE = REPO_ROOT / "server" / "eval" / "fixtures" / "voice" / "heldout-en.json"
LOCK_FILE = REPO_ROOT / "logs" / "heldout-en-eval.lock"
RESULTS_JSON = REPO_ROOT / "logs" / "heldout-en-eval-results.json"
DEFAULT_AUDIO_DIR = REPO_ROOT / "voice-capture-audio"
DEFAULT_CAPTURED_JSON = REPO_ROOT / "voice-capture-audio" / "real-asr.captured.json"

sys.path.insert(0, str(SERVICE_ROOT))

try:
    import av
    _orig_av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _patched_av_open
except Exception:
    pass

def run_node_extractor(text: str, item_type: str = "expense") -> dict:
    """Invokes shared/voice extractor v2 via deterministic node execution."""
    script = """
    const path = require('path');
    const { pathToFileURL } = require('url');
    (async () => {
        try {
            const text = process.argv[1] || '';
            const type = process.argv[2] || 'expense';
            
            if (type === 'command') {
                const parseCmdUrl = pathToFileURL(path.resolve('./shared/voice/parseCommand.js')).href;
                const { parseCommand } = await import(parseCmdUrl);
                const pending = [
                    { id: 'row-1', description: 'fertilizer', category: 'fertilizer', totalAmount: 10000 },
                    { id: 'row-2', description: 'tractor plowing', category: 'machinery', totalAmount: 25000 }
                ];
                const res = parseCommand(text, pending);
                console.log(JSON.stringify({ type: 'command', result: res }));
            } else {
                const extractUrl = pathToFileURL(path.resolve('./shared/voice/extractExpenses.js')).href;
                const { extractExpenses } = await import(extractUrl);
                const res = extractExpenses(text);
                console.log(JSON.stringify({ type: 'expense', result: res }));
            }
        } catch (e) {
            console.log(JSON.stringify({ error: e.message }));
        }
    })();
    """
    cmd = ["node", "-e", script, text, item_type]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT))
    if proc.returncode == 0 and proc.stdout.strip():
        try:
            return json.loads(proc.stdout.strip())
        except Exception:
            return {"error": "Invalid JSON from extractor"}
    return {"error": proc.stderr or "Process failed"}


def evaluate_extracted(item_meta: dict, transcript: str, extracted_raw: dict) -> dict:
    """Evaluates extracted data against ground truth heldout label."""
    item_type = item_meta.get("type", "expense")

    if item_type == "command":
        expected_cmd = item_meta.get("expected_command", {})
        res = extracted_raw.get("result", {})
        intent = res.get("intent")
        exp_intent = expected_cmd.get("intent")

        intent_correct = (intent == exp_intent)
        if intent_correct:
            val_status = "correct value"
        elif intent == "unknown" or not intent:
            val_status = "no value"
        else:
            val_status = "wrong value shown (silent)"

        return {
            "type": "command",
            "transcript": transcript,
            "extracted_intent": intent,
            "expected_intent": exp_intent,
            "status": res.get("status", "ready"),
            "reasons": [],
            "category_eval": "N/A",
            "quantity_eval": "N/A",
            "amount_eval": "N/A",
            "value_status": val_status,
            "details": res
        }

    # Expense evaluation
    exp_items = item_meta.get("expected", {}).get("items", [{}])
    exp_target = exp_items[0] if exp_items else {}
    exp_cat = exp_target.get("category")
    exp_qty = exp_target.get("quantity")
    exp_amt = exp_target.get("totalAmount")

    res = extracted_raw.get("result", {})
    items = res.get("items", [])
    ext_item = items[0] if items else {}

    ext_cat = ext_item.get("category")
    ext_qty = ext_item.get("quantity")
    ext_amt = ext_item.get("totalAmount")
    status = ext_item.get("status", "no_items")
    reasons = ext_item.get("reasons", [])

    # Category evaluation
    if ext_cat is None:
        cat_eval = "none"
    elif ext_cat == exp_cat:
        cat_eval = "correct"
    else:
        cat_eval = "wrong"

    # Quantity evaluation
    if ext_qty is None and exp_qty is None:
        qty_eval = "correct"
    elif ext_qty is None:
        qty_eval = "none"
    elif ext_qty == exp_qty:
        qty_eval = "correct"
    else:
        qty_eval = "wrong"

    # Amount evaluation
    if ext_amt is None and exp_amt is None:
        amt_eval = "correct"
    elif ext_amt is None:
        amt_eval = "none"
    elif ext_amt == exp_amt:
        amt_eval = "correct"
    else:
        amt_eval = "wrong"

    # Value status classification:
    # - correct value: amount matches expected
    # - wrong value shown (silent): amount mismatch and status == 'ok'
    # - wrong value shown (flagged): amount mismatch and status == 'needs_review'
    # - no value: amount is None
    if ext_amt is None:
        val_status = "no value"
    elif ext_amt == exp_amt:
        val_status = "correct value"
    else:
        if status == "ok":
            val_status = "wrong value shown (silent)"
        else:
            val_status = "wrong value shown (flagged)"

    return {
        "type": "expense",
        "transcript": transcript,
        "extracted_category": ext_cat,
        "expected_category": exp_cat,
        "category_eval": cat_eval,
        "extracted_quantity": ext_qty,
        "expected_quantity": exp_qty,
        "quantity_eval": qty_eval,
        "extracted_amount": ext_amt,
        "expected_amount": exp_amt,
        "amount_eval": amt_eval,
        "status": status,
        "reasons": reasons,
        "value_status": val_status
    }


def main():
    parser = argparse.ArgumentParser(description="Held-out English Evaluation Pipeline")
    parser.add_argument("--audio-dir", type=str, default=str(DEFAULT_AUDIO_DIR), help="Audio directory")
    parser.add_argument("--json", type=str, default="", help="Path to captured JSON metadata")
    parser.add_argument("--force-new-run", action="store_true", help="Override run-once lock")
    parser.add_argument("--synthetic-dry-run", type=str, default="", help="Run a synthetic single WAV test for latency check")
    args = parser.parse_args()

    # 1. Run-once Lock Check
    if not args.synthetic_dry_run:
        if LOCK_FILE.exists() and not args.force_new_run:
            print(f"ERROR: Run-once lock file exists at: {LOCK_FILE}")
            print("Refusing to run twice without explicit override.")
            print("Use --force-new-run to proceed with a fresh evaluation.")
            sys.exit(1)

    # 2. Synthetic Dry Run Mode (Requirement 5)
    if args.synthetic_dry_run:
        synth_path = Path(args.synthetic_dry_run)
        if not synth_path.exists():
            print(f"ERROR: Synthetic audio file not found: {synth_path}")
            sys.exit(1)

        print("\n" + "=" * 70)
        print("SYNTHETIC DRY RUN — END-TO-END PLUMBING & LATENCY CHECK")
        print("NOTE: Tested on synthetic audio. Says nothing about accuracy.")
        print("=" * 70)

        from faster_whisper import WhisperModel
        models_dir = str(SERVICE_ROOT / "models")
        t0 = time.perf_counter()
        model = WhisperModel("base.en", device="cpu", compute_type="int8", download_root=models_dir)
        load_time_ms = int((time.perf_counter() - t0) * 1000)

        t1 = time.perf_counter()
        segments, info = model.transcribe(str(synth_path), language="en")
        synth_transcript = " ".join(s.text.strip() for s in segments).strip()
        transcribe_time_ms = int((time.perf_counter() - t1) * 1000)

        # Run extractor v2 on output
        t2 = time.perf_counter()
        ext_res = run_node_extractor(synth_transcript, "expense")
        extract_time_ms = int((time.perf_counter() - t2) * 1000)

        total_latency_ms = transcribe_time_ms + extract_time_ms

        print(f"Audio File            : {synth_path.name} ({synth_path.stat().st_size} bytes)")
        print(f"Audio Duration        : {info.duration:.2f} s")
        print(f"Whisper Model Load    : {load_time_ms} ms")
        print(f"Whisper Transcription : {transcribe_time_ms} ms")
        print(f"Extractor v2 Execution: {extract_time_ms} ms")
        print(f"End-to-End Latency    : {total_latency_ms} ms")
        print(f"Transcript Output     : \"{synth_transcript}\"")
        print(f"Extractor Result      : {json.dumps(ext_res)}")
        print("\nDry run completed successfully. Plumbing verified.")
        return

    # 3. Full Held-out Evaluation Mode
    if not FIXTURES_FILE.exists():
        print(f"ERROR: Fixtures file not found: {FIXTURES_FILE}")
        sys.exit(1)

    with open(FIXTURES_FILE, "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    # Load captured JSON metadata
    captured_meta = {}
    json_path = Path(args.json) if args.json else DEFAULT_CAPTURED_JSON
    if not json_path.exists():
        # Check repo root
        alt_root_json = REPO_ROOT / "real-asr.captured.json"
        if alt_root_json.exists():
            json_path = alt_root_json

    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                c_data = json.load(f)
                if isinstance(c_data, list):
                    for entry in c_data:
                        pid = entry.get("promptId") or entry.get("id")
                        if pid:
                            captured_meta[pid] = entry
                elif isinstance(c_data, dict):
                    captured_meta = c_data
            print(f"Loaded metadata for {len(captured_meta)} items from {json_path}")
        except Exception as e:
            print(f"Warning: Could not read metadata JSON: {e}")

    # Check for audio files
    audio_dir = Path(args.audio_dir)
    audio_map = {}
    if audio_dir.exists():
        for f in audio_dir.glob("*"):
            if f.suffix.lower() in [".wav", ".webm", ".ogg", ".mp3", ".m4a"]:
                audio_map[f.stem] = f

    print(f"Found {len(audio_map)} audio files in {audio_dir}")
    if not audio_map and not captured_meta:
        print("No audio recordings or captured JSON found. Nothing to evaluate yet.")
        sys.exit(0)

    # Initialize Whisper
    from faster_whisper import WhisperModel
    models_dir = str(SERVICE_ROOT / "models")
    model = WhisperModel("base.en", device="cpu", compute_type="int8", download_root=models_dir)

    vocab_file = SERVICE_ROOT / "vocab.txt"
    vocab_prompt = vocab_file.read_text(encoding="utf-8").strip() if vocab_file.exists() else None

    engines = ["chrome", "whisper_raw", "whisper_vocab"]
    per_item_results = []
    summary_counts = {
        eng: {
            "correct_value": 0,
            "wrong_silent": 0,
            "wrong_flagged": 0,
            "no_value": 0,
            "total": 0
        }
        for eng in engines
    }

    for item in fixtures:
        pid = item["id"]
        ptype = item.get("type", "expense")
        ptext = item.get("text", "")
        meta = captured_meta.get(pid, {})
        audio_file = audio_map.get(pid)

        item_res = {
            "id": pid,
            "type": ptype,
            "text": ptext,
            "evaluations": {}
        }

        # 1. Chrome baseline
        chrome_transcript = meta.get("chromeTranscript") or meta.get("rawTranscript") or ""
        ext_chrome = run_node_extractor(chrome_transcript, ptype)
        eval_chrome = evaluate_extracted(item, chrome_transcript, ext_chrome)
        item_res["evaluations"]["chrome"] = eval_chrome
        vstat = eval_chrome["value_status"]
        summary_counts["chrome"]["total"] += 1
        if vstat == "correct value": summary_counts["chrome"]["correct_value"] += 1
        elif vstat == "wrong value shown (silent)": summary_counts["chrome"]["wrong_silent"] += 1
        elif vstat == "wrong value shown (flagged)": summary_counts["chrome"]["wrong_flagged"] += 1
        elif vstat == "no value": summary_counts["chrome"]["no_value"] += 1

        # 2. Whisper raw & with vocab
        w_raw_text = ""
        w_vocab_text = ""
        if audio_file and audio_file.exists():
            segs_raw, _ = model.transcribe(str(audio_file), language="en", initial_prompt=None)
            w_raw_text = " ".join(s.text.strip() for s in segs_raw).strip()

            segs_vocab, _ = model.transcribe(str(audio_file), language="en", initial_prompt=vocab_prompt)
            w_vocab_text = " ".join(s.text.strip() for s in segs_vocab).strip()

        ext_w_raw = run_node_extractor(w_raw_text, ptype)
        eval_w_raw = evaluate_extracted(item, w_raw_text, ext_w_raw)
        item_res["evaluations"]["whisper_raw"] = eval_w_raw
        vstat_raw = eval_w_raw["value_status"]
        summary_counts["whisper_raw"]["total"] += 1
        if vstat_raw == "correct value": summary_counts["whisper_raw"]["correct_value"] += 1
        elif vstat_raw == "wrong value shown (silent)": summary_counts["whisper_raw"]["wrong_silent"] += 1
        elif vstat_raw == "wrong value shown (flagged)": summary_counts["whisper_raw"]["wrong_flagged"] += 1
        elif vstat_raw == "no value": summary_counts["whisper_raw"]["no_value"] += 1

        ext_w_vocab = run_node_extractor(w_vocab_text, ptype)
        eval_w_vocab = evaluate_extracted(item, w_vocab_text, ext_w_vocab)
        item_res["evaluations"]["whisper_vocab"] = eval_w_vocab
        vstat_vocab = eval_w_vocab["value_status"]
        summary_counts["whisper_vocab"]["total"] += 1
        if vstat_vocab == "correct value": summary_counts["whisper_vocab"]["correct_value"] += 1
        elif vstat_vocab == "wrong value shown (silent)": summary_counts["whisper_vocab"]["wrong_silent"] += 1
        elif vstat_vocab == "wrong value shown (flagged)": summary_counts["whisper_vocab"]["wrong_flagged"] += 1
        elif vstat_vocab == "no value": summary_counts["whisper_vocab"]["no_value"] += 1

        per_item_results.append(item_res)

    # Save results JSON
    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(per_item_results, f, indent=2)
    print(f"\nWritten per-item evaluation results to: {RESULTS_JSON}")

    # Set run-once lock
    with open(LOCK_FILE, "w", encoding="utf-8") as f:
        f.write(f"EVAL_COMPLETED: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}\n")
        f.write(f"ITEMS_EVALUATED: {len(per_item_results)}\n")
    print(f"Created run-once lock: {LOCK_FILE}")

    # Print Summary Table
    print("\n" + "=" * 80)
    print("HELDOUT ENGLISH EVALUATION SUMMARY (Whisper vs Chrome vs Extractor v2)")
    print("=" * 80)
    print(f"{'Engine':<20} | {'Correct Value':<14} | {'Wrong (Silent)':<15} | {'Wrong (Flagged)':<15} | {'No Value':<10} | {'Total':<6}")
    print("-" * 80)
    for eng, st in summary_counts.items():
        print(f"{eng:<20} | {st['correct_value']:<14} | {st['wrong_silent']:<15} | {st['wrong_flagged']:<15} | {st['no_value']:<10} | {st['total']:<6}")
    print("=" * 80)


if __name__ == "__main__":
    main()

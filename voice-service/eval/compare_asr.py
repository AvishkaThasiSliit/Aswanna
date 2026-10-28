#!/usr/bin/env python3
"""
ASR Comparative Evaluation Tool (TASK W1)
Compares Browser Web Speech vs. Whisper (with and without vocabulary prompt).
Reports WER (via jiwer), amount-correct, category-correct, needs_review, silent errors, latency.

Usage:
    python voice-service/eval/compare_asr.py [--audio-dir <path>] [--json <path>]
"""

import os
import sys
import json
import time
import argparse
import subprocess
from pathlib import Path

# Add voice-service root to pythonpath
SERVICE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_ROOT))

try:
    import jiwer
except ImportError:
    jiwer = None

try:
    import av
    _orig_av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _patched_av_open
except Exception:
    pass

def run_node_extract(transcript: str, repo_root: Path) -> dict:
    """Run frozen extractExpenses via a tiny Node execution subprocess."""
    node_script = """
    const path = require('path');
    const { pathToFileURL } = require('url');
    (async () => {
        try {
            const extractPath = pathToFileURL(path.resolve(process.argv[1])).href;
            const { extractExpenses } = await import(extractPath);
            const text = process.argv[2] || '';
            const res = extractExpenses(text);
            console.log(JSON.stringify(res));
        } catch (e) {
            console.log(JSON.stringify({ items: [], error: e.message }));
        }
    })();
    """
    extract_js = repo_root / "shared" / "voice" / "extractExpenses.js"
    cmd = ["node", "-e", node_script, str(extract_js), transcript]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(repo_root))
    if proc.returncode == 0 and proc.stdout.strip():
        try:
            return json.loads(proc.stdout.strip())
        except Exception:
            return {"items": [], "warnings": []}
    return {"items": [], "warnings": []}


def score_extraction(extracted_items: list, expected_items: list) -> dict:
    """Evaluate extracted items against expected ground-truth rows."""
    if not expected_items:
        return {
            "amount_correct": len(extracted_items) == 0,
            "category_correct": len(extracted_items) == 0,
            "needs_review": any(i.get("status") == "needs_review" for i in extracted_items),
            "silent_error": len(extracted_items) > 0
        }

    # Match based on index or amount
    amount_correct = True
    category_correct = True
    needs_review = any(i.get("status") == "needs_review" for i in extracted_items)

    if len(extracted_items) != len(expected_items):
        amount_correct = False
        category_correct = False
    else:
        for ext, exp in zip(extracted_items, expected_items):
            if ext.get("totalAmount") != exp.get("totalAmount"):
                amount_correct = False
            if ext.get("category") != exp.get("category"):
                category_correct = False

    # A silent error occurs when extraction is marked 'ok' but amount or category is incorrect
    silent_error = (not needs_review) and (not amount_correct or not category_correct)

    return {
        "amount_correct": amount_correct,
        "category_correct": category_correct,
        "needs_review": needs_review,
        "silent_error": silent_error
    }


def main():
    parser = argparse.ArgumentParser(description="Compare ASR engines on captured speech recordings.")
    parser.add_argument("--audio-dir", type=str, default="", help="Directory containing audio files (.wav, .webm, .ogg)")
    parser.add_argument("--json", type=str, default="", help="Path to captured JSON metadata file")
    args = parser.parse_args()

    repo_root = SERVICE_ROOT.parent

    # Determine audio search location
    search_dirs = []
    if args.audio_dir:
        search_dirs.append(Path(args.audio_dir))
    search_dirs.extend([
        repo_root / "server" / "eval" / "fixtures" / "voice" / "audio",
        repo_root / "server" / "eval" / "fixtures" / "voice",
        SERVICE_ROOT / "eval" / "audio"
    ])

    audio_files = []
    for d in search_dirs:
        if d.exists() and d.is_dir():
            for ext in [".wav", ".webm", ".ogg"]:
                audio_files.extend(list(d.glob(f"*{ext}")))

    # Rule: If no audio exists yet, print 'no audio captured' and exit 0
    if not audio_files:
        print("no audio captured")
        sys.exit(0)

    print(f"Found {len(audio_files)} audio files for comparative evaluation.")

    # Lazy import Whisper
    from faster_whisper import WhisperModel
    models_dir = str(SERVICE_ROOT / "models")
    model = WhisperModel("base.en", device="cpu", compute_type="int8", download_root=models_dir)

    vocab_file = SERVICE_ROOT / "vocab.txt"
    vocab_prompt = vocab_file.read_text(encoding="utf-8").strip() if vocab_file.exists() else None

    # Load captured JSON if provided
    metadata = {}
    if args.json and Path(args.json).exists():
        try:
            with open(args.json, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        pid = item.get("promptId")
                        if pid:
                            metadata[pid] = item
        except Exception:
            pass

    results_by_engine = {
        "browser": {"wer": [], "amount_correct": 0, "cat_correct": 0, "needs_review": 0, "silent_errors": 0, "latency_ms": []},
        "whisper_no_prompt": {"wer": [], "amount_correct": 0, "cat_correct": 0, "needs_review": 0, "silent_errors": 0, "latency_ms": []},
        "whisper_with_prompt": {"wer": [], "amount_correct": 0, "cat_correct": 0, "needs_review": 0, "silent_errors": 0, "latency_ms": []}
    }

    count = 0
    for audio_path in audio_files:
        stem = audio_path.stem
        meta = metadata.get(stem, {})
        prompt_text = meta.get("promptText", "")
        expected = meta.get("expected", [])
        if isinstance(expected, dict) and "items" in expected:
            expected = expected["items"]

        # Only evaluate English audio
        lang = meta.get("language", "en")
        if lang != "en" and not prompt_text:
            continue

        count += 1
        print(f"\n--- [{count}] Evaluating: {audio_path.name} ---")
        if prompt_text:
            print(f"Reference Prompt: \"{prompt_text}\"")

        # 1. Browser ASR baseline from captured JSON
        browser_text = meta.get("rawTranscript", "")
        if browser_text and prompt_text and jiwer:
            b_wer = jiwer.wer(prompt_text.lower(), browser_text.lower())
            results_by_engine["browser"]["wer"].append(b_wer)
            b_extract = run_node_extract(browser_text, repo_root)
            b_score = score_extraction(b_extract.get("items", []), expected)
            if b_score["amount_correct"]: results_by_engine["browser"]["amount_correct"] += 1
            if b_score["category_correct"]: results_by_engine["browser"]["cat_correct"] += 1
            if b_score["needs_review"]: results_by_engine["browser"]["needs_review"] += 1
            if b_score["silent_error"]: results_by_engine["browser"]["silent_errors"] += 1

        # 2. Whisper without prompt
        t0 = time.perf_counter()
        segs_no_p, _ = model.transcribe(str(audio_path), language="en", initial_prompt=None)
        no_p_text = " ".join(s.text.strip() for s in segs_no_p).strip()
        no_p_lat = int((time.perf_counter() - t0) * 1000)
        results_by_engine["whisper_no_prompt"]["latency_ms"].append(no_p_lat)

        if prompt_text and jiwer:
            w1_wer = jiwer.wer(prompt_text.lower(), no_p_text.lower())
            results_by_engine["whisper_no_prompt"]["wer"].append(w1_wer)
        w1_extract = run_node_extract(no_p_text, repo_root)
        w1_score = score_extraction(w1_extract.get("items", []), expected)
        if w1_score["amount_correct"]: results_by_engine["whisper_no_prompt"]["amount_correct"] += 1
        if w1_score["category_correct"]: results_by_engine["whisper_no_prompt"]["cat_correct"] += 1
        if w1_score["needs_review"]: results_by_engine["whisper_no_prompt"]["needs_review"] += 1
        if w1_score["silent_error"]: results_by_engine["whisper_no_prompt"]["silent_errors"] += 1

        # 3. Whisper with vocabulary prompt
        t1 = time.perf_counter()
        segs_with_p, _ = model.transcribe(str(audio_path), language="en", initial_prompt=vocab_prompt)
        with_p_text = " ".join(s.text.strip() for s in segs_with_p).strip()
        with_p_lat = int((time.perf_counter() - t1) * 1000)
        results_by_engine["whisper_with_prompt"]["latency_ms"].append(with_p_lat)

        if prompt_text and jiwer:
            w2_wer = jiwer.wer(prompt_text.lower(), with_p_text.lower())
            results_by_engine["whisper_with_prompt"]["wer"].append(w2_wer)
        w2_extract = run_node_extract(with_p_text, repo_root)
        w2_score = score_extraction(w2_extract.get("items", []), expected)
        if w2_score["amount_correct"]: results_by_engine["whisper_with_prompt"]["amount_correct"] += 1
        if w2_score["category_correct"]: results_by_engine["whisper_with_prompt"]["cat_correct"] += 1
        if w2_score["needs_review"]: results_by_engine["whisper_with_prompt"]["needs_review"] += 1
        if w2_score["silent_error"]: results_by_engine["whisper_with_prompt"]["silent_errors"] += 1

        print(f"  Browser ASR    : \"{browser_text}\"")
        print(f"  Whisper (Raw)  : \"{no_p_text}\" ({no_p_lat} ms)")
        print(f"  Whisper (+Vocab): \"{with_p_text}\" ({with_p_lat} ms)")

    print("\n" + "=" * 60)
    print("COMPARATIVE EVALUATION SUMMARY")
    print("=" * 60)
    for engine, stats in results_by_engine.items():
        wer_avg = (sum(stats["wer"]) / len(stats["wer"])) if stats["wer"] else 0.0
        lat_avg = (sum(stats["latency_ms"]) / len(stats["latency_ms"])) if stats["latency_ms"] else 0.0
        print(f"Engine: {engine}")
        print(f"  WER              : {wer_avg:.3f}")
        print(f"  Amount Correct   : {stats['amount_correct']}/{count}")
        print(f"  Category Correct : {stats['cat_correct']}/{count}")
        print(f"  Needs Review     : {stats['needs_review']}/{count}")
        print(f"  Silent Errors    : {stats['silent_errors']}/{count}")
        print(f"  Mean Latency     : {lat_avg:.1f} ms")


if __name__ == "__main__":
    main()

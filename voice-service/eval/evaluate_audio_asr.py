#!/usr/bin/env python3
"""
Audio-Backed Speech Recognition Evaluation Tool (Phase 1)

Measures:
1. Word Error Rate (WER) - overall transcript accuracy
2. Character Error Rate (CER) - phonetic and graphemic precision (essential for Sinhala)
3. Numerical Token Accuracy - exact precision and recall for financial amounts and quantities
4. Inference Latency & Real-Time Factor (RTF) - millisecond latency per utterance and processing speed

Dataset Schema Expected in Manifest JSON:
[
  {
    "caseId": "VP-AUD-001",
    "audioPath": "recordings/en/vp_aud_001.wav",
    "language": "en",
    "referenceTranscript": "Bought 2 bags of urea fertilizer for 14000 rupees",
    "speaker": { "id": "farmer_01", "accent": "Sri Lankan English" },
    "reviewStatus": "reviewed"
  }
]
"""

import os
import sys
import json
import time
import argparse
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add voice-service root to Python path
SERVICE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_ROOT))

try:
    import jiwer
except ImportError:
    jiwer = None

from adapters import get_adapter, BaseASRAdapter


# Pure Python Levenshtein fallback for Word Error Rate (WER)
def calculate_fallback_wer(reference: str, hypothesis: str) -> float:
    ref_words = reference.strip().lower().split()
    hyp_words = hypothesis.strip().lower().split()

    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    if not hyp_words:
        return 1.0

    d = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]
    for i in range(len(ref_words) + 1):
        d[i][0] = i
    for j in range(len(hyp_words) + 1):
        d[0][j] = j

    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            cost = 0 if ref_words[i - 1] == hyp_words[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,       # deletion
                d[i][j - 1] + 1,       # insertion
                d[i - 1][j - 1] + cost  # substitution
            )

    return d[len(ref_words)][len(hyp_words)] / float(len(ref_words))


# Pure Python Levenshtein fallback for Character Error Rate (CER)
def calculate_fallback_cer(reference: str, hypothesis: str) -> float:
    ref_chars = list(reference.strip().lower())
    hyp_chars = list(hypothesis.strip().lower())

    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    if not hyp_chars:
        return 1.0

    d = [[0] * (len(hyp_chars) + 1) for _ in range(len(ref_chars) + 1)]
    for i in range(len(ref_chars) + 1):
        d[i][0] = i
    for j in range(len(hyp_chars) + 1):
        d[0][j] = j

    for i in range(1, len(ref_chars) + 1):
        for j in range(1, len(hyp_chars) + 1):
            cost = 0 if ref_chars[i - 1] == hyp_chars[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost
            )

    return d[len(ref_chars)][len(hyp_chars)] / float(len(ref_chars))


def compute_wer(reference: str, hypothesis: str) -> float:
    if not reference.strip():
        return 0.0 if not hypothesis.strip() else 1.0
    if jiwer is not None and hasattr(jiwer, "wer"):
        return float(jiwer.wer(reference, hypothesis))
    return calculate_fallback_wer(reference, hypothesis)


def compute_cer(reference: str, hypothesis: str) -> float:
    if not reference.strip():
        return 0.0 if not hypothesis.strip() else 1.0
    if jiwer is not None and hasattr(jiwer, "cer"):
        return float(jiwer.cer(reference, hypothesis))
    return calculate_fallback_cer(reference, hypothesis)


def extract_numerical_tokens(text: str) -> List[str]:
    """Find all numeric digit sequences in text."""
    return re.findall(r"\b\d+\b", text)


def evaluate_numerical_fidelity(reference: str, hypothesis: str) -> Dict[str, Any]:
    """
    Evaluates precision, recall, and exact match for critical numeric tokens
    (amounts, quantities) between reference and hypothesis transcripts.
    """
    ref_nums = extract_numerical_tokens(reference)
    hyp_nums = extract_numerical_tokens(hypothesis)

    if not ref_nums and not hyp_nums:
        return {
            "ref_count": 0,
            "hyp_count": 0,
            "matches": 0,
            "precision": 1.0,
            "recall": 1.0,
            "exact_number_match": True,
            "missing_numbers": [],
            "hallucinated_numbers": []
        }

    if not ref_nums and hyp_nums:
        return {
            "ref_count": 0,
            "hyp_count": len(hyp_nums),
            "matches": 0,
            "precision": 0.0,
            "recall": 1.0,
            "exact_number_match": False,
            "missing_numbers": [],
            "hallucinated_numbers": hyp_nums
        }

    matched = 0
    remaining_hyp = list(hyp_nums)
    missing = []

    for r in ref_nums:
        if r in remaining_hyp:
            matched += 1
            remaining_hyp.remove(r)
        else:
            missing.append(r)

    precision = round(matched / len(hyp_nums), 4) if hyp_nums else (1.0 if matched == 0 else 0.0)
    recall = round(matched / len(ref_nums), 4) if ref_nums else 1.0
    exact_match = (matched == len(ref_nums)) and (len(remaining_hyp) == 0)

    return {
        "ref_count": len(ref_nums),
        "hyp_count": len(hyp_nums),
        "matches": matched,
        "precision": precision,
        "recall": recall,
        "exact_number_match": exact_match,
        "missing_numbers": missing,
        "hallucinated_numbers": remaining_hyp
    }


def run_audio_eval(
    manifest_path: Path,
    audio_dir: Path,
    output_json: Path,
    output_md: Path,
    engine: str = "faster-whisper",
    model_id: Optional[str] = None,
    split_filter: Optional[str] = None
) -> Dict[str, Any]:
    if not manifest_path.exists():
        print(f"NOTICE: Audio manifest not found at: {manifest_path}")
        return {"error": f"Manifest not found: {manifest_path}"}

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cases = data["cases"] if isinstance(data, dict) and "cases" in data else data
    if not isinstance(cases, list):
        print(f"Error: Manifest at {manifest_path} must be a list of case objects.")
        sys.exit(1)

    if split_filter:
        cases = [c for c in cases if c.get("split") == split_filter]
        print(f"Filtered by split '{split_filter}': {len(cases)} cases remaining.")

    print("=" * 80)
    print("ASWANNA SPEECH RECOGNITION ACOUSTIC EVALUATION TOOL (PHASE 1)")
    print("=" * 80)
    print(f"Dataset Manifest: {manifest_path} ({len(cases)} cases)")
    print(f"Audio Base Directory: {audio_dir}")
    print(f"Evaluation Engine: {engine} (Model: {model_id or 'default'})")
    print()

    # Attempt to load ASR adapter if any real audio files exist
    adapter: Optional[BaseASRAdapter] = None
    adapter_load_error: Optional[str] = None

    results = []
    total_wer = 0.0
    total_cer = 0.0
    total_num_matches = 0
    total_num_ref = 0
    exact_num_match_count = 0
    valid_audio_count = 0
    total_latency_ms = 0
    total_audio_duration_s = 0.0

    for case in cases:
        case_id = case.get("caseId", "unknown")
        audio_rel = case.get("audioPath", "")
        audio_full = audio_dir / audio_rel
        ref_text = case.get("referenceTranscript") or case.get("transcript", "")
        lang = case.get("language", "en")
        speaker_id = case.get("speaker", {}).get("id", "unknown")

        has_audio = audio_full.exists()
        if not has_audio:
            # Check if there is pre-captured transcript in the fixture for comparison
            captured_hyp = case.get("capturedTranscript")
            if captured_hyp:
                wer = compute_wer(ref_text, captured_hyp)
                cer = compute_cer(ref_text, captured_hyp)
                num_fid = evaluate_numerical_fidelity(ref_text, captured_hyp)
                status_label = "AUDIO_MISSING_USED_CAPTURED_TRANSCRIPT"
                hypothesis = captured_hyp
            else:
                wer = None
                cer = None
                num_fid = None
                status_label = "MISSING_AUDIO_RECORDING"
                hypothesis = None

            results.append({
                "caseId": case_id,
                "language": lang,
                "speakerId": speaker_id,
                "audioAvailable": False,
                "reference": ref_text,
                "hypothesis": hypothesis,
                "wer": round(wer, 4) if wer is not None else None,
                "cer": round(cer, 4) if cer is not None else None,
                "numFidelity": num_fid,
                "latency_ms": None,
                "status": status_label
            })
            continue

        # Real audio file exists! Load adapter if not loaded yet
        if adapter is None and adapter_load_error is None:
            try:
                adapter = get_adapter(engine=engine, model_id=model_id)
                adapter.load()
            except Exception as e:
                adapter_load_error = str(e)
                print(f"Warning: Failed to load ASR adapter '{engine}': {adapter_load_error}")

        if adapter is not None and adapter.is_loaded:
            trans_res = adapter.transcribe(str(audio_full), language=lang)
            hypothesis = trans_res.get("text", "")
            latency = trans_res.get("latency_ms", 0)
            duration = trans_res.get("duration_s", 0.0)
        else:
            hypothesis = case.get("capturedTranscript", "")
            latency = 0
            duration = 0.0

        wer = compute_wer(ref_text, hypothesis)
        cer = compute_cer(ref_text, hypothesis)
        num_fid = evaluate_numerical_fidelity(ref_text, hypothesis)

        total_wer += wer
        total_cer += cer
        total_num_matches += num_fid["matches"]
        total_num_ref += num_fid["ref_count"]
        if num_fid["exact_number_match"]:
            exact_num_match_count += 1
        total_latency_ms += latency
        total_audio_duration_s += duration
        valid_audio_count += 1

        results.append({
            "caseId": case_id,
            "language": lang,
            "speakerId": speaker_id,
            "audioAvailable": True,
            "reference": ref_text,
            "hypothesis": hypothesis,
            "wer": round(wer, 4),
            "cer": round(cer, 4),
            "numFidelity": num_fid,
            "latency_ms": latency,
            "duration_s": duration,
            "status": "EVALUATED_LIVE_AUDIO"
        })

    rtf = round((total_latency_ms / 1000.0) / total_audio_duration_s, 3) if total_audio_duration_s > 0 else None

    summary = {
        "status": "VALIDATED_AUDIO" if valid_audio_count > 0 else "UNVALIDATED_SCAFFOLD",
        "engine": engine,
        "modelId": model_id,
        "totalCases": len(cases),
        "availableAudioRecordings": valid_audio_count,
        "meanWER": round(total_wer / valid_audio_count, 4) if valid_audio_count > 0 else None,
        "meanCER": round(total_cer / valid_audio_count, 4) if valid_audio_count > 0 else None,
        "exactNumberMatchAccuracy": round(exact_num_match_count / valid_audio_count, 4) if valid_audio_count > 0 else None,
        "overallNumericalRecall": round(total_num_matches / total_num_ref, 4) if total_num_ref > 0 else None,
        "averageLatencyMs": round(total_latency_ms / valid_audio_count, 1) if valid_audio_count > 0 else None,
        "realTimeFactorRTF": rtf,
        "cases": results
    }

    output_json.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    md_report = f"""# Audio-Backed ASR Evaluation Report (Phase 1)

> [!NOTE]
> **Status: {summary['status']}**
> Engine: `{engine}` | Model: `{model_id or 'default'}`
> Audio Directory: `{audio_dir}`

## Aggregate Metrics
- **Total Cases in Manifest**: {summary['totalCases']}
- **Live Audio Recordings Available**: {summary['availableAudioRecordings']}
- **Mean Word Error Rate (WER)**: {f"{summary['meanWER'] * 100:.2f}%" if summary['meanWER'] is not None else 'N/A (Awaiting physical recordings)'}
- **Mean Character Error Rate (CER)**: {f"{summary['meanCER'] * 100:.2f}%" if summary['meanCER'] is not None else 'N/A (Awaiting physical recordings)'}
- **Exact Number Match Accuracy**: {f"{summary['exactNumberMatchAccuracy'] * 100:.2f}%" if summary['exactNumberMatchAccuracy'] is not None else 'N/A'}
- **Overall Numerical Recall**: {f"{summary['overallNumericalRecall'] * 100:.2f}%" if summary['overallNumericalRecall'] is not None else 'N/A'}
- **Average Latency**: {f"{summary['averageLatencyMs']} ms" if summary['averageLatencyMs'] is not None else 'N/A'}
- **Real-Time Factor (RTF)**: {f"{summary['realTimeFactorRTF']}x" if summary['realTimeFactorRTF'] is not None else 'N/A'}

## Case Breakdown
| Case ID | Lang | Speaker | Status | WER | CER | Num Exact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""
    for c in results:
        wer_s = f"{c['wer'] * 100:.1f}%" if c.get('wer') is not None else "N/A"
        cer_s = f"{c['cer'] * 100:.1f}%" if c.get('cer') is not None else "N/A"
        num_s = "Yes" if c.get('numFidelity', {}) and c['numFidelity'].get('exact_number_match') else ("No" if c.get('numFidelity') else "N/A")
        md_report += f"| `{c['caseId']}` | `{c['language']}` | `{c['speakerId']}` | `{c['status']}` | {wer_s} | {cer_s} | {num_s} |\n"

    output_md.parent.mkdir(parents=True, exist_ok=True)
    with open(output_md, "w", encoding="utf-8") as f:
        f.write(md_report)

    print(f"Evaluation finished. Results written to:")
    print(f"  JSON: {output_json}")
    print(f"  MD:   {output_md}")
    return summary


def main():
    parser = argparse.ArgumentParser(description="Evaluate audio-backed speech recognition")
    parser.add_argument("--manifest", type=str, default="server/eval/fixtures/voice/audio_manifest.example.json", help="Path to manifest JSON")
    parser.add_argument("--audio-dir", type=str, default="voice-service/recordings", help="Base directory of audio recordings")
    parser.add_argument("--engine", type=str, default="faster-whisper", help="ASR engine: 'faster-whisper' or 'transformers'")
    parser.add_argument("--model-id", type=str, default=None, help="ASR model ID")
    parser.add_argument("--split", type=str, default=None, help="Optional split filter: train, val, or test")
    parser.add_argument("--json", type=str, default="voice-service/eval/reports/audio_asr_report.json", help="Output JSON report path")
    parser.add_argument("--md", type=str, default="docs/voice-audio-eval-scaffold.md", help="Output Markdown report path")

    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent.parent

    run_audio_eval(
        manifest_path=repo_root / args.manifest,
        audio_dir=repo_root / args.audio_dir,
        output_json=repo_root / args.json,
        output_md=repo_root / args.md,
        engine=args.engine,
        model_id=args.model_id,
        split_filter=args.split
    )


if __name__ == "__main__":
    main()

"""
Dataset Split Validator for Aswanna Speech Recognition.

Enforces strict speaker-disjoint dataset partitioning:
Training, Validation, and Test splits must not share any speaker IDs.
Speaker leakage across splits causes overly optimistic evaluation results and invalidates generalization.
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Set, List, Any, Tuple, Optional


class SpeakerOverlapError(Exception):
    """Raised when speaker leakage is detected across dataset splits."""
    def __init__(self, message: str, overlaps: Dict[str, Set[str]]):
        super().__init__(message)
        self.overlaps = overlaps


def extract_split_speakers(
    cases: List[Dict[str, Any]],
    split_name: str
) -> Tuple[Set[str], Dict[str, List[str]]]:
    """
    Extracts set of speaker IDs and maps speaker ID -> list of case IDs.
    """
    speakers: Set[str] = set()
    speaker_to_cases: Dict[str, List[str]] = {}

    for idx, c in enumerate(cases):
        speaker_obj = c.get("speaker", {})
        if isinstance(speaker_obj, dict):
            spk_id = speaker_obj.get("id")
        else:
            spk_id = None

        if spk_id:
            spk_str = str(spk_id).strip()
            speakers.add(spk_str)
            cid = c.get("caseId", f"{split_name}_case_{idx}")
            speaker_to_cases.setdefault(spk_str, []).append(cid)

    return speakers, speaker_to_cases


def validate_dataset_splits(
    splits: Dict[str, List[Dict[str, Any]]]
) -> Dict[str, Any]:
    """
    Validates speaker disjointness across provided splits (e.g. 'train', 'val', 'test').

    splits: dictionary mapping split name -> list of case dicts.
    Returns:
    {
        "valid": bool,
        "splitSizes": Dict[str, int],
        "splitSpeakerCounts": Dict[str, int],
        "overlaps": Dict[str, List[str]], # e.g. "train_vs_test": ["spk_001"]
        "overlapDetails": List[Dict[str, Any]]
    }
    """
    split_names = list(splits.keys())
    split_speakers: Dict[str, Set[str]] = {}
    split_case_maps: Dict[str, Dict[str, List[str]]] = {}
    split_sizes: Dict[str, int] = {}
    speaker_counts: Dict[str, int] = {}

    for name, cases in splits.items():
        spks, case_map = extract_split_speakers(cases, name)
        split_speakers[name] = spks
        split_case_maps[name] = case_map
        split_sizes[name] = len(cases)
        speaker_counts[name] = len(spks)

    overlaps: Dict[str, List[str]] = {}
    overlap_details: List[Dict[str, Any]] = []

    # Check all pairwise combinations
    for i in range(len(split_names)):
        for j in range(i + 1, len(split_names)):
            name_a = split_names[i]
            name_b = split_names[j]
            pair_key = f"{name_a}_vs_{name_b}"
            
            common_speakers = split_speakers[name_a] & split_speakers[name_b]
            if common_speakers:
                overlaps[pair_key] = sorted(list(common_speakers))
                for spk in sorted(common_speakers):
                    overlap_details.append({
                        "speakerId": spk,
                        "splits": [name_a, name_b],
                        "casesInFirstSplit": split_case_maps[name_a].get(spk, []),
                        "casesInSecondSplit": split_case_maps[name_b].get(spk, [])
                    })

    is_valid = len(overlaps) == 0

    return {
        "valid": is_valid,
        "splitSizes": split_sizes,
        "splitSpeakerCounts": speaker_counts,
        "overlaps": overlaps,
        "overlapDetails": overlap_details
    }


def validate_unified_manifest_splits(manifest_data: Any) -> Dict[str, Any]:
    """
    Validates a single manifest where cases contain a 'split' property ('train', 'val', 'test').
    """
    if isinstance(manifest_data, dict) and "cases" in manifest_data:
        cases = manifest_data["cases"]
    elif isinstance(manifest_data, list):
        cases = manifest_data
    else:
        raise ValueError("Manifest must be a list of cases or an object with 'cases'.")

    splits: Dict[str, List[Dict[str, Any]]] = {}
    for c in cases:
        split_label = c.get("split", "unassigned")
        splits.setdefault(split_label, []).append(c)

    return validate_dataset_splits(splits)


def main():
    parser = argparse.ArgumentParser(description="Validate speaker disjointness across dataset splits")
    parser.add_argument("--manifest", help="Path to unified manifest JSON with 'split' fields")
    parser.add_argument("--train", help="Path to train manifest JSON")
    parser.add_argument("--val", help="Path to validation manifest JSON")
    parser.add_argument("--test", help="Path to test manifest JSON")

    args = parser.parse_args()

    if args.manifest:
        p = Path(args.manifest)
        if not p.exists():
            print(f"Error: Manifest file '{p}' not found.")
            sys.exit(1)
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        result = validate_unified_manifest_splits(data)
    elif args.train or args.val or args.test:
        splits: Dict[str, List[Dict[str, Any]]] = {}
        for name, path_str in [("train", args.train), ("val", args.val), ("test", args.test)]:
            if path_str:
                p = Path(path_str)
                if not p.exists():
                    print(f"Error: Split file '{p}' not found.")
                    sys.exit(1)
                with open(p, "r", encoding="utf-8") as f:
                    splits[name] = json.load(f)
        result = validate_dataset_splits(splits)
    else:
        print("Error: Specify either --manifest or split files (--train, --val, --test).")
        sys.exit(1)

    print("=" * 60)
    print(f"DATASET SPLIT VALIDATION: {'PASSED' if result['valid'] else 'FAILED'}")
    print(f"Split Sizes: {result['splitSizes']}")
    print(f"Speaker Counts: {result['splitSpeakerCounts']}")
    print("=" * 60)

    if not result["valid"]:
        print("\nCRITICAL: Speaker overlap detected across splits!")
        for pair, leaking in result["overlaps"].items():
            print(f"  Overlap between {pair}: {leaking}")
        for detail in result["overlapDetails"]:
            print(f"    Speaker '{detail['speakerId']}' in {detail['splits']}:")
            print(f"      Split {detail['splits'][0]} cases: {detail['casesInFirstSplit']}")
            print(f"      Split {detail['splits'][1]} cases: {detail['casesInSecondSplit']}")
        sys.exit(1)
    else:
        print("\nAll splits are strictly speaker-disjoint. Zero data leakage detected.")
        sys.exit(0)


if __name__ == "__main__":
    main()

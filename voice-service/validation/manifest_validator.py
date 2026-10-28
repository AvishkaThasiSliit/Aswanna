"""
Dataset Manifest Validator for Aswanna Speech Recognition.

Validates that an audio dataset manifest satisfies all requirements:
1. Audio paths are well-formed (and optionally point to existing files)
2. Reference transcripts are non-empty strings
3. Language labels are restricted to supported domains ('si' or 'en')
4. Speaker IDs are present, non-empty, and adhere to pseudonymous conventions
5. Review status is explicitly marked ('reviewed' or 'draft')
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple


class ManifestValidationError(Exception):
    """Raised when manifest validation fails."""
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.errors = errors


SUPPORTED_LANGUAGES = {"si", "en"}
VALID_REVIEW_STATUSES = {"reviewed", "draft"}
PII_EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")
PII_PHONE_REGEX = re.compile(r"(\+?94|0)\d{9}")


def validate_speaker_pseudonymity(speaker_id: str) -> Optional[str]:
    """
    Validates that a speaker ID is pseudonymous and does not contain PII
    (e.g., email addresses, phone numbers).
    """
    if not speaker_id or not isinstance(speaker_id, str):
        return "Speaker ID must be a non-empty string"
    clean_id = speaker_id.strip()
    if not clean_id:
        return "Speaker ID cannot be blank"
    if PII_EMAIL_REGEX.search(clean_id):
        return f"Speaker ID '{clean_id}' appears to contain an email address (PII violation)"
    if PII_PHONE_REGEX.search(clean_id):
        return f"Speaker ID '{clean_id}' appears to contain a phone number (PII violation)"
    return None


def validate_case(
    case: Dict[str, Any],
    index: int,
    audio_base_dir: Optional[Path] = None,
    check_file_exists: bool = False
) -> Tuple[List[str], List[str]]:
    """
    Validates a single manifest case.
    Returns (errors, warnings).
    """
    errors: List[str] = []
    warnings: List[str] = []

    case_id = case.get("caseId")
    if not case_id or not isinstance(case_id, str) or not case_id.strip():
        errors.append(f"Case #{index}: Missing or empty 'caseId'")
        prefix = f"Case #{index}"
    else:
        prefix = f"Case '{case_id}'"

    # 1. Audio path validation
    audio_path = case.get("audioPath")
    if not audio_path or not isinstance(audio_path, str) or not audio_path.strip():
        errors.append(f"{prefix}: Missing or empty 'audioPath'")
    elif check_file_exists and audio_base_dir:
        resolved_file = audio_base_dir / audio_path
        if not resolved_file.exists():
            errors.append(f"{prefix}: Audio file does not exist at '{resolved_file}'")

    # 2. Transcript validation
    transcript = case.get("referenceTranscript") or case.get("transcript")
    if not transcript or not isinstance(transcript, str) or not transcript.strip():
        errors.append(f"{prefix}: Missing or empty 'referenceTranscript'")

    # 3. Language label validation
    lang = case.get("language")
    if not lang or not isinstance(lang, str):
        errors.append(f"{prefix}: Missing 'language' label")
    elif lang.strip().lower() not in SUPPORTED_LANGUAGES:
        errors.append(f"{prefix}: Invalid language '{lang}'. Must be one of: {sorted(SUPPORTED_LANGUAGES)}")

    # 4. Pseudonymous speaker ID validation
    speaker_obj = case.get("speaker")
    if not isinstance(speaker_obj, dict):
        errors.append(f"{prefix}: Missing 'speaker' object or 'speaker' is not a dictionary")
    else:
        spk_id = speaker_obj.get("id")
        spk_err = validate_speaker_pseudonymity(spk_id)
        if spk_err:
            errors.append(f"{prefix}: {spk_err}")

    # 5. Transcript review status validation
    review_status = case.get("reviewStatus")
    if not review_status or not isinstance(review_status, str):
        errors.append(f"{prefix}: Missing 'reviewStatus'. Must be 'reviewed' or 'draft'")
    elif review_status.strip().lower() not in VALID_REVIEW_STATUSES:
        errors.append(f"{prefix}: Invalid reviewStatus '{review_status}'. Must be one of: {sorted(VALID_REVIEW_STATUSES)}")
    elif review_status.strip().lower() == "draft":
        warnings.append(f"{prefix}: Transcript is marked as 'draft' (pending native farmer review)")

    return errors, warnings


def validate_manifest(
    manifest_data: Any,
    audio_base_dir: Optional[Path] = None,
    check_file_exists: bool = False
) -> Dict[str, Any]:
    """
    Validates a complete manifest list or dictionary against Aswanna requirements.
    """
    if isinstance(manifest_data, dict) and "cases" in manifest_data:
        cases = manifest_data["cases"]
    elif isinstance(manifest_data, list):
        cases = manifest_data
    else:
        raise ManifestValidationError(
            "Manifest root must be a list of cases or an object containing a 'cases' array.",
            ["Invalid manifest root type"]
        )

    all_errors: List[str] = []
    all_warnings: List[str] = []
    seen_case_ids = set()

    for idx, case in enumerate(cases):
        if not isinstance(case, dict):
            all_errors.append(f"Case #{idx} is not a valid JSON object")
            continue

        cid = case.get("caseId")
        if cid:
            if cid in seen_case_ids:
                all_errors.append(f"Duplicate caseId found: '{cid}' at case #{idx}")
            seen_case_ids.add(cid)

        case_errors, case_warnings = validate_case(
            case,
            index=idx,
            audio_base_dir=audio_base_dir,
            check_file_exists=check_file_exists
        )
        all_errors.extend(case_errors)
        all_warnings.extend(case_warnings)

    is_valid = len(all_errors) == 0
    return {
        "valid": is_valid,
        "totalCases": len(cases),
        "validCases": len(cases) - len({e.split(':')[0] for e in all_errors}),
        "errorCount": len(all_errors),
        "warningCount": len(all_warnings),
        "errors": all_errors,
        "warnings": all_warnings
    }


def main():
    parser = argparse.ArgumentParser(description="Validate Aswanna ASR Dataset Manifest")
    parser.add_argument("--manifest", required=True, help="Path to manifest JSON file")
    parser.add_argument("--audio-dir", default=None, help="Base directory for relative audio paths")
    parser.add_argument("--check-audio-exists", action="store_true", help="Verify audio files exist on disk")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"Error: Manifest file '{manifest_path}' does not exist.")
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    audio_dir = Path(args.audio_dir) if args.audio_dir else None
    result = validate_manifest(
        data,
        audio_base_dir=audio_dir,
        check_file_exists=args.check_audio_exists
    )

    print("=" * 60)
    print(f"MANIFEST VALIDATION: {'PASSED' if result['valid'] else 'FAILED'}")
    print(f"Total Cases: {result['totalCases']}")
    print(f"Errors: {result['errorCount']}")
    print(f"Warnings: {result['warningCount']}")
    print("=" * 60)

    if result["errors"]:
        print("\nErrors:")
        for err in result["errors"]:
            print(f"  [ERROR] {err}")

    if result["warnings"]:
        print("\nWarnings:")
        for warn in result["warnings"]:
            print(f"  [WARN]  {warn}")

    sys.exit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()

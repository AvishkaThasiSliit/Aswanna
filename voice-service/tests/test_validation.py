import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from validation.manifest_validator import validate_manifest, validate_case, validate_speaker_pseudonymity
from validation.split_validator import validate_dataset_splits, validate_unified_manifest_splits


def test_manifest_validation_passes_valid_cases():
    valid_data = [
        {
            "caseId": "VP-AUD-001",
            "audioPath": "recordings/en/vp_001.wav",
            "language": "en",
            "referenceTranscript": "Bought two bags of urea fertilizer for 14000 rupees",
            "speaker": {"id": "farmer_01", "accent": "Sinhala-accented English"},
            "reviewStatus": "reviewed"
        },
        {
            "caseId": "VP-AUD-002",
            "audioPath": "recordings/si/vp_002.wav",
            "language": "si",
            "referenceTranscript": "පොහොර මිටි දෙකක් රුපියල් දාහතරදාහයි",
            "speaker": {"id": "spk_102", "dialect": "Southern"},
            "reviewStatus": "draft"
        }
    ]

    result = validate_manifest(valid_data, check_file_exists=False)
    assert result["valid"] is True
    assert result["errorCount"] == 0
    assert result["warningCount"] == 1  # 1 draft warning
    assert result["totalCases"] == 2


def test_manifest_validation_rejects_missing_audio_or_transcript():
    invalid_data = [
        {
            "caseId": "VP-BAD-01",
            "audioPath": "",
            "language": "en",
            "referenceTranscript": "",
            "speaker": {"id": "farmer_01"},
            "reviewStatus": "reviewed"
        }
    ]

    result = validate_manifest(invalid_data, check_file_exists=False)
    assert result["valid"] is False
    assert any("audioPath" in err for err in result["errors"])
    assert any("referenceTranscript" in err for err in result["errors"])


def test_manifest_validation_rejects_unsupported_language():
    invalid_data = [
        {
            "caseId": "VP-BAD-LANG",
            "audioPath": "audio.wav",
            "language": "es",  # Spanish not supported
            "referenceTranscript": "Hola amigo",
            "speaker": {"id": "spk_01"},
            "reviewStatus": "reviewed"
        }
    ]

    result = validate_manifest(invalid_data, check_file_exists=False)
    assert result["valid"] is False
    assert any("Invalid language 'es'" in err for err in result["errors"])


def test_manifest_validation_rejects_pii_in_speaker_id():
    # Email PII
    assert validate_speaker_pseudonymity("kamal.perera@gmail.com") is not None
    assert "email" in validate_speaker_pseudonymity("kamal.perera@gmail.com")

    # Phone number PII
    assert validate_speaker_pseudonymity("+94771234567") is not None
    assert "phone" in validate_speaker_pseudonymity("0771234567")

    # Valid pseudonym
    assert validate_speaker_pseudonymity("spk_matale_01") is None
    assert validate_speaker_pseudonymity("farmer_04") is None


def test_manifest_validation_rejects_invalid_review_status():
    invalid_data = [
        {
            "caseId": "VP-BAD-STATUS",
            "audioPath": "audio.wav",
            "language": "si",
            "referenceTranscript": "පොහොර",
            "speaker": {"id": "spk_01"},
            "reviewStatus": "pending_unconfirmed"  # Not 'reviewed' or 'draft'
        }
    ]

    result = validate_manifest(invalid_data, check_file_exists=False)
    assert result["valid"] is False
    assert any("Invalid reviewStatus 'pending_unconfirmed'" in err for err in result["errors"])


def test_split_validator_passes_speaker_disjoint_splits():
    splits = {
        "train": [
            {"caseId": "c1", "speaker": {"id": "spk_01"}},
            {"caseId": "c2", "speaker": {"id": "spk_02"}}
        ],
        "val": [
            {"caseId": "c3", "speaker": {"id": "spk_03"}}
        ],
        "test": [
            {"caseId": "c4", "speaker": {"id": "spk_04"}},
            {"caseId": "c5", "speaker": {"id": "spk_05"}}
        ]
    }

    result = validate_dataset_splits(splits)
    assert result["valid"] is True
    assert len(result["overlaps"]) == 0
    assert result["splitSpeakerCounts"] == {"train": 2, "val": 1, "test": 2}


def test_split_validator_catches_speaker_leakage_between_train_and_test():
    splits = {
        "train": [
            {"caseId": "c1", "speaker": {"id": "spk_01"}},
            {"caseId": "c2", "speaker": {"id": "spk_02"}}
        ],
        "val": [
            {"caseId": "c3", "speaker": {"id": "spk_03"}}
        ],
        "test": [
            {"caseId": "c4", "speaker": {"id": "spk_02"}},  # Leaking spk_02!
            {"caseId": "c5", "speaker": {"id": "spk_05"}}
        ]
    }

    result = validate_dataset_splits(splits)
    assert result["valid"] is False
    assert "train_vs_test" in result["overlaps"]
    assert "spk_02" in result["overlaps"]["train_vs_test"]
    assert len(result["overlapDetails"]) == 1
    assert result["overlapDetails"][0]["speakerId"] == "spk_02"
    assert "c2" in result["overlapDetails"][0]["casesInFirstSplit"]
    assert "c4" in result["overlapDetails"][0]["casesInSecondSplit"]


def test_split_validator_catches_leakage_in_unified_manifest():
    manifest = [
        {"caseId": "c1", "split": "train", "speaker": {"id": "spk_A"}},
        {"caseId": "c2", "split": "val", "speaker": {"id": "spk_A"}},  # Leaking spk_A!
        {"caseId": "c3", "split": "test", "speaker": {"id": "spk_B"}}
    ]

    result = validate_unified_manifest_splits(manifest)
    assert result["valid"] is False
    assert "train_vs_val" in result["overlaps"]
    assert "spk_A" in result["overlaps"]["train_vs_val"]

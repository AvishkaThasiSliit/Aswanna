"""
Local Audio Transcription Test (Requirement 4)

Strict requirement:
- Test transcription against a real audio file supplied by the developer.
- Do NOT fabricate synthetic audio or report a fake success.
- If no real recording file has been supplied, this test cleanly detects the absence
  and marks the test as BLOCKED/SKIPPED with an explicit message directing the developer
  to place real recordings in `voice-service/recordings/`.
"""

import os
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("VOICE_INTERNAL_TOKEN", "test-internal-token-for-pytest")

from adapters import get_adapter
from app import app, INTERNAL_TOKEN
from fastapi.testclient import TestClient

client = TestClient(app)

RECORDING_DIRS = [
    Path(__file__).resolve().parent.parent / "recordings",
    Path(__file__).resolve().parent.parent.parent / "recordings",
    Path(__file__).resolve().parent.parent.parent / "test_audio"
]

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".webm", ".flac", ".m4a"}


def find_developer_supplied_audio() -> list[Path]:
    """Finds any physical audio recordings supplied by developer."""
    found = []
    for d in RECORDING_DIRS:
        if d.exists() and d.is_dir():
            for f in d.rglob("*"):
                if f.is_file() and f.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS:
                    found.append(f)
    return found


def test_real_developer_audio_transcription():
    """
    Executes actual transcription against a real developer-supplied audio file.
    Does not fake success or fabricate audio.
    """
    audio_files = find_developer_supplied_audio()

    if not audio_files:
        pytest.skip(
            "BLOCKED: No physical speech audio recordings supplied by developer. "
            "To execute this test, provide a real field recording in 'voice-service/recordings/'. "
            "Fabricated or synthetic audio is strictly forbidden."
        )

    # Developer has provided at least one real recording
    test_file = audio_files[0]
    assert test_file.exists(), f"Audio file not found: {test_file}"
    assert test_file.stat().st_size > 0, f"Audio file is empty: {test_file}"

    # Test via loaded service endpoint
    with open(test_file, "rb") as f:
        audio_bytes = f.read()

    response = client.post(
        "/transcribe",
        files={"file": (test_file.name, audio_bytes, "audio/wav")},
        headers={"X-Internal-Token": INTERNAL_TOKEN}
    )

    assert response.status_code == 200, f"Transcription failed: {response.text}"
    data = response.json()
    assert "text" in data
    assert len(data["text"]) > 0, "Transcription result text is empty"
    assert "segments" in data
    assert "duration_s" in data
    assert data["duration_s"] > 0
    assert "latency_ms" in data

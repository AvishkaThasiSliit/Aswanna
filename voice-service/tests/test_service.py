import os
import sys
import io
import math
import struct
import wave
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure voice-service directory is on pythonpath
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("VOICE_INTERNAL_TOKEN", "test-internal-token-for-pytest")

from app import app, INTERNAL_TOKEN, WHISPER_MODEL

client = TestClient(app)

def create_dummy_wav(duration_s=1.0, sample_rate=16000, frequency=440.0) -> bytes:
    """Generate a minimal valid 16kHz mono 16-bit PCM WAV in memory for plumbing tests."""
    buffer = io.BytesIO()
    num_samples = int(duration_s * sample_rate)
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            # Generate low amplitude sine wave
            value = int(1000.0 * math.sin(2.0 * math.pi * frequency * (i / sample_rate)))
            frames.extend(struct.pack('<h', value))
        wav_file.writeframes(frames)
    return buffer.getvalue()


def test_health_check_returns_model_and_status():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model"] == WHISPER_MODEL


def test_transcribe_rejects_missing_or_invalid_internal_token():
    dummy_wav = create_dummy_wav(duration_s=0.5)

    # Missing token
    res1 = client.post("/transcribe", files={"file": ("test.wav", dummy_wav, "audio/wav")})
    assert res1.status_code == 401
    assert "token" in res1.json()["detail"].lower()

    # Invalid token
    res2 = client.post(
        "/transcribe",
        files={"file": ("test.wav", dummy_wav, "audio/wav")},
        headers={"X-Internal-Token": "wrong-token"}
    )
    assert res2.status_code == 401


def test_transcribe_rejects_empty_audio():
    response = client.post(
        "/transcribe",
        files={"file": ("empty.wav", b"", "audio/wav")},
        headers={"X-Internal-Token": INTERNAL_TOKEN}
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_transcribe_rejects_invalid_audio_content():
    response = client.post(
        "/transcribe",
        files={"file": ("corrupt.wav", b"not-a-real-audio-header-garbage", "audio/wav")},
        headers={"X-Internal-Token": INTERNAL_TOKEN}
    )
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


def test_transcribe_rejects_oversized_audio():
    oversized_data = b"0" * (10 * 1024 * 1024 + 100)
    response = client.post(
        "/transcribe",
        files={"file": ("huge.wav", oversized_data, "audio/wav")},
        headers={"X-Internal-Token": INTERNAL_TOKEN}
    )
    assert response.status_code == 400
    assert "10 mb" in response.json()["detail"].lower()


def test_transcribe_plumbing_and_temp_file_cleanup():
    """
    NOTE (TASK W1): This plumbing test verifies endpoint contract, audio parsing,
    and temporary file deletion. It does NOT evaluate speech transcription accuracy.
    """
    valid_wav = create_dummy_wav(duration_s=1.0)

    # Snapshot existing temp directory
    import tempfile
    temp_dir = tempfile.gettempdir()
    before_files = set(os.listdir(temp_dir))

    response = client.post(
        "/transcribe?use_vocab_prompt=true",
        files={"file": ("sample.wav", valid_wav, "audio/wav")},
        headers={"X-Internal-Token": INTERNAL_TOKEN}
    )

    assert response.status_code == 200
    data = response.json()
    assert "text" in data
    assert "segments" in data
    assert isinstance(data["segments"], list)
    assert "duration_s" in data
    assert data["duration_s"] > 0
    assert data["model"] == WHISPER_MODEL
    assert "latency_ms" in data
    assert data["used_initial_prompt"] is True

    # Verify temp file was cleaned up and not leaked
    after_files = set(os.listdir(temp_dir))
    created_whisper_temps = [f for f in (after_files - before_files) if f.startswith("voice_whisper_")]
    assert len(created_whisper_temps) == 0, f"Leaked temp files: {created_whisper_temps}"

import os
import sys
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from adapters import get_adapter, BaseASRAdapter
from adapters.faster_whisper_adapter import FasterWhisperAdapter
from adapters.hf_sinhala_adapter import HFSinhalaWhisperAdapter


def test_factory_resolves_faster_whisper():
    adapter = get_adapter(engine="faster-whisper", model_id="base.en")
    assert isinstance(adapter, FasterWhisperAdapter)
    assert adapter.get_engine_name() == "faster-whisper"
    assert adapter.model_id == "base.en"


def test_factory_resolves_hf_sinhala_whisper():
    adapter = get_adapter(engine="transformers", model_id="SinhaSpeech/whisper-small-sinhala-run12-best")
    assert isinstance(adapter, HFSinhalaWhisperAdapter)
    assert adapter.get_engine_name() == "transformers"
    assert adapter.model_id == "SinhaSpeech/whisper-small-sinhala-run12-best"


def test_factory_rejects_unknown_engine():
    with pytest.raises(ValueError, match="Unsupported ASR engine"):
        get_adapter(engine="non_existent_engine")


def test_hf_adapter_metadata():
    adapter = HFSinhalaWhisperAdapter(model_id="SinhaSpeech/whisper-small-sinhala-run12-best")
    meta = adapter.get_metadata()
    assert meta["engine"] == "transformers"
    assert meta["license"] == "Apache-2.0 / MIT"
    assert meta["primary_language"] == "si"
    assert meta["fine_tuned_for"] == "Sinhala Speech Recognition (SinhaSpeech)"


def test_hf_adapter_startup_failure_reports_informative_error():
    adapter = HFSinhalaWhisperAdapter(model_id="SinhaSpeech/whisper-small-sinhala-run12-best")
    # Simulate environment where torch or weights are not installed
    with pytest.raises(RuntimeError) as exc_info:
        adapter.load()
    assert "PyTorch" in str(exc_info.value) or "Hugging Face" in str(exc_info.value) or "Failed to initialize" in str(exc_info.value)
    health = adapter.get_health()
    assert health["status"] == "error"
    assert health["loaded"] is False
    assert health["error"] is not None


def test_hf_adapter_transcription_with_mocked_pipeline():
    adapter = HFSinhalaWhisperAdapter(model_id="SinhaSpeech/whisper-small-sinhala-run12-best")
    
    # Mock loaded pipeline
    mock_pipeline = MagicMock()
    mock_pipeline.return_value = {
        "text": "පොහොර මිටි දෙකක් රුපියල් දාහතරදාහයි",
        "chunks": [
            {
                "timestamp": (0.0, 3.2),
                "text": "පොහොර මිටි දෙකක් රුපියල් දාහතරදාහයි"
            }
        ]
    }
    adapter._pipeline = mock_pipeline
    adapter.is_loaded = True

    result = adapter.transcribe("fake_audio.wav", language="si")
    assert result["text"] == "පොහොර මිටි දෙකක් රුපියල් දාහතරදාහයි"
    assert len(result["segments"]) == 1
    assert result["segments"][0]["start"] == 0.0
    assert result["segments"][0]["end"] == 3.2
    assert result["model"] == "SinhaSpeech/whisper-small-sinhala-run12-best"
    assert result["latency_ms"] >= 0

"""
ASR Adapter Factory for Aswanna Voice Service.
Resolves and creates configured ASR adapters.
"""

import os
from typing import Optional
from .base import BaseASRAdapter
from .faster_whisper_adapter import FasterWhisperAdapter
from .hf_sinhala_adapter import HFSinhalaWhisperAdapter


def get_adapter(
    engine: Optional[str] = None,
    model_id: Optional[str] = None,
    device: Optional[str] = None,
    **kwargs
) -> BaseASRAdapter:
    """
    Factory function to instantiate an ASR adapter.

    Precedence:
    1. Explicit function arguments
    2. Environment variables (VOICE_ASR_ENGINE, VOICE_MODEL_ID, VOICE_DEVICE)
    3. Defaults: engine='faster-whisper', model_id='base.en', device='cpu'
    """
    resolved_engine = (engine or os.getenv("VOICE_ASR_ENGINE", "faster-whisper")).strip().lower()
    resolved_device = (device or os.getenv("VOICE_DEVICE", "cpu")).strip().lower()

    if resolved_engine in ["hf", "transformers", "sinhaspeech"]:
        resolved_model = model_id or os.getenv("VOICE_MODEL_ID", HFSinhalaWhisperAdapter.DEFAULT_MODEL_ID)
        return HFSinhalaWhisperAdapter(
            model_id=resolved_model,
            device=resolved_device,
            **kwargs
        )

    if resolved_engine in ["faster-whisper", "faster_whisper", "whisper"]:
        resolved_model = model_id or os.getenv("WHISPER_MODEL", os.getenv("VOICE_MODEL_ID", "base.en"))
        return FasterWhisperAdapter(
            model_id=resolved_model,
            device=resolved_device,
            **kwargs
        )

    raise ValueError(
        f"Unsupported ASR engine: '{resolved_engine}'. "
        f"Supported engines: 'faster-whisper', 'transformers'."
    )

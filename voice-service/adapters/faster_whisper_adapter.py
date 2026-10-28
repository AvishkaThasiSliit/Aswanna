"""
Faster-Whisper ASR Adapter for Aswanna.
Uses CTranslate2-backed Faster-Whisper for high-efficiency CPU/GPU inference.
"""

import time
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import av
    _orig_av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _patched_av_open
except Exception:
    pass

from faster_whisper import WhisperModel
from .base import BaseASRAdapter


class FasterWhisperAdapter(BaseASRAdapter):
    """Adapter wrapping CTranslate2-based faster-whisper."""

    def __init__(
        self,
        model_id: str = "base.en",
        device: str = "cpu",
        compute_type: str = "int8",
        download_root: Optional[str] = None,
        **kwargs
    ):
        super().__init__(model_id=model_id, device=device, **kwargs)
        self.compute_type = compute_type
        self.download_root = download_root
        self._model: Optional[WhisperModel] = None

    def get_engine_name(self) -> str:
        return "faster-whisper"

    def load(self) -> None:
        """Load Faster-Whisper model into memory."""
        try:
            self._model = WhisperModel(
                self.model_id,
                device=self.device,
                compute_type=self.compute_type,
                download_root=self.download_root
            )
            self.is_loaded = True
            self.load_error = None
        except Exception as e:
            self.is_loaded = False
            self.load_error = f"Failed to load FasterWhisper model '{self.model_id}': {str(e)}"
            raise RuntimeError(self.load_error) from e

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = "en",
        initial_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        if not self.is_loaded or self._model is None:
            raise RuntimeError(f"Model is not loaded. Load error: {self.load_error}")

        start_time = time.perf_counter()

        # Execute transcription
        segments_gen, info = self._model.transcribe(
            audio_path,
            language=language or "en",
            initial_prompt=initial_prompt
        )

        segments = []
        text_parts = []
        for s in segments_gen:
            clean_text = s.text.strip()
            if clean_text:
                text_parts.append(clean_text)
            segments.append({
                "text": clean_text,
                "start": round(s.start, 2),
                "end": round(s.end, 2),
                "avg_logprob": round(s.avg_logprob, 4),
                "no_speech_prob": round(s.no_speech_prob, 4)
            })

        latency_ms = int((time.perf_counter() - start_time) * 1000)
        full_text = " ".join(text_parts).strip()
        duration_s = round(info.duration, 2) if hasattr(info, "duration") and info.duration else 0.0

        return {
            "text": full_text,
            "segments": segments,
            "duration_s": duration_s,
            "model": self.model_id,
            "latency_ms": latency_ms,
            "used_initial_prompt": bool(initial_prompt is not None)
        }

"""
Hugging Face Transformers ASR Adapter for SinhaSpeech Sinhala Whisper.
Model: SinhaSpeech/whisper-small-sinhala-run12-best
License: Apache-2.0 / MIT
Domain: Sinhala Automatic Speech Recognition
"""

import time
import os
from typing import Optional, Dict, Any
from .base import BaseASRAdapter


class HFSinhalaWhisperAdapter(BaseASRAdapter):
    """
    Adapter for SinhaSpeech/whisper-small-sinhala-run12-best using Hugging Face Transformers.
    """

    DEFAULT_MODEL_ID = "SinhaSpeech/whisper-small-sinhala-run12-best"

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL_ID,
        device: str = "cpu",
        cache_dir: Optional[str] = None,
        **kwargs
    ):
        super().__init__(model_id=model_id, device=device, **kwargs)
        self.cache_dir = cache_dir
        self._pipeline = None

    def get_engine_name(self) -> str:
        return "transformers"

    def load(self) -> None:
        """
        Loads the Hugging Face ASR pipeline.
        Separated from request handling and executed once at server startup.
        """
        try:
            try:
                import torch
            except ImportError as e:
                raise RuntimeError(
                    "PyTorch ('torch') is not installed in the Python environment. "
                    "HFSinhalaWhisperAdapter requires PyTorch. Install with: "
                    "pip install torch --extra-index-url https://download.pytorch.org/whl/cpu"
                ) from e

            try:
                from transformers import pipeline
            except ImportError as e:
                raise RuntimeError(
                    "Hugging Face 'transformers' is not installed in the Python environment. "
                    "Install with: pip install transformers"
                ) from e

            # Select device identifier for transformers pipeline
            # -1 for CPU, 0+ for CUDA device index
            device_id = -1
            if self.device == "cuda":
                if torch.cuda.is_available():
                    device_id = 0
                else:
                    raise RuntimeError("CUDA was requested for HFSinhalaWhisperAdapter but torch.cuda.is_available() is False.")

            # Load ASR pipeline
            self._pipeline = pipeline(
                task="automatic-speech-recognition",
                model=self.model_id,
                device=device_id,
                model_kwargs={"cache_dir": self.cache_dir} if self.cache_dir else {}
            )
            self.is_loaded = True
            self.load_error = None

        except Exception as e:
            self.is_loaded = False
            self.load_error = f"Failed to initialize Hugging Face model '{self.model_id}': {str(e)}"
            raise RuntimeError(self.load_error) from e

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = "si",
        initial_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Transcribe audio using the loaded Hugging Face pipeline.
        Forces Sinhala ('si' / 'sinhalese') language decoding and transcribe task.
        """
        if not self.is_loaded or self._pipeline is None:
            raise RuntimeError(f"HFSinhalaWhisperAdapter is not loaded. Error: {self.load_error}")

        start_time = time.perf_counter()

        generate_kwargs = {
            "task": "transcribe"
        }
        # Hugging Face Whisper accepts language token (e.g. 'sinhalese' or 'si')
        if language:
            lang_token = "sinhalese" if language in ["si", "sin", "sinhalese"] else language
            generate_kwargs["language"] = lang_token

        if initial_prompt:
            generate_kwargs["prompt_ids"] = initial_prompt

        raw_result = self._pipeline(
            audio_path,
            generate_kwargs=generate_kwargs,
            return_timestamps=True
        )

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        # Parse text and timestamp chunks
        full_text = raw_result.get("text", "").strip() if isinstance(raw_result, dict) else str(raw_result).strip()
        chunks = raw_result.get("chunks", []) if isinstance(raw_result, dict) else []

        segments = []
        max_end = 0.0

        for chunk in chunks:
            chunk_text = chunk.get("text", "").strip()
            ts = chunk.get("timestamp", (0.0, 0.0))
            start_ts = round(ts[0], 2) if ts and ts[0] is not None else 0.0
            end_ts = round(ts[1], 2) if ts and ts[1] is not None else start_ts
            if end_ts > max_end:
                max_end = end_ts

            segments.append({
                "text": chunk_text,
                "start": start_ts,
                "end": end_ts,
                "avg_logprob": 0.0,
                "no_speech_prob": 0.0
            })

        # If no chunks provided, emit a single segment matching full text
        if not segments and full_text:
            segments.append({
                "text": full_text,
                "start": 0.0,
                "end": round(max_end, 2),
                "avg_logprob": 0.0,
                "no_speech_prob": 0.0
            })

        return {
            "text": full_text,
            "segments": segments,
            "duration_s": round(max_end, 2),
            "model": self.model_id,
            "latency_ms": latency_ms,
            "used_initial_prompt": bool(initial_prompt is not None)
        }

    def get_metadata(self) -> Dict[str, Any]:
        meta = super().get_metadata()
        meta.update({
            "license": "Apache-2.0 / MIT",
            "primary_language": "si",
            "base_architecture": "openai/whisper-small",
            "fine_tuned_for": "Sinhala Speech Recognition (SinhaSpeech)"
        })
        return meta

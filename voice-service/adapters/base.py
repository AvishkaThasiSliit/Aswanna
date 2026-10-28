"""
Base ASR Adapter interface for Aswanna speech recognition service.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any


class BaseASRAdapter(ABC):
    """
    Abstract interface for speech-to-text recognition adapters.
    Separates the HTTP/API contract from model runtime implementation.
    """

    def __init__(self, model_id: str, device: str = "cpu", **kwargs):
        self.model_id = model_id
        self.device = device
        self.options = kwargs
        self.is_loaded = False
        self.load_error: Optional[str] = None

    @abstractmethod
    def load(self) -> None:
        """
        Load the model weights and pipelines into memory once at service startup.
        Should set self.is_loaded = True if successful, or raise an exception.
        """
        pass

    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        initial_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file at audio_path.

        Returns a dictionary adhering to the Aswanna ASR contract:
        {
            "text": str,
            "segments": [
                {
                    "text": str,
                    "start": float,
                    "end": float,
                    "avg_logprob": float,
                    "no_speech_prob": float
                }
            ],
            "duration_s": float,
            "model": str,
            "latency_ms": int,
            "used_initial_prompt": bool
        }
        """
        pass

    def get_health(self) -> Dict[str, Any]:
        """Return adapter operational health status."""
        return {
            "status": "ok" if self.is_loaded else ("error" if self.load_error else "unloaded"),
            "engine": self.get_engine_name(),
            "model": self.model_id,
            "loaded": self.is_loaded,
            "error": self.load_error
        }

    @abstractmethod
    def get_engine_name(self) -> str:
        """Return the name of the runtime engine (e.g., 'faster-whisper', 'transformers')."""
        pass

    def get_metadata(self) -> Dict[str, Any]:
        """Return descriptive metadata about the adapter."""
        return {
            "engine": self.get_engine_name(),
            "model_id": self.model_id,
            "device": self.device,
            "loaded": self.is_loaded
        }

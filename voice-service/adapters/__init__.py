"""
ASR Adapter Package for Aswanna Voice Service
Provides modular adapters for Faster-Whisper and Hugging Face Transformers.
"""

from .base import BaseASRAdapter
from .factory import get_adapter

__all__ = ["BaseASRAdapter", "get_adapter"]

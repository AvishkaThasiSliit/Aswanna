"""
Dataset validation package for Aswanna Speech Recognition.
Provides manifest schema validation and speaker-disjoint split validation.
"""

from .manifest_validator import validate_manifest, ManifestValidationError
from .split_validator import validate_dataset_splits, SpeakerOverlapError

__all__ = [
    "validate_manifest",
    "ManifestValidationError",
    "validate_dataset_splits",
    "SpeakerOverlapError"
]

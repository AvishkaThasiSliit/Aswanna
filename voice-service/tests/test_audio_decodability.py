"""
Decoder-Backed Audio Verification Tests (PyAV / FFmpeg).

These tests explicitly verify actual audio decodability using PyAV (FFmpeg bindings),
separately from the Node.js structural header and box validation in audioValidator.js.

Key invariants verified:
1. Valid audio fixtures actually decode into playable audio packets and frames.
2. Malformed or corrupted audio payloads fail full-stream decoding with InvalidDataError.
3. No real contributor voice data is fabricated.
"""

import io
import math
import struct
import wave
import pytest
import av


def generate_synthesized_wav(duration_s: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Generates a mathematically synthesized 440 Hz sine wave PCM 16-bit WAV buffer."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        num_samples = int(sample_rate * duration_s)
        samples = [
            int(32767 * 0.5 * math.sin(2 * math.pi * 440 * i / sample_rate))
            for i in range(num_samples)
        ]
        wav_file.writeframes(struct.pack('<' + ('h' * len(samples)), *samples))
    return buf.getvalue()


def test_decoder_backed_valid_wav_decodes_frames():
    """Verify that a valid synthesized WAV decodes into genuine PCM audio frames."""
    wav_bytes = generate_synthesized_wav(duration_s=1.0, sample_rate=16000)
    buf = io.BytesIO(wav_bytes)

    container = av.open(buf)
    assert len(container.streams.audio) == 1
    audio_stream = container.streams.audio[0]

    assert audio_stream.format.name == 's16'
    assert audio_stream.rate == 16000
    assert audio_stream.channels == 1

    frames = list(container.decode(audio_stream))
    assert len(frames) > 0
    total_samples = sum(f.samples for f in frames)
    assert total_samples == 16000


def test_decoder_backed_rejects_corrupted_bitstream():
    """Verify that FFmpeg/PyAV rejects corrupted non-audio bitstream with InvalidDataError."""
    corrupt_bytes = b'RIFF' + b'\x00' * 4 + b'WAVE' + b'corrupt_non_audio_payload_bytes_here'
    buf = io.BytesIO(corrupt_bytes)

    with pytest.raises(av.error.InvalidDataError):
        container = av.open(buf)
        list(container.decode(container.streams.audio[0]))


def test_decoder_backed_rejects_truncated_magic():
    """Verify that truncated or random byte sequences fail to open in the decoder."""
    truncated = b'RIFF\x10\x00'
    buf = io.BytesIO(truncated)

    with pytest.raises(av.error.InvalidDataError):
        av.open(buf)

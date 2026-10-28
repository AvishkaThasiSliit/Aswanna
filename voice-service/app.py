import os
import time
import tempfile
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
import av

from adapters import BaseASRAdapter, get_adapter

# Compatibility shim: PyAV 14+ deprecated and removed metadata_errors parameter from av.open()
_orig_av_open = av.open
def _safe_av_open(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _orig_av_open(*args, **kwargs)
av.open = _safe_av_open

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = str(BASE_DIR / "models")
VOCAB_FILE = BASE_DIR / "vocab.txt"

ASR_ENGINE = os.getenv("VOICE_ASR_ENGINE", "faster-whisper").strip().lower()
WHISPER_MODEL = os.getenv("WHISPER_MODEL", os.getenv("VOICE_MODEL_ID", "base.en"))
INTERNAL_TOKEN = os.getenv("VOICE_INTERNAL_TOKEN")
if not INTERNAL_TOKEN:
    raise RuntimeError("VOICE_INTERNAL_TOKEN must be set in environment; default token removed for security")
DEFAULT_USE_PROMPT = os.getenv("WHISPER_USE_PROMPT", "true").lower() in ["1", "true", "yes"]

# Load vocabulary prompt
DEFAULT_PROMPT = ""
if VOCAB_FILE.exists():
    DEFAULT_PROMPT = VOCAB_FILE.read_text(encoding="utf-8").strip()

# Global adapter instance and startup error tracking
active_adapter: Optional[BaseASRAdapter] = None
startup_error: Optional[str] = None


def load_configured_adapter() -> BaseASRAdapter:
    """Load the configured adapter once at service startup."""
    global active_adapter, startup_error
    if active_adapter is not None and active_adapter.is_loaded:
        return active_adapter
    try:
        active_adapter = get_adapter(
            engine=ASR_ENGINE,
            model_id=WHISPER_MODEL,
            download_root=MODELS_DIR,
            cache_dir=MODELS_DIR
        )
        active_adapter.load()
        startup_error = None
        return active_adapter
    except Exception as e:
        startup_error = str(e)
        if active_adapter is None:
            try:
                active_adapter = get_adapter(engine=ASR_ENGINE, model_id=WHISPER_MODEL)
                active_adapter.load_error = startup_error
            except Exception:
                pass
        return active_adapter


# Initialize model once at module/service startup
load_configured_adapter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager: ensures model is loaded once at startup."""
    load_configured_adapter()
    yield



app = FastAPI(
    title="Aswanna Voice Service (Whisper & Sinhala ASR)",
    version="1.1.0",
    lifespan=lifespan
)


@app.get("/health")
def health_check():
    """Health check reporting model loading status and any startup error."""
    global active_adapter, startup_error
    if active_adapter is None:
        return {
            "status": "error" if startup_error else "uninitialized",
            "engine": ASR_ENGINE,
            "model": WHISPER_MODEL,
            "loaded": False,
            "error": startup_error
        }
    
    health = active_adapter.get_health()
    if startup_error and health["status"] == "ok":
        health["status"] = "error"
        health["error"] = startup_error
    return health


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    use_vocab_prompt: Optional[bool] = Query(None),
    language: Optional[str] = Query(None)
):
    # 1. Internal security token check
    if not x_internal_token or x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing or invalid internal token"
        )

    # 2. Check model readiness
    global active_adapter, startup_error
    if active_adapter is None or not active_adapter.is_loaded:
        # In test environments without lifespan trigger, attempt lazy load once
        if active_adapter is None and startup_error is None:
            load_configured_adapter()

    if active_adapter is None or not active_adapter.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ASR model is not loaded: {startup_error or 'Startup failure'}"
        )

    # 3. File size and presence check
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB
    content = await file.read()
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio file"
        )

    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file exceeds 10 MB limit"
        )

    # 4. Write audio to temporary file with guaranteed deletion
    ext = Path(file.filename or "audio.wav").suffix or ".wav"
    temp_fd, temp_path = tempfile.mkstemp(suffix=ext, prefix="voice_whisper_")
    os.close(temp_fd)

    try:
        with open(temp_path, "wb") as f:
            f.write(content)

        # 5. Audio validation and duration inspection using av
        try:
            container = av.open(temp_path)
            audio_streams = [s for s in container.streams if s.type == "audio"]
            if not audio_streams:
                container.close()
                raise ValueError("No audio stream found")
            duration_s = float(container.duration / av.time_base) if container.duration else 0.0
            container.close()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid audio content or unsupported audio format"
            )

        if duration_s > 30.5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio duration ({duration_s:.1f}s) exceeds 30 seconds limit"
            )

        # 6. Determine domain prompt
        should_use_prompt = DEFAULT_USE_PROMPT if use_vocab_prompt is None else use_vocab_prompt
        initial_prompt = DEFAULT_PROMPT if should_use_prompt and DEFAULT_PROMPT else None

        # 7. Run transcription via loaded adapter
        target_lang = language
        if not target_lang:
            target_lang = "si" if active_adapter.get_engine_name() == "transformers" else "en"

        result = active_adapter.transcribe(
            temp_path,
            language=target_lang,
            initial_prompt=initial_prompt
        )

        return result

    finally:
        # Guarantee audio file is never stored or logged
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

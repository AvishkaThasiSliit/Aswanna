import os
import io
import asyncio
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Request, Depends, status
from fastapi.responses import JSONResponse
from PIL import Image

try:
    from .ocr import is_tesseract_available, run_ocr
    from .parse_bill import parse_bill_text
except (ImportError, ValueError):
    from ocr import is_tesseract_available, run_ocr
    from parse_bill import parse_bill_text

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
REQUEST_TIMEOUT_SECONDS = 30.0

def get_required_token() -> str:
    token = os.getenv("BILL_INTERNAL_TOKEN")
    if not token or not token.strip():
        raise RuntimeError("BILL_INTERNAL_TOKEN must be set in environment")
    return token.strip()

# Enforce token at startup / import
INTERNAL_TOKEN = get_required_token()

app = FastAPI(
    title="Aswanna Bill Service",
    description="Offline OCR and structured parsing for agricultural bills",
    version="1.0.0"
)

import hmac

def verify_token(
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    expected = os.getenv("BILL_INTERNAL_TOKEN", INTERNAL_TOKEN)
    token = None
    if x_internal_token:
        token = x_internal_token.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if not token or not hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid or missing internal token"
        )

def strip_exif(image_bytes: bytes) -> bytes:
    """Strip EXIF metadata by loading and re-encoding the image in-memory."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            # Create a clean image copy without EXIF tags
            img_format = "PNG" if image_bytes.startswith(b"\x89PNG") else "JPEG"
            mode = img.mode
            if mode not in ("RGB", "L"):
                mode = "RGB" if "A" not in mode else "RGBA"
            clean_img = Image.new(mode, img.size)
            clean_img.paste(img)
            out_buf = io.BytesIO()
            clean_img.save(out_buf, format=img_format)
            return out_buf.getvalue()
    except Exception:
        # If Pillow fails to process, return raw bytes
        return image_bytes

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "bill-service",
        "ocr_engine_available": is_tesseract_available()
    }

@app.post("/scan-bill", dependencies=[Depends(verify_token)])
async def scan_bill(request: Request):
    # 1. Content-Type check
    raw_ct = request.headers.get("content-type", "")
    content_type = raw_ct.lower().split(";")[0].strip()
    if content_type not in ["image/png", "image/jpeg", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Content-Type. Only image/png and image/jpeg are supported."
        )

    # 2. Content-Length validation (if present)
    cl_header = request.headers.get("content-length")
    if cl_header is not None:
        try:
            cl = int(cl_header)
            if cl > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="File size exceeds 5 MB limit"
                )
            if cl < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Content-Length header"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed Content-Length header"
            )

    # 3. Stream body with running byte counter (never touches disk)
    chunks = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="File size exceeds 5 MB limit"
            )
        chunks.append(chunk)

    content = b"".join(chunks)
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )

    # 2. Magic bytes validation (PNG and JPEG only)
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n") or content.startswith(b"\x89PNG")
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    if not (is_png or is_jpeg):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only PNG and JPEG images are supported."
        )

    # 3. Strip EXIF metadata
    clean_bytes = strip_exif(content)

    # 4. Check OCR engine availability
    if not is_tesseract_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCR engine (Tesseract) is not configured or not found. Please install Tesseract and set TESSERACT_CMD."
        )

    # 5. Run OCR with engine timeout (25s engine timeout, 30s asyncio timeout)
    try:
        ocr_result = await asyncio.wait_for(
            asyncio.to_thread(run_ocr, clean_bytes, timeout=25),
            timeout=REQUEST_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="OCR processing timed out"
        )
    except RuntimeError as e:
        err_msg = str(e)
        if "OCR_ENGINE_MISSING" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=err_msg
            )
        if "OCR_TIMEOUT" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR error: {err_msg}"
        )

    # 6. Parse OCR output
    raw_text = ocr_result.get("raw_text", "")
    words = ocr_result.get("words", [])
    parsed = parse_bill_text(raw_text, words)

    return parsed

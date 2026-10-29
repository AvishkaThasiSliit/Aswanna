import os
import io
import shutil
from typing import Dict, Any, List, Optional
from PIL import Image

def get_tesseract_cmd() -> Optional[str]:
    """
    Resolves Tesseract binary:
    1. TESSERACT_CMD environment variable
    2. shutil.which('tesseract')
    3. None if not found
    """
    cmd = os.getenv("TESSERACT_CMD")
    if cmd:
        return cmd
    return shutil.which("tesseract")

def is_tesseract_available() -> bool:
    cmd = get_tesseract_cmd()
    if not cmd:
        return False
    if os.path.isabs(cmd):
        return os.path.exists(cmd) and os.path.isfile(cmd)
    return shutil.which(cmd) is not None

def preprocess_image(image: Image.Image) -> Image.Image:
    """Grayscale, upscale if small, and normalize."""
    gray = image.convert("L")
    w, h = gray.size
    if w < 1200 or h < 1200:
        factor = 2
        gray = gray.resize((w * factor, h * factor), Image.Resampling.LANCZOS)
    return gray

def run_ocr(image_bytes: bytes, timeout: int = 25) -> Dict[str, Any]:
    """
    Run Tesseract OCR lazily with an explicit engine timeout.
    If engine missing, raises RuntimeError('OCR_ENGINE_MISSING: ...').
    If engine times out, raises RuntimeError('OCR_TIMEOUT: ...').
    """
    cmd = get_tesseract_cmd()
    if not cmd or not is_tesseract_available():
        raise RuntimeError(
            f"OCR_ENGINE_MISSING: Tesseract executable not found. "
            f"Searched TESSERACT_CMD environment variable and system PATH via shutil.which('tesseract'). "
            f"Please install Tesseract and set TESSERACT_CMD environment variable."
        )

    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = cmd

    try:
        available_langs = pytesseract.get_languages()
    except Exception:
        available_langs = ["eng"]

    lang = "eng"
    if "sin" in available_langs:
        lang = "eng+sin"

    try:
        img = Image.open(io.BytesIO(image_bytes))
        processed = preprocess_image(img)
        data = pytesseract.image_to_data(processed, lang=lang, output_type=pytesseract.Output.DICT, timeout=timeout)
    except pytesseract.TesseractNotFoundError:
        raise RuntimeError(
            f"OCR_ENGINE_MISSING: Tesseract executable not found at '{cmd}'. "
            f"Please install Tesseract and set TESSERACT_CMD environment variable."
        )
    except (pytesseract.TesseractTimeoutError, TimeoutError) as e:
        raise RuntimeError(f"OCR_TIMEOUT: OCR processing exceeded engine timeout of {timeout}s: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"OCR_EXECUTION_ERROR: {str(e)}")

    words = []
    text_lines = []
    current_line = []
    current_line_num = -1

    for i in range(len(data.get("text", []))):
        w = data["text"][i].strip()
        conf = float(data["conf"][i]) if "conf" in data else -1.0
        line_num = data["line_num"][i] if "line_num" in data else 0

        if w:
            words.append({
                "text": w,
                "confidence": conf / 100.0 if conf >= 0 else None,
                "box": {
                    "left": data["left"][i],
                    "top": data["top"][i],
                    "width": data["width"][i],
                    "height": data["height"][i]
                }
            })
            if line_num != current_line_num:
                if current_line:
                    text_lines.append(" ".join(current_line))
                current_line = [w]
                current_line_num = line_num
            else:
                current_line.append(w)

    if current_line:
        text_lines.append(" ".join(current_line))

    raw_text = "\n".join(text_lines)
    return {
        "raw_text": raw_text,
        "words": words,
        "lang": lang
    }

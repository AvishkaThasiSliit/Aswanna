import os
import io
import pytest
import starlette
import fastapi
import tempfile
from PIL import Image
from fastapi.testclient import TestClient

import sys
from pathlib import Path
bill_service_dir = str(Path(__file__).resolve().parent.parent)
if bill_service_dir not in sys.path:
    sys.path.insert(0, bill_service_dir)

os.environ["BILL_INTERNAL_TOKEN"] = "test-secret-token"

try:
    from main import app, get_required_token
except ImportError:
    from bill_service.main import app, get_required_token

client = TestClient(app)

def make_test_png(width=100, height=100, color="white") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=color)
    img.save(buf, format="PNG")
    return buf.getvalue()

def make_test_jpeg(width=100, height=100, color="white") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=color)
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_multipart_upload_spooling_evidence():
    """
    Evidence test for TASK BILL-1e A1:
    Demonstrates that standard multipart upload with SpooledTemporaryFile(max_size=1MB)
    spools files over 1 MB directly to disk.
    """
    print(f"\n[SPOOL CHECK] FastAPI Version: {fastapi.__version__}")
    print(f"[SPOOL CHECK] Starlette Version: {starlette.__version__}")

    # Simulate SpooledTemporaryFile behavior used by Starlette's UploadFile
    spooled = tempfile.SpooledTemporaryFile(max_size=1024 * 1024)
    assert isinstance(spooled._file, io.BytesIO)

    file_name = None
    try:
        # Write 3 MB of PNG data
        png_3mb = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (3 * 1024 * 1024))
        spooled.write(png_3mb)

        # After exceeding 1 MB threshold, file is rolled over to disk
        is_disk_file = not isinstance(spooled._file, io.BytesIO)
        file_name = getattr(spooled._file, "name", None)
        print(f"[SPOOL CHECK] 3 MB payload _file type: {type(spooled._file)}")
        print(f"[SPOOL CHECK] Spooled temp file on disk: {file_name}")
        assert is_disk_file is True
        assert file_name is not None
        assert os.path.exists(file_name) is True
    finally:
        spooled.close()
        if file_name and os.path.exists(file_name):
            try:
                os.remove(file_name)
            except Exception:
                pass
        # Confirm cleanup
        if file_name:
            assert os.path.exists(file_name) is False

def test_startup_token_check_raises_when_unset(monkeypatch):
    monkeypatch.delenv("BILL_INTERNAL_TOKEN", raising=False)
    with pytest.raises(RuntimeError) as exc_info:
        get_required_token()
    assert "BILL_INTERNAL_TOKEN must be set" in str(exc_info.value)

def test_health_endpoint_no_auth():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "bill-service"
    assert "ocr_engine_available" in data

def test_auth_rejection_missing_token():
    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={"Content-Type": "image/png"}
    )
    assert resp.status_code == 401
    assert "Unauthorized" in resp.json()["detail"]

def test_auth_rejection_bad_token():
    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={
            "X-Internal-Token": "wrong-token",
            "Content-Type": "image/png"
        }
    )
    assert resp.status_code == 401

def test_auth_acceptance_bearer_token():
    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={
            "Authorization": "Bearer test-secret-token",
            "Content-Type": "image/png"
        }
    )
    # Auth passes! Since Tesseract is missing, returns 503 rather than 401
    assert resp.status_code in (200, 503)

def test_invalid_content_type_rejected():
    fake_data = b"Plain text payload"
    resp = client.post(
        "/scan-bill",
        content=fake_data,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "text/plain"
        }
    )
    assert resp.status_code == 400
    assert "Invalid Content-Type" in resp.json()["detail"]

def test_magic_bytes_validation_with_png_content_type():
    fake_data = b"This is plain text disguised as image/png."
    resp = client.post(
        "/scan-bill",
        content=fake_data,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png"
        }
    )
    assert resp.status_code == 400
    assert "Invalid image format" in resp.json()["detail"]

def test_malformed_content_length_returns_400():
    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png",
            "Content-Length": "not-an-integer"
        }
    )
    assert resp.status_code == 400
    assert "Malformed Content-Length" in resp.json()["detail"]

def test_negative_content_length_returns_400():
    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png",
            "Content-Length": "-10"
        }
    )
    assert resp.status_code == 400

def test_upload_limit_5mb_rejection():
    # Exceeds 5 MB
    oversized = b"\x89PNG\r\n\x1a\n" + (b"0" * (5 * 1024 * 1024 + 100))
    resp = client.post(
        "/scan-bill",
        content=oversized,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png"
        }
    )
    assert resp.status_code == 413
    assert "exceeds 5 MB" in resp.json()["detail"]

def test_chunked_upload_no_content_length_succeeds():
    png_bytes = make_test_png()
    def generate_chunks():
        # Yield in 256-byte chunks without Content-Length
        for i in range(0, len(png_bytes), 256):
            yield png_bytes[i:i+256]

    resp = client.post(
        "/scan-bill",
        content=generate_chunks(),
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png"
        }
    )
    # Passed streaming running counter! 503 is returned because Tesseract is not installed
    assert resp.status_code in (200, 503)

def test_chunked_upload_oversized_rejected_with_413():
    def generate_large_chunks():
        header = b"\x89PNG\r\n\x1a\n"
        yield header
        chunk = b"X" * (1024 * 1024)  # 1 MB chunk
        for _ in range(6):  # 6 MB total
            yield chunk

    resp = client.post(
        "/scan-bill",
        content=generate_large_chunks(),
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png"
        }
    )
    assert resp.status_code == 413
    assert "exceeds 5 MB" in resp.json()["detail"]

def test_missing_tesseract_returns_http_503(monkeypatch):
    monkeypatch.setenv("TESSERACT_CMD", r"C:\fake\path\to\tesseract.exe")
    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png"
        }
    )
    assert resp.status_code == 503
    assert "OCR engine (Tesseract) is not configured or not found" in resp.json()["detail"]

def test_ocr_timeout_returns_http_504(monkeypatch):
    import main
    def mock_run_ocr(image_bytes, timeout=25):
        raise RuntimeError("OCR_TIMEOUT: OCR processing exceeded engine timeout")

    monkeypatch.setattr(main, "is_tesseract_available", lambda: True)
    monkeypatch.setattr(main, "run_ocr", mock_run_ocr)

    png_bytes = make_test_png()
    resp = client.post(
        "/scan-bill",
        content=png_bytes,
        headers={
            "X-Internal-Token": "test-secret-token",
            "Content-Type": "image/png"
        }
    )
    assert resp.status_code == 504
    assert "OCR_TIMEOUT" in resp.json()["detail"]

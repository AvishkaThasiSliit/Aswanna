import os
import sys
import time
import json
import secrets
import subprocess
import httpx
from pathlib import Path

ROOT_DIR = Path("D:/Aswanna")
BILL_SERVICE_DIR = ROOT_DIR / "bill-service"
DEV_DATA_DIR = ROOT_DIR / "bill-scan-data" / "synthetic" / "development"
LOGS_DIR = ROOT_DIR / "logs"

if str(BILL_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(BILL_SERVICE_DIR))

# Ensure Tesseract environment is set
os.environ["TESSERACT_CMD"] = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Generate random internal token
BILL_TOKEN = secrets.token_hex(16)
os.environ["BILL_INTERNAL_TOKEN"] = BILL_TOKEN

PORT = 8011
BASE_URL = f"http://127.0.0.1:{PORT}"

print(f"[SETUP] Starting bill-service on 127.0.0.1:{PORT} with random token...")
server_process = subprocess.Popen(
    [
        sys.executable,
        "-m", "uvicorn",
        "main:app",
        "--host", "127.0.0.1",
        "--port", str(PORT),
        "--log-level", "warning"
    ],
    cwd="D:/Aswanna/bill-service",
    env=os.environ
)

client = httpx.Client(timeout=35.0)

try:
    # Wait for service to become responsive
    healthy = False
    for attempt in range(25):
        time.sleep(0.3)
        try:
            r = client.get(f"{BASE_URL}/health")
            if r.status_code == 200:
                healthy = True
                break
        except Exception:
            pass

    if not healthy:
        raise RuntimeError("bill-service failed to start or healthcheck timed out.")

    print(f"[HEALTH] bill-service healthy on {BASE_URL}/health")

    # The 3 chosen bills: one per degradation level 0, 2, 3
    chosen_bills = [
        {"id": "bill_001_deg0", "file": "bill_001_deg0.png", "level": 0},
        {"id": "bill_031_deg2", "file": "bill_031_deg2.png", "level": 2},
        {"id": "bill_046_deg3", "file": "bill_046_deg3.jpg", "level": 3},
    ]

    print("\n" + "="*80)
    print("SERVICE DRY RUN: 3 DEVELOPMENT BILLS (Levels 0, 2, 3)")
    print("="*80)

    from ocr import run_ocr

    for cb in chosen_bills:
        img_path = DEV_DATA_DIR / cb["file"]
        json_path = DEV_DATA_DIR / f"{cb['id']}.json"

        with open(img_path, "rb") as f:
            img_bytes = f.read()

        with open(json_path, "r", encoding="utf-8") as f:
            gt_data = json.load(f)

        ct = "image/png" if cb["file"].endswith(".png") else "image/jpeg"

        # POST /scan-bill as raw image body
        headers = {
            "Content-Type": ct,
            "Authorization": f"Bearer {BILL_TOKEN}"
        }

        resp = client.post(f"{BASE_URL}/scan-bill", headers=headers, content=img_bytes)
        parsed_json = resp.json()

        # Direct OCR text for side-by-side inspection
        ocr_res = run_ocr(img_bytes)
        raw_ocr_text = ocr_res.get("raw_text", "")

        print(f"\n>>> BILL: {cb['id']} (Degradation Level {cb['level']}) <<<")
        print("-" * 80)
        print("RAW OCR TEXT:")
        print(raw_ocr_text.strip())
        print("-" * 40)
        print("PARSED JSON:")
        print(json.dumps(parsed_json, indent=2))
        print("-" * 40)
        print("GROUND TRUTH:")
        print(json.dumps(gt_data, indent=2))
        print("=" * 80)

    # Latency table for all 20 development bills
    print("\n" + "="*80)
    print("LATENCY TABLE: ALL 20 DEVELOPMENT BILLS")
    print("="*80)
    print(f"{'Bill ID':<20} {'Level':<8} {'Format':<8} {'Size (KB)':<12} {'HTTP Status':<14} {'Latency (ms)':<12}")
    print("-" * 80)

    # Sort development images
    dev_images = sorted(list(DEV_DATA_DIR.glob("*.png")) + list(DEV_DATA_DIR.glob("*.jpg")))
    latency_records = []

    for img_p in dev_images:
        b_id = img_p.stem
        # parse level from stem
        import re
        m = re.search(r"deg(\d)", b_id)
        lvl = int(m.group(1)) if m else 0
        fmt = img_p.suffix[1:].upper()
        sz_kb = round(img_p.stat().st_size / 1024, 1)

        with open(img_p, "rb") as f:
            data_bytes = f.read()

        ct = "image/png" if fmt == "PNG" else "image/jpeg"
        hdrs = {
            "Content-Type": ct,
            "Authorization": f"Bearer {BILL_TOKEN}"
        }

        t_start = time.perf_counter()
        r = client.post(f"{BASE_URL}/scan-bill", headers=hdrs, content=data_bytes)
        dur_ms = round((time.perf_counter() - t_start) * 1000, 1)

        latency_records.append({"id": b_id, "level": lvl, "format": fmt, "size_kb": sz_kb, "status": r.status_code, "latency_ms": dur_ms})
        print(f"{b_id:<20} {lvl:<8} {fmt:<8} {sz_kb:<12} {r.status_code:<14} {dur_ms:<12}")

    avg_ms = round(sum(r["latency_ms"] for r in latency_records) / len(latency_records), 1)
    min_ms = min(r["latency_ms"] for r in latency_records)
    max_ms = max(r["latency_ms"] for r in latency_records)
    print("-" * 80)
    print(f"Summary: Min = {min_ms} ms | Max = {max_ms} ms | Mean = {avg_ms} ms over {len(latency_records)} bills")
    print("=" * 80)

finally:
    print("\n[TEARDOWN] Stopping bill-service process...")
    server_process.terminate()
    server_process.wait()
    print("[TEARDOWN] bill-service process stopped.")

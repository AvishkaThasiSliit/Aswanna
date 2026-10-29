#!/usr/bin/env python3
"""
Synthetic printed-bill generator with locked ground truth (TASK BILL-2a).
Generates 60 printed-style English receipts for farm supplies, fuel stations, and hardware shops.
Renders bills using PIL across two distinct layouts and four degradation levels.
Splits: 20 development bills, 40 test bills.
Ground truth JSON per bill with total in integer cents, items, vendor, ISO date, and distractors.
"""

import os
import sys
import json
import math
import random
import hashlib
from pathlib import Path
from decimal import Decimal
from typing import List, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SCRIPT_DIR = Path(__file__).resolve().parent
BILL_SERVICE_DIR = SCRIPT_DIR.parent
ROOT_DIR = BILL_SERVICE_DIR.parent
OUTPUT_DATA_DIR = ROOT_DIR / "bill-scan-data" / "synthetic"
LOGS_DIR = ROOT_DIR / "logs"

# Ensure directories exist
OUTPUT_DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Fixed master random seed for 100% reproducible generation
SEED = 20261029

# Shops & Vendors (Farm supply, Fuel stations, Hardware stores)
VENDORS = [
    {
        "name": "Lanka Agro Chemicals & Farm Supplies",
        "address": "45 Kandy Road, Kurunegala",
        "phone": "037-2234567",
        "type": "farm_supply"
    },
    {
        "name": "Rajarata Farmers Mart",
        "address": "12 Main Street, Anuradhapura",
        "phone": "025-2221234",
        "type": "farm_supply"
    },
    {
        "name": "Dambulla Agri Inputs Center",
        "address": "88 Market Road, Dambulla",
        "phone": "066-2284990",
        "type": "farm_supply"
    },
    {
        "name": "Wayamba Agro Service",
        "address": "102 Station Road, Maho",
        "phone": "037-2275112",
        "type": "farm_supply"
    },
    {
        "name": "Ceypetco Filling Station",
        "address": "A9 Highway, Medawachchiya",
        "phone": "025-2245001",
        "type": "fuel_station"
    },
    {
        "name": "Lanka IOC Fuel Point",
        "address": "Colombo Road, Polonnaruwa",
        "phone": "027-2223840",
        "type": "fuel_station"
    },
    {
        "name": "Sinha Auto & Diesel Center",
        "address": "14 Puttalam Road, Nikaweratiya",
        "phone": "037-2260455",
        "type": "fuel_station"
    },
    {
        "name": "City Hardware & Agri Tools",
        "address": "77 Bazaar Street, Matale",
        "phone": "066-2223400",
        "type": "hardware"
    },
    {
        "name": "New Gamini Hardware Stores",
        "address": "33 Hospital Road, Tambuttegama",
        "phone": "025-2276550",
        "type": "hardware"
    },
    {
        "name": "Jaya Hardware & Machinery Mart",
        "address": "50 Commercial Zone, Hingurakgoda",
        "phone": "027-2246110",
        "type": "hardware"
    }
]

# Realistic Items catalog mapped strictly to the app's 8 categories
CATALOG = [
    # Fertilizer
    {"desc": "Urea Fertilizer 50kg", "unit_price": 4500.0, "category": "fertilizer"},
    {"desc": "TSP Fertilizer 50kg", "unit_price": 5200.0, "category": "fertilizer"},
    {"desc": "MOP Fertilizer 50kg", "unit_price": 4800.0, "category": "fertilizer"},
    {"desc": "Compost Fertilizer 25kg", "unit_price": 1200.0, "category": "fertilizer"},
    {"desc": "Zinc Sulphate 1kg", "unit_price": 850.0, "category": "fertilizer"},
    # Seed
    {"desc": "Bg 358 Seed Paddy 20kg", "unit_price": 3800.0, "category": "seed"},
    {"desc": "Bg 300 Certified Seed 20kg", "unit_price": 3950.0, "category": "seed"},
    {"desc": "At 362 Seed Paddy 20kg", "unit_price": 4100.0, "category": "seed"},
    {"desc": "Maize Hybrid Seeds 5kg", "unit_price": 4500.0, "category": "seed"},
    {"desc": "Chilli Seed Packet 100g", "unit_price": 650.0, "category": "seed"},
    # Agrochemical
    {"desc": "Glyphosate Weedicide 1L", "unit_price": 2800.0, "category": "agrochemical"},
    {"desc": "Bispyribac Sodium 500ml", "unit_price": 1950.0, "category": "agrochemical"},
    {"desc": "Chlorpyrifos Insecticide 1L", "unit_price": 2200.0, "category": "agrochemical"},
    {"desc": "Mancozeb Fungicide 500g", "unit_price": 1400.0, "category": "agrochemical"},
    {"desc": "Weedicide Spray 500ml", "unit_price": 1750.0, "category": "agrochemical"},
    # Fuel
    {"desc": "Auto Diesel", "unit_price": 350.0, "category": "fuel"},
    {"desc": "Super Diesel", "unit_price": 400.0, "category": "fuel"},
    {"desc": "Petrol 92 Octane", "unit_price": 360.0, "category": "fuel"},
    {"desc": "Kerosene Oil", "unit_price": 240.0, "category": "fuel"},
    {"desc": "Engine Oil 4T 1L", "unit_price": 1850.0, "category": "fuel"},
    # Machinery
    {"desc": "Wheelbarrow Heavy Duty", "unit_price": 9500.0, "category": "machinery"},
    {"desc": "Knapsack Sprayer 16L", "unit_price": 6800.0, "category": "machinery"},
    {"desc": "Grass Cutter Blade 12in", "unit_price": 1650.0, "category": "machinery"},
    {"desc": "Water Pump V-Belt B-42", "unit_price": 1100.0, "category": "machinery"},
    {"desc": "Tiller Cultivator Tyne", "unit_price": 1450.0, "category": "machinery"},
    # Irrigation
    {"desc": "Drip Irrigation Pipe 16mm 100m", "unit_price": 7500.0, "category": "irrigation"},
    {"desc": "PVC Ball Valve 2 inch", "unit_price": 1250.0, "category": "irrigation"},
    {"desc": "Sprinkler Head 3/4 inch", "unit_price": 850.0, "category": "irrigation"},
    {"desc": "Flexible Hose Pipe 30m", "unit_price": 3200.0, "category": "irrigation"},
    {"desc": "Foot Valve 2 inch", "unit_price": 1450.0, "category": "irrigation"},
    # Labour (services often billed at agri centers)
    {"desc": "Sprayer Servicing Charge", "unit_price": 800.0, "category": "labour"},
    {"desc": "Pump Repair Labour Charge", "unit_price": 1500.0, "category": "labour"},
    # Other
    {"desc": "Tarpaulin Sheet 12x18ft", "unit_price": 3400.0, "category": "other"},
    {"desc": "Binding Wire Roll 5kg", "unit_price": 1600.0, "category": "other"},
    {"desc": "Jute Gunny Bags 10pcs", "unit_price": 1200.0, "category": "other"},
    {"desc": "Safety Rubber Boots Pair", "unit_price": 2400.0, "category": "other"},
]

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def format_date(d: int, m: int, y: int, fmt_idx: int) -> Tuple[str, str]:
    """Returns (formatted_display_string, iso_date_yyyy_mm_dd)."""
    iso_date = f"{y:04d}-{m:02d}-{d:02d}"
    if fmt_idx == 0:
        display = f"{d:02d}/{m:02d}/{y:04d}"
    elif fmt_idx == 1:
        display = f"{d:02d}-{m:02d}-{str(y)[2:]}"
    elif fmt_idx == 2:
        display = f"{d:d} {MONTH_NAMES[m-1]} {y:04d}"
    elif fmt_idx == 3:
        display = f"{y:04d}-{m:02d}-{d:02d}"
    else:
        display = f"{d:02d}.{m:02d}.{y:04d}"
    return display, iso_date

def format_amount(amount: float, style_idx: int) -> str:
    """Formats amount according to realistic printed bill styles."""
    val = round(amount, 2)
    val_int = int(round(val))
    val_has_cents = (abs(val - val_int) > 0.001)

    if style_idx == 0:
        # Standard comma with two decimals: 1,250.00
        return f"{val:,.2f}"
    elif style_idx == 1:
        # Rs. prefix with comma: Rs.1,250.00 or Rs. 1,250.00
        return f"Rs.{val:,.2f}"
    elif style_idx == 2:
        # Slashed total style: 1250/= or 1,250/=
        if not val_has_cents:
            return f"{val_int:,}/="
        return f"{val:,.2f}"
    elif style_idx == 3:
        # Rs prefix space separated: Rs 1 250 or Rs 1,250/=
        if not val_has_cents:
            s = f"{val_int:,}".replace(",", " ")
            return f"Rs {s}"
        return f"Rs {val:,.2f}"
    elif style_idx == 4:
        # LKR prefix: LKR 1,250.00
        return f"LKR {val:,.2f}"
    else:
        return f"{val:,.2f}"

def get_fonts() -> Tuple[Any, Any, Any]:
    """Loads fonts, falling back gracefully to PIL default if TTF unavailable."""
    ttf_candidates = [
        r"C:\Windows\Fonts\consola.ttf",
        r"C:\Windows\Fonts\cour.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    ]
    font_path = None
    for p in ttf_candidates:
        if os.path.exists(p):
            font_path = p
            break

    if font_path:
        try:
            title_font = ImageFont.truetype(font_path, 20)
            body_font = ImageFont.truetype(font_path, 15)
            small_font = ImageFont.truetype(font_path, 13)
            return title_font, body_font, small_font
        except Exception:
            pass

    default = ImageFont.load_default()
    return default, default, default

TITLE_FONT, BODY_FONT, SMALL_FONT = get_fonts()

def render_bill_image(
    lines: List[Tuple[str, str, Any]],  # (text, alignment: 'left'|'center'|'split', font)
    width: int = 500,
    line_height: int = 22
) -> Image.Image:
    """Renders a clean bill image from line specifications."""
    total_lines = len(lines)
    height = max(400, (total_lines + 4) * line_height)
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    y = 25
    margin = 25

    for item in lines:
        text, align, font = item
        if align == "center":
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            x = (width - w) // 2
            draw.text((x, y), text, fill=(0, 0, 0), font=font)
        elif align == "split":
            left_txt, right_txt = text.split("||", 1)
            draw.text((margin, y), left_txt.strip(), fill=(0, 0, 0), font=font)
            bbox = draw.textbbox((0, 0), right_txt.strip(), font=font)
            rw = bbox[2] - bbox[0]
            draw.text((width - margin - rw, y), right_txt.strip(), fill=(0, 0, 0), font=font)
        else:
            draw.text((margin, y), text, fill=(0, 0, 0), font=font)
        y += line_height

    return img

def apply_degradation(img: Image.Image, level: int, rng: random.Random) -> Image.Image:
    """
    Applies realistic degradation across 4 levels:
    0: Clean (no degradation)
    1: Slight blur and JPEG compression
    2: Skew up to 5 degrees and lower contrast
    3: Heavy noise and low resolution
    """
    if level == 0:
        return img

    if level == 1:
        # Slight blur and JPEG compression artifact
        blurred = img.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.4, 0.8)))
        # Emulate JPEG compression in memory
        import io
        buf = io.BytesIO()
        blurred.save(buf, format="JPEG", quality=rng.randint(65, 80))
        buf.seek(0)
        return Image.open(buf).convert("RGB")

    if level == 2:
        # Skew up to 5 degrees (positive or negative) + lower contrast
        angle = rng.uniform(-4.5, 4.5)
        rotated = img.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))

        # Contrast adjustment
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(rotated)
        contrasted = enhancer.enhance(rng.uniform(0.65, 0.85))

        # Light noise
        import io
        buf = io.BytesIO()
        contrasted.save(buf, format="JPEG", quality=rng.randint(60, 75))
        buf.seek(0)
        return Image.open(buf).convert("RGB")

    if level == 3:
        # Heavy noise and low resolution downscale/upscale + slight skew
        angle = rng.uniform(-3.0, 3.0)
        rotated = img.rotate(angle, resample=Image.BILINEAR, expand=True, fillcolor=(245, 245, 245))

        # Downscale by 50% then upscale to create low-res pixelation
        w, h = rotated.size
        small_w, small_h = max(100, int(w * 0.55)), max(100, int(h * 0.55))
        low_res = rotated.resize((small_w, small_h), resample=Image.BILINEAR)
        restored = low_res.resize((w, h), resample=Image.NEAREST)

        # Add salt-and-pepper / gaussian-like noise
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(restored)
        degraded = enhancer.enhance(rng.uniform(0.7, 0.9))

        import io
        buf = io.BytesIO()
        degraded.save(buf, format="JPEG", quality=rng.randint(40, 55))
        buf.seek(0)
        return Image.open(buf).convert("RGB")

    return img

def generate_dataset():
    rng = random.Random(SEED)

    # 60 bills total: 15 per degradation level (0, 1, 2, 3)
    # Split: 20 development bills (5 per level), 40 test bills (10 per level)
    # Assign deterministic split and level mapping
    bills_meta = []
    bill_id = 1
    for level in range(4):
        # 15 bills for this level: 5 dev, 10 test
        for i in range(15):
            split = "development" if i < 5 else "test"
            bills_meta.append({
                "num_id": bill_id,
                "level": level,
                "split": split,
                "split_idx": i
            })
            bill_id += 1

    # Shuffle assignment deterministically
    # (keeps exact count of 20 dev and 40 test, exactly 5 and 10 per level)
    generated_records = []
    test_split_records = []

    for meta in bills_meta:
        b_id = f"bill_{meta['num_id']:03d}"
        level = meta["level"]
        split = meta["split"]

        vendor = rng.choice(VENDORS)
        day = rng.randint(1, 28)
        month = rng.randint(1, 12)
        year = rng.choice([2025, 2026])
        date_fmt_idx = rng.randint(0, 4)
        date_str, iso_date = format_date(day, month, year, date_fmt_idx)

        # Number of line items: 1 to 4
        num_items = rng.randint(1, 4)
        selected_catalog = rng.sample(CATALOG, num_items)

        items_gt = []
        bill_lines = []
        raw_subtotal_cents = 0
        total_qty = 0

        for item_tmpl in selected_catalog:
            qty = rng.randint(1, 3)
            total_qty += qty
            u_price = item_tmpl["unit_price"]
            amt = round(qty * u_price, 2)
            amt_cents = int(round(amt * 100))
            raw_subtotal_cents += amt_cents

            items_gt.append({
                "description": item_tmpl["desc"],
                "quantity": qty,
                "unit_price": u_price,
                "amount": amt,
                "category": item_tmpl["category"]
            })

        # Distractor lines configuration
        # Totals with/without VAT, discount, cash, change, total qty
        has_discount = (rng.random() < 0.35)
        has_tax = (rng.random() < 0.30)
        has_cash_change = (rng.random() < 0.70)
        has_qty_total = (rng.random() < 0.60)

        discount_cents = 0
        tax_cents = 0

        if has_discount:
            # 5% to 15% discount rounded to 10 rupees
            disc_rate = rng.choice([0.05, 0.10, 0.15])
            disc_val = round((raw_subtotal_cents * disc_rate) / 1000.0) * 10.0
            discount_cents = int(round(disc_val * 100))

        after_disc_cents = raw_subtotal_cents - discount_cents

        if has_tax:
            tax_rate = 0.08  # 8% VAT
            tax_val = round((after_disc_cents * tax_rate) / 100.0)
            tax_cents = int(round(tax_val * 100))

        final_total_cents = after_disc_cents + tax_cents
        final_total_rupees = round(final_total_cents / 100.0, 2)

        # Layout choice: Layout 1 (Classic tabular) vs Layout 2 (Compact receipt style)
        layout = (meta["num_id"] % 2) + 1
        amt_style = rng.randint(0, 4)

        # Build Bill Lines
        bill_lines.append((vendor["name"].upper(), "center", TITLE_FONT))
        bill_lines.append((vendor["address"], "center", SMALL_FONT))
        bill_lines.append((f"Tel: {vendor['phone']}", "center", SMALL_FONT))
        bill_lines.append(("--------------------------------------------------", "center", BODY_FONT))

        receipt_no = f"INV-{year}-{1000 + meta['num_id']}"
        bill_lines.append((f"Date: {date_str} || Bill No: {receipt_no}", "split", BODY_FONT))
        bill_lines.append(("--------------------------------------------------", "center", BODY_FONT))

        distractor_lines = []

        if layout == 1:
            # Tabular header
            bill_lines.append(("Item Description || Qty  Rate     Amount", "split", SMALL_FONT))
            bill_lines.append(("--------------------------------------------------", "center", SMALL_FONT))
            for itm in items_gt:
                desc = itm["description"]
                if len(desc) > 22:
                    desc = desc[:20] + ".."
                q_r_a = f"{itm['quantity']} x {itm['unit_price']:,.2f} || {format_amount(itm['amount'], amt_style)}"
                bill_lines.append((f"{desc} || {q_r_a}", "split", BODY_FONT))
        else:
            # Compact multi-line
            for itm in items_gt:
                bill_lines.append((itm["description"], "left", BODY_FONT))
                detail_str = f"   {itm['quantity']} @ {itm['unit_price']:,.2f} each"
                amt_str = format_amount(itm['amount'], amt_style)
                bill_lines.append((f"{detail_str} || {amt_str}", "split", BODY_FONT))

        bill_lines.append(("--------------------------------------------------", "center", BODY_FONT))

        # Distractor & Total Section
        if has_qty_total:
            line_str = f"Total Items: {len(items_gt)} | Total Qty: {total_qty}"
            bill_lines.append((line_str, "center", SMALL_FONT))
            distractor_lines.append(line_str)

        if has_discount or has_tax:
            subtot_val = raw_subtotal_cents / 100.0
            line_str = f"Subtotal || {format_amount(subtot_val, amt_style)}"
            bill_lines.append((line_str, "split", BODY_FONT))
            distractor_lines.append(f"Subtotal: {subtot_val:.2f}")

        if has_discount:
            disc_val = discount_cents / 100.0
            line_str = f"Discount (Less) || -{format_amount(disc_val, amt_style)}"
            bill_lines.append((line_str, "split", BODY_FONT))
            distractor_lines.append(f"Discount: -{disc_val:.2f}")

        if has_tax:
            t_val = tax_cents / 100.0
            line_str = f"VAT (8%) || {format_amount(t_val, amt_style)}"
            bill_lines.append((line_str, "split", BODY_FONT))
            distractor_lines.append(f"VAT: {t_val:.2f}")

        # Total Line
        tot_keyword = rng.choice(["TOTAL", "NET TOTAL", "TOTAL PAYABLE", "BALANCE DUE"])
        tot_str = f"{tot_keyword} || {format_amount(final_total_rupees, amt_style)}"
        bill_lines.append((tot_str, "split", TITLE_FONT))
        bill_lines.append(("==================================================", "center", BODY_FONT))

        if has_cash_change:
            # Cash tendered rounded up to next 1000 or 500
            tendered = math.ceil(final_total_rupees / 500.0) * 500.0
            if tendered == final_total_rupees:
                tendered += 500.0
            change = tendered - final_total_rupees
            c_line = f"Cash Tendered || {format_amount(tendered, amt_style)}"
            ch_line = f"Change || {format_amount(change, amt_style)}"
            bill_lines.append((c_line, "split", SMALL_FONT))
            bill_lines.append((ch_line, "split", SMALL_FONT))
            distractor_lines.append(f"Cash Tendered: {tendered:.2f}")
            distractor_lines.append(f"Change: {change:.2f}")

        bill_lines.append(("THANK YOU! PLEASE COME AGAIN", "center", SMALL_FONT))

        # Render clean image
        clean_img = render_bill_image(bill_lines, width=480, line_height=22)

        # Apply degradation
        deg_img = apply_degradation(clean_img, level, rng)

        # Determine target paths: bill-scan-data/synthetic/<split>/
        split_dir = OUTPUT_DATA_DIR / split
        split_dir.mkdir(parents=True, exist_ok=True)

        ext = "png" if level in [0, 2] else "jpg"
        img_filename = f"{b_id}_deg{level}.{ext}"
        json_filename = f"{b_id}_deg{level}.json"

        img_path = split_dir / img_filename
        json_path = split_dir / json_filename

        # Save image
        if ext == "png":
            deg_img.save(img_path, format="PNG")
        else:
            deg_img.save(img_path, format="JPEG", quality=85)

        # Build Ground Truth structure
        gt_obj = {
            "id": b_id,
            "filename": img_filename,
            "split": split,
            "degradation_level": level,
            "layout": layout,
            "vendor": vendor["name"],
            "date": iso_date,
            "items": items_gt,
            "total": final_total_rupees,
            "total_cents": final_total_cents,
            "distractors": distractor_lines,
            "meta": {
                "date_display": date_str,
                "amount_style_idx": amt_style,
                "has_tax": has_tax,
                "has_discount": has_discount
            }
        }

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(gt_obj, f, indent=2)

        file_size = img_path.stat().st_size
        rec = {
            "id": b_id,
            "split": split,
            "level": level,
            "img_file": img_filename,
            "json_file": json_filename,
            "file_size": file_size,
            "gt": gt_obj
        }
        generated_records.append(rec)
        if split == "test":
            test_split_records.append(rec)

    # Write manifest per split
    for s in ["development", "test"]:
        s_dir = OUTPUT_DATA_DIR / s
        s_manifest = [r["gt"] for r in generated_records if r["split"] == s]
        with open(s_dir / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(s_manifest, f, indent=2)

    # Compute SHA256 of test-split ground truth
    # Canonical stringification: sorted keys, compact separators
    test_split_records_sorted = sorted(test_split_records, key=lambda x: x["id"])
    canonical_test_gt = [r["gt"] for r in test_split_records_sorted]
    test_json_bytes = json.dumps(canonical_test_gt, sort_keys=True, indent=2).encode("utf-8")
    test_hash = hashlib.sha256(test_json_bytes).hexdigest()

    hash_file = LOGS_DIR / "bill-synth-test-hash.txt"
    hash_file.write_text(f"{test_hash}  test-ground-truth-sha256\n", encoding="utf-8")

    # Create logs/bill-synth-test.lock
    lock_file = LOGS_DIR / "bill-synth-test.lock"
    lock_content = (
        f"SYNTHETIC TEST SPLIT LOCKED\n"
        f"SHA256: {test_hash}\n"
        f"Count: {len(test_split_records)}\n"
        f"Rule: Test labels are never edited; only development bills may be used for tuning.\n"
    )
    lock_file.write_text(lock_content, encoding="utf-8")

    print(f"Generated {len(generated_records)} synthetic bills total.")
    print(f"Development split: {len(generated_records) - len(test_split_records)} bills in {OUTPUT_DATA_DIR / 'development'}")
    print(f"Test split: {len(test_split_records)} bills in {OUTPUT_DATA_DIR / 'test'}")
    print(f"Test split hash: {test_hash}")
    print(f"Locked test split: {lock_file}")

if __name__ == "__main__":
    generate_dataset()

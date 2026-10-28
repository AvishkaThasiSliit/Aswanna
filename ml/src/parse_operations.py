"""
ml/src/parse_operations.py
Parses the Operation tables across all raw COC survey workbooks in
'Profit Folder/COC folder/data/raw_surveys/**/*.xlsx' into a unified CSV:
ml/data/derived/operation_costs.csv

Columns:
season, year, crop, district, operation_name, operation_order,
labour_cost, machinery_cost, material_cost, total_cost, source_file, source_sheet
"""

import os
import re
import sys
import glob
from pathlib import Path
import openpyxl
import pandas as pd
import numpy as np

# Crop Aliases
CROP_ALIASES = {
    # Paddy
    "paddy": "Paddy",
    "paddy - irrigated": "Paddy",
    "paddy - rainfed": "Paddy",
    "paddy irrigated": "Paddy",
    "paddy rainfed": "Paddy",
    "paddy(irrigated)": "Paddy",
    "paddy(rainfed)": "Paddy",
    # Coarse Grains
    "maize": "Maize",
    "kurakkan": "Kurakkan",
    "finger millet": "Kurakkan",
    # Pulses
    "black gram": "Black Gram",
    "blackgram": "Black Gram",
    "b.gram": "Black Gram",
    "b'gram": "Black Gram",
    "b'ggram": "Black Gram",
    "black g": "Black Gram",
    "cowpea": "Cowpea",
    "green gram": "Green Gram",
    "green grame": "Green Gram",
    "greengram": "Green Gram",
    # Oilseeds
    "ground nut": "Groundnut",
    "groundnut": "Groundnut",
    "g'nut": "Groundnut",
    "g nut": "Groundnut",
    "gingelly": "Gingelly",
    "gingerlly": "Gingelly",
    "gingerly": "Gingelly",
    "sesame": "Gingelly",
    "soybean": "Soybean",
    "soya": "Soybean",
    "soya bean": "Soybean",
    # Condiments
    "big onion": "Big Onion",
    "red onion": "Red Onion",
    "red onio": "Red Onion",
    "chilli": "Green Chilli",
    "g chilli": "Green Chilli",
    "green chilli": "Green Chilli",
    "greenchilli": "Green Chilli",
    "capsicum": "Capsicum",
    "capsi": "Capsicum",
    # Vegetables
    "cabbage": "Cabbage",
    "carrot": "Carrot",
    "carro": "Carrot",
    "tomato": "Tomato",
    "tommato": "Tomato",
    "brinjal": "Brinjal",
    "brijal": "Brinjal",
    "brinal": "Brinjal",
    "bitter gourd": "Bitter Gourd",
    "bitter goard": "Bitter Gourd",
    "pole bean": "Pole Bean",
    "polebean": "Pole Bean",
    "pole been": "Pole Bean",
    "pole ben": "Pole Bean",
    "pole beans": "Pole Bean",
    "potato": "Potato",
    "poteto": "Potato",
    "sweet potato": "Sweet Potato",
    "manioc": "Manioc",
    "pumpkin": "Pumpkin",
    "pumking": "Pumpkin",
    "pumkin": "Pumpkin",
    "pupkin": "Pumpkin",
    "beetroot": "Beetroot",
    "beet - root": "Beetroot",
    "beet root": "Beetroot",
}

DISTRICT_ALIASES = {
    "anuradhapura": "Anuradhapura", "a'pura": "Anuradhapura", "apura": "Anuradhapura", "anu": "Anuradhapura",
    "ampara": "Ampara", "ampara east": "Ampara (East)", "ampara - east": "Ampara (East)", "ampara (east)": "Ampara (East)",
    "am east": "Ampara (East)", "amp east": "Ampara (East)", "ampara-east": "Ampara (East)",
    "ampara west": "Ampara (West)", "ampara - west": "Ampara (West)", "ampara (west)": "Ampara (West)",
    "am west": "Ampara (West)", "amp west": "Ampara (West)", "ampara-west": "Ampara (West)",
    "badulla": "Badulla", "bdl": "Badulla", "bd": "Badulla",
    "batticaloa": "Batticaloa", "batti": "Batticaloa",
    "gampaha": "Gampaha", "gamph": "Gampaha",
    "hambantota": "Hambantota", "h'tota": "Hambantota", "h tota": "Hambantota", "htota": "Hambantota", "hamb": "Hambantota",
    "jaffna": "Jaffna",
    "kalutara": "Kalutara",
    "kandy": "Kandy",
    "kurunegala": "Kurunegala", "kurunagala": "Kurunegala", "kuru": "Kurunegala", "k'gala": "Kurunegala",
    "kegalle": "Kegalle", "kg": "Kegalle",
    "mannar": "Mannar",
    "matale": "Matale", "mtl": "Matale",
    "matara": "Matara",
    "monaragala": "Monaragala", "moneragala": "Monaragala", "m'gala": "Monaragala",
    "nuwara eliya": "Nuwara Eliya", "nuwara-eliya": "Nuwara Eliya", "nuwaraeliya": "Nuwara Eliya", "n'eliya": "Nuwara Eliya",
    "polonnaruwa": "Polonnaruwa", "polon": "Polonnaruwa", "pln": "Polonnaruwa", "p'naruwa": "Polonnaruwa",
    "puttalam": "Puttalam", "putt": "Puttalam",
    "trincomalee": "Trincomalee", "trinco": "Trincomalee",
    "vavuniya": "Vavuniya", "vav": "Vavuniya",
    "system b": "Mahaweli System B", "sys b": "Mahaweli System B", "mahaweli b": "Mahaweli System B",
    "system c": "Mahaweli System C", "sys c": "Mahaweli System C", "mahaweli c": "Mahaweli System C",
    "system h": "Mahaweli System H", "sys h": "Mahaweli System H", "mahaweli h": "Mahaweli System H",
    "udawalawa": "Udawalawa", "udawalawe": "Udawalawa",
    "whole island": "Whole Island", "wi": "Whole Island", "all island": "Whole Island",
}


def clean_str(s):
    if s is None:
        return ""
    return str(s).replace('\xa0', ' ').replace('\u2013', '-').replace('\u2014', '-').replace('\ufffd', 'e').strip()


def clean_num(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return 0.0 if np.isnan(val) else float(val)
    s = str(val).strip()
    if not s or s in ['-', '`', '*', 'na', 'nan', 'nil', '.', '/', '\\']:
        return 0.0
    # multiline cell
    if '\n' in s:
        lines = [ln.strip() for ln in s.split('\n') if ln.strip()]
        s = lines[0] if lines else ''
    s = re.sub(r'[\,\`\'\"\*\s]', '', s)
    # parenthesized number e.g. (1234.50) -> treat as number or 0 if alternative
    m = re.match(r'^\(?([\d\.\-]+)\)?$', s)
    if m:
        try:
            return float(m.group(1))
        except (ValueError, TypeError):
            return 0.0
    return 0.0


def parse_season_year(filepath):
    """Derive season and year from directory structure or filename."""
    path_str = str(filepath).lower()
    season = "Maha" if "maha" in path_str else "Yala"
    m_range = re.search(r'(\d{4})\s*[-_]\s*(\d{2,4})', path_str)
    if m_range:
        y1 = int(m_range.group(1))
        y2 = m_range.group(2)
        year_str = f"{y1}-{y2[-2:]}" if len(y2) in [2, 4] else str(y1)
        return season, year_str
    m_single = re.search(r'(\d{4})', path_str)
    if m_single:
        return season, str(m_single.group(1))
    return season, "Unknown"


def normalize_crop_name(text, filename=""):
    t = clean_str(text).lower()
    for k in sorted(CROP_ALIASES.keys(), key=len, reverse=True):
        if re.search(r'(?<![a-zA-Z0-9])' + re.escape(k) + r'(?![a-zA-Z0-9])', t):
            return CROP_ALIASES[k]
    fn_lower = str(filename).lower()
    if "paddy" in fn_lower:
        return "Paddy"
    return None


def normalize_district_name(text):
    t = clean_str(text).lower()
    for k in sorted(DISTRICT_ALIASES.keys(), key=len, reverse=True):
        if re.search(r'(?<![a-zA-Z0-9])' + re.escape(k) + r'(?![a-zA-Z0-9])', t):
            return DISTRICT_ALIASES[k]
    return "Unknown"


def parse_operations_from_sheet(sheet, filepath, sheetname):
    """
    Parses the operations table from a single openpyxl worksheet.
    Returns (records_list, error_or_skip_reason)
    """
    # 1. Identify sheet metadata (Crop, District)
    top_rows_text = []
    for r in range(1, 15):
        vals = [clean_str(sheet.cell(r, c).value) for c in range(1, 12)]
        non_empty = [v for v in vals if v]
        if non_empty:
            top_rows_text.append(" ".join(non_empty))
    header_block = " ".join(top_rows_text).lower()

    # Skip known non-COC sheets
    sname_lower = sheetname.lower().strip()
    if any(k in sname_lower for k in ['graphs', 'stat table', 'annexes', 'summery', 'summary', 'page', 'content']):
        return [], "Non-COC sheet (summary/graph/TOC)"
    if sname_lower in ['s', 'sheet1', 'sheet2']:
        return [], "Draft or blank sheet"

    # Crop
    crop = normalize_crop_name(header_block + " " + sheetname, filename=filepath)
    if not crop:
        return [], "Could not identify crop from header or sheetname"

    # District
    district = normalize_district_name(header_block + " " + sheetname)

    # 2. Locate Operation Table
    op_row = None
    total_incl_row = None
    max_scan = min(sheet.max_row, 50)

    for r in range(1, max_scan + 1):
        row_str = " ".join([clean_str(sheet.cell(r, c).value).lower() for c in range(1, 15)])
        if "operation" in row_str and op_row is None:
            op_row = r
        if re.search(r'total\s*incl', row_str) and total_incl_row is None:
            total_incl_row = r

    if not op_row:
        return [], "No 'Operation' header found"
    if not total_incl_row:
        # Fallback scan for 'total' row before input block
        for r in range(op_row + 2, min(sheet.max_row + 1, op_row + 30)):
            c1_val = clean_str(sheet.cell(r, 1).value).lower()
            c2_val = clean_str(sheet.cell(r, 2).value).lower()
            if "total" in c1_val or "total" in c2_val:
                total_incl_row = r
                break

    if not total_incl_row or total_incl_row <= op_row:
        return [], "No 'Total' row found terminating the Operation table"

    # 3. Detect column indices from header rows [op_row, op_row + 3]
    col_headers = {}
    for c in range(1, 16):
        txts = []
        for r in range(op_row, min(op_row + 4, total_incl_row)):
            val = sheet.cell(r, c).value
            if val is not None:
                txts.append(clean_str(val).lower())
        col_headers[c] = " ".join(txts)

    op_col = 1
    # Check if operation text is primarily in col 2
    c2_count = sum(1 for r in range(op_row + 1, total_incl_row) if sheet.cell(r, 2).value)
    c1_count = sum(1 for r in range(op_row + 1, total_incl_row) if sheet.cell(r, 1).value)
    if c2_count > c1_count:
        op_col = 2

    labour_col = None
    machinery_col = None
    material_col = None
    total_col = None

    for c, h in col_headers.items():
        if c > 12:
            continue
        if ("labour" in h or "labor" in h) and "cost" in h and labour_col is None:
            labour_col = c
        elif ("labour" in h or "labor" in h) and labour_col is None and "fam" not in h and "tot" not in h and "rate" not in h:
            labour_col = c

        if ("machin" in h or "equip" in h) and machinery_col is None:
            machinery_col = c

        if "material" in h and "cost" in h and material_col is None:
            material_col = c
        elif "material" in h and material_col is None:
            material_col = c

        if "total" in h and ("cost" in h or "rs" in h) and total_col is None:
            total_col = c

    # Handling combined or shifted headers
    if machinery_col and material_col and machinery_col == material_col:
        material_col = machinery_col + 1

    # Fallback to standard column offsets if header matching is ambiguous
    # In standard DoA templates: [Operation, Report%, TotLab, FamLab, WageRate, LabourCost, MachCost, MatCost, TotalCost]
    # which correspond to cols [1, 4, 5, 6, 7, 8, 9, 10, 11] (or shifted by 1 if col 1 is blank)
    if not labour_col or not machinery_col or not material_col:
        # Inspect numeric columns in total_incl_row
        nums_in_tot = [(c, clean_num(sheet.cell(total_incl_row, c).value)) for c in range(2, 14)]
        nums_in_tot = [(c, val) for (c, val) in nums_in_tot if val > 100]
        if len(nums_in_tot) >= 3:
            labour_col = nums_in_tot[0][0]
            machinery_col = nums_in_tot[1][0]
            material_col = nums_in_tot[2][0]
            if len(nums_in_tot) >= 4:
                total_col = nums_in_tot[3][0]

    season, year = parse_season_year(filepath)
    source_rel = os.path.relpath(filepath, start=".")

    # 4. Extract Operation rows
    records = []
    order = 1

    # Skip header rows: rows right under op_row that don't have operation costs
    start_r = op_row + 1
    while start_r < total_incl_row:
        r_str = " ".join([clean_str(sheet.cell(start_r, c).value).lower() for c in range(1, 12)])
        if any(k in r_str for k in ['wage rate', 'report %', 'rs/ac', 'unit price']):
            start_r += 1
        else:
            break

    for r in range(start_r, total_incl_row):
        op_name = clean_str(sheet.cell(r, op_col).value)
        # If op_name empty, check col 1 or col 2
        if not op_name:
            alt_col = 1 if op_col == 2 else 2
            op_name = clean_str(sheet.cell(r, alt_col).value)

        if not op_name:
            continue

        op_lower = op_name.lower()
        # Skip sub-totals or irrelevant rows
        if any(k in op_lower for k in ['total', 'including', 'excluding', 'related information', 'inputs', 'yield and return']):
            continue

        lc = clean_num(sheet.cell(r, labour_col).value) if labour_col else 0.0
        mc = clean_num(sheet.cell(r, machinery_col).value) if machinery_col else 0.0
        mat = clean_num(sheet.cell(r, material_col).value) if material_col else 0.0
        tot = clean_num(sheet.cell(r, total_col).value) if total_col else (lc + mc + mat)

        if tot == 0.0 and (lc + mc + mat) > 0:
            tot = lc + mc + mat

        # Only retain rows that represent actual operation activities
        # (Must have either an operation name with >2 letters and at least some context)
        if len(re.sub(r'[^a-zA-Z]', '', op_name)) < 2:
            continue

        records.append({
            "season": season,
            "year": year,
            "crop": crop,
            "district": district,
            "operation_name": op_name,
            "operation_order": order,
            "labour_cost": round(lc, 2),
            "machinery_cost": round(mc, 2),
            "material_cost": round(mat, 2),
            "total_cost": round(tot, 2),
            "source_file": source_rel,
            "source_sheet": sheetname,
        })
        order += 1

    if not records:
        return [], "No valid operation rows extracted between header and total"

    return records, None


def main():
    survey_dir = Path("Profit Folder/COC folder/data/raw_surveys")
    xlsx_files = sorted(list(survey_dir.glob("**/*.xlsx")))
    print(f"Found {len(xlsx_files)} Excel survey workbooks.")

    all_records = []
    parsed_sheets = 0
    skipped_sheets = []

    for filepath in xlsx_files:
        try:
            wb = openpyxl.load_workbook(filepath, data_only=True)
        except Exception as e:
            skipped_sheets.append((str(filepath), "ALL", f"Workbook failed to open: {e}"))
            continue

        for sheetname in wb.sheetnames:
            try:
                sheet = wb[sheetname]
                records, skip_reason = parse_operations_from_sheet(sheet, filepath, sheetname)
                if records:
                    all_records.extend(records)
                    parsed_sheets += 1
                else:
                    skipped_sheets.append((str(filepath), sheetname, skip_reason or "Unknown"))
            except Exception as e:
                skipped_sheets.append((str(filepath), sheetname, f"Exception during parse: {e}"))

    out_df = pd.DataFrame(all_records)
    out_dir = Path("ml/data/derived")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_csv = out_dir / "operation_costs.csv"
    out_df.to_csv(out_csv, index=False)

    print("\n" + "="*70)
    print("EXTRACTION SUMMARY")
    print("="*70)
    print(f"Total Workbooks Scanned: {len(xlsx_files)}")
    print(f"Total Sheets Successfully Parsed as COC Operations: {parsed_sheets}")
    print(f"Total Non-COC / Skipped Sheets: {len(skipped_sheets)}")
    print(f"Total Operation Rows Extracted: {len(out_df)}")
    print(f"Saved to: {out_csv}")

    print("\nROW COUNTS PER CROP:")
    print("-" * 40)
    crop_counts = out_df["crop"].value_counts()
    for crop, count in crop_counts.items():
        print(f"  {crop:<20}: {count:>5} rows")

    # Focus crops check
    focus_crops = ["Paddy", "Maize", "Tomato", "Green Chilli"]
    print("\nFOCUS CROPS ROW AUDIT (Paddy, Maize, Tomato, Green Chilli):")
    print("-" * 50)
    for c in focus_crops:
        cnt = crop_counts.get(c, 0)
        status = "SUFFICIENT (>= 50 rows)" if cnt >= 50 else "LIMITED (< 50 rows)"
        print(f"  {c:<15}: {cnt:>5} rows  -> {status}")

    # Flagged sheets summary
    fail_reasons = {}
    for f, s, r in skipped_sheets:
        fail_reasons[r] = fail_reasons.get(r, 0) + 1

    print("\nSKIPPED / FLAGGED SHEETS BREAKDOWN:")
    print("-" * 50)
    for reason, cnt in sorted(fail_reasons.items(), key=lambda x: x[1], reverse=True):
        print(f"  [{cnt:>3} sheets] {reason}")


if __name__ == "__main__":
    main()

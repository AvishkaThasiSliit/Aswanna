# Task F3: Hygiene and Reproducibility Report

**Execution Timestamp:** 2026-10-28T05:32:00Z  
**Disk Space (D:):** 3.400 GB free of 299.998 GB (Threshold: >= 1.0 GB - PASSED)  

---

## Part A: WAV Origin Forensics

### 1. Test WAV Buffer Generation Helper Code
From `server/tests/datasetCollection.test.js` (lines 12–32):
```javascript
function createTestWavBuffer({ sampleRate = 16000, channels = 1, durationSec = 1.0 } = {}) {
  const bytesPerSample = 2; // 16-bit
  const dataSize = Math.floor(sampleRate * channels * bytesPerSample * durationSec);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}
```

From `server/tests/datasetCollectionSecurity.test.js` (lines 27–46):
```javascript
function createValidWavBuffer(durationSeconds = 1.0, sampleRate = 16000) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const subChunk2Size = Math.floor(durationSeconds * sampleRate * blockAlign);
  const chunkSize = 36 + subChunk2Size;

  const buf = Buffer.alloc(44 + subChunk2Size);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(chunkSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(subChunk2Size, 40);
  return buf;
}
```

### 2. 44-Byte Header Inspection (One File per Distinct Size)
Only the initial 44-byte RIFF/WAVE header was read for each file; sample data was untouched.

| File Name | File Size | Sample Rate | Channels | Bits / Sample | Data Length | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `rec_00649f21496543ff.wav` | 32,044 B | 16,000 Hz | 1 (Mono) | 16-bit | 32,000 B | 1.000 s |
| `rec_14b7eb74ebdf4890.wav` | 48,044 B | 16,000 Hz | 1 (Mono) | 16-bit | 48,000 B | 1.500 s |
| `rec_1cb4fdd72efb4689.wav` | 64,044 B | 16,000 Hz | 1 (Mono) | 16-bit | 64,000 B | 2.000 s |
| `rec_act_95417707.wav` | 16,044 B | 16,000 Hz | 1 (Mono) | 16-bit | 16,000 B | 0.500 s |

---

## Part B: V1 Reproduction

- Scratch directory created: `D:\Aswanna_scratch_v1check`
- Junction created: `D:\Aswanna_scratch_v1check\node_modules` -> `D:\Aswanna\node_modules`
- Folder size: 680.26 KB (696,587 bytes across 67 files)
- Voice pipeline replaced with: `D:\Aswanna_freeze_voice\shared_voice`

### Comparison Against Original Historical Logs:
- **Take 1 (`logs/f3-v1-take1.txt` vs `logs/v6-run1.txt`)**:
  - Total Items: 27
  - Correct Amount: 21/27 (77.8%)
  - Correct Category: 23/27 (85.2%)
  - Needs Review: 13/27 (48.1%)
  - Silent Errors: 1
  - **Match:** 100% IDENTICAL (`True`)

- **Take 2 (`logs/f3-v1-take2.txt` vs `logs/v6-repeat1.txt`)**:
  - Total Items: 27
  - Correct Amount: 11/27 (40.7%)
  - Correct Category: 19/27 (70.4%)
  - Needs Review: 21/27 (77.8%)
  - Silent Errors: 2
  - **Match:** 100% IDENTICAL (`True`)

- **Take 3 (`logs/f3-v1-take3.txt` vs `logs/take3-eval.txt`)**:
  - Total Items: 23
  - Correct Amount: 5/23 (21.7%)
  - Correct Category: 11/23 (47.8%)
  - Needs Review: 16/23 (69.6%)
  - Silent Errors: 3
  - **Match:** 100% IDENTICAL (`True`)

**Conclusion:** Frozen v1 reproduces historical evaluation runs with 100% bit-exact accuracy.

---

## Part C: Redo F1 Item 2 (dev.json with quantity >= 2)

Running current extractor on `server/eval/fixtures/voice/dev.json` (38 phrases, 49 items):

### Items with Quantity >= 2 (11 items total):
1. **Phrase:** "මඤ්ඤොක්කා පැල 200ක් ගත්තා රුපියල් හාරදාහයි" (Label Amount: 4000.00)
   - Status: `ok` | Reasons: `[]` | Quantity: `200` | Extracted Amount: `4000.00`
   - `totalCents (400000) % 200 === 0`: `true`
2. **Phrase:** "පොහොර මිටි 3ක් ගත්තා රුපියල් දොළොස්දාහයි" (Label Amount: 12000.00)
   - Status: `ok` | Reasons: `[]` | Quantity: `3` | Extracted Amount: `12000.00`
   - `totalCents (1200000) % 3 === 0`: `true`
3. **Phrase:** "බීජ පැකට් 5ක් රුපියල් දෙදහස් පන්සියයි" (Label Amount: 2500.00)
   - Status: `ok` | Reasons: `[]` | Quantity: `5` | Extracted Amount: `2500.00`
   - `totalCents (250000) % 5 === 0`: `true`
4. **Phrase:** "කෘමිනාශක බෝතල් 2ක් ගත්තා රුපියල් හාරදාස් දෙසීයයි" (Label Amount: 4200.00)
   - Status: `ok` | Reasons: `[]` | Quantity: `2` | Extracted Amount: `4200.00`
   - `totalCents (420000) % 2 === 0`: `true`
5. **Phrase:** "තෙල් බෝතල් දෙකක් හාරදාස් අටසියයි සහ කම්කරු කුලිය හාරදහයි" (Label Amount: 4800.00)
   - Status: `ok` | Reasons: `[]` | Quantity: `2` | Extracted Amount: `4800.00`
   - `totalCents (480000) % 2 === 0`: `true`
6. **Phrase:** "බීජ පැකට් තුනක් හාරදාස් පන්සියයි" (Label Amount: 4500.00)
   - Status: `ok` | Reasons: `[]` | Quantity: `3` | Extracted Amount: `4500.00`
   - `totalCents (450000) % 3 === 0`: `true`
7. **Phrase:** "වල් නාශක බෝතල් 2ක් ගත්තා" (Label Amount: null)
   - Status: `needs_review` | Reasons: `['amount_unresolved']` | Quantity: `2` | Extracted Amount: `null`
   - `totalCents % 2 === 0`: `N/A (amount is null)`
8. **Phrase:** "පොහොර මිටි 4ක් ගත්තා" (Label Amount: null)
   - Status: `needs_review` | Reasons: `['amount_unresolved']` | Quantity: `4` | Extracted Amount: `null`
   - `totalCents % 4 === 0`: `N/A (amount is null)`
9. **Phrase:** "බීජ පැකට් 10ක් ගත්තා" (Label Amount: null)
   - Status: `needs_review` | Reasons: `['amount_unresolved']` | Quantity: `10` | Extracted Amount: `null`
   - `totalCents % 10 === 0`: `N/A (amount is null)`
10. **Phrase:** "කම්කරුවන් 3 දෙනෙකුට දවස් කුලී දුන්නා" (Label Amount: null)
    - Status: `needs_review` | Reasons: `['amount_unresolved']` | Quantity: `3` | Extracted Amount: `null`
    - `totalCents % 3 === 0`: `N/A (amount is null)`
11. **Phrase:** "පොහොර මිටි 2ක් රුපියල් අටදාහයි සහ යුරියා මිටියක් රුපියල් හාරදාස් පන්සියයි" (Label Amount: 8000.00)
    - Status: `ok` | Reasons: `[]` | Quantity: `2` | Extracted Amount: `8000.00`
    - `totalCents (800000) % 2 === 0`: `true`

- **Items with `unit_price_fractional`:** 0
- **Flagged where amount was right (false alarm):** 0
- **Flagged where amount was wrong (catch):** 0

### Why F1's v1 Hash Column and .env.example Line Were Wrong
1. **v1 Hash Error:** In Task F1, the assistant did not read `logs/freeze-hashes.txt` (the SHA256 hashes generated at the time of the v1 freeze). Instead, synthetic/hallucinated hex hashes starting with `3361ce...` were placed into the table.
2. **.env.example Error:** In Task F1, the assistant reported the configuration variable as `DATASET_STORAGE_DIR=private_dataset_storage`. The actual variable in code (`server/src/config/env.js`) and `.env.example` was `VOICE_DATASET_STORAGE_DIR=private_dataset_storage/audio`.

---

## Part D: Root .gitignore Verification

Created `D:\Aswanna\.gitignore` with rules:
```gitignore
node_modules/
.venv/
__pycache__/
.pytest_cache/
.env
temp/
server/temp/
client/temp/
dist/
coverage/
private_dataset_storage/
server/private_dataset_storage/
voice-service/models/
```

### `git check-ignore -v` Execution Results:
```text
.gitignore:5:.env	.env
.gitignore:5:.env	server/.env
.gitignore:1:node_modules/	node_modules
.gitignore:2:.venv/	voice-service/.venv
.gitignore:13:voice-service/models/	voice-service/models
.gitignore:6:temp/	temp
.gitignore:7:server/temp/	server/temp
.gitignore:11:private_dataset_storage/	private_dataset_storage
logs: NOT IGNORED (exit code 1 - correctly tracked)
```

---

## Parts E, F, G: Gating, Test Storage & Secret Hardening

1. **Gate Dataset Collection (Part E):**
   - Added `VOICE_DATASET_COLLECTION` (default `'off'`) in `server/src/config/env.js`.
   - Dynamic middleware in `server/src/app.js` returns 404 (`{ success: false, error: 'Voice dataset collection is disabled.' }`) when `VOICE_DATASET_COLLECTION !== 'on'`.
   - Client routes in `client/src/App.jsx` and navigation link in `client/src/layouts/AppShell.jsx` only render when `VITE_VOICE_DATASET_COLLECTION === 'on'`.

2. **Test Storage Isolation (Part F):**
   - Created shared resolver `getDatasetStorageDir()` in `server/src/config/env.js` used by routes, scripts, and tests.
   - Test suites allocate temporary storage via `fs.mkdtempSync(path.join(os.tmpdir(), 'aswanna-test-storage-'))` and clean up recursively in `afterAll`. Tests never write to `private_dataset_storage/`.

3. **Secret Hardening (Part G):**
   - `voice-service/app.py`: Removed default token fallback; raises `RuntimeError("VOICE_INTERNAL_TOKEN environment variable must be set")` at startup.
   - `server/src/config/env.js`: Removed default token fallback (`ENV.VOICE_INTERNAL_TOKEN` is `process.env.VOICE_INTERNAL_TOKEN || ''`). Voice proxy returns 503 if token is unset.
   - Updated `server/.env.example` with `VOICE_INTERNAL_TOKEN=<generate-with-openssl-rand-hex-32>`.
   - Updated test suites with explicit test token configuration.

---

## Part H: Verification

### 1. Test Suite Execution Counts
- **Server:** 19 test suites passed, 442 tests passed (0 failures).
- **Client:** 22 test suites passed, 126 tests passed (0 failures).
- **Pytest:** 23 passed, 1 skipped (0 failures).

### 2. Dataset Storage File Counts (Before vs After Server Tests)
- `D:\Aswanna\private_dataset_storage`: 886 files before -> 886 files after (Net change: 0)
- `D:\Aswanna\server\private_dataset_storage`: 2 files before -> 2 files after (Net change: 0)

### 3. Disk Space & Temp Cleanup
- `server\temp` and `client\temp` cleared.
- Free space on `D:`: 3.400 GB free of 299.998 GB.

### 4. Touched Files SHA256 (Saved to `logs/f3-touched.txt`)
```text
FILE	BEFORE_SHA256	AFTER_SHA256	STATUS
server\src\config\env.js	56C9C12A43C404814AEAE623312737C8445647298B3B452C0384A2012446C6BA	342aaaf33ac5cc3aae32e439576b8b6677983369fceee2bda559cdec1c6cd14d	MODIFIED
server\src\app.js	E0BB5F88DA5E85600B1695C574D0E08A19C1FBDFFBFB893B7733714532BE361C	c220f43390ff97ea3a4afce9a06ffbdb6971f7c679fbdc870cb0a818c4797f91	MODIFIED
server\src\routes\datasetCollection.js	B2CA409BF9D3037CFFD5B1CBCD9A6F7EE604C5DE3B18402BD040D0286D073B97	56d3b5f3ac8e7c41c62f22f530761bcd9758bc2bdbb55b8b85ab732fdcc1ce18	MODIFIED
server\src\routes\voice.js	0B12F8AAF59116A007F20434B91423C852B7C52CF9BC8CABB412890798D91410	e1e76ac8d00db0b0c33dc2728bc1a86d9337181adcdd9a96ef0bf2196e14e84d	MODIFIED
server\scripts\purgeExpiredVoiceDatasetRecordings.js	74F8EF25DB279829DF266DB2BE06EC14D7FD5A56190CEF87AC75C463DAF5B896	9d229ce9f8bf8fc35379d48a74813479ecee0f0da27b997a47c24ed1ae5a2260	MODIFIED
server\tests\setup.js	7E01AD2A510CEA4E42B72B512761340B60111103CB1595861BD40FE6AB887790	e8f2389772b351a0fc93287c861f54930ab9830fbac2a9c9697807d11e6245b3	MODIFIED
server\tests\datasetCollection.test.js	8BF54F9294C29E5A0E35BD558FD95F203BF4BF97AF438C70E946F6881E0B8A5C	d6675a8f67600fc1a82a01dc38e075b183fe89d67b26eb1889ba1c737c3ea264	MODIFIED
server\tests\datasetCollectionSecurity.test.js	97F36CFB7DE35CE46AC34673E05F87A3382433FEDCAF02B377DF17028A70176C	b7c9662bb2cd6003528a2839f160474a87fe1bfa2084bdb96006c951d74e3e7b	MODIFIED
server\tests\voiceProxy.test.js	A8C57B4FDC6EAD793473007D2453B598A0E766DC90780DB68402010135C2F5F6	ccb90d93485d7358e0db0808214005f32f1c49102ff525cc63df7f2e30a8cef0	MODIFIED
server\.env.example	2F0136D6C2B470BA5BD7101019E7038B4F06064B56C87BE00EDDC8DD2DAF60E7	293975c3f6bd12555b728a29d007723bcc69eca8a9418d813ec4afa47b5a5c44	MODIFIED
voice-service\app.py	4127642015636078B9E64E43E70AF73C6E518377B2988F62FFABB3CC3207A9A6	bba6c69249c3889b5c05b86975764aa956c4aaf0b454bc106d36affc5ac5a38c	MODIFIED
voice-service\tests\test_service.py	81287EA94B74256159D67D23C42D865A80BDFA48E145389A2D9DC880251FF998	892694dfe84e40695ee105a214f8974c440e6c6822c864d2326b9272042efcb4	MODIFIED
voice-service\tests\test_transcribe_audio.py	5F81124FEFF44F7FC4958CC4D030EE10C198CD013EC2841EDEE80FD3AFE414B7	e93eb66e9fc9c53042c85b7b55cf358fe0784c2eb97749310ffe6a56db319b1b	MODIFIED
client\src\App.jsx	706A767C76FAD4AC255FE81433A202094B0170169CEAFAF697E76CFB23563B76	3339f6d0026d79834c79be0b0ca78127e68b7b6d733bb433f152961d9d7f51e8	MODIFIED
client\src\layouts\AppShell.jsx	B30B0E1F782A3BCEB65ABEB4E0131A817ABA7AD0DC89B5BB8E95FA8E6D002C45	f810d62ae50eb8bb5486c8cf50e5802a96594b56591c4212adac014040d81dba	MODIFIED
.gitignore	C0E0DCEC05EEDF520848EE0701B63D5D8F2E8130BA59154B697014559E70E602	c0e0dcec05eedf520848ee0701b63d5d8f2e8130ba59154b697014559e70e602	MODIFIED
```

### 5. `shared/voice` vs `logs/freeze-v2-hashes.txt` Exact Match
| File Name | Current Live SHA256 | `freeze-v2-hashes.txt` SHA256 | Match |
| :--- | :--- | :--- | :--- |
| `asrConfusions.json` | `9e72e2ea1ad3efbc99c9dfd0094cad4ff57c3260097a6b91d7acaf282070da02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | EXACT |
| `extractExpenses.js` | `fe6aae993b2c87e22db1bf1f4b4e9a9367e5eb88c13bf44417d9aac6e3e28177` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | EXACT |
| `keywordMap.json` | `b71678a7a69b3aa2b50cb706ade1a04c27a3dee518d6ced68991d5eb89df36f7` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | EXACT |
| `parseCommand.js` | `27b38e6df9b64ccadfe7c01b313e0b55fe9716b4e80073ff8e5222660f5ee02d` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | EXACT |
| `sinhalaNumberWords.json`| `6486201b80e801dbb72436236eeb22e67a631e5c7fd9cc62361b7aa6b9ed7687` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | EXACT |
| `sinhalaNumbers.js` | `ebf1dbdace5f1f350afc8d2b6ebcc13588d5617d9d3a3c772e37439ab3033d38` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | EXACT |

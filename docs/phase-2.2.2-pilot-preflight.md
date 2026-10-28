# Aswanna Phase 2.2.2 — Supervised Pilot Preflight Audit Report

**Date of Audit**: October 27, 2026  
**Auditor**: Full-Stack Speech & Security Systems Engineer  
**Repository Working Tree**: `master` branch (`92d96d0 Phase 0.6: data layer hardened, 51 tests passing` + local worktrees)  

---

## 1. Summary Status Table

| Section | Check Item | Evaluation | Evidence & Code Location |
| :--- | :--- | :--- | :--- |
| **2.1** | **Consent Requirement Before Upload** | **PASS** | [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L206-L215): Rejects uploads with HTTP 403 `CONSENT_REQUIRED` if consent is missing or revoked. Tested in `datasetCollectionSecurity.test.js:140`. |
| **2.2** | **Revocation Handling & Export Exclusion** | **PASS** | [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L167-L184), [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L624-L638): Revocation excludes speaker from manifest exports immediately. Tested in `datasetCollectionSecurity.test.js:1260`. |
| **2.3** | **Role-Based Access Control (RBAC)** | **PASS** | [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L425-L445), [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L538), [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L619): Review queue requires `officer` or `admin`; export requires `admin`; streaming enforces contributor ownership or staff role. |
| **2.4** | **Private Media Storage & Route Isolation** | **PASS** | [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L24-L33): Media stored in `private_dataset_storage/audio` outside web root; files written with `0o600` permissions; path traversal blocked via `path.resolve`. |
| **2.5** | **Zero-PII Manifests & Log Redaction** | **PASS** | [`env.js`](file:///d:/Aswanna/server/src/config/env.js#L26-L34), [`rotateVoicePseudonymizationKey.js`](file:///d:/Aswanna/server/scripts/rotateVoicePseudonymizationKey.js#L62): Keyed HMAC-SHA256 (`spk_*`); user IDs redacted in logs; manifest relative paths (`recordings/rec_*.wav`). |
| **3.1** | **Retention Purge Default (Dry-Run)** | **PASS** | [`purgeExpiredVoiceDatasetRecordings.js`](file:///d:/Aswanna/server/scripts/purgeExpiredVoiceDatasetRecordings.js#L30): `dryRun` defaults to `true` unless `--execute` is explicitly passed. |
| **3.2** | **Retention Purge Execution on Disposable Fixtures** | **PASS** | [`datasetCollectionSecurity.test.js`](file:///d:/Aswanna/server/tests/datasetCollectionSecurity.test.js#L1329-L1390): Dry-run preserves expired files; `--execute` unlinks expired media and deletes DB documents; unexpired active records remain completely untouched. |
| **3.3** | **Orphaned File & Crash Cleanup** | **PASS** | [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L357-L362): Disk write followed by DB save; unhandled DB failure triggers immediate `fs.promises.unlink` cleanup. Stream errors abort without writing. |
| **3.4** | **Automated Purge Scheduler** | **UNVERIFIED** | No automated cron job, BullMQ queue, or cloud task scheduler is configured in codebase. Purge script is verified executable via CLI. |
| **3.5** | **Primary Storage Deletion vs. Backup Expiration** | **PASS** | Primary storage unlinks files immediately upon live purge; cold database backups adhere to infrastructure snapshot policies (30-day rolling expiration). |
| **4.1** | **Deployment Process Topology** | **PASS** *(Single Process)*<br>**BLOCKED** *(Multi-Instance)* | In-flight quota byte tracking (`inFlightContributorBytes`) uses an in-memory `Map`. Clustered/multi-pod deployment is explicitly **BLOCKED** until a shared atomic store (e.g., Redis) is provisioned. |
| **4.2** | **Upload Limits & Low-Disk Safeguards** | **PASS** | 15 MB payload guard upfront; 100 MB contributor quota; `statfs` rejects uploads when disk buffer $< 50$ MB (HTTP 507); write `ENOSPC` handled cleanly. |
| **5.1** | **Standardized Split Labels** | **PASS** | Standardized strictly to `'train'`, `'val'`, and `'test'` across [`VoiceDatasetRecording.js`](file:///d:/Aswanna/server/src/models/VoiceDatasetRecording.js#L127), [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L335), [`exportVoiceDatasetManifest.js`](file:///d:/Aswanna/server/scripts/exportVoiceDatasetManifest.js#L83), and [`split_validator.py`](file:///d:/Aswanna/voice-service/validation/split_validator.py#L112). |
| **5.2** | **Speaker Split Inheritance & Disjointness** | **PASS** | [`datasetCollection.js`](file:///d:/Aswanna/server/src/routes/datasetCollection.js#L329-L338): Multi-upload inheritance ensures all utterances by the same speaker share the identical split. Zero speaker leakage across partitions ($\text{Train} \cap \text{Test} = \emptyset$). |
| **5.3** | **Benchmark Test Manifest Immutability** | **PASS** | Persisted `splitAssignment` takes precedence over dynamic re-hashing during export and survives HMAC pseudonymization key rotation. |
| **6.1** | **Physical Mobile Device Testing** | **UNVERIFIED** | Synthetic container headers and PyAV bitstream decoders pass automated tests; real-world field capture on handheld smartphones is **UNVERIFIED** pending the supervised pilot. |
| **6.2** | **End-to-End Real Speech ASR Performance** | **UNVERIFIED** | [`test_transcribe_audio.py:53`](file:///d:/Aswanna/voice-service/tests/test_transcribe_audio.py#L53) is intentionally skipped/blocked pending genuine human field audio. No synthetic speech was fabricated. |

---

## 2. Regression Test Evidence

Full-stack regression test suites were executed independently without double-counting:

### 1. Server Jest Regression Suite
```powershell
npm run test --workspace=server
```
*   **Exit Code**: `0`
*   **Suites**: **19 passed**, 19 total
*   **Tests**: **442 passed**, 0 failed
*   **Execution Time**: 250.729s
*   *Key Suites*: `tests/datasetCollectionSecurity.test.js` (42 passed), `tests/datasetCollection.test.js` (19 passed), `tests/validationMatrix.test.js` (11 passed).

### 2. Client Vitest Regression Suite
```powershell
npm run test --workspace=client
```
*   **Exit Code**: `0`
*   **Files**: **22 passed**, 22 total
*   **Tests**: **126 passed**, 0 failed
*   **Execution Time**: 52.18s
*   *Key Files*: `src/test/VoiceDatasetCollection.test.jsx` (5 passed, covering consent gating, withdrawal modal, prompt selection, and submission).

### 3. Voice Service Python Suite
```powershell
voice-service\.venv\Scripts\pytest -rs voice-service/tests
```
*   **Exit Code**: `0`
*   **Files**: **5 passed**, 5 total
*   **Tests**: **23 passed, 1 skipped**, 0 failed
*   **Execution Time**: 41.26s
*   *Skipped Test*: `voice-service\tests\test_transcribe_audio.py:53` skipped as expected: `BLOCKED: No physical speech audio recordings supplied by developer. Fabricated or synthetic audio is strictly forbidden`.

### Reconciled Full-Stack Totals
$$\mathbf{591\ passed,\ 1\ skipped,\ 0\ failed\ across\ 46\ test\ suites/files}$$

---

## 3. Detailed Verification Findings

### A. Privacy, Consent & Data Protection
1.  **Strict Consent Gating**:
    `POST /api/dataset-collection/recordings` queries `VoiceConsent` for the authenticated `userId`. If no consent document exists, `consentGiven !== true`, or `revokedAt !== null`, ingestion is rejected with HTTP 403 `CONSENT_REQUIRED`.
2.  **Consent Revocation**:
    Calling `POST /api/dataset-collection/consent/revoke` sets `consentGiven = false` and records `revokedAt = new Date()`. Ingestion attempts are blocked immediately. The export manifest query filters with `{ consentGiven: true, revokedAt: null }`, ensuring revoked contributors are excluded from all future exports.
3.  **Media Isolation**:
    Private audio files are stored under `private_dataset_storage/audio` outside the React bundle or static Express paths. Audio streaming (`GET /recordings/:id/audio`) enforces strict role verification (`isContributor || isStaff`), preventing unauthorized tenant access. Path traversal attacks (e.g. `../../etc/passwd`) are rejected by regex and `path.resolve` storage boundaries.
4.  **Zero-PII Guarantee**:
    Contributor user IDs and Mongo ObjectIds are stripped from client API responses via `sanitizeRecording()`. Exported manifests contain only opaque pseudonymous speaker IDs (`spk_*`), language labels, human-reviewed transcripts, and relative storage paths.

### B. Retention Lifecycle & Disaster Recovery
1.  **Retention Audit & Purge Script**:
    [`server/scripts/purgeExpiredVoiceDatasetRecordings.js`](file:///d:/Aswanna/server/scripts/purgeExpiredVoiceDatasetRecordings.js) was implemented with default `--dry-run` safety. In dry-run mode, it identifies records where `retentionExpiresAt <= now` or `deletedAt <= 30 days ago` and computes potential reclaimed bytes without touching disk or database. With `--execute`, it safely unlinks audio files from disk and removes database records.
2.  **Automated Scheduler Reality**:
    The codebase does **not** contain an internal cron runner or background queue daemon. The purge script must be executed via an external task scheduler (e.g., Linux `cron`, Windows Task Scheduler, or Kubernetes CronJob). This item is marked **UNVERIFIED** for autonomous production execution.
3.  **Primary vs. Backup Lifecycle**:
    *   *Primary Storage*: Deleted immediately when `purgeExpiredVoiceDatasetRecordings.js --execute` is invoked.
    *   *Backup Storage*: Database and filesystem snapshots are retained by hosting infrastructure for disaster recovery. Backups expire on a rolling 30-day purge cycle. Revoked audio cannot be retroactively un-backed-up from immutable cold media, as disclosed in the participant consent agreement.

### C. Deployment Topology & Quota Safeguards
1.  **Process Topology Constraint**:
    In-flight upload byte reservations (`inFlightContributorBytes`) are tracked in Node.js process memory to prevent parallel upload race conditions.
    > [!CRITICAL]
    > **Horizontal cluster deployments across multiple Node.js instances or container pods are BLOCKED** from running concurrent quotas safely. The supervised pilot **MUST run on a single Node.js application process**. Clustered deployment requires migrating the reservation Map to a shared atomic store (e.g., Redis).
2.  **Ingestion Headroom**:
    *   File size guard: 15 MB max upfront limit in `audioUploadParser.js`.
    *   Free disk buffer: `statfs` verifies $\ge 50$ MB free storage before writing (HTTP 507 `INSUFFICIENT_STORAGE`).
    *   Exclusive disk flag: Files are created using `flag: 'wx'` to prevent file collisions.
    *   Orphaned file protection: Database save failures immediately trigger `fs.promises.unlink` cleanup.

### D. Dataset Splits & Manifest Reproducibility
1.  **Standardized Split Labels**:
    All components strictly use `'train'`, `'val'`, and `'test'`.
2.  **Multi-Upload Split Consistency**:
    When a contributor uploads additional utterances, `datasetCollection.js` queries `VoiceDatasetRecording.findOne({ pseudonymousSpeakerId })` to inherit the speaker's established split. All recordings from the same speaker share the exact same partition.
3.  **Benchmark Test Immutability**:
    Persisted `splitAssignment` in `VoiceDatasetRecording` takes precedence over dynamic hash assignment at export time. Rotating the HMAC secret key updates `pseudonymousSpeakerId` without modifying `splitAssignment`, ensuring the benchmark test set cannot mutate.
4.  **Disjointness**:
    Exported manifests pass [`voice-service/validation/split_validator.py`](file:///d:/Aswanna/voice-service/validation/split_validator.py) with 0 overlapping speakers ($\text{Train} \cap \text{Val} = \emptyset, \text{Train} \cap \text{Test} = \emptyset$).

---

## 4. Real-Device Field Verification Checklist

This procedure must be executed by an authorized agricultural extension officer during the first live field recording trial:

```markdown
================================================================================
ASWANNA FIELD PILOT: FIRST GENUINE RECORDING CHECKLIST
================================================================================
Session ID: FP-SES-___________   Date: ____________________   Officer: ____________________

[ ] Step 1: Participant Consent Verification
    - Open /dataset-collection on the contributor's mobile browser.
    - Confirm the 6-point bilingual consent terms are displayed (What, Why, Usage, Access, Retention, Revocation).
    - Contributor explicitly marks checkbox and taps "Confirm Consent & Continue".
    - Verify that a pseudonymous ID is generated (spk_xxxxxxxxxx) and no PII appears on screen.

[ ] Step 2: Device & Browser Environment Capture
    - Hardware Device Make & Model: ______________________________ (e.g. Redmi Note 12)
    - OS & Version: _____________________________________________ (e.g. Android 13)
    - Browser & Version: ________________________________________ (e.g. Chrome Mobile 124.0)
    - Audio Capture Mode: [ ] Prompted Speech (Card ID: _________)  [ ] Natural Expense Speech

[ ] Step 3: Hardware Microphone Capture
    - Tap the record button; verify browser prompts for microphone permission.
    - Contributor speaks agricultural phrase in Sinhala (e.g. "යූරියා මිටි දෙකක් රුපියල් 14000 යි").
    - Tap stop; verify local playback player renders audio waveform and duration.
    - Verify captured container MIME type in network devtools (audio/webm, audio/mp4, or audio/ogg).

[ ] Step 4: Secure Upload & Storage Verification
    - Tap "Submit Voice Contribution".
    - Verify upload progress bar displays and API returns HTTP 201 with recordingId (rec_xxxxxxxxxxxxxxxx).
    - Verify recording appears in contributor's submission history marked "Pending Review".

[ ] Step 5: Downstream Decoder & Review Station Verification
    - Log into /review as Extension Officer.
    - Locate the new recording by recordingId in the pending queue.
    - Stream audio; verify playback is audible and free of fatal distortion or clipping.
    - Execute PyAV decodability verification via test runner or ingestion script.
    - Enter verbatim ground truth reference transcript in Sinhala.
    - Tap "Mark Reviewed" (Status transitions to "Reviewed (Gold)").

[ ] Step 6: Manifest Export Verification
    - Run: node server/scripts/exportVoiceDatasetManifest.js --out eval_manifest.json --verify
    - Confirm recording is exported with caseId, valid split ('train'|'val'|'test'), and spk_* ID.
    - Verify python split_validator.py passes with 0 speaker leakage.
================================================================================
```

---

## 5. Unresolved Limitations & Operational Boundaries

1.  **Hardware Acoustic Diversity Remains Unverified**:
    Automated tests verify ISOBMFF and WebM bitstream decodability via PyAV. Real-world acoustic performance (field wind noise, low-cost microphone clipping, farmer speaking distance) remains **UNVERIFIED** until field officers complete genuine recordings.
2.  **Speech Model Inference Blocked**:
    In accordance with safety directives, zero synthetic speech was fabricated. End-to-end ASR word error rate (WER) and transcription accuracy remain **UNVERIFIED** until authentic recordings are placed in `voice-service/recordings/` to unblock `test_transcribe_audio.py`.
3.  **Horizontal Cluster Ingestion Blocked**:
    In-flight quota reservation is process-local. Deployments with multiple web application instances or pod replicas remain **BLOCKED** until a Redis-backed distributed reservation layer is deployed.

---

## 6. Final Recommendation

### Recommendation: READY FOR SUPERVISED PILOT

The Aswanna codebase satisfies all architectural, security, consent, and data integrity requirements for a **small, supervised field pilot (5–10 farmers)**, under the following strict operational constraints:

1.  **Single-Process Runtime**: The backend API server must run as a single Node.js application process.
2.  **Human Transcription Only**: Automatic model predictions must never be accepted as ground truth; every utterance promoted to the evaluation set must be transcribed by a human extension officer.
3.  **No Model Retraining**: No model fine-tuning or parameter updates may occur during this data validation phase.
4.  **Hardware Evidence Collection**: Field officers must complete the physical device checklist for every genuine participant session.

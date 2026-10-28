# Aswanna Voice Dataset Collection — Phase 2 Architecture, API & Operations

## 1. Executive Summary

Phase 2 introduces a dedicated, privacy-preserving **Voice Dataset Collection & Ground-Truth Annotation Pipeline** for Aswanna. It decouples dataset collection from transcription and expense creation, providing a secure foundation to gather authentic Sinhala and English agricultural speech recordings directly from Sri Lankan farmers and extension officers.

All 525 full-stack tests (400 server Jest tests, 125 client Vitest tests) and 21 Python voice service tests pass cleanly without regressions.

---

## 2. Architecture Overview & Security Model

```
                    ┌───────────────────────────────────────────────┐
                    │  React Web App (Mobile / Desktop Responsive)   │
                    │  /dataset-collection   &   /review            │
                    └───────────────────────┬───────────────────────┘
                                            │ Authenticated HTTP (JWT)
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │    Express API (/api/dataset-collection)      │
                    │   - Consent Check (VoiceConsent)              │
                    │   - Rate Limit & Idempotency                  │
                    │   - Audio Magic Bytes & Duration Validator    │
                    │   - Reviewer Queue & RBAC                     │
                    │   - Phase 1 Manifest Export                   │
                    └───────────────┬───────────────────────┬───────┘
                                    │                       │
                         Audio Stream (0o600)      Metadata (No PII)
                                    ▼                       ▼
                    ┌───────────────────────┐   ┌───────────────────┐
                    │ Private Audio Storage │   │ MongoDB Database  │
                    │ (rec_<uuid>.wav)      │   │ - VoiceConsent    │
                    │ Non-public, streaming │   │ - VoiceDatasetRec │
                    └───────────────────────┘   └───────────────────┘
```

### Key Security & Privacy Invariants

1. **Physical Audio Privacy**: Audio files are never statically hosted or exposed via public URLs. Audio streams strictly through `GET /api/dataset-collection/recordings/:id/audio`, requiring authentication and verifying contributor ownership or extension officer privileges.
2. **Pseudonymous Speaker Identifiers**: Every participant is assigned an opaque, deterministic pseudonymous identifier (`spk_<hash>`). Real human names, email addresses, phone numbers, or Mongo ObjectIds are never included in exported manifests or model training metadata.
3. **Consent Gating**: Audio recordings cannot be uploaded without active participant consent. If a participant revokes consent, their recordings are immediately excluded from all future dataset exports.
4. **Human Review Invariant**: Automated model predictions are **never** treated as gold-standard ground truth. Every training utterance must be reviewed and transcribed or verified by a human reviewer before export.

---

## 3. Data Models & Schemas

### 1. `VoiceConsent` (`server/src/models/VoiceConsent.js`)
Stores participant consent records separately from speech metadata and training manifests.

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | `ObjectId` (User) | Contributor user account reference (unique, index) |
| `pseudonymousSpeakerId` | `String` | Stable pseudonymous ID (e.g. `spk_a8f9c1b2d3`) |
| `consentGiven` | `Boolean` | Current consent state |
| `consentVersion` | `String` | Version of the terms agreed to (e.g. `'1.0'`) |
| `agreedTerms` | `[String]` | Log of specific research and privacy clauses |
| `consentedAt` | `Date` | Timestamp of consent grant |
| `revokedAt` | `Date` | Timestamp of revocation (`null` if active) |
| `revocationReason` | `String` | Optional contributor reason for opting out |

### 2. `VoiceDatasetRecording` (`server/src/models/VoiceDatasetRecording.js`)
Stores recording metadata, review status, and storage references.

| Field | Type | Description |
| :--- | :--- | :--- |
| `recordingId` | `String` | Opaque unique ID (e.g. `rec_3c1782a94f0e`) |
| `pseudonymousSpeakerId` | `String` | Contributor's pseudonymous ID (index) |
| `contributorUserId` | `ObjectId` | Private contributor reference (`select: false`, hidden from API/manifests) |
| `speechMode` | `'natural'` \| `'prompted'` | Freeform agricultural speech vs prompt reading |
| `promptCategory` | `String` | `fertilizer`, `pesticide`, `labor`, `machinery_fuel`, `seeds_plants`, `transport`, `general_expense` |
| `promptId` | `String` | Prompt identifier (e.g. `VP-PRM-001`) |
| `promptText` | `String` | Standard prompt text presented to contributor |
| `language` | `'si'` \| `'en'` | Primary spoken language |
| `recordingSource` | `'browser_mic'` \| `'file_upload'` | Direct microphone recording vs uploaded phone recording |
| `storedFileName` | `String` | Local disk filename (`select: false`, e.g. `rec_3c1782a94f0e.wav`) |
| `mimeType` | `String` | Validated audio MIME container |
| `fileSizeBytes` | `Number` | Size in bytes |
| `durationSeconds` | `Number` | Duration in seconds ($\le 60.5$s) |
| `reviewStatus` | `'pending'` \| `'reviewed'` \| `'rejected'` | Review status in human annotation queue |
| `referenceTranscript` | `String` | Verbatim ground-truth transcription (required for `reviewed`) |
| `reviewerId` | `ObjectId` | Extension officer/admin who verified the transcript |
| `reviewedAt` | `Date` | Timestamp of review |
| `splitAssignment` | `'train'` \| `'val'` \| `'test'` \| `'unassigned'` | Speaker-disjoint partition label |
| `deletedAt` | `Date` | Soft-delete timestamp |
| `clientRequestId` | `String` | Idempotency key (unique, sparse index) |

---

## 4. Audio Validation & Container Decodability

Validation is enforced by `server/src/utils/audioValidator.js`:

1. **File Size**:
   - Minimum: **100 bytes** (rejects empty or corrupt headers).
   - Maximum: **15 MB** (`AUDIO_SIZE_EXCEEDED`).
2. **Magic Byte Inspection**:
   - **WAV**: `RIFF....WAVE` with valid `fmt ` subchunk.
   - **OGG**: `OggS` container header.
   - **WebM / Matroska**: `\x1A\x45\xDF\xA3` (EBML header from browser `MediaRecorder`).
   - **MP3**: `ID3` tag or MPEG sync frames (`0xFF 0xFB/F3/F2`).
   - **FLAC**: `fLaC` header.
   - **M4A / MP4**: `ftyp` atom (`M4A `, `mp42`, `isom`).
   - *Any other format or raw text file is rejected with HTTP 400 `INVALID_AUDIO_FORMAT`.*
3. **Duration Guard**:
   - Parses internal container header / subchunks to compute audio duration.
   - Enforces a strict upper bound of **60.5 seconds** (`AUDIO_DURATION_EXCEEDED`).

---

## 5. API Contract Reference

### Participant Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dataset-collection/consent` | Contributor | Fetch current user's consent status & pseudonymous ID |
| `POST` | `/api/dataset-collection/consent` | Contributor | Grant consent; returns `spk_<hash>` |
| `POST` | `/api/dataset-collection/consent/revoke` | Contributor | Revoke consent (excludes contributor from exports) |
| `GET` | `/api/dataset-collection/prompts` | Public/Auth | Returns standardized prompts & categories |
| `POST` | `/api/dataset-collection/recordings` | Consenting Contributor | Upload audio recording (natural or prompted) |
| `GET` | `/api/dataset-collection/recordings` | Contributor | List user's contributed recordings |
| `GET` | `/api/dataset-collection/recordings/:id/audio` | Contributor / Staff | Private streaming endpoint for audio playback |
| `DELETE` | `/api/dataset-collection/recordings/:id` | Contributor / Admin | Soft-delete a contributed recording |

### Reviewer & Admin Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dataset-collection/review/recordings` | Officer / Admin | List review queue (`status=pending\|reviewed\|rejected`) |
| `PATCH` | `/api/dataset-collection/review/recordings/:id` | Officer / Admin | Submit verbatim reference transcript and approve/reject |
| `GET` | `/api/dataset-collection/export` | Admin | Export consent-eligible, reviewed recordings into Phase 1 manifest schema |

---

## 6. Phase 1 Manifest Export & Speaker-Disjoint Split Integrity

The export API (`GET /api/dataset-collection/export?split=true`) and CLI tool (`server/scripts/exportVoiceDatasetManifest.js`) enforce complete compatibility with Phase 1 manifest specifications:

```bash
# Export reviewed dataset with speaker-disjoint splits to JSON:
node server/scripts/exportVoiceDatasetManifest.js --out exports/voice_manifest.json --verify
```

### Export Eligibility Pipeline
1. `VoiceConsent.consentGiven === true && !VoiceConsent.revokedAt`
2. `VoiceDatasetRecording.reviewStatus === 'reviewed'`
3. `VoiceDatasetRecording.referenceTranscript` is non-empty
4. `VoiceDatasetRecording.deletedAt === null`

### Speaker Disjoint Invariant
Recordings are partitioned by **speaker identifier**:
$$\text{Speakers}(\text{Train}) \cap \text{Speakers}(\text{Validation}) = \emptyset, \quad \text{Speakers}(\text{Train}) \cap \text{Speakers}(\text{Test}) = \emptyset$$
- 70% of consenting speakers are assigned to `train`.
- 15% of consenting speakers are assigned to `val`.
- 15% of consenting speakers are assigned to `test`.
- Passed directly to `voice-service/validation/split_validator.py` and `manifest_validator.py` for verification.

---

## 7. Environment Variables

Add to `server/.env` (or configure in deployment environment):

```env
# Path to private disk storage for audio recordings (defaults to private_dataset_storage/audio)
VOICE_DATASET_STORAGE_DIR=private_dataset_storage/audio

# Retention period in days for contributed dataset recordings (defaults to 365 days)
VOICE_DATASET_RETENTION_DAYS=365

# Keyed HMAC secret for irreversible speaker pseudonymization
VOICE_PSEUDONYMIZATION_KEY=aswanna-voice-pseudo-salt-secret-key-2026

# Storage quota per contributor in bytes (defaults to 100 MB)
VOICE_DATASET_MAX_CONTRIBUTOR_BYTES=104857600

# Minimum free disk buffer required before accepting uploads (defaults to 50 MB)
VOICE_DATASET_MIN_FREE_DISK_BYTES=52428800
```

---

## 8. Phase 2.1 — Security Hardening & Pilot Readiness Audit

### Audit Findings & Remediations

| Risk Area | Pre-Hardening State | Hardened Production State | File |
| :--- | :--- | :--- | :--- |
| **Pseudonymous Speaker IDs** | Predictable SHA-256 of `userId` with static salt | Keyed HMAC-SHA256 (`ENV.VOICE_PSEUDONYMIZATION_KEY`), opaque, irreversible, zero PII | `server/src/routes/datasetCollection.js` |
| **Path Traversal & Injection** | `req.params.id` passed to DB queries without regex validation | Strict regex `/^rec_[a-f0-9]{12}$/` + `path.resolve` boundary check against storage root | `server/src/routes/datasetCollection.js` |
| **Audio Range Requests** | Basic range slicing without error handling | RFC 7233 compliant: validates bounds, negative ranges, syntax; returns HTTP 416 on violation | `server/src/routes/datasetCollection.js` |
| **Orphaned Audio Files** | Audio file written before `recording.save()`, leaving orphaned file on DB error | Wrapped in try/catch; automatic asynchronous unlink cleans up orphaned audio file on DB error | `server/src/routes/datasetCollection.js` |
| **Audio Validation & Decodability** | Magic byte prefix inspection only | Deep structural validation: WAV fmt/data chunk integrity, sample rate (8k-48k), channels (1-2), bit depth (16/24/32), data size bounds; WebM DocType check; OGG page sequence; MP3 sync frame; FLAC STREAMINFO | `server/src/utils/audioValidator.js` |
| **Streaming Upload Abuse** | Stream read into buffer before checking | Early stream termination: aborts and destroys incoming stream when byte limit exceeded; rejects large base64 before decoding | `server/src/utils/audioUploadParser.js` |
| **Storage Abuse & Disk Exhaustion** | No per-contributor or total limits | Configurable per-contributor quota (`VOICE_DATASET_MAX_CONTRIBUTOR_BYTES`) and low-disk threshold guard (`statfs`) | `server/src/routes/datasetCollection.js` |
| **Dataset Split Mutation** | Index-proportional allocation changed when new speakers joined | Deterministic MD5 hash-bucket split assignment (`assignSpeakerSplit`); frozen test set cannot mutate on dataset growth | `server/src/routes/datasetCollection.js`, `server/scripts/exportVoiceDatasetManifest.js` |

---

## 9. Verification & Test Evidence

### Full Node Test Suite (`npm test`)
- **Server Workspace**: 19 test suites passed, **422 tests passed** (including `datasetCollectionSecurity.test.js` [22 passed] and `datasetCollection.test.js` [19 passed]).
- **Client Workspace**: 22 test files passed, **125 tests passed** (including `VoiceDatasetCollection.test.jsx` [4 passed]).
- **Total Node Tests**: **547 passed**, 0 failed.

### Voice Service Python Test Suite (`pytest voice-service/tests`)
- `test_adapters.py`: 6 passed
- `test_service.py`: 6 passed
- `test_transcribe_audio.py`: 1 skipped (developer physical audio awaiting field recording)
- `test_validation.py`: 8 passed
- **Total Python Tests**: **20 passed**, 1 skipped, 0 failed in 42.47s.

### Phase 1 Python Manifest & Split Validators
- `manifest_validator.py`: PASSED (0 errors, 0 warnings).
- `split_validator.py`: PASSED (0 speaker leakage across splits, 100% speaker-disjoint).

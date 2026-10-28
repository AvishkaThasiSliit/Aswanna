import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { ENV, getPseudonymizationKey, getDatasetStorageDir } from '../config/env.js';
import { VoiceConsent } from '../models/VoiceConsent.js';
import { VoiceDatasetRecording } from '../models/VoiceDatasetRecording.js';
import { validateAudioBuffer } from '../utils/audioValidator.js';
import { parseAudioUploadRequest } from '../utils/audioUploadParser.js';
import { VOICE_DATASET_PROMPTS, PROMPT_CATEGORIES } from '../config/voiceDatasetPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Resolves absolute storage directory using shared resolver and ensures it exists outside public root.
 */
function getStorageDirectory() {
  const dirPath = getDatasetStorageDir();

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

// In-flight upload bytes tracking per contributor to prevent race condition quota bypasses
export const inFlightContributorBytes = new Map();

/**
 * Generates an opaque pseudonymous speaker ID using keyed HMAC (e.g. spk_a8f9c1b2d3).
 * Irreversible without server secret key, producing zero PII.
 */
export function generatePseudonymousSpeakerId(userId) {
  const secret = getPseudonymizationKey();
  const hmac = crypto.createHmac('sha256', secret)
    .update(userId.toString())
    .digest('hex');
  return `spk_${hmac.slice(0, 10)}`;
}

/**
 * Strict regex validation for recording IDs to prevent directory traversal and injection.
 * Accepts lowercase or uppercase hex, normalized safely to lowercase.
 * Supports legacy 12-hex IDs and newer 16-32 hex IDs (12 to 32 hex chars).
 */
export function validateRecordingId(id) {
  if (!id || typeof id !== 'string') {
    throw new AppError('BAD_REQUEST', 'Invalid recording ID format', 400);
  }
  const cleanId = id.trim().toLowerCase();
  if (!/^rec_[a-f0-9]{12,32}$/.test(cleanId)) {
    throw new AppError('BAD_REQUEST', 'Invalid recording ID format', 400);
  }
  return cleanId;
}

/**
 * Computes canonical request fingerprint covering audio content and relevant metadata.
 * Ensures idempotent retries verify payload identity and prevents conflicting reuse.
 */
export function computeRequestFingerprint(fileBuffer, fields = {}) {
  const audioHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const canonical = {
    audioHash,
    speechMode: fields.speechMode === 'prompted' ? 'prompted' : 'natural',
    promptCategory: fields.promptCategory || 'unprompted',
    promptId: fields.promptId || null,
    language: fields.language === 'en' ? 'en' : 'si'
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Deterministically assigns a speaker ID to train (70%), val (15%), or test (15%).
 * Stable across dataset expansions so that test speakers are frozen and never mutate.
 */
export function assignSpeakerSplit(pseudonymousSpeakerId) {
  const hashInt = parseInt(
    crypto.createHash('md5').update(pseudonymousSpeakerId).digest('hex').slice(0, 8),
    16
  );
  const bucket = hashInt % 100;
  if (bucket < 70) return 'train';
  if (bucket < 85) return 'val';
  return 'test';
}

// ─── 1. Consent Endpoints ───────────────────────────────────────────────────

/**
 * GET /api/dataset-collection/consent
 * Check participant consent status.
 */
router.get('/consent', requireAuth, asyncHandler(async (req, res) => {
  const consent = await VoiceConsent.findOne({ userId: req.user._id });
  if (!consent) {
    return res.json({
      hasConsented: false,
      consentGiven: false,
      pseudonymousSpeakerId: null
    });
  }

  const isActive = consent.consentGiven && !consent.revokedAt;
  return res.json({
    hasConsented: isActive,
    consentGiven: consent.consentGiven,
    pseudonymousSpeakerId: consent.pseudonymousSpeakerId,
    consentVersion: consent.consentVersion,
    consentedAt: consent.consentedAt,
    revokedAt: consent.revokedAt
  });
}));

/**
 * POST /api/dataset-collection/consent
 * Grant consent for voice dataset collection.
 */
router.post('/consent', requireAuth, asyncHandler(async (req, res) => {
  const { consentGiven = true, agreedTerms = [] } = req.body || {};
  let consent = await VoiceConsent.findOne({ userId: req.user._id });

  if (!consent) {
    const speakerId = generatePseudonymousSpeakerId(req.user._id);
    consent = new VoiceConsent({
      userId: req.user._id,
      pseudonymousSpeakerId: speakerId,
      consentGiven: Boolean(consentGiven),
      consentVersion: '1.0',
      agreedTerms,
      consentedAt: new Date(),
      revokedAt: null
    });
  } else {
    consent.consentGiven = Boolean(consentGiven);
    consent.revokedAt = null;
    consent.revocationReason = null;
    consent.consentedAt = new Date();
    if (agreedTerms.length) consent.agreedTerms = agreedTerms;
  }

  await consent.save();

  return res.status(200).json({
    message: 'Consent recorded successfully',
    hasConsented: consent.consentGiven,
    pseudonymousSpeakerId: consent.pseudonymousSpeakerId,
    consentedAt: consent.consentedAt
  });
}));

/**
 * POST /api/dataset-collection/consent/revoke
 * Revoke participant consent.
 */
router.post('/consent/revoke', requireAuth, asyncHandler(async (req, res) => {
  const { reason = 'Participant requested revocation' } = req.body || {};
  const consent = await VoiceConsent.findOne({ userId: req.user._id });

  if (!consent) {
    throw new AppError('NOT_FOUND', 'No consent record found to revoke', 404);
  }

  consent.consentGiven = false;
  consent.revokedAt = new Date();
  consent.revocationReason = reason;
  await consent.save();

  return res.status(200).json({
    message: 'Consent revoked. Recordings from this speaker will be excluded from dataset exports.',
    revokedAt: consent.revokedAt
  });
}));

// ─── 2. Prompts Endpoint ────────────────────────────────────────────────────

/**
 * GET /api/dataset-collection/prompts
 * Returns standardized prompts and prompt categories.
 */
router.get('/prompts', (_req, res) => {
  res.json({
    categories: PROMPT_CATEGORIES,
    prompts: VOICE_DATASET_PROMPTS
  });
});

// ─── 3. Upload & Recordings Endpoints ───────────────────────────────────────

/**
 * POST /api/dataset-collection/recordings
 * Upload a voice recording (natural or prompted speech).
 */
router.post('/recordings', requireAuth, asyncHandler(async (req, res) => {
  // 1. Verify participant consent
  const consent = await VoiceConsent.findOne({ userId: req.user._id });
  if (!consent || !consent.consentGiven || consent.revokedAt) {
    throw new AppError(
      'CONSENT_REQUIRED',
      'Participant consent is required before recording or uploading voice data. Please review and accept the consent agreement.',
      403
    );
  }

  // 2. Parse request payload and extract audio buffer and metadata fields
  const { fileBuffer, fields, mimeType: uploadMime } = await parseAudioUploadRequest(req);

  // 3. Compute canonical request fingerprint and check idempotency via clientRequestId
  const clientRequestId = fields.clientRequestId || req.headers['x-client-request-id'];
  const currentFingerprint = computeRequestFingerprint(fileBuffer, fields);

  if (clientRequestId) {
    const existing = await VoiceDatasetRecording.findOne({ clientRequestId }).select('+contributorUserId');
    if (existing) {
      if (!existing.contributorUserId.equals(req.user._id)) {
        throw new AppError('CONFLICT', 'clientRequestId already in use by another contributor', 409);
      }
      if (existing.requestFingerprint && existing.requestFingerprint !== currentFingerprint) {
        throw new AppError('CONFLICT', 'clientRequestId already submitted with conflicting audio payload or metadata', 409);
      }
      return res.status(200).json({
        message: 'Recording already submitted (idempotent)',
        recording: sanitizeRecording(existing)
      });
    }
  }

  // 4. Validate audio file buffer (format, size, duration, container decodability)
  const validation = validateAudioBuffer(fileBuffer, {
    claimedDuration: fields.durationSeconds,
    claimedMime: uploadMime
  });

  // 5. Enforce storage quota per contributor with race-safe in-flight byte reservation
  const userKey = req.user._id.toString();
  const userUsage = await VoiceDatasetRecording.aggregate([
    { $match: { contributorUserId: req.user._id, deletedAt: null } },
    { $group: { _id: null, totalBytes: { $sum: '$fileSizeBytes' } } }
  ]);
  const currentBytes = userUsage[0]?.totalBytes || 0;
  const inFlight = inFlightContributorBytes.get(userKey) || 0;

  if (currentBytes + inFlight + fileBuffer.length > ENV.VOICE_DATASET_MAX_CONTRIBUTOR_BYTES) {
    throw new AppError(
      'STORAGE_QUOTA_EXCEEDED',
      `Contributor storage quota (${(ENV.VOICE_DATASET_MAX_CONTRIBUTOR_BYTES / (1024 * 1024)).toFixed(0)} MB) exceeded`,
      400
    );
  }

  // Reserve in-flight bytes
  inFlightContributorBytes.set(userKey, inFlight + fileBuffer.length);

  try {
    // 6. Check low-disk threshold
    const storageDir = getStorageDirectory();
    try {
      if (typeof fs.promises.statfs === 'function') {
        const diskStats = await fs.promises.statfs(storageDir);
        const freeBytes = diskStats.bavail * diskStats.bsize;
        if (freeBytes < ENV.VOICE_DATASET_MIN_FREE_DISK_BYTES) {
          throw new AppError('INSUFFICIENT_STORAGE', 'Storage capacity limit reached on server', 507);
        }
      }
    } catch (statErr) {
      if (statErr.status || statErr.code === 'INSUFFICIENT_STORAGE') throw statErr;
      // Non-fatal if statfs is not supported on platform
    }

    // 7. Bounded generation of unique opaque recording ID (16 hex chars) with exclusive disk write
    let recordingId;
    let storedFileName;
    let targetFilePath;
    let fileWritten = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const candidateUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const candidateId = `rec_${candidateUuid}`;
      const existsInDb = await VoiceDatasetRecording.exists({ recordingId: candidateId });
      if (existsInDb) continue;

      const candidateFileName = `${candidateId}.${validation.extension}`;
      const candidatePath = path.join(storageDir, candidateFileName);

      const resolvedTarget = path.resolve(candidatePath);
      const resolvedStorage = path.resolve(storageDir);
      if (!resolvedTarget.startsWith(resolvedStorage)) {
        throw new AppError('FORBIDDEN', 'Path traversal attempt detected', 403);
      }

      try {
        // Write audio privately with exclusive flag 'wx' so existing files are never overwritten
        await fs.promises.writeFile(resolvedTarget, fileBuffer, { mode: 0o600, flag: 'wx' });
        fileWritten = true;
        recordingId = candidateId;
        storedFileName = candidateFileName;
        targetFilePath = resolvedTarget;
        break;
      } catch (writeErr) {
        if (writeErr.code === 'EEXIST') {
          continue; // collision on disk, retry with fresh UUID
        }
        if (writeErr.code === 'ENOSPC') {
          throw new AppError('INSUFFICIENT_STORAGE', 'Storage capacity limit reached on server', 507);
        }
        throw writeErr;
      }
    }

    if (!recordingId || !fileWritten) {
      throw new AppError('INTERNAL_ERROR', 'Failed to generate unique recording identifier', 500);
    }

    // 8. Persist database record with automatic orphaned file cleanup on failure
    const retentionDays = ENV.VOICE_DATASET_RETENTION_DAYS || 365;
    const retentionExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    // Ensure all recordings for the same speaker share the exact same split partition
    const existingSplitRec = await VoiceDatasetRecording.findOne({
      pseudonymousSpeakerId: consent.pseudonymousSpeakerId,
      splitAssignment: { $in: ['train', 'val', 'test'] }
    }).select('splitAssignment');

    const splitAssignment = (existingSplitRec && existingSplitRec.splitAssignment !== 'unassigned')
      ? existingSplitRec.splitAssignment
      : assignSpeakerSplit(consent.pseudonymousSpeakerId);

    const recording = new VoiceDatasetRecording({
      recordingId,
      pseudonymousSpeakerId: consent.pseudonymousSpeakerId,
      contributorUserId: req.user._id,
      speechMode: fields.speechMode === 'prompted' ? 'prompted' : 'natural',
      promptCategory: fields.promptCategory || 'unprompted',
      promptId: fields.promptId || null,
      promptText: fields.promptText || null,
      language: fields.language === 'en' ? 'en' : 'si',
      accentOrDialect: fields.accentOrDialect || 'standard',
      noiseEnvironment: fields.noiseEnvironment || 'quiet',
      recordingSource: fields.recordingSource === 'file_upload' ? 'file_upload' : 'browser_mic',
      deviceType: fields.deviceType || 'unknown',
      storedFileName,
      mimeType: validation.mimeType,
      fileSizeBytes: validation.sizeBytes,
      durationSeconds: validation.durationSeconds,
      reviewStatus: 'pending',
      referenceTranscript: '',
      retentionExpiresAt,
      clientRequestId: clientRequestId || undefined,
      requestFingerprint: currentFingerprint,
      splitAssignment,
      splitPolicy: 'speaker_hash_v1'
    });

    try {
      await recording.save();
    } catch (saveError) {
      // Clean up written audio file immediately on failure to prevent orphaned files
      await fs.promises.unlink(targetFilePath).catch((unlinkErr) => {
        console.error('[Storage Cleanup Error] Failed to unlink temp file:', unlinkErr.code);
      });
      if (saveError.code === 11000 && clientRequestId) {
        const existing = await VoiceDatasetRecording.findOne({ clientRequestId }).select('+contributorUserId');
        if (existing) {
          if (!existing.contributorUserId.equals(req.user._id)) {
            throw new AppError('CONFLICT', 'clientRequestId already in use by another contributor', 409);
          }
          if (existing.requestFingerprint && existing.requestFingerprint !== currentFingerprint) {
            throw new AppError('CONFLICT', 'clientRequestId already submitted with conflicting audio payload or metadata', 409);
          }
          return res.status(200).json({
            message: 'Recording already submitted (idempotent)',
            recording: sanitizeRecording(existing)
          });
        }
      }
      throw saveError;
    }

    return res.status(201).json({
      message: 'Voice recording submitted successfully for review',
      recording: sanitizeRecording(recording)
    });
  } finally {
    // Release in-flight quota reservation
    const active = inFlightContributorBytes.get(userKey) || 0;
    const remaining = active - fileBuffer.length;
    if (remaining <= 0) {
      inFlightContributorBytes.delete(userKey);
    } else {
      inFlightContributorBytes.set(userKey, remaining);
    }
  }
}));

/**
 * GET /api/dataset-collection/recordings
 * List contributor's own recordings (or all if officer/admin).
 */
router.get('/recordings', requireAuth, asyncHandler(async (req, res) => {
  const isStaff = ['officer', 'admin'].includes(req.user.role);
  const query = { deletedAt: null };

  // Regular farmers see only their own contributions
  if (!isStaff) {
    const consent = await VoiceConsent.findOne({ userId: req.user._id });
    if (!consent) return res.json({ recordings: [] });
    query.pseudonymousSpeakerId = consent.pseudonymousSpeakerId;
  }

  const recordings = await VoiceDatasetRecording.find(query)
    .sort({ createdAt: -1 })
    .limit(100);

  return res.json({
    recordings: recordings.map(sanitizeRecording)
  });
}));

/**
 * GET /api/dataset-collection/recordings/:id/audio
 * Private streaming endpoint for authenticated audio playback.
 * Enforces strict authorization, range request validation, and path traversal protection.
 */
router.get('/recordings/:id/audio', requireAuth, asyncHandler(async (req, res) => {
  const recordingId = validateRecordingId(req.params.id);

  const recording = await VoiceDatasetRecording.findOne({
    recordingId,
    deletedAt: null
  }).select('+storedFileName +contributorUserId');

  if (!recording) {
    throw new AppError('NOT_FOUND', 'Recording not found', 404);
  }

  // Authorization check: contributor or staff
  const isContributor = recording.contributorUserId.equals(req.user._id);
  const isStaff = ['officer', 'admin'].includes(req.user.role);
  if (!isContributor && !isStaff) {
    throw new AppError('FORBIDDEN', 'Access denied to private recording audio', 403);
  }

  const storageDir = getStorageDirectory();
  const resolvedStorageDir = path.resolve(storageDir);
  const filePath = path.join(storageDir, recording.storedFileName);
  const resolvedFilePath = path.resolve(filePath);

  if (!resolvedFilePath.startsWith(resolvedStorageDir)) {
    throw new AppError('FORBIDDEN', 'Path traversal attempt detected', 403);
  }

  if (!fs.existsSync(resolvedFilePath)) {
    throw new AppError('NOT_FOUND', 'Audio file missing from private storage', 404);
  }

  const stat = fs.statSync(resolvedFilePath);
  const range = req.headers.range;

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    const [_, rawStart, rawEnd] = match;
    if (!rawStart && !rawEnd) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    const start = rawStart ? parseInt(rawStart, 10) : 0;
    const end = rawEnd ? parseInt(rawEnd, 10) : stat.size - 1;

    if (isNaN(start) || isNaN(end) || start < 0 || start >= stat.size || end < start || end >= stat.size) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(resolvedFilePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': recording.mimeType
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': recording.mimeType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(resolvedFilePath).pipe(res);
  }
}));

/**
 * DELETE /api/dataset-collection/recordings/:id
 * Soft-delete a recording.
 */
router.delete('/recordings/:id', requireAuth, asyncHandler(async (req, res) => {
  const recordingId = validateRecordingId(req.params.id);

  const recording = await VoiceDatasetRecording.findOne({
    recordingId,
    deletedAt: null
  }).select('+contributorUserId');

  if (!recording) {
    throw new AppError('NOT_FOUND', 'Recording not found', 404);
  }

  const isContributor = recording.contributorUserId.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isContributor && !isAdmin) {
    throw new AppError('FORBIDDEN', 'Insufficient permissions to delete this recording', 403);
  }

  recording.deletedAt = new Date();
  await recording.save();

  return res.json({
    message: 'Recording deleted successfully',
    recordingId: recording.recordingId
  });
}));

// ─── 4. Reviewer Endpoints (Officers & Admins) ──────────────────────────────

/**
 * GET /api/dataset-collection/review/recordings
 * Fetch pending recordings for reviewer interface.
 */
router.get('/review/recordings', requireAuth, requireRole('officer', 'admin'), asyncHandler(async (req, res) => {
  const { status: reviewStatus = 'pending', language, page = 1, limit = 20 } = req.query;
  const filter = { deletedAt: null };

  if (reviewStatus) filter.reviewStatus = reviewStatus;
  if (language) filter.language = language;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

  const total = await VoiceDatasetRecording.countDocuments(filter);
  const recordings = await VoiceDatasetRecording.find(filter)
    .sort({ createdAt: 1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  return res.json({
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    recordings: recordings.map(sanitizeRecording)
  });
}));

/**
 * PATCH /api/dataset-collection/review/recordings/:id
 * Reviewer submits ground-truth transcript and marks reviewed or rejected.
 */
router.patch('/review/recordings/:id', requireAuth, requireRole('officer', 'admin'), asyncHandler(async (req, res) => {
  const recordingId = validateRecordingId(req.params.id);
  const { reviewStatus, referenceTranscript, rejectionReason } = req.body || {};

  if (!['reviewed', 'rejected'].includes(reviewStatus)) {
    throw new AppError('BAD_REQUEST', "reviewStatus must be either 'reviewed' or 'rejected'", 400);
  }

  if (reviewStatus === 'reviewed') {
    if (!referenceTranscript || typeof referenceTranscript !== 'string' || !referenceTranscript.trim()) {
      throw new AppError(
        'TRANSCRIPT_REQUIRED',
        "A non-empty referenceTranscript is mandatory to mark a recording as 'reviewed'. Model predictions must never be automatically accepted.",
        400
      );
    }
  }

  const recording = await VoiceDatasetRecording.findOne({
    recordingId,
    deletedAt: null
  });

  if (!recording) {
    throw new AppError('NOT_FOUND', 'Recording not found for review', 404);
  }

  recording.reviewStatus = reviewStatus;
  recording.reviewerId = req.user._id;
  recording.reviewedAt = new Date();

  if (reviewStatus === 'reviewed') {
    recording.referenceTranscript = referenceTranscript.trim();
    recording.rejectionReason = null;
  } else {
    recording.rejectionReason = rejectionReason || 'Rejected during review';
  }

  await recording.save();

  return res.json({
    message: `Recording ${reviewStatus} successfully`,
    recording: sanitizeRecording(recording)
  });
}));

// ─── 5. Export Endpoint (Admins) ────────────────────────────────────────────

/**
 * GET /api/dataset-collection/export
 * Exports consent-eligible, human-reviewed recordings formatted for Phase 1 manifest.
 * Preserves deterministic speaker-disjoint splits invariant to dataset expansion.
 */
router.get('/export', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { split = 'false' } = req.query;
  const shouldSplit = split === 'true' || split === '1';

  // Find all active consent speaker IDs
  const activeConsents = await VoiceConsent.find({
    consentGiven: true,
    revokedAt: null
  }).select('pseudonymousSpeakerId');

  const eligibleSpeakerIds = new Set(activeConsents.map(c => c.pseudonymousSpeakerId));

  // Find reviewed, non-deleted recordings for eligible speakers
  const recordings = await VoiceDatasetRecording.find({
    deletedAt: null,
    reviewStatus: 'reviewed',
    referenceTranscript: { $exists: true, $ne: '' },
    pseudonymousSpeakerId: { $in: Array.from(eligibleSpeakerIds) }
  }).select('+storedFileName').sort({ createdAt: 1 });

  const manifestCases = recordings.map(rec => {
    // Authoritative split precedence: preserve existing persisted split to freeze benchmark test-set membership
    const splitLabel = shouldSplit
      ? (rec.splitAssignment && rec.splitAssignment !== 'unassigned'
          ? rec.splitAssignment
          : assignSpeakerSplit(rec.pseudonymousSpeakerId))
      : (rec.splitAssignment || 'train');

    return {
      caseId: `VP-${rec.recordingId.toUpperCase().replace('_', '-')}`,
      audioPath: `recordings/${rec.storedFileName}`,
      language: rec.language,
      referenceTranscript: rec.referenceTranscript,
      speaker: {
        id: rec.pseudonymousSpeakerId,
        dialect: rec.accentOrDialect,
        noiseLevel: rec.noiseEnvironment
      },
      reviewStatus: 'reviewed',
      split: splitLabel,
      provenance: {
        recordingId: rec.recordingId,
        speechMode: rec.speechMode,
        promptCategory: rec.promptCategory,
        promptId: rec.promptId,
        recordingSource: rec.recordingSource,
        deviceType: rec.deviceType,
        datasetVersion: rec.datasetVersion,
        durationSeconds: rec.durationSeconds
      }
    };
  });

  return res.json({
    datasetVersion: 'v1.0',
    splitPolicy: 'speaker_hash_v1',
    exportedAt: new Date().toISOString(),
    totalCases: manifestCases.length,
    eligibleSpeakersCount: new Set(manifestCases.map(c => c.speaker.id)).size,
    cases: manifestCases
  });
}));

/**
 * Sanitizes recording object for client exposure.
 * Strictly hides internal filesystem paths, private file names, and user references.
 */
function sanitizeRecording(recording) {
  return {
    recordingId: recording.recordingId,
    pseudonymousSpeakerId: recording.pseudonymousSpeakerId,
    speechMode: recording.speechMode,
    promptCategory: recording.promptCategory,
    promptId: recording.promptId,
    promptText: recording.promptText,
    language: recording.language,
    accentOrDialect: recording.accentOrDialect,
    noiseEnvironment: recording.noiseEnvironment,
    recordingSource: recording.recordingSource,
    deviceType: recording.deviceType,
    durationSeconds: recording.durationSeconds,
    fileSizeBytes: recording.fileSizeBytes,
    reviewStatus: recording.reviewStatus,
    referenceTranscript: recording.referenceTranscript,
    rejectionReason: recording.rejectionReason,
    datasetVersion: recording.datasetVersion,
    audioUrl: `/api/dataset-collection/recordings/${recording.recordingId}/audio`,
    createdAt: recording.createdAt,
    reviewedAt: recording.reviewedAt
  };
}

export default router;

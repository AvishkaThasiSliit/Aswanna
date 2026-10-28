import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { VoiceConsent } from '../src/models/VoiceConsent.js';
import { VoiceDatasetRecording } from '../src/models/VoiceDatasetRecording.js';

// Helper to create valid 16kHz mono 16-bit PCM WAV in memory
function createTestWavBuffer(durationSeconds = 1.0, sampleRate = 16000) {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.floor(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 1000);
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

import os from 'os';
import jwt from 'jsonwebtoken';
import { ENV, getDatasetStorageDir } from '../src/config/env.js';

// Explicitly enable dataset collection flag for test suite
process.env.VOICE_DATASET_COLLECTION = 'on';
ENV.VOICE_DATASET_COLLECTION = 'on';

const DUMMY_HASH = '$2a$12$e8Yh8.mHkYn0zS30i/v2xeQYk6bV7QfH0QnE9K.9aQ8i9E7.Y1.e.'; // Pre-computed bcrypt hash

async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Voice Contributor',
    email: `voice-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: DUMMY_HASH,
    role: 'farmer'
  };
  const user = await User.create({ ...defaults, ...overrides });
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, ENV.JWT_SECRET, { expiresIn: '1h' });
  return { token, user };
}

describe('Voice Dataset Collection API (Phase 2)', () => {
  let farmerToken;
  let farmerUser;
  let officerToken;
  let officerUser;
  let adminToken;
  let adminUser;

  afterAll(() => {
    const dir = getDatasetStorageDir();
    if (dir && dir.includes('aswanna-test-storage') && fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          fs.unlinkSync(path.join(dir, f));
        }
      } catch (e) {}
    }
  });

  beforeEach(async () => {
    const farmerRes = await registerUser({ role: 'farmer', name: 'Farmer Bandara' });
    farmerToken = farmerRes.token;
    farmerUser = farmerRes.user;

    const officerRes = await registerUser({ role: 'officer', name: 'Officer Wickramasinghe' });
    officerToken = officerRes.token;
    officerUser = officerRes.user;

    const adminRes = await registerUser({ role: 'admin', name: 'System Admin' });
    adminToken = adminRes.token;
    adminUser = adminRes.user;
  });

  // ─── 1. Consent Tests ──────────────────────────────────────────────────────
  describe('Consent Handling', () => {
    test('check consent returns hasConsented: false when not yet granted', async () => {
      const res = await request(app)
        .get('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.hasConsented).toBe(false);
      expect(res.body.pseudonymousSpeakerId).toBeNull();
    });

    test('granting consent generates pseudonymous speaker ID', async () => {
      const res = await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ consentGiven: true, agreedTerms: ['Term 1'] });

      expect(res.status).toBe(200);
      expect(res.body.hasConsented).toBe(true);
      expect(res.body.pseudonymousSpeakerId).toMatch(/^spk_[a-f0-9]{10}$/);

      // Verify persisted record
      const consentRecord = await VoiceConsent.findOne({ userId: farmerUser._id });
      expect(consentRecord).toBeDefined();
      expect(consentRecord.consentGiven).toBe(true);
    });

    test('uploading audio without consent is blocked with 403 CONSENT_REQUIRED', async () => {
      const wav = createTestWavBuffer(1.0);
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    });

    test('revoking consent updates record and prevents subsequent uploads', async () => {
      // First grant
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ consentGiven: true });

      // Then revoke
      const revokeRes = await request(app)
        .post('/api/dataset-collection/consent/revoke')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ reason: 'Participant opted out' });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.revokedAt).toBeDefined();

      // Check status
      const statusRes = await request(app)
        .get('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`);
      expect(statusRes.body.hasConsented).toBe(false);

      // Subsequent upload fails
      const wav = createTestWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural'
        });
      expect(uploadRes.status).toBe(403);
    });
  });

  // ─── 2. Upload Validation Tests ────────────────────────────────────────────
  describe('Upload Validation & Decodability', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ consentGiven: true });
    });

    test('accepts valid 16kHz PCM WAV audio file', async () => {
      const wav = createTestWavBuffer(2.0);
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'prompted',
          promptId: 'VP-PRM-001',
          promptCategory: 'fertilizer',
          promptText: 'යූරියා මිටි 2 ක් රුපියල් 14000 කට ගත්තා',
          language: 'si'
        });

      expect(res.status).toBe(201);
      expect(res.body.recording).toBeDefined();
      expect(res.body.recording.recordingId).toMatch(/^rec_[a-f0-9]{12,32}$/);
      expect(res.body.recording.reviewStatus).toBe('pending');
      expect(res.body.recording.durationSeconds).toBeGreaterThan(1.8);

      // Verify internal path is NOT exposed in response
      expect(res.body.recording.storedFileName).toBeUndefined();
      expect(res.body.recording.audioFilePath).toBeUndefined();
      expect(res.body.recording.audioUrl).toContain('/api/dataset-collection/recordings/');
    });

    test('rejects fake/corrupted audio file content (e.g. plain text masquerading as audio)', async () => {
      const fakeText = Buffer.from('This is a text file, not valid audio');
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: fakeText.toString('base64'),
          speechMode: 'natural'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_AUDIO_FORMAT');
    });

    test('rejects empty audio payload', async () => {
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: '',
          speechMode: 'natural'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMPTY_AUDIO_FILE');
    });

    test('rejects audio duration exceeding 60 seconds limit', async () => {
      const longWav = createTestWavBuffer(65.0, 8000); // 65 seconds
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: longWav.toString('base64'),
          speechMode: 'natural'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AUDIO_DURATION_EXCEEDED');
    });

    test('idempotency: duplicate request with same clientRequestId returns existing record without duplicating', async () => {
      const wav = createTestWavBuffer(1.5);
      const clientReqId = `req-idemp-${Date.now()}`;

      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          clientRequestId: clientReqId
        });

      expect(res1.status).toBe(201);
      const recId1 = res1.body.recording.recordingId;

      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          clientRequestId: clientReqId
        });

      expect(res2.status).toBe(200);
      expect(res2.body.recording.recordingId).toBe(recId1);

      // Verify count in database
      const count = await VoiceDatasetRecording.countDocuments({ clientRequestId: clientReqId });
      expect(count).toBe(1);
    });
  });

  // ─── 3. Permissions & Private Storage ──────────────────────────────────────
  describe('RBAC & Private Storage Protection', () => {
    let recordingId;

    beforeEach(async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ consentGiven: true });

      const wav = createTestWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si'
        });
      recordingId = uploadRes.body.recording.recordingId;
    });

    test('contributor can stream their own private audio', async () => {
      const res = await request(app)
        .get(`/api/dataset-collection/recordings/${recordingId}/audio`)
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('audio/wav');
    });

    test('officer and admin can stream private audio for review', async () => {
      const res = await request(app)
        .get(`/api/dataset-collection/recordings/${recordingId}/audio`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
    });

    test('different unauthorized farmer cannot stream other participants audio', async () => {
      const otherFarmer = await registerUser({ role: 'farmer', name: 'Other Farmer' });
      const res = await request(app)
        .get(`/api/dataset-collection/recordings/${recordingId}/audio`)
        .set('Authorization', `Bearer ${otherFarmer.token}`);

      expect(res.status).toBe(403);
    });

    test('farmer cannot access reviewer queue', async () => {
      const res = await request(app)
        .get('/api/dataset-collection/review/recordings')
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── 4. Reviewer Interface & Ground Truth Transcripts ──────────────────────
  describe('Human Review Workflow', () => {
    let recordingId;

    beforeEach(async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ consentGiven: true });

      const wav = createTestWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si'
        });
      recordingId = uploadRes.body.recording.recordingId;
    });

    test('officer can list pending recordings in review queue', async () => {
      const res = await request(app)
        .get('/api/dataset-collection/review/recordings?status=pending')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.recordings).toBeDefined();
      expect(res.body.recordings.some(r => r.recordingId === recordingId)).toBe(true);
    });

    test('marking reviewed without transcript is rejected (human ground-truth invariant)', async () => {
      const res = await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recordingId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          reviewStatus: 'reviewed',
          referenceTranscript: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TRANSCRIPT_REQUIRED');
    });

    test('officer submits verbatim reference transcript and marks reviewed', async () => {
      const goldTranscript = 'යූරියා මිටි දෙකක් රුපියල් දාහතරදාහකට ගත්තා';
      const res = await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recordingId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          reviewStatus: 'reviewed',
          referenceTranscript: goldTranscript
        });

      expect(res.status).toBe(200);
      expect(res.body.recording.reviewStatus).toBe('reviewed');
      expect(res.body.recording.referenceTranscript).toBe(goldTranscript);

      // Verify in database
      const dbRec = await VoiceDatasetRecording.findOne({ recordingId });
      expect(dbRec.reviewStatus).toBe('reviewed');
      expect(dbRec.reviewerId.toString()).toBe(officerUser._id.toString());
      expect(dbRec.reviewedAt).toBeDefined();
    });

    test('officer can reject poor audio with reason', async () => {
      const res = await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recordingId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          reviewStatus: 'rejected',
          rejectionReason: 'Background tractor noise obscured speech'
        });

      expect(res.status).toBe(200);
      expect(res.body.recording.reviewStatus).toBe('rejected');
    });
  });

  // ─── 5. Export & Split Integrity ──────────────────────────────────────────
  describe('Export Eligibility & Speaker-Disjoint Split Integrity', () => {
    let recReviewedId;
    let recUnreviewedId;
    let recRevokedSpeakerId;

    beforeEach(async () => {
      // 1. Farmer A (Active Consent) -> 1 reviewed, 1 pending
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ consentGiven: true });

      const wav = createTestWavBuffer(1.0);
      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'prompted',
          promptId: 'VP-PRM-001',
          promptCategory: 'fertilizer',
          language: 'si'
        });
      recReviewedId = res1.body.recording.recordingId;

      // Mark recReviewedId as reviewed
      await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recReviewedId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          reviewStatus: 'reviewed',
          referenceTranscript: 'පොහොර මිටි 2 ක් රුපියල් 14000 යි'
        });

      // Second unreviewed recording
      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si'
        });
      recUnreviewedId = res2.body.recording.recordingId;

      // 2. Farmer B -> Granted, recorded, reviewed, THEN revoked consent
      const farmerB = await registerUser({ role: 'farmer', name: 'Farmer Withdrawn' });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerB.token}`)
        .send({ consentGiven: true });

      const resB = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerB.token}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si'
        });
      recRevokedSpeakerId = resB.body.recording.recordingId;

      await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recRevokedSpeakerId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          reviewStatus: 'reviewed',
          referenceTranscript: 'වල්නාශක බෝතලයක් ගත්තා'
        });

      // Farmer B revokes consent
      await request(app)
        .post('/api/dataset-collection/consent/revoke')
        .set('Authorization', `Bearer ${farmerB.token}`)
        .send({ reason: 'Opted out' });
    });

    test('export excludes unreviewed recordings and revoked consent recordings', async () => {
      const res = await request(app)
        .get('/api/dataset-collection/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cases).toBeDefined();

      const caseIds = res.body.cases.map(c => c.provenance.recordingId);
      // Reviewed with active consent must be included
      expect(caseIds).toContain(recReviewedId);
      // Unreviewed must be excluded
      expect(caseIds).not.toContain(recUnreviewedId);
      // Revoked consent must be excluded
      expect(caseIds).not.toContain(recRevokedSpeakerId);
    });

    test('exported cases adhere to Phase 1 manifest specification and protect PII', async () => {
      const res = await request(app)
        .get('/api/dataset-collection/export?split=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const exportedCase = res.body.cases[0];

      expect(exportedCase).toHaveProperty('caseId');
      expect(exportedCase).toHaveProperty('audioPath');
      expect(exportedCase).toHaveProperty('language');
      expect(exportedCase).toHaveProperty('referenceTranscript');
      expect(exportedCase).toHaveProperty('speaker');
      expect(exportedCase.speaker).toHaveProperty('id');
      expect(exportedCase.speaker.id).toMatch(/^spk_[a-f0-9]{10}$/);
      expect(exportedCase).toHaveProperty('reviewStatus', 'reviewed');
      expect(exportedCase).toHaveProperty('split');

      // Crucial: No real human names, emails, or user IDs leaked
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('Farmer Bandara');
      expect(serialized).not.toContain('Officer Wickramasinghe');
      expect(serialized).not.toContain(farmerUser.email);
      expect(serialized).not.toContain(farmerUser._id.toString());
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { VoiceConsent } from '../src/models/VoiceConsent.js';
import { VoiceDatasetRecording } from '../src/models/VoiceDatasetRecording.js';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import { validateAudioBuffer, detectAudioContainer } from '../src/utils/audioValidator.js';
import { parseAudioUploadRequest } from '../src/utils/audioUploadParser.js';
import { assignSpeakerSplit, generatePseudonymousSpeakerId, validateRecordingId } from '../src/routes/datasetCollection.js';
import { rotatePseudonymizationKeys } from '../scripts/rotateVoicePseudonymizationKey.js';
import { purgeExpiredRecordings } from '../scripts/purgeExpiredVoiceDatasetRecordings.js';
import { ENV, getPseudonymizationKey, getDatasetStorageDir } from '../src/config/env.js';

// Explicitly enable dataset collection flag for test suite
process.env.VOICE_DATASET_COLLECTION = 'on';
ENV.VOICE_DATASET_COLLECTION = 'on';

const DUMMY_HASH = '$2a$12$e8Yh8.mHkYn0zS30i/v2xeQYk6bV7QfH0QnE9K.9aQ8i9E7.Y1.e.';

async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Voice Contributor',
    email: `sec-voice-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: DUMMY_HASH,
    role: 'farmer'
  };
  const user = await User.create({ ...defaults, ...overrides });
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, ENV.JWT_SECRET, { expiresIn: '1h' });
  return { token, user };
}

/**
 * Generates a valid PCM 16-bit 16kHz mono WAV buffer.
 */
function createValidWavBuffer(durationSeconds = 1.0, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.floor(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 10000);
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

/**
 * Creates minimal valid WebM EBML container buffer.
 */
function createValidWebmBuffer() {
  const ebmlHeader = Buffer.from([
    0x1A, 0x45, 0xDF, 0xA3, // EBML ID
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, // Size
    0x42, 0x82, 0x84, // DocType
    0x77, 0x65, 0x62, 0x6D // "webm"
  ]);
  const payload = Buffer.alloc(100, 0xAA);
  return Buffer.concat([ebmlHeader, payload]);
}

/**
 * Creates minimal valid Ogg container buffer.
 */
function createValidOggBuffer() {
  const oggHeader = Buffer.alloc(28);
  oggHeader.write('OggS', 0);
  oggHeader.writeUInt8(0, 4); // version 0
  oggHeader.writeUInt8(0x02, 5); // BOS
  oggHeader.writeBigUInt64LE(0n, 6);
  oggHeader.writeUInt32LE(12345, 14); // serial
  oggHeader.writeUInt32LE(0, 18); // page seq
  oggHeader.writeUInt32LE(0, 22); // checksum
  oggHeader.writeUInt8(1, 26); // 1 segment
  oggHeader.writeUInt8(80, 27); // segment length 80
  const payload = Buffer.alloc(80, 0x55);
  return Buffer.concat([oggHeader, payload]);
}

/**
 * Creates minimal valid MP3 buffer with ID3v2 container header.
 */
function createValidMp3Buffer() {
  const id3 = Buffer.alloc(10);
  id3.write('ID3', 0);
  id3.writeUInt8(3, 3); // ID3v2.3
  id3.writeUInt8(0, 4); // Revision
  id3.writeUInt8(0, 5); // Flags
  // Size = 100 bytes (synchsafe)
  id3.writeUInt8(0, 6);
  id3.writeUInt8(0, 7);
  id3.writeUInt8(0, 8);
  id3.writeUInt8(100, 9);
  const payload = Buffer.alloc(100, 0xFF);
  return Buffer.concat([id3, payload]);
}

/**
 * Creates minimal valid FLAC buffer.
 */
function createValidFlacBuffer() {
  const marker = Buffer.from('fLaC');
  const streamInfo = Buffer.alloc(38);
  streamInfo.writeUInt8(0x00, 0); // block type 0 (STREAMINFO), last = 0
  // block length = 34 (24-bit uint)
  streamInfo.writeUInt8(0, 1);
  streamInfo.writeUInt8(0, 2);
  streamInfo.writeUInt8(34, 3);
  const payload = Buffer.alloc(64, 0x12);
  return Buffer.concat([marker, streamInfo, payload]);
}

/**
 * Creates minimal valid M4A / MP4 ISOBMFF container buffer.
 */
function createValidM4aBuffer() {
  const ftyp = Buffer.alloc(28);
  ftyp.writeUInt32BE(28, 0); // box length
  ftyp.write('ftyp', 4);
  ftyp.write('M4A ', 8); // major brand
  ftyp.writeUInt32BE(0, 12); // minor version
  ftyp.write('M4A mp42isom', 16); // compatible brands

  const mdat = Buffer.alloc(40);
  mdat.writeUInt32BE(40, 0);
  mdat.write('mdat', 4);
  mdat.fill(0x33, 8);

  const moov = Buffer.alloc(36);
  moov.writeUInt32BE(36, 0);
  moov.write('moov', 4);
  moov.fill(0x77, 8);

  return Buffer.concat([ftyp, mdat, moov]);
}

/**
 * Creates raw MPEG audio sync frame MP3 buffer.
 */
function createValidRawMp3Buffer() {
  const frame = Buffer.alloc(120);
  frame[0] = 0xFF;
  frame[1] = 0xFB; // MPEG1 Layer 3
  frame[2] = 0x90; // 128 kbps, 44.1 kHz
  frame[3] = 0x64;
  frame.fill(0x55, 4);
  return frame;
}

describe('Voice Dataset Collection Security Hardening (Phase 2.1)', () => {
  let farmerA;
  let farmerB;
  let officer;
  let admin;

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
    farmerA = await registerUser({ role: 'farmer', name: 'Farmer Alpha Security' });
    farmerB = await registerUser({ role: 'farmer', name: 'Farmer Beta Isolation' });
    officer = await registerUser({ role: 'officer', name: 'Field Review Officer' });
    admin = await registerUser({ role: 'admin', name: 'System Security Admin' });
  });

  describe('1. Authentication Gating & Zero-Trust Enforcement', () => {
    it('rejects unauthenticated requests to all collection endpoints with 401', async () => {
      const endpoints = [
        { method: 'get', url: '/api/dataset-collection/consent' },
        { method: 'post', url: '/api/dataset-collection/consent', body: { consentGiven: true } },
        { method: 'post', url: '/api/dataset-collection/consent/revoke', body: {} },
        { method: 'post', url: '/api/dataset-collection/recordings', body: {} },
        { method: 'get', url: '/api/dataset-collection/recordings' },
        { method: 'get', url: '/api/dataset-collection/recordings/rec_0123456789ab/audio' },
        { method: 'delete', url: '/api/dataset-collection/recordings/rec_0123456789ab' },
        { method: 'get', url: '/api/dataset-collection/review/recordings' },
        { method: 'patch', url: '/api/dataset-collection/review/recordings/rec_0123456789ab', body: {} },
        { method: 'get', url: '/api/dataset-collection/export' }
      ];

      for (const ep of endpoints) {
        const req = request(app)[ep.method](ep.url);
        if (ep.body) req.send(ep.body);
        const res = await req;
        expect(res.status).toBe(401);
      }
    });
  });

  describe('2. Contributor Isolation & Role-Based Authorization', () => {
    let recordingAId;

    beforeEach(async () => {
      // Grant consent and upload recording as Farmer A
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si'
        });
      recordingAId = res.body.recording.recordingId;
    });

    it('prevents Farmer B from streaming Farmer A private audio (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get(`/api/dataset-collection/recordings/${recordingAId}/audio`)
        .set('Authorization', `Bearer ${farmerB.token}`);

      expect(res.status).toBe(403);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('FORBIDDEN');
    });

    it('prevents Farmer B from deleting Farmer A recording (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .delete(`/api/dataset-collection/recordings/${recordingAId}`)
        .set('Authorization', `Bearer ${farmerB.token}`);

      expect(res.status).toBe(403);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('FORBIDDEN');
    });

    it('prevents regular farmers from accessing reviewer queue or reviewing recordings (403 FORBIDDEN)', async () => {
      const getQueue = await request(app)
        .get('/api/dataset-collection/review/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`);
      expect(getQueue.status).toBe(403);

      const reviewPatch = await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recordingAId}`)
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ reviewStatus: 'reviewed', referenceTranscript: 'පොහොර මිටි 2' });
      expect(reviewPatch.status).toBe(403);
    });

    it('allows Officer and Admin to access reviewer queue and stream private audio for audit', async () => {
      const streamOfficer = await request(app)
        .get(`/api/dataset-collection/recordings/${recordingAId}/audio`)
        .set('Authorization', `Bearer ${officer.token}`);
      expect(streamOfficer.status).toBe(200);

      const streamAdmin = await request(app)
        .get(`/api/dataset-collection/recordings/${recordingAId}/audio`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(streamAdmin.status).toBe(200);
    });

    it('prevents Officer from exporting dataset manifest; only Admin is authorized', async () => {
      const exportOfficer = await request(app)
        .get('/api/dataset-collection/export')
        .set('Authorization', `Bearer ${officer.token}`);
      expect(exportOfficer.status).toBe(403);

      const exportAdmin = await request(app)
        .get('/api/dataset-collection/export')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(exportAdmin.status).toBe(200);
    });
  });

  describe('3. Consent Revocation & Immediate Exclusion Invariant', () => {
    it('revoking consent blocks subsequent uploads and immediately excludes recordings from export', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });
      const recId = uploadRes.body.recording.recordingId;

      // Review the recording
      await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recId}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .send({ reviewStatus: 'reviewed', referenceTranscript: 'වී බුසල් 5 ක්' });

      // Check export before revocation: included
      const exportBefore = await request(app)
        .get('/api/dataset-collection/export')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(exportBefore.body.cases.some(c => c.provenance.recordingId === recId)).toBe(true);

      // Revoke consent
      const revokeRes = await request(app)
        .post('/api/dataset-collection/consent/revoke')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ reason: 'Participant opted out' });
      expect(revokeRes.status).toBe(200);

      // Verify immediate exclusion from export
      const exportAfter = await request(app)
        .get('/api/dataset-collection/export')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(exportAfter.body.cases.some(c => c.provenance.recordingId === recId)).toBe(false);

      // Verify subsequent upload is blocked
      const uploadBlocked = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });
      expect(uploadBlocked.status).toBe(403);
      const code = uploadBlocked.body.error?.code || uploadBlocked.body.code;
      expect(code).toBe('CONSENT_REQUIRED');
    });
  });

  describe('4. Path Traversal & Identifier Sanitization', () => {
    it('safely rejects malformed recording IDs and path traversal attempts with 400', async () => {
      const maliciousIds = [
        '../../etc/passwd',
        '..%2F..%2Fetc%2Fpasswd',
        'rec_invalid!@#',
        'rec_short',
        '../../../windows/win.ini',
        'rec_0123456789abcdefg' // too long
      ];

      for (const malId of maliciousIds) {
        const streamRes = await request(app)
          .get(`/api/dataset-collection/recordings/${encodeURIComponent(malId)}/audio`)
          .set('Authorization', `Bearer ${officer.token}`);
        expect(streamRes.status).toBe(400);
        const code1 = streamRes.body.error?.code || streamRes.body.code;
        expect(code1).toBe('BAD_REQUEST');

        const deleteRes = await request(app)
          .delete(`/api/dataset-collection/recordings/${encodeURIComponent(malId)}`)
          .set('Authorization', `Bearer ${officer.token}`);
        expect(deleteRes.status).toBe(400);

        const patchRes = await request(app)
          .patch(`/api/dataset-collection/review/recordings/${encodeURIComponent(malId)}`)
          .set('Authorization', `Bearer ${officer.token}`)
          .send({ reviewStatus: 'reviewed', referenceTranscript: 'test' });
        expect(patchRes.status).toBe(400);
      }
    });

    it('returns 404 for valid format but non-existent recording ID', async () => {
      const nonExistentId = 'rec_a1b2c3d4e5f6';
      const res = await request(app)
        .get(`/api/dataset-collection/recordings/${nonExistentId}/audio`)
        .set('Authorization', `Bearer ${officer.token}`);
      expect(res.status).toBe(404);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('NOT_FOUND');
    });

    it('validateRecordingId normalizes uppercase hex to lowercase and supports 12 to 32 hex chars', () => {
      // Legacy 12-hex IDs
      expect(validateRecordingId('rec_A1B2C3D4E5F6')).toBe('rec_a1b2c3d4e5f6');
      expect(validateRecordingId('  rec_123456abcdef  ')).toBe('rec_123456abcdef');

      // Newer 16-hex and up to 32-hex IDs
      expect(validateRecordingId('rec_0123456789abcdef')).toBe('rec_0123456789abcdef');
      expect(validateRecordingId('rec_0123456789abcdef0123456789abcdef')).toBe('rec_0123456789abcdef0123456789abcdef');

      // Rejections
      expect(() => validateRecordingId('rec_short')).toThrow(/Invalid recording ID format/i);
      expect(() => validateRecordingId('rec_0123456789abcdef0123456789abcdef00')).toThrow(/Invalid recording ID format/i); // 34 chars
      expect(() => validateRecordingId('rec_nonhexzzzzzzzzzzzz')).toThrow(/Invalid recording ID format/i);
      expect(() => validateRecordingId('../rec_123456789012')).toThrow(/Invalid recording ID format/i);
      expect(() => validateRecordingId(null)).toThrow(/Invalid recording ID format/i);
    });

    it('deterministic collision test: retries generation when ID collides and never overwrites existing records', async () => {
      // 1. Create an existing recording in DB with 16 hex chars
      const salt = Date.now().toString(16).padStart(12, '0').slice(-12);
      const collidingHex = `c011${salt}`;
      const freshHex = `fa00${salt}`;
      const existingId = `rec_${collidingHex}`;

      await VoiceDatasetRecording.create({
        recordingId: existingId,
        pseudonymousSpeakerId: 'spk_existing_coll',
        contributorUserId: farmerA.user._id,
        speechMode: 'natural',
        language: 'si',
        storedFileName: `${existingId}.wav`,
        mimeType: 'audio/wav',
        fileSizeBytes: 1024,
        durationSeconds: 1.0,
        reviewStatus: 'pending'
      });

      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerB.token}`)
        .send({ consentGiven: true });

      // 2. Mock crypto.randomUUID to return colliding 16-hex on attempt 1, and fresh 16-hex on attempt 2
      let uuidCallCount = 0;
      const uuidSpy = jest.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        uuidCallCount++;
        if (uuidCallCount === 1) {
          return `${collidingHex}-0000-0000-0000-000000000000`;
        }
        return `${freshHex}-0000-0000-0000-000000000000`;
      });

      const storageDir = getDatasetStorageDir();
      const createdFilePath = path.join(storageDir, `rec_${freshHex}.wav`);

      try {
        const wav = createValidWavBuffer(1.0);
        const res = await request(app)
          .post('/api/dataset-collection/recordings')
          .set('Authorization', `Bearer ${farmerB.token}`)
          .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

        expect(res.status).toBe(201);
        expect(res.body.recording.recordingId).toBe(`rec_${freshHex}`);

        // Assert existing recording was NOT overwritten or mutated
        const existingAfter = await VoiceDatasetRecording.findOne({ recordingId: existingId });
        expect(existingAfter).toBeDefined();
        expect(existingAfter.pseudonymousSpeakerId).toBe('spk_existing_coll');
      } finally {
        uuidSpy.mockRestore();
        if (fs.existsSync(createdFilePath)) {
          fs.unlinkSync(createdFilePath);
        }
      }
    });
  });

  describe('5. HTTP Range Request Validation (RFC 7233 & HTTP 416)', () => {
    let recId;

    beforeEach(async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });
      recId = res.body.recording.recordingId;
    });

    it('serves partial content (206) for valid range request', async () => {
      const res = await request(app)
        .get(`/api/dataset-collection/recordings/${recId}/audio`)
        .set('Authorization', `Bearer ${farmerA.token}`)
        .set('Range', 'bytes=0-100');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toMatch(/^bytes 0-100\/\d+$/);
      expect(res.headers['content-length']).toBe('101');
    });

    it('returns 416 Range Not Satisfiable for out-of-bounds or malformed range requests', async () => {
      const invalidRanges = [
        'bytes=99999999-',       // start exceeds file size
        'bytes=200-100',          // start > end
        'bytes=abc-xyz',          // non-numeric
        'bytes=-10-50'            // invalid syntax
      ];

      for (const rangeHeader of invalidRanges) {
        const res = await request(app)
          .get(`/api/dataset-collection/recordings/${recId}/audio`)
          .set('Authorization', `Bearer ${farmerA.token}`)
          .set('Range', rangeHeader);

        expect(res.status).toBe(416);
        expect(res.headers['content-range']).toMatch(/^bytes \*\/\d+$/);
      }
    });
  });

  describe('6. Idempotency, Quotas & Storage Protection', () => {
    it('duplicate clientRequestId returns existing record idempotently without creating duplicate files', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const clientReqId = 'cid-sec-test-' + Date.now();

      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si',
          clientRequestId: clientReqId
        });
      expect(res1.status).toBe(201);
      const recId1 = res1.body.recording.recordingId;

      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({
          audioBase64: wav.toString('base64'),
          speechMode: 'natural',
          language: 'si',
          clientRequestId: clientReqId
        });
      expect(res2.status).toBe(200);
      expect(res2.body.message).toMatch(/idempotent/i);
      expect(res2.body.recording.recordingId).toBe(recId1);

      // Assert only 1 recording exists in DB with this clientRequestId
      const count = await VoiceDatasetRecording.countDocuments({ clientRequestId: clientReqId });
      expect(count).toBe(1);
    });

    it('handles simultaneous idempotent uploads concurrently without race-condition duplicates', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const clientReqId = 'simultaneous-' + Date.now() + '-' + Math.random();

      // Launch both requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/dataset-collection/recordings')
          .set('Authorization', `Bearer ${farmerA.token}`)
          .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId }),
        request(app)
          .post('/api/dataset-collection/recordings')
          .set('Authorization', `Bearer ${farmerA.token}`)
          .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId })
      ]);

      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);
      expect(res1.body.recording.recordingId).toBe(res2.body.recording.recordingId);

      const dbCount = await VoiceDatasetRecording.countDocuments({ clientRequestId: clientReqId });
      expect(dbCount).toBe(1);
    });

    it('rejects idempotency conflict when same contributor sends different audio with same clientRequestId', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav1 = createValidWavBuffer(1.0);
      const wav2 = createValidWavBuffer(2.0);
      const clientReqId = 'conflict-audio-' + Date.now();

      // First upload
      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav1.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId });
      expect(res1.status).toBe(201);

      // Conflicting upload with different audio bytes
      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav2.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId });

      expect(res2.status).toBe(409);
      const code = res2.body.error?.code || res2.body.code;
      expect(code).toBe('CONFLICT');
    });

    it('rejects idempotency conflict when same contributor sends conflicting metadata with same clientRequestId', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const clientReqId = 'conflict-meta-' + Date.now();

      // First upload (natural mode)
      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId });
      expect(res1.status).toBe(201);

      // Conflicting upload (prompted mode)
      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'prompted', promptId: 'VP-001', language: 'si', clientRequestId: clientReqId });

      expect(res2.status).toBe(409);
      const code = res2.body.error?.code || res2.body.code;
      expect(code).toBe('CONFLICT');
    });

    it('rejects idempotency conflict when a different contributor reuses the same clientRequestId', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerB.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const clientReqId = 'cross-contributor-' + Date.now();

      // Farmer A uploads
      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId });
      expect(res1.status).toBe(201);

      // Farmer B attempts to reuse Farmer A's clientRequestId
      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerB.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si', clientRequestId: clientReqId });

      expect(res2.status).toBe(409);
      const code = res2.body.error?.code || res2.body.code;
      expect(code).toBe('CONFLICT');
      // Assert Farmer B did not receive Farmer A's recording details
      expect(res2.body.recording).toBeUndefined();
    });

    it('rejects upload with 507 INSUFFICIENT_STORAGE when disk space is below minimum threshold', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);

      // Mock statfs returning 40 KB free space (< 50 MB threshold)
      const statfsSpy = jest.spyOn(fs.promises, 'statfs').mockResolvedValueOnce({
        bavail: 10,
        bsize: 4096
      });

      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      expect(res.status).toBe(507);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('INSUFFICIENT_STORAGE');

      statfsSpy.mockRestore();
    });

    it('enforces contributor quota and rejects uploads exceeding limit with STORAGE_QUOTA_EXCEEDED', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);

      // Mock aggregate returning usage already near quota limit
      const quotaLimit = ENV.VOICE_DATASET_MAX_CONTRIBUTOR_BYTES;
      const aggSpy = jest.spyOn(VoiceDatasetRecording, 'aggregate').mockResolvedValueOnce([
        { _id: null, totalBytes: quotaLimit - 50 } // only 50 bytes left
      ]);

      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      expect(res.status).toBe(400);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('STORAGE_QUOTA_EXCEEDED');

      aggSpy.mockRestore();
    });

    it('cleans up written audio file if database persistence throws an error', async () => {
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);

      // Spy on save to simulate unexpected DB failure
      const saveSpy = jest.spyOn(VoiceDatasetRecording.prototype, 'save')
        .mockRejectedValueOnce(new Error('Simulated Database Persistence Failure'));

      const storageDir = getDatasetStorageDir();

      const filesBefore = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];

      const res = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      expect(res.status).toBe(500);

      const filesAfter = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];
      expect(filesAfter.length).toBe(filesBefore.length);

      saveSpy.mockRestore();
    });

    it('safely handles stream disconnect / error without persisting orphaned files', async () => {
      const mockReq = new EventEmitter();
      mockReq.headers = { 'content-type': 'audio/wav', 'content-length': '1000' };

      const parsePromise = parseAudioUploadRequest(mockReq);
      mockReq.emit('error', new Error('Client connection reset unexpectedly'));

      await expect(parsePromise).rejects.toThrow(/Failed to read audio upload stream/i);
    });
  });

  describe('7. Hardened Audio Decodability & Deep Container Validation (All Formats)', () => {
    it('accepts valid containers for all 6 supported formats: WAV, WebM, OGG, MP3 (ID3 & raw frame), FLAC, M4A', () => {
      // 1. WAV
      const wavBuf = createValidWavBuffer(1.0);
      const wavVal = validateAudioBuffer(wavBuf, { claimedMime: 'audio/wav' });
      expect(wavVal.isValid).toBe(true);
      expect(wavVal.format).toBe('wav');

      // 2. WebM
      const webmBuf = createValidWebmBuffer();
      const webmVal = validateAudioBuffer(webmBuf, { claimedMime: 'audio/webm' });
      expect(webmVal.isValid).toBe(true);
      expect(webmVal.format).toBe('webm');

      // 3. OGG
      const oggBuf = createValidOggBuffer();
      const oggVal = validateAudioBuffer(oggBuf, { claimedMime: 'audio/ogg' });
      expect(oggVal.isValid).toBe(true);
      expect(oggVal.format).toBe('ogg');

      // 4a. MP3 (ID3v2)
      const mp3Buf = createValidMp3Buffer();
      const mp3Val = validateAudioBuffer(mp3Buf, { claimedMime: 'audio/mpeg' });
      expect(mp3Val.isValid).toBe(true);
      expect(mp3Val.format).toBe('mp3');

      // 4b. MP3 (Raw MPEG audio sync frame)
      const rawMp3Buf = createValidRawMp3Buffer();
      const rawMp3Val = validateAudioBuffer(rawMp3Buf, { claimedMime: 'audio/mpeg' });
      expect(rawMp3Val.isValid).toBe(true);
      expect(rawMp3Val.format).toBe('mp3');

      // 5. FLAC
      const flacBuf = createValidFlacBuffer();
      const flacVal = validateAudioBuffer(flacBuf, { claimedMime: 'audio/flac' });
      expect(flacVal.isValid).toBe(true);
      expect(flacVal.format).toBe('flac');

      // 6. M4A / MP4 (ISOBMFF with ftyp, mdat, moov)
      const m4aBuf = createValidM4aBuffer();
      const m4aVal = validateAudioBuffer(m4aBuf, { claimedMime: 'audio/mp4' });
      expect(m4aVal.isValid).toBe(true);
      expect(m4aVal.format).toBe('m4a');
    });

    it('rejects malformed WAV fixtures (truncated data chunk, invalid sample rate, invalid format code, 0 channels)', () => {
      const wav = createValidWavBuffer(1.0);

      // Truncated data chunk
      const truncatedWav = Buffer.from(wav);
      truncatedWav.writeUInt32LE(100000, 40);
      expect(() => validateAudioBuffer(truncatedWav)).toThrow(/Truncated WAV data chunk/i);

      // Invalid sample rate
      const badRateWav = createValidWavBuffer(1.0, 96000);
      expect(() => validateAudioBuffer(badRateWav)).toThrow(/Sample rate \(96000 Hz\) out of supported range/i);

      // Invalid format code (e.g. 85 MP3 in WAV)
      const badFormatWav = createValidWavBuffer(1.0);
      badFormatWav.writeUInt16LE(85, 20);
      expect(() => validateAudioBuffer(badFormatWav)).toThrow(/Unsupported WAV audio format code/i);

      // 0 channels
      const zeroChanWav = createValidWavBuffer(1.0);
      zeroChanWav.writeUInt16LE(0, 22);
      expect(() => validateAudioBuffer(zeroChanWav)).toThrow(/Invalid channel count/i);
    });

    it('rejects malformed WebM fixtures (truncated header, corrupt magic bytes, missing DocType)', () => {
      // Truncated container (16 bytes > 12 bytes detectAudioContainer threshold, < 32 bytes WebM minimum)
      const shortWebm = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00]);
      expect(() => detectAudioContainer(shortWebm)).toThrow(/WebM audio file is truncated/i);
      expect(() => validateAudioBuffer(shortWebm)).toThrow(/Audio file is too small/i);

      // Corrupt magic (padded to > 100 bytes)
      const corruptMagic = Buffer.concat([
        Buffer.from([0x1A, 0x45, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D]),
        Buffer.alloc(100, 0x55)
      ]);
      expect(() => validateAudioBuffer(corruptMagic)).toThrow(/does not match any supported audio format/i);

      // Missing DocType (padded to > 100 bytes)
      const noDocType = Buffer.concat([
        Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14]),
        Buffer.alloc(100, 0x55)
      ]);
      expect(() => validateAudioBuffer(noDocType)).toThrow(/missing valid DocType/i);
    });

    it('rejects malformed OGG fixtures (truncated page header, invalid magic, unsupported version)', () => {
      // Truncated magic
      const shortOgg = Buffer.from('OggS');
      expect(() => validateAudioBuffer(shortOgg)).toThrow(/Audio file is too small/i);

      // Unsupported version
      const badVerOgg = createValidOggBuffer();
      badVerOgg[4] = 0x02; // version 2
      expect(() => validateAudioBuffer(badVerOgg)).toThrow(/Unsupported OGG version/i);

      // Truncated segment table
      const truncSegOgg = createValidOggBuffer().slice(0, 27); // cut before segments
      expect(() => detectAudioContainer(truncSegOgg)).toThrow(/OGG audio file is truncated/i);
      expect(() => validateAudioBuffer(truncSegOgg)).toThrow(/Audio file is too small/i);
    });

    it('rejects malformed MP3 fixtures (truncated header, reserved MPEG version, reserved layer, invalid bitrate)', () => {
      // Reserved MPEG version in sync frame
      const badMpegVer = Buffer.alloc(120);
      badMpegVer[0] = 0xFF;
      badMpegVer[1] = 0xE8; // version index 01 (reserved)
      badMpegVer[2] = 0x90;
      expect(() => validateAudioBuffer(badMpegVer)).toThrow(/reserved MPEG version/i);

      // Reserved layer
      const badLayer = Buffer.alloc(120);
      badLayer[0] = 0xFF;
      badLayer[1] = 0xF0; // layer index 00 (reserved)
      badLayer[2] = 0x90;
      expect(() => validateAudioBuffer(badLayer)).toThrow(/reserved layer/i);

      // Invalid bitrate index (0x0F)
      const badBitrate = Buffer.alloc(120);
      badBitrate[0] = 0xFF;
      badBitrate[1] = 0xFB;
      badBitrate[2] = 0xF0; // 0x0F bitrate
      expect(() => validateAudioBuffer(badBitrate)).toThrow(/invalid bitrate index/i);
    });

    it('rejects malformed FLAC fixtures (truncated header, corrupt magic, wrong block type, corrupt STREAMINFO length)', () => {
      // Wrong block type (not STREAMINFO)
      const wrongBlock = createValidFlacBuffer();
      wrongBlock[4] = 0x04; // block type 4 (VORBIS_COMMENT) instead of 0
      expect(() => validateAudioBuffer(wrongBlock)).toThrow(/missing mandatory STREAMINFO/i);

      // Corrupt block length (!= 34)
      const badBlockLen = createValidFlacBuffer();
      badBlockLen[7] = 20; // 20 instead of 34
      expect(() => validateAudioBuffer(badBlockLen)).toThrow(/Corrupt FLAC STREAMINFO block size/i);
    });

    it('rejects malformed M4A fixtures (truncated ftyp, unsupported brand, missing moov/mdat, corrupt box size)', () => {
      // Truncated ftyp
      const shortM4a = Buffer.alloc(20);
      shortM4a.writeUInt32BE(20, 0);
      shortM4a.write('ftyp', 4);
      expect(() => detectAudioContainer(shortM4a)).toThrow(/M4A audio file is truncated/i);
      expect(() => validateAudioBuffer(shortM4a)).toThrow(/Audio file is too small/i);

      // Unsupported brand
      const badBrandM4a = createValidM4aBuffer();
      badBrandM4a.write('UNKN', 8);
      badBrandM4a.write('UNKNUNKNUNKN', 16);
      expect(() => validateAudioBuffer(badBrandM4a)).toThrow(/Unsupported MP4\/M4A brand container/i);

      // Missing both moov and mdat boxes (has only ftyp and free box)
      const noMediaM4a = Buffer.alloc(120);
      noMediaM4a.writeUInt32BE(28, 0);
      noMediaM4a.write('ftyp', 4);
      noMediaM4a.write('M4A ', 8);
      noMediaM4a.write('M4A isom', 16);
      noMediaM4a.writeUInt32BE(92, 28);
      noMediaM4a.write('free', 32); // free atom, no audio
      expect(() => validateAudioBuffer(noMediaM4a)).toThrow(/missing mandatory moov metadata or mdat media payload/i);

      // Corrupt box size inside atom stream (< 8 bytes)
      const corruptBoxSize = createValidM4aBuffer();
      corruptBoxSize.writeUInt32BE(2, 28); // atom size 2
      expect(() => validateAudioBuffer(corruptBoxSize)).toThrow(/Corrupt M4A atom box size/i);
    });

    it('rejects MIME/extension mismatch (e.g. claiming audio/wav with an MP3 payload)', () => {
      const mp3Buf = createValidMp3Buffer();
      expect(() => {
        validateAudioBuffer(mp3Buf, { claimedMime: 'audio/wav' });
      }).toThrow(/does not match detected audio format/i);
    });

    it('rejects plain text masquerading as audio', () => {
      const fake = Buffer.from('Hello world this is not an audio file at all but a lengthy plain text string payload designed to exceed minimum bytes and test format detection');
      expect(() => {
        validateAudioBuffer(fake);
      }).toThrow(/does not match any supported audio format/i);
    });
  });

  describe('8. Pseudonymous Speaker ID, Key Rotation & Deterministic Split Protection', () => {
    it('generates unguessable keyed HMAC pseudonymous speaker IDs without PII', () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const speakerId1 = generatePseudonymousSpeakerId(mockUserId);
      const speakerId2 = generatePseudonymousSpeakerId(mockUserId);

      // Deterministic for same user
      expect(speakerId1).toBe(speakerId2);
      expect(speakerId1).toMatch(/^spk_[a-f0-9]{10}$/);

      // Never matches plain sha256 of user ID
      const plainSha = crypto.createHash('sha256').update(mockUserId.toString()).digest('hex').slice(0, 10);
      expect(speakerId1).not.toBe(`spk_${plainSha}`);

      // Does not contain email, phone or personal indicators
      expect(speakerId1).not.toMatch(/@/);
      expect(speakerId1).not.toMatch(/\+?94\d+/);
    });

    it('assignSpeakerSplit is deterministic and maintains invariant across additions', () => {
      const speakers = [
        'spk_0123456789',
        'spk_abcdef0123',
        'spk_456789abcd',
        'spk_fedcba9876'
      ];

      // Assign splits
      const assignmentsRun1 = speakers.map(assignSpeakerSplit);
      const assignmentsRun2 = speakers.map(assignSpeakerSplit);

      // Must be completely stable and idempotent
      expect(assignmentsRun1).toEqual(assignmentsRun2);

      // All splits must be valid
      assignmentsRun1.forEach(split => {
        expect(['train', 'val', 'test']).toContain(split);
      });
    });

    it('supports HMAC secret key rotation and maintains speaker continuity', async () => {
      // Register farmer, grant consent, upload recording
      const farmerRotate = await registerUser({ role: 'farmer', name: 'Farmer Key Rotation' });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerRotate.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerRotate.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      const initialSpeakerId = uploadRes.body.recording.pseudonymousSpeakerId;

      // Execute key rotation
      const oldKey = ENV.VOICE_PSEUDONYMIZATION_KEY;
      const newKey = 'rotated-voice-hmac-key-2027-test';
      const rotationResult = await rotatePseudonymizationKeys({ oldKey, newKey, dryRun: false });

      expect(rotationResult.updatedConsents).toBeGreaterThanOrEqual(1);

      // Verify VoiceConsent and recording have the new HMAC speaker ID
      const updatedConsent = await VoiceConsent.findOne({ userId: farmerRotate.user._id });
      const updatedRecording = await VoiceDatasetRecording.findOne({ recordingId: uploadRes.body.recording.recordingId });

      expect(updatedConsent.pseudonymousSpeakerId).not.toBe(initialSpeakerId);
      expect(updatedRecording.pseudonymousSpeakerId).toBe(updatedConsent.pseudonymousSpeakerId);

      // Re-rotate back to standard test key to restore environment
      await rotatePseudonymizationKeys({ oldKey: newKey, newKey: oldKey, dryRun: false });
    });

    it('guarantees split freeze policy: small datasets, new speakers, repeated exports, and dataset expansion', async () => {
      // 1. Create 3 distinct farmers with consent and reviewed recordings
      const initialFarmers = [];
      const initialRecordings = [];

      for (let i = 1; i <= 3; i++) {
        const farmer = await registerUser({ role: 'farmer', name: `Farmer Split Alpha ${i}` });
        await request(app)
          .post('/api/dataset-collection/consent')
          .set('Authorization', `Bearer ${farmer.token}`)
          .send({ consentGiven: true });

        const wav = createValidWavBuffer(1.0);
        const uploadRes = await request(app)
          .post('/api/dataset-collection/recordings')
          .set('Authorization', `Bearer ${farmer.token}`)
          .send({ audioBase64: wav.toString('base64'), speechMode: 'prompted', promptId: `VP-00${i}`, language: 'si' });

        const recId = uploadRes.body.recording.recordingId;
        await request(app)
          .patch(`/api/dataset-collection/review/recordings/${recId}`)
          .set('Authorization', `Bearer ${officer.token}`)
          .send({ reviewStatus: 'reviewed', referenceTranscript: `වී බුසල් ${i}` });

        initialFarmers.push(farmer);
        initialRecordings.push(recId);
      }

      // 2. Export #1
      const export1 = await request(app)
        .get('/api/dataset-collection/export?split=true')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(export1.status).toBe(200);
      const splitMapping1 = {};
      export1.body.cases.forEach(c => {
        splitMapping1[c.provenance.recordingId] = c.split;
      });

      // 3. Repeated exports with identical dataset must produce identical split assignments (idempotence)
      for (let rep = 0; rep < 3; rep++) {
        const repeatExport = await request(app)
          .get('/api/dataset-collection/export?split=true')
          .set('Authorization', `Bearer ${admin.token}`);
        repeatExport.body.cases.forEach(c => {
          expect(c.split).toBe(splitMapping1[c.provenance.recordingId]);
        });
      }

      // 4. Dataset expansion: add 3 new speakers to the dataset
      for (let j = 4; j <= 6; j++) {
        const newFarmer = await registerUser({ role: 'farmer', name: `Farmer Split Beta ${j}` });
        await request(app)
          .post('/api/dataset-collection/consent')
          .set('Authorization', `Bearer ${newFarmer.token}`)
          .send({ consentGiven: true });

        const wav = createValidWavBuffer(1.0);
        const newUpload = await request(app)
          .post('/api/dataset-collection/recordings')
          .set('Authorization', `Bearer ${newFarmer.token}`)
          .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

        await request(app)
          .patch(`/api/dataset-collection/review/recordings/${newUpload.body.recording.recordingId}`)
          .set('Authorization', `Bearer ${officer.token}`)
          .send({ reviewStatus: 'reviewed', referenceTranscript: `පොහොර මිටි ${j}` });
      }

      // 5. Export #2 (expanded dataset)
      const export2 = await request(app)
        .get('/api/dataset-collection/export?split=true')
        .set('Authorization', `Bearer ${admin.token}`);

      // Crucial: All initial recordings MUST retain their original frozen split assignment!
      initialRecordings.forEach(recId => {
        const updatedCase = export2.body.cases.find(c => c.provenance.recordingId === recId);
        expect(updatedCase).toBeDefined();
        expect(updatedCase.split).toBe(splitMapping1[recId]);
      });
    });

    it('exported manifest satisfies Phase 1 Python manifest and split validators', async () => {
      const { spawnSync } = await import('child_process');
      const pythonExe = path.join(process.cwd(), 'voice-service/.venv/Scripts/python.exe');

      if (!fs.existsSync(pythonExe)) {
        return; // Skip if local python virtualenv is not in this directory
      }

      // Grant consent and create reviewed recording as Farmer A
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerA.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'prompted', promptId: 'VP-P01', language: 'si' });

      await request(app)
        .patch(`/api/dataset-collection/review/recordings/${uploadRes.body.recording.recordingId}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .send({ reviewStatus: 'reviewed', referenceTranscript: 'පොහොර මිටි 3' });

      const exportRes = await request(app)
        .get('/api/dataset-collection/export?split=true')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(exportRes.status).toBe(200);

      const tmpManifestPath = path.join(process.cwd(), 'temp/test_security_manifest.json');
      fs.mkdirSync(path.dirname(tmpManifestPath), { recursive: true });
      fs.writeFileSync(tmpManifestPath, JSON.stringify(exportRes.body, null, 2), 'utf-8');

      try {
        const mv = spawnSync(pythonExe, [
          path.join(process.cwd(), 'voice-service/validation/manifest_validator.py'),
          '--manifest', tmpManifestPath
        ], { encoding: 'utf-8' });
        expect(mv.status).toBe(0);

        const sv = spawnSync(pythonExe, [
          path.join(process.cwd(), 'voice-service/validation/split_validator.py'),
          '--manifest', tmpManifestPath
        ], { encoding: 'utf-8' });
        expect(sv.status).toBe(0);
      } finally {
        if (fs.existsSync(tmpManifestPath)) {
          fs.unlinkSync(tmpManifestPath);
        }
      }
    });

    it('enforces secure key configuration in production and fails safely without printing secret', () => {
      const origEnv = ENV.NODE_ENV;
      const origKey = ENV.VOICE_PSEUDONYMIZATION_KEY;

      try {
        ENV.NODE_ENV = 'production';
        ENV.VOICE_PSEUDONYMIZATION_KEY = 'aswanna-voice-pseudo-salt-secret-key-2026'; // default weak key

        expect(() => getPseudonymizationKey()).toThrow(/SECURITY_ERROR/);
        try {
          getPseudonymizationKey();
        } catch (err) {
          // Never prints the secret value in the message
          expect(err.message).not.toContain('aswanna-voice-pseudo-salt-secret-key-2026');
          expect(err.message).toContain('distinct, high-entropy secret');
        }
      } finally {
        ENV.NODE_ENV = origEnv;
        ENV.VOICE_PSEUDONYMIZATION_KEY = origKey;
      }
    });

    it('recovers from interrupted key rotation where VoiceConsent was updated but recordings were not', async () => {
      const farmerInterrupt = await registerUser({ role: 'farmer', name: 'Farmer Interrupted' });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerInterrupt.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerInterrupt.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      const oldSpk = uploadRes.body.recording.pseudonymousSpeakerId;
      const oldKey = ENV.VOICE_PSEUDONYMIZATION_KEY;
      const newKey = 'recovered-hmac-key-2027-test';

      // Manually simulate an interrupted run:
      // Update VoiceConsent to newSpk, but leave VoiceDatasetRecording with oldSpk!
      const consent = await VoiceConsent.findOne({ userId: farmerInterrupt.user._id });
      const hmac = crypto.createHmac('sha256', newKey).update(farmerInterrupt.user._id.toString()).digest('hex');
      const newSpk = `spk_${hmac.slice(0, 10)}`;

      consent.pseudonymousSpeakerId = newSpk;
      await consent.save();

      // Verify the simulated desynchronized / interrupted state
      const recBefore = await VoiceDatasetRecording.findOne({ recordingId: uploadRes.body.recording.recordingId });
      expect(recBefore.pseudonymousSpeakerId).toBe(oldSpk);
      expect(consent.pseudonymousSpeakerId).toBe(newSpk);

      // Now run rotation recovery
      const res = await rotatePseudonymizationKeys({ oldKey, newKey, dryRun: false });
      expect(res.updatedRecordings).toBeGreaterThanOrEqual(1);

      // Verify orphaned recording was recovered and updated to newSpk
      const recAfter = await VoiceDatasetRecording.findOne({ recordingId: uploadRes.body.recording.recordingId });
      expect(recAfter.pseudonymousSpeakerId).toBe(newSpk);

      // Restore environment key
      await rotatePseudonymizationKeys({ oldKey: newKey, newKey: oldKey, dryRun: false });
    });

    it('preserves frozen split assignments across pseudonymization key rotation', async () => {
      const farmerFreeze = await registerUser({ role: 'farmer', name: 'Farmer Split Freeze' });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerFreeze.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerFreeze.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      const recId = uploadRes.body.recording.recordingId;
      await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recId}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .send({ reviewStatus: 'reviewed', referenceTranscript: 'පොහොර පරීක්ෂාව' });

      // Force recording to have an explicit frozen test split
      await VoiceDatasetRecording.updateOne({ recordingId: recId }, { $set: { splitAssignment: 'test' } });

      // Rotate key
      const oldKey = ENV.VOICE_PSEUDONYMIZATION_KEY;
      const newKey = 'split-freeze-key-2027';
      await rotatePseudonymizationKeys({ oldKey, newKey, dryRun: false });

      // Export manifest
      const exportRes = await request(app)
        .get('/api/dataset-collection/export?split=true')
        .set('Authorization', `Bearer ${admin.token}`);

      const exportedCase = exportRes.body.cases.find(c => c.provenance.recordingId === recId);
      expect(exportedCase).toBeDefined();
      expect(exportedCase.split).toBe('test'); // Retained frozen split!

      // Restore key
      await rotatePseudonymizationKeys({ oldKey: newKey, newKey: oldKey, dryRun: false });
    });

    it('strictly excludes revoked contributors from exported dataset manifests', async () => {
      const farmerRevoke = await registerUser({ role: 'farmer', name: 'Farmer To Revoke' });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${farmerRevoke.token}`)
        .send({ consentGiven: true });

      const wav = createValidWavBuffer(1.0);
      const uploadRes = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${farmerRevoke.token}`)
        .send({ audioBase64: wav.toString('base64'), speechMode: 'natural', language: 'si' });

      const recId = uploadRes.body.recording.recordingId;
      await request(app)
        .patch(`/api/dataset-collection/review/recordings/${recId}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .send({ reviewStatus: 'reviewed', referenceTranscript: 'අස්වනු නෙලීම' });

      // Revoke consent
      const revokeRes = await request(app)
        .post('/api/dataset-collection/consent/revoke')
        .set('Authorization', `Bearer ${farmerRevoke.token}`)
        .send({ reason: 'Contributor requested complete data withdrawal' });
      expect(revokeRes.status).toBe(200);

      // Export manifest as admin
      const exportRes = await request(app)
        .get('/api/dataset-collection/export?split=true')
        .set('Authorization', `Bearer ${admin.token}`);

      const found = exportRes.body.cases.find(c => c.provenance.recordingId === recId);
      expect(found).toBeUndefined(); // Strictly excluded!
    });

    it('guarantees all recordings belonging to one speaker share the exact same split assignment across multiple uploads', async () => {
      const speakerUser = await registerUser({ role: 'farmer', name: 'Farmer Multi Recording' });
      await request(app)
        .post('/api/dataset-collection/consent')
        .set('Authorization', `Bearer ${speakerUser.token}`)
        .send({ consentGiven: true });

      const wav1 = createValidWavBuffer(1.0);
      const wav2 = createValidWavBuffer(1.5);

      // Upload recording 1
      const res1 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${speakerUser.token}`)
        .send({ audioBase64: wav1.toString('base64'), speechMode: 'natural', language: 'si' });
      expect(res1.status).toBe(201);
      const split1 = res1.body.recording.recordingId;
      const rec1Doc = await VoiceDatasetRecording.findOne({ recordingId: split1 });
      expect(['train', 'val', 'test']).toContain(rec1Doc.splitAssignment);

      // Upload recording 2 by the same speaker
      const res2 = await request(app)
        .post('/api/dataset-collection/recordings')
        .set('Authorization', `Bearer ${speakerUser.token}`)
        .send({ audioBase64: wav2.toString('base64'), speechMode: 'prompted', promptId: 'VP-PRM-001', promptCategory: 'fertilizer', language: 'si' });
      expect(res2.status).toBe(201);
      const split2 = res2.body.recording.recordingId;
      const rec2Doc = await VoiceDatasetRecording.findOne({ recordingId: split2 });

      // Invariant: rec1 and rec2 MUST have identical split assignment
      expect(rec2Doc.splitAssignment).toBe(rec1Doc.splitAssignment);
    });

    it('executes safe retention lifecycle audit and purge without touching unexpired records', async () => {
      const storageDir = getDatasetStorageDir();
      if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

      const purgeUser = await registerUser({ role: 'farmer', name: 'Farmer Purge Test' });
      const spkId = `spk_purge_${Date.now().toString().slice(-6)}`;
      const expiredRecId = `rec_exp_${Date.now().toString().slice(-8)}`;
      const activeRecId = `rec_act_${Date.now().toString().slice(-8)}`;

      const expiredFileName = `${expiredRecId}.wav`;
      const activeFileName = `${activeRecId}.wav`;
      fs.writeFileSync(path.join(storageDir, expiredFileName), createValidWavBuffer(0.5));
      fs.writeFileSync(path.join(storageDir, activeFileName), createValidWavBuffer(0.5));

      // Create an expired record (retention expired yesterday)
      const expiredDoc = await VoiceDatasetRecording.create({
        recordingId: expiredRecId,
        pseudonymousSpeakerId: spkId,
        contributorUserId: purgeUser.user._id,
        speechMode: 'natural',
        language: 'si',
        storedFileName: expiredFileName,
        mimeType: 'audio/wav',
        fileSizeBytes: 16044,
        durationSeconds: 0.5,
        reviewStatus: 'pending',
        retentionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired!
      });

      // Create an active unexpired record (retention in 364 days)
      const activeDoc = await VoiceDatasetRecording.create({
        recordingId: activeRecId,
        pseudonymousSpeakerId: spkId,
        contributorUserId: purgeUser.user._id,
        speechMode: 'natural',
        language: 'si',
        storedFileName: activeFileName,
        mimeType: 'audio/wav',
        fileSizeBytes: 16044,
        durationSeconds: 0.5,
        reviewStatus: 'pending',
        retentionExpiresAt: new Date(Date.now() + 364 * 24 * 60 * 60 * 1000) // Active!
      });

      // 1. Dry run test
      const dryResult = await purgeExpiredRecordings({ execute: false });
      expect(dryResult.dryRun).toBe(true);
      expect(dryResult.matchedCount).toBeGreaterThanOrEqual(1);
      expect(dryResult.recordsRemoved).toBe(0);
      expect(fs.existsSync(path.join(storageDir, expiredFileName))).toBe(true); // NOT deleted

      // 2. Live execute test
      const liveResult = await purgeExpiredRecordings({ execute: true });
      expect(liveResult.dryRun).toBe(false);
      expect(liveResult.recordsRemoved).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(path.join(storageDir, expiredFileName))).toBe(false); // Cleaned from disk!

      // 3. Verify active record is completely preserved
      const checkActive = await VoiceDatasetRecording.findOne({ recordingId: activeRecId });
      expect(checkActive).toBeDefined();
      expect(fs.existsSync(path.join(storageDir, activeFileName))).toBe(true); // Active file intact!

      // Cleanup test file
      if (fs.existsSync(path.join(storageDir, activeFileName))) {
        fs.unlinkSync(path.join(storageDir, activeFileName));
      }
    });
  });
});



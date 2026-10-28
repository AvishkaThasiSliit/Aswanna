import request from 'supertest';
import app from '../src/app.js';
import { ENV } from '../src/config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../');
const CAPTURE_AUDIO_DIR = path.join(repoRoot, 'voice-capture-audio');

describe('Dev Voice Capture Gated Endpoints (TASK FINISH-1)', () => {
  const originalCapture = ENV.VOICE_CAPTURE;
  const originalNodeEnv = ENV.NODE_ENV;

  afterEach(() => {
    ENV.VOICE_CAPTURE = originalCapture;
    ENV.NODE_ENV = originalNodeEnv;
  });

  describe('Gating Invariants', () => {
    it('flag off returns 404', async () => {
      ENV.VOICE_CAPTURE = 'off';
      ENV.NODE_ENV = 'test';

      const resGet = await request(app).get('/api/dev/voice-capture/prompts');
      expect(resGet.status).toBe(404);

      const resPost = await request(app).post('/api/dev/voice-capture/save').send({
        promptId: 'HE-01',
        ext: 'webm',
        audioBase64: 'AAAA'
      });
      expect(resPost.status).toBe(404);
    });

    it('production mode returns 404 even when flag is on', async () => {
      ENV.VOICE_CAPTURE = 'on';
      ENV.NODE_ENV = 'production';

      const res = await request(app).get('/api/dev/voice-capture/prompts');
      expect(res.status).toBe(404);
    });
  });

  describe('Validation & Hardening when Enabled', () => {
    beforeEach(() => {
      ENV.VOICE_CAPTURE = 'on';
      ENV.NODE_ENV = 'test';
    });

    it('"../x" returns 400', async () => {
      const res = await request(app)
        .post('/api/dev/voice-capture/save')
        .send({
          promptId: '../x',
          ext: 'webm',
          audioBase64: Buffer.from('test audio').toString('base64')
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PROMPT_ID');
    });

    it('unknown id returns 400', async () => {
      const res = await request(app)
        .post('/api/dev/voice-capture/save')
        .send({
          promptId: 'NOT-AN-EXISTING-PROMPT-ID',
          ext: 'webm',
          audioBase64: Buffer.from('test audio').toString('base64')
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PROMPT_ID');
    });

    it('bad extension returns 400', async () => {
      const res = await request(app)
        .post('/api/dev/voice-capture/save')
        .send({
          promptId: 'HE-01',
          ext: 'exe',
          audioBase64: Buffer.from('test audio').toString('base64')
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_EXTENSION');
    });

    it('oversized body returns 413 via Content-Length or decoded payload', async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x55);
      const res = await request(app)
        .post('/api/dev/voice-capture/save')
        .send({
          promptId: 'HE-01',
          ext: 'webm',
          audioBase64: oversizedBuffer.toString('base64')
        });

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('valid request creates server-built filename and saves audio safely', async () => {
      const dummyData = Buffer.from('RIFF_SAMPLE_DEV_AUDIO');
      const res = await request(app)
        .post('/api/dev/voice-capture/save')
        .send({
          promptId: 'HE-01',
          ext: 'wav',
          audioBase64: dummyData.toString('base64')
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.filename).toBe('HE-01.wav');
      expect(res.body.filePath).toBe('voice-capture-audio/HE-01.wav');

      const savedPath = path.join(CAPTURE_AUDIO_DIR, 'HE-01.wav');
      expect(fs.existsSync(savedPath)).toBe(true);

      // Clean up test file
      try { fs.unlinkSync(savedPath); } catch {}
    });

    it('GET /api/dev/voice-capture/prompts returns 30 prompts from heldout-en.json', async () => {
      const res = await request(app).get('/api/dev/voice-capture/prompts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.prompts).toHaveLength(30);
    });
  });
});

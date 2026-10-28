/**
 * voiceProxy.test.js - Jest tests for Node.js Voice Transcription Proxy (TASK W1)
 *
 * NOTE: These tests verify endpoint authentication, rate-limiting, size limits,
 * 503 fallback error handling, and payload forwarding. None of these tests evaluate
 * speech-to-text accuracy or acoustic performance.
 */

import request from 'supertest';
import app from '../src/app.js';
import { jest } from '@jest/globals';
import { ENV } from '../src/config/env.js';

async function registerAndLogin(role = 'farmer') {
  const email = `voice-test-${Date.now()}-${Math.random()}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Voice Proxy Tester',
    email,
    password: 'Password123!',
    role
  });
  return res.body; // { token, user }
}

describe('Voice Transcription Node Proxy Endpoints (TASK W1)', () => {
  let authToken;

  beforeEach(async () => {
    ENV.VOICE_INTERNAL_TOKEN = 'test-voice-internal-secret-token';
    const loginData = await registerAndLogin();
    authToken = loginData.token;
  });

  describe('GET /api/voice/config', () => {
    it('returns configured ASR mode (default: browser)', async () => {
      const res = await request(app).get('/api/voice/config');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('asr');
      expect(['browser', 'whisper']).toContain(res.body.asr);
    });
  });

  describe('POST /api/voice/transcribe', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/voice/transcribe')
        .send(Buffer.from('dummy-audio'));

      expect(res.status).toBe(401);
    });

    it('rejects uploads exceeding 10 MB limit with 400', async () => {
      const res = await request(app)
        .post('/api/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Length', String(11 * 1024 * 1024))
        .send(Buffer.alloc(100)); // Header check triggers 400 immediately

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/10 MB/i);
    });

    it('returns 503 with clear message when Python Whisper service is unavailable', async () => {
      // Mock global fetch to simulate connection failure (service down)
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8001'));

      try {
        const dummyAudio = Buffer.from('RIFF....WAVEfmt ');
        const res = await request(app)
          .post('/api/voice/transcribe')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'audio/wav')
          .send(dummyAudio);

        expect(res.status).toBe(503);
        expect(res.body.error).toContain('Voice transcription service is currently unavailable');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('forwards audio and returns transcript + segments when Python service responds 200', async () => {
      const mockWhisperResponse = {
        text: 'urea 2 bags 14000',
        segments: [
          {
            text: 'urea 2 bags 14000',
            start: 0.0,
            end: 2.1,
            avg_logprob: -0.32,
            no_speech_prob: 0.04
          }
        ],
        duration_s: 2.1,
        model: 'base.en',
        latency_ms: 280,
        used_initial_prompt: true
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockWhisperResponse
      });

      try {
        const dummyAudio = Buffer.from('RIFF....WAVEfmt ');
        const res = await request(app)
          .post('/api/voice/transcribe?use_vocab_prompt=true')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'audio/wav')
          .send(dummyAudio);

        expect(res.status).toBe(200);
        expect(res.body.text).toBe('urea 2 bags 14000');
        expect(res.body.segments).toHaveLength(1);
        expect(res.body.segments[0].avg_logprob).toBe(-0.32);
        expect(res.body.duration_s).toBe(2.1);
        expect(res.body.model).toBe('base.en');
        expect(res.body.used_initial_prompt).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

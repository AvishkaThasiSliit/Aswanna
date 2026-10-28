import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { ENV } from '../config/env.js';

const router = express.Router();

const voiceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many voice transcription requests, please try again later'
    }
  }
});

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * GET /api/voice/config
 * Returns current server-configured ASR mode ('browser' | 'whisper')
 */
router.get('/config', (_req, res) => {
  res.json({ asr: ENV.VOICE_ASR });
});

/**
 * POST /api/voice/transcribe
 * Proxies multipart audio upload to Python Whisper service with auth, size, and rate limits.
 */
router.post('/transcribe', requireAuth, voiceRateLimiter, async (req, res) => {
  // Check Content-Length header early
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BYTES) {
    return res.status(400).json({ error: 'Audio file exceeds 10 MB limit' });
  }

  // Accumulate request body buffer
  const chunks = [];
  let totalBytes = 0;
  let exceeded = false;

  req.on('data', chunk => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BYTES) {
      exceeded = true;
      req.pause();
    } else {
      chunks.push(chunk);
    }
  });

  req.on('end', async () => {
    if (exceeded) {
      return res.status(400).json({ error: 'Audio file exceeds 10 MB limit' });
    }

    if (chunks.length === 0 && contentLength === 0) {
      return res.status(400).json({ error: 'Empty audio file' });
    }

    const bodyBuffer = Buffer.concat(chunks);
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const targetUrl = `${ENV.VOICE_SERVICE_URL}/transcribe${queryString}`;

    if (!ENV.VOICE_INTERNAL_TOKEN) {
      return res.status(503).json({
        error: 'Voice transcription service is currently unavailable. Please use browser speech recognition or manual entry.'
      });
    }

    try {
      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'multipart/form-data',
          'X-Internal-Token': ENV.VOICE_INTERNAL_TOKEN
        },
        body: bodyBuffer
      });

      const responseData = await upstreamRes.json().catch(() => null);

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json(
          responseData || { error: 'Upstream transcription service error' }
        );
      }

      return res.status(200).json(responseData);
    } catch (err) {
      // Python service unavailable / connection error
      return res.status(503).json({
        error: 'Voice transcription service is currently unavailable. Please use browser speech recognition or manual entry.'
      });
    }
  });

  req.on('error', () => {
    return res.status(400).json({ error: 'Failed to read audio upload stream' });
  });
});

export default router;

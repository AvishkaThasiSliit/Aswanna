import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { ENV } from '../config/env.js';
import { mapBillServiceToReviewItems } from '../services/billMapping.js';

const router = express.Router();

const billRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many bill scanning requests, please try again later'
    }
  }
});

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 30000; // 30 seconds

/**
 * POST /api/bill-scan
 * Proxies raw image body (image/png or image/jpeg) to Python bill-service with authentication, rate limiting, and size guards.
 */
router.post('/', requireAuth, billRateLimiter, async (req, res) => {
  // 1. Content-Type validation
  const rawCt = req.headers['content-type'] || '';
  const contentType = rawCt.toLowerCase().split(';')[0].trim();
  if (contentType !== 'image/png' && contentType !== 'image/jpeg' && contentType !== 'image/jpg') {
    return res.status(400).json({
      error: {
        code: 'INVALID_CONTENT_TYPE',
        message: 'Invalid Content-Type. Only image/png and image/jpeg are supported.'
      }
    });
  }

  // 2. Early Content-Length check
  const clHeader = req.headers['content-length'];
  if (clHeader != null) {
    const cl = parseInt(clHeader, 10);
    if (isNaN(cl) || cl < 0) {
      return res.status(400).json({
        error: {
          code: 'MALFORMED_CONTENT_LENGTH',
          message: 'Malformed or negative Content-Length header'
        }
      });
    }
    if (cl > MAX_BYTES) {
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Bill image exceeds 5 MB limit'
        }
      });
    }
  }

  // 3. Upstream token guard
  if (!ENV.BILL_INTERNAL_TOKEN || !ENV.BILL_INTERNAL_TOKEN.trim()) {
    return res.status(503).json({
      error: {
        code: 'BILL_SERVICE_UNAVAILABLE',
        message: 'Bill scanning service is not configured or token is unset'
      }
    });
  }

  // 4. Stream body chunks with running byte counter (never touch disk)
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
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Bill image exceeds 5 MB limit'
        }
      });
    }

    if (chunks.length === 0) {
      return res.status(400).json({
        error: {
          code: 'EMPTY_FILE',
          message: 'Empty image file uploaded'
        }
      });
    }

    const bodyBuffer = Buffer.concat(chunks);

    // Magic bytes check (never trust header alone)
    const isPng = bodyBuffer.length >= 8 && bodyBuffer[0] === 0x89 && bodyBuffer[1] === 0x50 && bodyBuffer[2] === 0x4e && bodyBuffer[3] === 0x47;
    const isJpeg = bodyBuffer.length >= 3 && bodyBuffer[0] === 0xff && bodyBuffer[1] === 0xd8 && bodyBuffer[2] === 0xff;
    if (!isPng && !isJpeg) {
      return res.status(400).json({
        error: {
          code: 'INVALID_IMAGE_BYTES',
          message: 'Uploaded file contents do not match PNG or JPEG magic bytes'
        }
      });
    }

    const targetUrl = `${ENV.BILL_SERVICE_URL.replace(/\/$/, '')}/scan-bill`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Authorization': `Bearer ${ENV.BILL_INTERNAL_TOKEN}`
        },
        body: bodyBuffer,
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      const upstreamData = await upstreamRes.json().catch(() => null);

      if (!upstreamRes.ok) {
        if (upstreamRes.status === 503) {
          return res.status(503).json({
            error: {
              code: 'OCR_ENGINE_MISSING',
              message: 'OCR engine is not available on the bill scanner service'
            }
          });
        }
        if (upstreamRes.status === 504) {
          return res.status(504).json({
            error: {
              code: 'OCR_TIMEOUT',
              message: 'OCR processing timed out on upstream service'
            }
          });
        }
        if (upstreamRes.status === 413) {
          return res.status(413).json({
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Image rejected as too large by upstream service'
            }
          });
        }
        return res.status(upstreamRes.status).json({
          error: {
            code: 'BILL_SERVICE_ERROR',
            message: upstreamData?.detail || 'Upstream bill scanner error'
          }
        });
      }

      // Map raw response to review items
      const reviewItems = mapBillServiceToReviewItems(upstreamData);

      return res.status(200).json({
        status: upstreamData.status || 'ok',
        reasons: upstreamData.reasons || [],
        vendor: upstreamData.vendor || null,
        date: upstreamData.date || null,
        total: upstreamData.total || null,
        items: reviewItems
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).json({
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'Bill scanner request timed out'
          }
        });
      }

      // Upstream down / unreachable
      return res.status(503).json({
        error: {
          code: 'BILL_SERVICE_DOWN',
          message: 'Bill scanning service is currently unavailable. Please use manual entry.'
        }
      });
    }
  });

  req.on('error', (err) => {
    return res.status(400).json({
      error: {
        code: 'UPLOAD_STREAM_ERROR',
        message: 'Error streaming uploaded file'
      }
    });
  });
});

export default router;

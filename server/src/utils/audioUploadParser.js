import { AppError } from './errors.js';
import { MAX_AUDIO_BYTES } from './audioValidator.js';

/**
 * Parses multipart boundary from Content-Type header.
 */
function extractBoundary(contentType) {
  if (!contentType) return null;
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  return match[1] || match[2];
}

/**
 * Parses multipart/form-data buffer safely into fields and audio file buffer.
 */
function parseMultipartBuffer(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const fields = {};
  let fileBuffer = null;
  let fileHeaders = {};

  let start = 0;
  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const nextBoundaryIdx = buffer.indexOf(boundaryBuffer, boundaryIdx + boundaryBuffer.length);
    if (nextBoundaryIdx === -1) break;

    const partBuffer = buffer.slice(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    const headerEndIdx = partBuffer.indexOf('\r\n\r\n');

    if (headerEndIdx !== -1) {
      const headerStr = partBuffer.slice(0, headerEndIdx).toString('utf-8');
      const bodyBuffer = partBuffer.slice(headerEndIdx + 4, partBuffer.length - 2); // trim trailing \r\n

      const nameMatch = headerStr.match(/name="([^"]+)"/i);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
      const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n;]+)/i);

      if (filenameMatch) {
        fileBuffer = bodyBuffer;
        fileHeaders = {
          filename: filenameMatch[1],
          contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream'
        };
      } else if (nameMatch) {
        fields[nameMatch[1]] = bodyBuffer.toString('utf-8').trim();
      }
    }

    start = nextBoundaryIdx;
  }

  return { fields, fileBuffer, fileHeaders };
}

/**
 * Parses incoming Express request for voice dataset upload.
 * Enforces streaming byte limits upfront to prevent memory buffering abuse.
 * Resolves { fileBuffer, fields, mimeType }.
 */
export async function parseAudioUploadRequest(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    // Reject upfront if Content-Length header exceeds limit
    if (contentLength > MAX_AUDIO_BYTES) {
      return reject(new AppError('AUDIO_SIZE_EXCEEDED', 'Audio file exceeds 15 MB limit', 400));
    }

    // 1. If body has already been parsed as JSON (e.g., base64 in tests or JSON API)
    if (req.body && typeof req.body === 'object') {
      const b64 = req.body.audioBase64 !== undefined ? req.body.audioBase64 : req.body.audio;
      if (b64 !== undefined) {
        if (!b64 || (typeof b64 === 'string' && !b64.trim())) {
          return reject(new AppError('EMPTY_AUDIO_FILE', 'Empty audio payload', 400));
        }
        if (typeof b64 === 'string') {
          // Reject base64 strings that exceed max allowable size before creating Buffer
          const estimatedBytes = (b64.length * 3) / 4;
          if (estimatedBytes > MAX_AUDIO_BYTES) {
            return reject(new AppError('AUDIO_SIZE_EXCEEDED', 'Audio payload exceeds 15 MB limit', 400));
          }
        }
        const cleanB64 = typeof b64 === 'string' && b64.includes('base64,') ? b64.split('base64,')[1] : b64;
        const fileBuffer = Buffer.from(cleanB64, 'base64');
        const fields = { ...req.query, ...req.body };
        delete fields.audioBase64;
        delete fields.audio;
        return resolve({
          fileBuffer,
          fields,
          mimeType: req.body.mimeType || req.headers['content-type'] || 'audio/wav'
        });
      }
    }

    // 2. If stream was already consumed and no audio present in body
    if (req.readableEnded || req.complete) {
      return reject(new AppError('EMPTY_AUDIO_FILE', 'Empty audio file payload', 400));
    }

    // 3. Otherwise read the raw HTTP stream with streaming enforcement
    const chunks = [];
    let totalBytes = 0;
    let exceeded = false;

    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_AUDIO_BYTES) {
        exceeded = true;
        // Pause and destroy stream immediately to avoid memory exhaustion
        req.pause();
        if (typeof req.destroy === 'function') {
          req.destroy();
        }
        return reject(new AppError('AUDIO_SIZE_EXCEEDED', 'Audio file exceeds 15 MB limit', 400));
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (exceeded) return;

      if (chunks.length === 0) {
        return reject(new AppError('EMPTY_AUDIO_FILE', 'Empty audio file payload', 400));
      }

      const bodyBuffer = Buffer.concat(chunks);
      const boundary = extractBoundary(contentType);

      if (boundary && contentType.includes('multipart/form-data')) {
        const { fields, fileBuffer, fileHeaders } = parseMultipartBuffer(bodyBuffer, boundary);
        if (!fileBuffer || fileBuffer.length === 0) {
          return reject(new AppError('EMPTY_AUDIO_FILE', 'No audio file found in multipart upload', 400));
        }
        return resolve({
          fileBuffer,
          fields: { ...req.query, ...fields },
          mimeType: fileHeaders.contentType || 'audio/wav'
        });
      }

      // Direct binary stream or octet-stream
      const fields = { ...req.query };
      if (req.headers['x-speech-mode']) fields.speechMode = req.headers['x-speech-mode'];
      if (req.headers['x-prompt-id']) fields.promptId = req.headers['x-prompt-id'];
      if (req.headers['x-prompt-category']) fields.promptCategory = req.headers['x-prompt-category'];
      if (req.headers['x-language']) fields.language = req.headers['x-language'];
      if (req.headers['x-client-request-id']) fields.clientRequestId = req.headers['x-client-request-id'];

      return resolve({
        fileBuffer: bodyBuffer,
        fields,
        mimeType: contentType || 'audio/wav'
      });
    });

    req.on('error', err => {
      if (!exceeded) {
        reject(new AppError('UPLOAD_ERROR', `Failed to read audio upload stream: ${err.message}`, 400));
      }
    });
  });
}

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../');

const router = express.Router();
const CAPTURE_AUDIO_DIR = path.join(repoRoot, 'voice-capture-audio');
const HELDOUT_PROMPTS_FILE = path.join(repoRoot, 'server/eval/fixtures/voice/heldout-en.json');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = new Set(['webm', 'ogg', 'wav', 'mp4']);

// Ensure storage dir exists
if (!fs.existsSync(CAPTURE_AUDIO_DIR)) {
  fs.mkdirSync(CAPTURE_AUDIO_DIR, { recursive: true });
}

function getValidPromptIds() {
  try {
    if (fs.existsSync(HELDOUT_PROMPTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(HELDOUT_PROMPTS_FILE, 'utf-8'));
      return new Set(data.map(p => p.id));
    }
  } catch {}
  return new Set();
}

// 5 MB limit guard on incoming requests
router.use((req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BYTES) {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds 5 MB limit' } });
  }
  next();
});

// GET /api/dev/voice-capture/prompts
router.get('/prompts', (_req, res) => {
  try {
    if (!fs.existsSync(HELDOUT_PROMPTS_FILE)) {
      return res.status(404).json({ success: false, error: 'heldout-en.json not found' });
    }
    const content = fs.readFileSync(HELDOUT_PROMPTS_FILE, 'utf-8');
    const prompts = JSON.parse(content);
    return res.json({ success: true, prompts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dev/voice-capture/save
router.post('/save', (req, res) => {
  try {
    const { promptId, ext, audioBase64 } = req.body || {};

    if (!promptId || typeof promptId !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_PROMPT_ID', message: 'promptId is required and must be a string' } });
    }

    // promptId must be an exact id from heldout-en.json
    const validPromptIds = getValidPromptIds();
    if (!validPromptIds.has(promptId)) {
      return res.status(400).json({ error: { code: 'INVALID_PROMPT_ID', message: `promptId '${promptId}' is not a valid heldout-en.json prompt ID` } });
    }

    // Extension whitelist: webm, ogg, wav, mp4
    const normalizedExt = String(ext || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(normalizedExt)) {
      return res.status(400).json({ error: { code: 'INVALID_EXTENSION', message: `Extension '${ext}' is not permitted. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}` } });
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: { code: 'MISSING_AUDIO', message: 'audioBase64 is required' } });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Audio payload exceeds 5 MB limit' } });
    }

    // Filename built by the server only
    const filename = `${promptId}.${normalizedExt}`;
    const targetPath = path.join(CAPTURE_AUDIO_DIR, filename);

    fs.writeFileSync(targetPath, buffer);

    return res.json({
      success: true,
      filename,
      filePath: `voice-capture-audio/${filename}`,
      bytes: buffer.length
    });
  } catch (err) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;

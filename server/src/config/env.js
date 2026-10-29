import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attempt to load .env file if process.loadEnvFile is available
if (typeof process.loadEnvFile === 'function') {
  const candidateEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(__dirname, '../../..', '.env'),
    path.resolve(__dirname, '../../..', 'server', '.env'),
    path.resolve(__dirname, '../..', '.env')
  ];
  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        break;
      } catch {
        // continue if already loaded or unable to parse
      }
    }
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';

function getValidatedMongoUri() {
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) {
    return process.env.MONGODB_URI.trim();
  }
  if ((process.env.NODE_ENV || nodeEnv) === 'test') {
    return ''; // test environment uses in-memory MongoMemoryServer
  }
  throw new Error('CONFIG_ERROR: MONGODB_URI environment variable is required. Please set MONGODB_URI in your environment or server/.env file.');
}

// Central env config – all process.env access lives here
export const ENV = {
  NODE_ENV: nodeEnv,
  PORT: parseInt(process.env.PORT || '4000', 10),
  get MONGODB_URI() {
    return getValidatedMongoUri();
  },
  set MONGODB_URI(val) {
    process.env.MONGODB_URI = val;
  },
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '20', 10),
  FORECAST_MODE: process.env.FORECAST_MODE || 'off',
  VOICE_ASR: process.env.VOICE_ASR || 'browser',
  VOICE_SERVICE_URL: process.env.VOICE_SERVICE_URL || 'http://127.0.0.1:8001',
  get VOICE_INTERNAL_TOKEN() {
    return process.env.VOICE_INTERNAL_TOKEN || '';
  },
  set VOICE_INTERNAL_TOKEN(val) {
    process.env.VOICE_INTERNAL_TOKEN = val;
  },
  get VOICE_DATASET_STORAGE_DIR() {
    return process.env.VOICE_DATASET_STORAGE_DIR || 'private_dataset_storage/audio';
  },
  set VOICE_DATASET_STORAGE_DIR(val) {
    process.env.VOICE_DATASET_STORAGE_DIR = val;
  },
  get VOICE_DATASET_COLLECTION() {
    return process.env.VOICE_DATASET_COLLECTION || 'off';
  },
  set VOICE_DATASET_COLLECTION(val) {
    process.env.VOICE_DATASET_COLLECTION = val;
  },
  get VOICE_CAPTURE() {
    return process.env.VOICE_CAPTURE || 'off';
  },
  set VOICE_CAPTURE(val) {
    process.env.VOICE_CAPTURE = val;
  },
  VOICE_DATASET_RETENTION_DAYS: parseInt(process.env.VOICE_DATASET_RETENTION_DAYS || '365', 10),
  VOICE_PSEUDONYMIZATION_KEY: process.env.VOICE_PSEUDONYMIZATION_KEY || 'aswanna-voice-pseudo-salt-secret-key-2026',
  VOICE_DATASET_MAX_CONTRIBUTOR_BYTES: parseInt(process.env.VOICE_DATASET_MAX_CONTRIBUTOR_BYTES || '104857600', 10), // 100 MB per contributor
  VOICE_DATASET_MIN_FREE_DISK_BYTES: parseInt(process.env.VOICE_DATASET_MIN_FREE_DISK_BYTES || '52428800', 10), // 50 MB minimum free disk buffer
  get BILL_SCAN() {
    return process.env.BILL_SCAN || 'off';
  },
  set BILL_SCAN(val) {
    process.env.BILL_SCAN = val;
  },
  get BILL_SERVICE_URL() {
    return process.env.BILL_SERVICE_URL || 'http://127.0.0.1:8010';
  },
  set BILL_SERVICE_URL(val) {
    process.env.BILL_SERVICE_URL = val;
  },
  get BILL_INTERNAL_TOKEN() {
    return process.env.BILL_INTERNAL_TOKEN || '';
  },
  set BILL_INTERNAL_TOKEN(val) {
    process.env.BILL_INTERNAL_TOKEN = val;
  },
};

/**
 * Shared storage path resolver for routes, scripts, and tests.
 */
export function getDatasetStorageDir() {
  const dir = ENV.VOICE_DATASET_STORAGE_DIR;
  if (path.isAbsolute(dir)) {
    return dir;
  }
  const repoRoot = path.resolve(__dirname, '../../../');
  return path.join(repoRoot, dir);
}

/**
 * Returns validated pseudonymization HMAC key.
 * In production, strictly requires a distinct, non-default, high-entropy secret (>= 32 chars).
 * Secret values are never printed in error messages, logs, or diagnostics.
 */
export function getPseudonymizationKey() {
  const key = ENV.VOICE_PSEUDONYMIZATION_KEY;
  if (ENV.NODE_ENV === 'production') {
    if (!key || key === 'aswanna-voice-pseudo-salt-secret-key-2026' || key.length < 32) {
      throw new Error('SECURITY_ERROR: VOICE_PSEUDONYMIZATION_KEY must be configured with a distinct, high-entropy secret (>= 32 chars) in production');
    }
  }
  return key || ENV.JWT_SECRET;
}

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from './routes/auth.js';
import farmerProfileRoutes from './routes/farmerProfile.js';
import machineryOwnedRoutes from './routes/machineryOwned.js';
import landsRoutes from './routes/lands.js';
import cyclesRoutes from './routes/cycles.js';
import activityCodesRoutes from './routes/activityCodes.js';
import expensesRoutes from './routes/expenses.js';
import harvestsRoutes from './routes/harvests.js';
import salesRoutes from './routes/sales.js';
import cycleNotesRoutes from './routes/cycleNotes.js';
import mockSo1Routes from './routes/mockSo1.js';          // REPLACE WITH REAL SO1 API
import alertsRoutes from './routes/alerts.js';
import thresholdConfigRoutes from './routes/thresholdConfig.js';
import varianceRoutes from './routes/variance.js';
import forecastRoutes from './routes/forecast.js';
import recommendationRoutes from './routes/recommendation.js';
import voiceRoutes from './routes/voice.js';
import datasetCollectionRoutes from './routes/datasetCollection.js';
import devVoiceCaptureRoutes from './routes/devVoiceCapture.js';
import billScanRoutes from './routes/billScan.js';
import { ENV } from './config/env.js';
import { errorHandler } from './utils/errors.js';

import rateLimit from 'express-rate-limit';

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 50000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '16mb' }));

// Rate limit write endpoints
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});

// ─── Request Logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/farmer-profile', farmerProfileRoutes);
app.use('/api/farmer-profiles', farmerProfileRoutes);
app.use('/api/machinery-owned', machineryOwnedRoutes);
app.use('/api/lands', landsRoutes);
app.use('/api/cycles', cyclesRoutes);
app.use('/api/cycles/:id/variance', varianceRoutes);
app.use('/api/cycles/:id/forecast', forecastRoutes);
app.use('/api/activity-codes', activityCodesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/harvests', harvestsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/cycle-notes', cycleNotesRoutes);
app.use('/api/mock-so1', mockSo1Routes);               // REPLACE WITH REAL SO1 API
app.use('/api/alerts', alertsRoutes);
app.use('/api/threshold-config', thresholdConfigRoutes);
app.use('/api/crop-recommendation', recommendationRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/dataset-collection', (req, res, next) => {
  if (ENV.VOICE_DATASET_COLLECTION !== 'on') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
  return datasetCollectionRoutes(req, res, next);
});
app.use('/api/dev/voice-capture', (req, res, next) => {
  if (ENV.VOICE_CAPTURE !== 'on' || ENV.NODE_ENV === 'production') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
  return devVoiceCaptureRoutes(req, res, next);
});
app.use('/api/bill-scan', (req, res, next) => {
  if (ENV.BILL_SCAN !== 'on') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
  return billScanRoutes(req, res, next);
});

// ─── Frontend Static Serving ──────────────────────────────────────────────────
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// ─── Central error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

export default app;

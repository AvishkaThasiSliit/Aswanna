import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';

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
import { errorHandler } from './utils/errors.js';

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Request Logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/farmer-profile', farmerProfileRoutes);
app.use('/api/machinery-owned', machineryOwnedRoutes);
app.use('/api/lands', landsRoutes);
app.use('/api/cycles', cyclesRoutes);
app.use('/api/activity-codes', activityCodesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/harvests', harvestsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/cycle-notes', cycleNotesRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// ─── Central error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

export default app;

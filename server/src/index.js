import mongoose from 'mongoose';
import app from './app.js';
import { ENV } from './config/env.js';

const { PORT, MONGODB_URI } = ENV;

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ MongoDB connected: ${MONGODB_URI}`);

    app.listen(PORT, () => {
      console.log(`🚀 Aswanna API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();

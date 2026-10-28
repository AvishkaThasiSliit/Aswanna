import net from 'net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import fs from 'fs';
import app from './app.js';
import { ENV } from './config/env.js';
import { seedDatabase } from '../scripts/seed.js';

const { PORT, MONGODB_URI } = ENV;

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

async function reportPortInUse(port) {
  console.error(`\n❌ [Aswanna Error] Port ${port} is already in use.`);
  console.error(`\nDiagnostics & Safe Resolution:`);
  let isActiveAswanna = false;
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    const data = await res.json();
    if (data?.status === 'ok') {
      isActiveAswanna = true;
    }
  } catch {
    // not an active Aswanna instance or not responding
  }

  if (isActiveAswanna) {
    console.error(`- An active Aswanna backend is already running on http://localhost:${port} and responded to /api/health.`);
    console.error(`- To reuse it without restarting, run only the client:`);
    console.error(`    npm run dev:client  (or npm run dev --workspace=client)`);
    console.error(`- To stop the existing background server and restart:`);
    console.error(`    In PowerShell: Get-NetTCPConnection -LocalPort ${port} | Select-Object OwningProcess`);
    console.error(`    Stop-Process -Id <PID> -Force`);
  } else {
    console.error(`- Port ${port} is occupied by another application.`);
    console.error(`- To identify the owning process:`);
    console.error(`    In PowerShell: Get-NetTCPConnection -LocalPort ${port} | Select-Object LocalAddress, LocalPort, State, OwningProcess`);
    console.error(`- To run Aswanna on an alternate port:`);
    console.error(`    In PowerShell: $env:PORT="${port + 1}"; npm start`);
    console.error(`    In bash:       PORT=${port + 1} npm start`);
  }
  console.error('');
  process.exit(1);
}

async function start() {
  try {
    const portAvailable = await checkPortAvailable(PORT);
    if (!portAvailable) {
      await reportPortInUse(PORT);
    }

    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
      console.log(`✅ MongoDB connected: ${MONGODB_URI}`);
    } catch (err) {
      console.log('Local MongoDB not running. Starting MongoMemoryServer for dev...');
      const dbPath = path.join(process.cwd(), 'temp', 'dev-db');
      fs.mkdirSync(dbPath, { recursive: true });
      const memServer = await MongoMemoryServer.create({
        binary: { version: '7.0.14', downloadDir: 'd:/Aswanna/.mongo-cache' },
        instance: { dbPath }
      });
      const uri = memServer.getUri();
      await mongoose.connect(uri);
      console.log(`✅ Connected to MongoMemoryServer at ${uri}`);
      await seedDatabase();
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Aswanna API listening on http://localhost:${PORT}`);
    });

    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        await reportPortInUse(PORT);
      }
      console.error('Failed to start server:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();


import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Setup test storage and environment flags BEFORE config/tests load
const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aswanna-test-storage-'));
process.env.VOICE_DATASET_STORAGE_DIR = testStorageDir;
process.env.VOICE_DATASET_COLLECTION = 'on';
process.env.VOICE_INTERNAL_TOKEN = 'test-voice-internal-secret-token';

let mongoServer;

beforeAll(async () => {
  jest.setTimeout(30000);
  const binaryOptions = {
    version: '7.0.14',
    downloadDir: 'd:/Aswanna/.mongo-cache'
  };

  let attempts = 0;
  while (attempts < 5) {
    try {
      mongoServer = await MongoMemoryServer.create({
        binary: binaryOptions,
        instance: {
          launchTimeoutMS: 60000,
        }
      });
      break;
    } catch (err) {
      attempts++;
      if (attempts >= 5) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    try {
      await mongoServer.stop();
    } catch (err) {
      // Ignore Windows temp cleanup error if process locked
    }
  }
  if (testStorageDir && fs.existsSync(testStorageDir)) {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore Windows temp cleanup error if file locked
    }
  }
  await new Promise(r => setTimeout(r, 600));
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

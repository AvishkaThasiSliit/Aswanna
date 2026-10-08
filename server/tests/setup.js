import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

beforeAll(async () => {
  const binaryOptions = {
    version: '7.0.14',
    downloadDir: 'd:/Aswanna/.mongo-cache'
  };
  mongoServer = await MongoMemoryServer.create({ binary: binaryOptions });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    try {
      await mongoServer.stop({ doCleanup: false });
    } catch (err) {
      // Ignore Windows temp file lock errors during teardown
    }
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

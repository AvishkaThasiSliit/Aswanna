import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { Land } from '../src/models/Land.js';
import { Cycle } from '../src/models/Cycle.js';
import { Expense } from '../src/models/Expense.js';
import { ActivityCode } from '../src/models/ActivityCode.js';
import { Baseline } from '../src/models/Baseline.js';
import { ThresholdConfig } from '../src/models/ThresholdConfig.js';
import { Alert } from '../src/models/Alert.js';
import { CropAccuracyHistory } from '../src/models/CropAccuracyHistory.js';
import { ENV } from '../src/config/env.js';


export async function seedDatabase() {
  const passwordHash = await User.hashPassword('Password123');

  // Clear existing collections
  await User.deleteMany({});
  await FarmerProfile.deleteMany({});
  await Land.deleteMany({});
  await Cycle.deleteMany({});
  await Expense.deleteMany({});
  await ActivityCode.deleteMany({});
  await Baseline.deleteMany({});
  await ThresholdConfig.deleteMany({});
  await Alert.deleteMany({});
  await CropAccuracyHistory.deleteMany({});

  // Demo Farmer: Sunil Perera
  const farmerUser = await User.create({
    name: 'Sunil Perera',
    email: 'sunil@aswanna.lk',
    phone: '0771234567',
    role: 'farmer',
    district: 'Kurunegala',
    passwordHash
  });

  // Admin User
  await User.create({
    name: 'Admin User',
    email: 'admin@aswanna.lk',
    phone: '0712345678',
    role: 'admin',
    passwordHash
  });

  const farmerProfile = await FarmerProfile.create({
    userId: farmerUser._id,
    farmerId: 'FARM-1001',
    fullName: 'Sunil Perera',
    nic: '198512345678',
    district: 'Kurunegala',
    dsDivision: 'Kuliyapitiya',
    phone: '0771234567'
  });

  const land = await Land.create({
    farmerId: farmerProfile._id,
    landCode: 'L1',
    extentValue: 0.5,
    extentUnit: 'acre',
    district: 'Kurunegala',
    dsDivision: 'Kuliyapitiya'
  });

  const cycle = await Cycle.create({
    farmerId: farmerProfile._id,
    landId: land._id,
    landCode: 'L1',
    crop: 'Tomato',
    season: 'Yala',
    status: 'active',
    startDate: new Date('2026-04-01')
  });

  const placeholders = [
    { code: 'PH-01', nameEn: 'land preparation', nameSi: 'බිම් සකස් කිරීම' },
    { code: 'PH-02', nameEn: 'nursery', nameSi: 'තවාන් කටයුතු' },
    { code: 'PH-03', nameEn: 'sowing/transplanting', nameSi: 'බීජ සිටුවීම / පැල සිටුවීම' },
    { code: 'PH-04', nameEn: 'basal fertilizer', nameSi: 'මුලික පොහොර යෙදීම' },
    { code: 'PH-05', nameEn: 'top-dress fertilizer', nameSi: 'මතුපිට පොහොර යෙදීම' },
    { code: 'PH-06', nameEn: 'weeding', nameSi: 'වල් පැළෑටි පාලනය' },
    { code: 'PH-07', nameEn: 'irrigation', nameSi: 'ජල සම්පාදනය' },
    { code: 'PH-08', nameEn: 'pest/disease spraying', nameSi: 'පළිබෝධ / රෝග පාලනය' },
    { code: 'PH-09', nameEn: 'staking/support', nameSi: 'ලී පරාල / රක්ක ගැසීම' },
    { code: 'PH-10', nameEn: 'harvesting', nameSi: 'අස්වැන්න නෙලීම' },
    { code: 'PH-11', nameEn: 'transport', nameSi: 'ප්රවාහනය' },
    { code: 'PH-12', nameEn: 'other', nameSi: 'වෙනත්' }
  ];

  const activityCodes = [];
  for (const item of placeholders) {
    const ac = await ActivityCode.create({
      code: item.code,
      nameEn: item.nameEn,
      nameSi: item.nameSi,
      isPlaceholder: true,
      source: 'placeholder',
      active: true
    });
    activityCodes.push(ac);
  }

  // 28 Expenses matching exact category totals:
  // Seed: 18,500 | Fertilizer: 31,200 | Labour: 37,800 | Machinery: 25,600 | Fuel: 16,800 | Irrigation: 15,700
  // Total = 145,600 rupees

  const expenseDefs = [
    // Machinery (25,600)
    { date: '2026-04-01', code: 0, dayStatus: 'worked', machinery: { method: 'Tractor', unitPrice: 10000, quantity: 1, cost: 10000 } },
    { date: '2026-04-15', code: 0, dayStatus: 'worked', machinery: { method: 'Rotavator', unitPrice: 8600, quantity: 1, cost: 8600 } },
    { date: '2026-04-24', code: 8, dayStatus: 'worked', machinery: { method: 'Water Pump Machine', unitPrice: 7000, quantity: 1, cost: 7000 } },

    // Seed (18,500)
    { date: '2026-04-02', code: 1, dayStatus: 'worked', inputs: [{ inputType: 'seed', categoryTag: 'seed', quantity: 5, unit: 'kg', cost: 9500 }] },
    { date: '2026-04-04', code: 2, dayStatus: 'worked', inputs: [{ inputType: 'seed', categoryTag: 'seed', quantity: 4, unit: 'kg', cost: 9000 }] },

    // Fertilizer (31,200)
    { date: '2026-04-08', code: 3, dayStatus: 'worked', inputs: [{ inputType: 'fertilizer', categoryTag: 'fertilizer', quantity: 50, unit: 'kg', cost: 11200 }] },
    { date: '2026-04-17', code: 4, dayStatus: 'worked', inputs: [{ inputType: 'fertilizer', categoryTag: 'fertilizer', quantity: 40, unit: 'kg', cost: 10000 }] },
    { date: '2026-04-27', code: 4, dayStatus: 'worked', inputs: [{ inputType: 'fertilizer', categoryTag: 'fertilizer', quantity: 40, unit: 'kg', cost: 10000 }] },

    // Labour (37,800)
    { date: '2026-04-03', code: 1, dayStatus: 'worked', labour: { familyLabour: 1, hiredLabour: 1, dailyWage: 2000, cost: 4000 } },
    { date: '2026-04-06', code: 0, dayStatus: 'worked', labour: { familyLabour: 1, hiredLabour: 1, dailyWage: 2500, cost: 5000 } },
    { date: '2026-04-09', code: 3, dayStatus: 'worked', labour: { familyLabour: 0, hiredLabour: 2, dailyWage: 2250, cost: 4500 } },
    { date: '2026-04-12', code: 2, dayStatus: 'worked', labour: { familyLabour: 1, hiredLabour: 2, dailyWage: 2000, cost: 6000 } },
    { date: '2026-04-18', code: 4, dayStatus: 'worked', labour: { familyLabour: 0, hiredLabour: 2, dailyWage: 2000, cost: 4000 } },
    { date: '2026-04-20', code: 5, dayStatus: 'worked', labour: { familyLabour: 1, hiredLabour: 1, dailyWage: 2400, cost: 4800 } },
    { date: '2026-04-28', code: 5, dayStatus: 'worked', labour: { familyLabour: 0, hiredLabour: 2, dailyWage: 2250, cost: 4500 } },
    { date: '2026-05-04', code: 9, dayStatus: 'worked', labour: { familyLabour: 1, hiredLabour: 1, dailyWage: 2250, cost: 4500 } },
    { date: '2026-05-06', code: 10, dayStatus: 'worked', labour: { familyLabour: 0, hiredLabour: 2, dailyWage: 2250, cost: 4500 } },

    // Fuel (16,800)
    { date: '2026-04-05', code: 0, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'fuel', quantity: 15, unit: 'l', cost: 4500 }] },
    { date: '2026-04-14', code: 6, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'fuel', quantity: 12, unit: 'l', cost: 3800 }] },
    { date: '2026-04-25', code: 7, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'fuel', quantity: 15, unit: 'l', cost: 4500 }] },
    { date: '2026-05-02', code: 6, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'fuel', quantity: 13, unit: 'l', cost: 4000 }] },

    // Irrigation (15,700)
    { date: '2026-04-10', code: 6, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'irrigation', quantity: 6, unit: 'hours', cost: 5200 }] },
    { date: '2026-04-22', code: 6, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'irrigation', quantity: 7, unit: 'hours', cost: 5500 }] },
    { date: '2026-04-30', code: 6, dayStatus: 'worked', inputs: [{ inputType: 'other', categoryTag: 'irrigation', quantity: 6, unit: 'hours', cost: 5000 }] },

    // 4 No Work days
    { date: '2026-04-07', code: 11, dayStatus: 'no_work' },
    { date: '2026-04-13', code: 11, dayStatus: 'no_work' },
    { date: '2026-04-19', code: 11, dayStatus: 'no_work' },
    { date: '2026-05-01', code: 11, dayStatus: 'no_work' }
  ];

  for (const item of expenseDefs) {
    const exp = new Expense({
      cycleId: cycle._id,
      entryDate: new Date(item.date),
      activityCode: activityCodes[item.code]._id,
      dayStatus: item.dayStatus,
      inputs: item.inputs || [],
      machinery: item.machinery || {},
      labour: item.labour || {},
      other: item.other || {},
      createdBy: farmerUser._id,
      syncStatus: 'synced'
    });
    await exp.save();
  }

  console.log('✅ Database seeded successfully!');
  console.log('----------------------------------------------------');
  console.log('Demo Farmer Login:');
  console.log('  Email:    sunil@aswanna.lk');
  console.log('  Password: Password123');
  console.log('  Role:     farmer');
  console.log('----------------------------------------------------');

  // ── Phase 3: Seed SO1 baselines (REPLACE WITH REAL SO1 API values) ──────────
  // Expected values from the Phase 3 spec demo:
  //   seed 25000 | fertilizer 45000 | labour 60000 | machinery 40000
  //   fuel 25000 | irrigation 25000 | agrochemical 0 | other 0 (Total = 220000)
  const SO1_DEMO = [
    { category: 'seed',         expected: 25000 },
    { category: 'fertilizer',   expected: 45000 },
    { category: 'labour',       expected: 60000 },
    { category: 'machinery',    expected: 40000 },
    { category: 'fuel',         expected: 25000 },
    { category: 'irrigation',   expected: 25000 },
    { category: 'agrochemical', expected: 0     },
    { category: 'other',        expected: 0     },
  ];

  for (const row of SO1_DEMO) {
    await Baseline.create({
      cycleId:        cycle._id,
      category:       row.category,
      expected:       row.expected,
      low:            Math.round(row.expected * 0.90),
      high:           Math.round(row.expected * 1.15),
      baselineSource: 'SO1',
    });
  }

  // Update cycle to reflect baseline source
  await Cycle.findByIdAndUpdate(cycle._id, { baselineSource: 'SO1' });

  // ── Threshold config (default tiered mode) ─────────────────────────────────
  await ThresholdConfig.create({
    cycleId:  cycle._id,
    mode:     'tiered',
    single:   0.10,
    stable:   { attention: 0.10, significant: 0.15 },
    volatile: { attention: 0.07, significant: 0.12 },
  });

  // ── Seed example alerts covering all 3 tiers ─────────────────────────────
  const alertSeeds = [
    // NORMAL tier – seed spend within normal bound (+4%)
    { category: 'seed',       tier: 'normal',      variancePct: 0.04, expectedToDate: 17500, actualToDate: 18200, dayOfCycle: 36, resolvedAt: null },
    // ATTENTION tier – fuel spend is 10% over phased plan (volatile: >7% & <=12%)
    { category: 'fuel',       tier: 'attention',   variancePct: 0.10, expectedToDate: 12500, actualToDate: 13750, dayOfCycle: 36, resolvedAt: null },
    // SIGNIFICANT tier – fertilizer is 15% over phased plan (volatile: >12%)
    { category: 'fertilizer', tier: 'significant', variancePct: 0.15, expectedToDate: 22500, actualToDate: 25875, dayOfCycle: 36, resolvedAt: null },
  ];

  for (const seed of alertSeeds) {
    await Alert.create({ cycleId: cycle._id, ...seed });
  }

  // ── Seed CropAccuracyHistory for SO3.5 Ranking Demo ──────────────────────
  // Seed history for Tomato (high past overspend error = 45%), Maize (low error = 2%), Paddy (1%)
  const historySeeds = [
    { crop: 'Tomato', errorPct: 0.45, predictedTotal: 245000, actualTotal: 355250 },
    { crop: 'Tomato', errorPct: 0.43, predictedTotal: 240000, actualTotal: 343200 },
    { crop: 'Tomato', errorPct: 0.47, predictedTotal: 250000, actualTotal: 367500 },
    { crop: 'Maize',  errorPct: 0.02, predictedTotal: 160000, actualTotal: 163200 },
    { crop: 'Maize',  errorPct: 0.02, predictedTotal: 165000, actualTotal: 168300 },
    { crop: 'Maize',  errorPct: 0.02, predictedTotal: 162000, actualTotal: 165240 },
    { crop: 'Paddy',  errorPct: 0.01, predictedTotal: 220000, actualTotal: 222200 },
    { crop: 'Paddy',  errorPct: 0.01, predictedTotal: 225000, actualTotal: 227250 },
    { crop: 'Paddy',  errorPct: 0.01, predictedTotal: 218000, actualTotal: 220180 },
  ];

  for (const item of historySeeds) {
    await CropAccuracyHistory.create({
      district: 'Kurunegala',
      crop: item.crop,
      season: 'Yala',
      cycleId: new mongoose.Types.ObjectId(),
      predictedTotal: item.predictedTotal,
      actualTotal: item.actualTotal,
      errorPct: item.errorPct,
      closedAt: new Date(),
    });
  }

  console.log('✅ Phase 3 seed data inserted (baselines, threshold config, 3-tier sample alerts, CropAccuracyHistory).');
}

async function runStandaloneSeed() {
  let memServer = null;
  try {
    await mongoose.connect(ENV.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to MongoDB at', ENV.MONGODB_URI);
  } catch (err) {
    console.log('Local MongoDB not running. Starting MongoMemoryServer for seeding...');
    const seedDbPath = path.join(process.cwd(), 'temp', 'seed-db-' + Date.now());
    fs.mkdirSync(seedDbPath, { recursive: true });
    memServer = await MongoMemoryServer.create({
      binary: { version: '7.0.14', downloadDir: 'd:/Aswanna/.mongo-cache' },
      instance: { dbPath: seedDbPath }
    });
    const uri = memServer.getUri();
    await mongoose.connect(uri);
    console.log('Connected to MongoMemoryServer at', uri);
  }

  await seedDatabase();

  if (memServer) {
    console.log('MongoMemoryServer seeded.');
  }
  await mongoose.disconnect();
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runStandaloneSeed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { Land } from '../src/models/Land.js';
import { Cycle } from '../src/models/Cycle.js';
import { Expense } from '../src/models/Expense.js';
import { ActivityCode } from '../src/models/ActivityCode.js';
import { createExpense } from '../src/services/expenseService.js';

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/aswenna');
  console.log('Connected to MongoDB');

  await mongoose.connection.db.dropDatabase();

  const user = await User.create({ name: 'Admin', phone: '0712345678', role: 'admin' });
  const farmer = await FarmerProfile.create({ userId: user._id, name: 'Sunil Perera', district: 'Kurunegala' });
  
  const land = await Land.create({ 
    farmerId: farmer._id, 
    landCode: 'L1', 
    extentValue: 0.5, 
    extentUnit: 'acre' 
  });
  
  const cycle = await Cycle.create({
    farmerId: farmer._id,
    landId: land._id,
    landCode: 'L1',
    crop: 'Tomato',
    season: 'Yala',
    status: 'active',
    startDate: new Date('2026-04-01')
  });

  const placeholders = [
    'land preparation', 'nursery', 'sowing/transplanting', 'basal fertilizer',
    'top-dress fertilizer', 'weeding', 'irrigation', 'pest/disease spraying',
    'staking/support', 'harvesting', 'transport', 'other'
  ];

  let i = 1;
  const activityCodes = [];
  for (const name of placeholders) {
    const ac = await ActivityCode.create({
      code: `PH-\${String(i++).padStart(2, '0')}`,
      nameEn: name,
      isPlaceholder: true,
      source: 'placeholder',
      active: true
    });
    activityCodes.push(ac);
  }

  await createExpense(cycle._id.toString(), {
    entryDate: new Date('2026-04-05'),
    activityCode: activityCodes[0]._id,
    inputs: [{ cost: 8500 }],
    machinery: { cost: 3500 },
    labour: { cost: 5000 },
    other: { amount: 0 }
  }, user._id.toString());

  console.log('Database seeded successfully');
  await mongoose.disconnect();
}

seed().catch(console.error);

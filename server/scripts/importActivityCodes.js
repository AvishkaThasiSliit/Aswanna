import fs from 'fs';
import mongoose from 'mongoose';
import { ActivityCode } from '../src/models/ActivityCode.js';

async function importCodes() {
  const file = process.argv[2];
  if (!file) {
    console.log('Usage: node importActivityCodes.js <csv-file>');
    return;
  }

  await mongoose.connect('mongodb://localhost:27017/aswenna');
  console.log('Connected to MongoDB');

  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  
  let imported = 0;
  for (const line of lines.slice(1)) {
    const [code, nameSi, nameEn, cropScopeRaw] = line.split(',');
    const cropScope = cropScopeRaw ? cropScopeRaw.split('|') : [];
    
    await ActivityCode.findOneAndUpdate(
      { code },
      { nameSi, nameEn, cropScope, source: 'DoA', active: true, isPlaceholder: false },
      { upsert: true }
    );
    imported++;
  }

  await ActivityCode.updateMany(
    { source: 'placeholder' },
    { $set: { active: false } }
  );

  console.log(`Imported \${imported} codes successfully. Marked old placeholders inactive.`);
  await mongoose.disconnect();
}

importCodes().catch(console.error);

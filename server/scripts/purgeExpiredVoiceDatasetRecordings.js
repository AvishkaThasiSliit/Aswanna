#!/usr/bin/env node
/**
 * Purge Expired Voice Dataset Recordings CLI (Phase 2.2)
 *
 * Implements safe, auditable automated retention lifecycle management:
 * 1. Identifies recordings where `retentionExpiresAt` has passed (< current time).
 * 2. Identifies soft-deleted recordings past the 30-day grace period.
 * 3. In dry-run mode (default), calculates counts and reclaimed storage without mutating data.
 * 4. In execute mode (`--execute`), unlinks underlying disk media safely and removes expired records.
 *
 * Usage:
 *   node server/scripts/purgeExpiredVoiceDatasetRecordings.js [--dry-run]
 *   node server/scripts/purgeExpiredVoiceDatasetRecordings.js --execute
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import { ENV, getDatasetStorageDir } from '../src/config/env.js';
import { VoiceDatasetRecording } from '../src/models/VoiceDatasetRecording.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

function getStorageDirectory() {
  return getDatasetStorageDir();
}

export async function purgeExpiredRecordings(options = {}) {
  const dryRun = options.execute !== true && options.dryRun !== false;
  const now = options.now || new Date();
  const softDeleteCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log('='.repeat(70));
  console.log('ASWANNA VOICE DATASET: RETENTION & PURGE AUDIT');
  console.log('='.repeat(70));
  console.log(`Execution Mode: ${dryRun ? 'DRY RUN (No data or files modified)' : 'EXECUTE (Live purge enabled)'}`);
  console.log(`Current Timestamp: ${now.toISOString()}`);
  console.log(`Soft-Delete Cutoff (30 days): ${softDeleteCutoff.toISOString()}`);

  if (mongoose.connection.readyState === 0) {
    const uri = options.uri || ENV.MONGODB_URI;
    console.log(`Connecting to database...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }

  // Find recordings matching expiration criteria
  const query = {
    $or: [
      { retentionExpiresAt: { $ne: null, $lte: now } },
      { deletedAt: { $ne: null, $lte: softDeleteCutoff } }
    ]
  };

  const expiredRecords = await VoiceDatasetRecording.find(query).select('+storedFileName');
  console.log(`Found ${expiredRecords.length} expired or aged soft-deleted recording(s).`);

  let totalBytesReclaimed = 0;
  let filesUnlinked = 0;
  let recordsRemoved = 0;
  const storageDir = options.storageDir || getStorageDirectory();

  for (const rec of expiredRecords) {
    const fileSize = rec.fileSizeBytes || 0;
    totalBytesReclaimed += fileSize;

    if (!dryRun) {
      if (rec.storedFileName) {
        const filePath = path.join(storageDir, rec.storedFileName);
        try {
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            filesUnlinked++;
          }
        } catch (unlinkErr) {
          console.warn(`[Purge Warning] Failed to unlink file '${rec.storedFileName}':`, unlinkErr.code);
        }
      }

      await VoiceDatasetRecording.deleteOne({ _id: rec._id });
      recordsRemoved++;
    }
  }

  console.log('='.repeat(70));
  console.log('PURGE SUMMARY:');
  console.log(`  Target Records:         ${expiredRecords.length}`);
  console.log(`  Records Removed:        ${dryRun ? 0 : recordsRemoved}`);
  console.log(`  Media Files Unlinked:   ${dryRun ? 0 : filesUnlinked}`);
  console.log(`  Storage Space Reclaimed: ${(totalBytesReclaimed / (1024 * 1024)).toFixed(2)} MB`);
  console.log('='.repeat(70));

  return {
    dryRun,
    matchedCount: expiredRecords.length,
    recordsRemoved: dryRun ? 0 : recordsRemoved,
    filesUnlinked: dryRun ? 0 : filesUnlinked,
    bytesReclaimed: totalBytesReclaimed
  };
}

// Execute if run directly from command line
if (process.argv[1] && process.argv[1].endsWith('purgeExpiredVoiceDatasetRecordings.js')) {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const uriIdx = args.indexOf('--uri');
  const mongoUri = uriIdx !== -1 ? args[uriIdx + 1] : undefined;

  purgeExpiredRecordings({ execute, uri: mongoUri })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Retention purge failed:', err);
      process.exit(1);
    });
}

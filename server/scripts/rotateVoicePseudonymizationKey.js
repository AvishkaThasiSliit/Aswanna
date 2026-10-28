#!/usr/bin/env node
/**
 * Voice Pseudonymization Key Rotation Script
 *
 * Rotates participant pseudonymous speaker IDs from an old HMAC key to a new HMAC key.
 * Updates VoiceConsent and VoiceDatasetRecording collections atomically per speaker.
 *
 * Usage:
 *   node server/scripts/rotateVoicePseudonymizationKey.js --old-key <oldKey> --new-key <newKey> [--dry-run]
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { ENV } from '../src/config/env.js';
import { VoiceConsent } from '../src/models/VoiceConsent.js';
import { VoiceDatasetRecording } from '../src/models/VoiceDatasetRecording.js';

function computeHmacSpeakerId(userId, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey)
    .update(userId.toString())
    .digest('hex');
  return `spk_${hmac.slice(0, 10)}`;
}

export async function rotatePseudonymizationKeys({ oldKey, newKey, dryRun = false, uri } = {}) {
  if (!oldKey || !newKey) {
    throw new Error('Both --old-key and --new-key are mandatory for key rotation');
  }
  if (oldKey === newKey) {
    throw new Error('New key must be distinct from old key');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri || ENV.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  }

  console.log('=' .repeat(70));
  console.log('ASWANNA VOICE DATASET: HMAC SECRET KEY ROTATION');
  console.log(`Dry Run: ${dryRun ? 'YES (No changes will be written)' : 'NO (Live database mutation)'}`);
  console.log('=' .repeat(70));

  const consents = await VoiceConsent.find({});
  console.log(`Found ${consents.length} total participant consent records.`);

  let updatedConsents = 0;
  let updatedRecordings = 0;

  for (const consent of consents) {
    const expectedOldSpk = computeHmacSpeakerId(consent.userId, oldKey);
    const newSpk = computeHmacSpeakerId(consent.userId, newKey);

    const consentAlreadyRotated = consent.pseudonymousSpeakerId === newSpk;
    const orphanedCount = await VoiceDatasetRecording.countDocuments({
      pseudonymousSpeakerId: expectedOldSpk
    });

    if (consentAlreadyRotated && orphanedCount === 0) {
      continue;
    }

    const previousSpk = consent.pseudonymousSpeakerId;
    console.log(`Speaker [REDACTED_USER_ID]: ${previousSpk} -> ${newSpk}`);

    if (!dryRun) {
      let session = null;
      const client = mongoose.connection.getClient ? mongoose.connection.getClient() : mongoose.connection.client;
      const isReplicaSet = Boolean(client?.topology?.description?.type?.includes('ReplicaSet'));

      if (isReplicaSet) {
        try {
          session = await mongoose.startSession();
          session.startTransaction();
        } catch {
          session = null;
        }
      }

      try {
        if (!consentAlreadyRotated) {
          consent.pseudonymousSpeakerId = newSpk;
          await consent.save(session ? { session } : undefined);
          updatedConsents++;
        }

        const recResult = await VoiceDatasetRecording.updateMany(
          { pseudonymousSpeakerId: { $in: [previousSpk, expectedOldSpk] } },
          { $set: { pseudonymousSpeakerId: newSpk } },
          session ? { session } : undefined
        );
        updatedRecordings += recResult.modifiedCount;

        if (session) {
          await session.commitTransaction();
        }
      } catch (err) {
        if (session) {
          await session.abortTransaction().catch(() => {});
        }
        throw err;
      } finally {
        if (session) {
          session.endSession();
        }
      }
    } else {
      if (!consentAlreadyRotated) updatedConsents++;
      const recCount = await VoiceDatasetRecording.countDocuments({
        pseudonymousSpeakerId: { $in: [previousSpk, expectedOldSpk] }
      });
      updatedRecordings += recCount;
    }
  }

  console.log('=' .repeat(70));
  console.log(`Rotation completed.`);
  console.log(`Consents rotated: ${updatedConsents}`);
  console.log(`Recordings updated: ${updatedRecordings}`);
  console.log('=' .repeat(70));

  return { updatedConsents, updatedRecordings };
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('rotateVoicePseudonymizationKey.js')) {
  const args = process.argv.slice(2);
  const oldIdx = args.indexOf('--old-key');
  const oldKey = oldIdx !== -1 ? args[oldIdx + 1] : undefined;
  const newIdx = args.indexOf('--new-key');
  const newKey = newIdx !== -1 ? args[newIdx + 1] : undefined;
  const dryRun = args.includes('--dry-run');

  rotatePseudonymizationKeys({ oldKey, newKey, dryRun })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Key rotation failed:', err.message);
      process.exit(1);
    });
}

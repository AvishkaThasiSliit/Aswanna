#!/usr/bin/env node
/**
 * Export Voice Dataset Manifest CLI (Phase 2)
 *
 * Exports consent-eligible, human-reviewed voice recordings into Phase 1 manifest schema.
 * Partitions dataset into speaker-disjoint splits: Train (70%), Val (15%), Test (15%).
 * Preserves provenance while completely hiding participant PII.
 *
 * Usage:
 *   node server/scripts/exportVoiceDatasetManifest.js [--out path/to/manifest.json] [--split] [--verify]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { spawnSync } from 'child_process';

import { ENV } from '../src/config/env.js';
import { VoiceConsent } from '../src/models/VoiceConsent.js';
import { VoiceDatasetRecording } from '../src/models/VoiceDatasetRecording.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

async function exportManifest(options = {}) {
  const outputPath = options.out
    ? path.resolve(process.cwd(), options.out)
    : path.join(REPO_ROOT, 'exports/voice_manifest.json');

  const shouldSplit = options.split !== false;

  console.log('=' .repeat(70));
  console.log('ASWANNA VOICE DATASET MANIFEST EXPORT');
  console.log('=' .repeat(70));
  console.log(`Target Output: ${outputPath}`);
  console.log(`Speaker-Disjoint Split: ${shouldSplit ? 'ENABLED (70% Train, 15% Val, 15% Test)' : 'DISABLED'}`);

  if (mongoose.connection.readyState === 0) {
    const uri = options.uri || ENV.MONGODB_URI;
    console.log(`Connecting to database...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }

  // 1. Fetch active consents
  const activeConsents = await VoiceConsent.find({
    consentGiven: true,
    revokedAt: null
  }).select('pseudonymousSpeakerId');

  const eligibleSpeakerIds = new Set(activeConsents.map(c => c.pseudonymousSpeakerId));
  console.log(`Eligible consenting speakers: ${eligibleSpeakerIds.size}`);

  // 2. Fetch reviewed, non-deleted recordings
  const recordings = await VoiceDatasetRecording.find({
    deletedAt: null,
    reviewStatus: 'reviewed',
    referenceTranscript: { $exists: true, $ne: '' },
    pseudonymousSpeakerId: { $in: Array.from(eligibleSpeakerIds) }
  }).select('+storedFileName').sort({ createdAt: 1 });

  console.log(`Reviewed, consent-eligible recordings: ${recordings.length}`);

  if (recordings.length === 0) {
    console.log('Notice: No reviewed recordings found with active participant consent.');
  }

  // 3. Speaker-disjoint split allocation (deterministic hash-based partitioning)
  const uniqueSpeakers = Array.from(new Set(recordings.map(r => r.pseudonymousSpeakerId)));
  const { assignSpeakerSplit } = await import('../src/routes/datasetCollection.js');
  const speakerToSplit = {};

  if (shouldSplit) {
    uniqueSpeakers.forEach(spkId => {
      speakerToSplit[spkId] = assignSpeakerSplit(spkId);
    });
  }

  // 4. Construct manifest adhering strictly to Phase 1 manifest specification
  const cases = recordings.map(rec => {
    // Authoritative split precedence: preserve existing persisted split to freeze benchmark test-set membership
    const splitLabel = shouldSplit
      ? (rec.splitAssignment && rec.splitAssignment !== 'unassigned'
          ? rec.splitAssignment
          : (speakerToSplit[rec.pseudonymousSpeakerId] || 'train'))
      : (rec.splitAssignment || 'train');

    return {
      caseId: `VP-${rec.recordingId.toUpperCase().replace('_', '-')}`,
      audioPath: `recordings/${rec.storedFileName}`,
      language: rec.language,
      referenceTranscript: rec.referenceTranscript,
      speaker: {
        id: rec.pseudonymousSpeakerId,
        dialect: rec.accentOrDialect,
        noiseLevel: rec.noiseEnvironment
      },
      reviewStatus: 'reviewed',
      split: splitLabel,
      provenance: {
        recordingId: rec.recordingId,
        speechMode: rec.speechMode,
        promptCategory: rec.promptCategory,
        promptId: rec.promptId,
        recordingSource: rec.recordingSource,
        deviceType: rec.deviceType,
        datasetVersion: rec.datasetVersion,
        durationSeconds: rec.durationSeconds
      }
    };
  });

  const exportPayload = {
    datasetVersion: 'v1.0',
    splitPolicy: 'speaker_hash_v1',
    exportedAt: new Date().toISOString(),
    totalCases: cases.length,
    eligibleSpeakersCount: uniqueSpeakers.length,
    splitDistribution: shouldSplit ? {
      train: cases.filter(c => c.split === 'train').length,
      val: cases.filter(c => c.split === 'val').length,
      test: cases.filter(c => c.split === 'test').length
    } : null,
    cases
  };

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2), 'utf-8');
  console.log(`Successfully exported ${cases.length} cases to: ${outputPath}`);

  // 5. Verification against Phase 1 validators if requested
  if (options.verify && cases.length > 0) {
    console.log('\nRunning Phase 1 validation checks...');
    const pythonExe = path.join(REPO_ROOT, 'voice-service/.venv/Scripts/python.exe');
    if (fs.existsSync(pythonExe)) {
      // Run manifest validator
      const mv = spawnSync(pythonExe, [
        path.join(REPO_ROOT, 'voice-service/validation/manifest_validator.py'),
        '--manifest', outputPath
      ], { stdio: 'inherit' });

      // Run split validator
      const sv = spawnSync(pythonExe, [
        path.join(REPO_ROOT, 'voice-service/validation/split_validator.py'),
        '--manifest', outputPath
      ], { stdio: 'inherit' });

      if (mv.status === 0 && sv.status === 0) {
        console.log('\n[VERIFIED] Manifest and split validators PASSED with zero speaker leakage.');
      }
    }
  }

  return exportPayload;
}

// Execute if run directly from command line
if (process.argv[1] && process.argv[1].endsWith('exportVoiceDatasetManifest.js')) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;
  const uriIdx = args.indexOf('--uri');
  const mongoUri = uriIdx !== -1 ? args[uriIdx + 1] : undefined;
  const verify = args.includes('--verify');

  exportManifest({ out: outPath, uri: mongoUri, verify })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Export failed:', err);
      process.exit(1);
    });
}

export { exportManifest };

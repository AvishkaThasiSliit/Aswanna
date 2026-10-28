import mongoose from 'mongoose';

const voiceDatasetRecordingSchema = new mongoose.Schema({
  recordingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pseudonymousSpeakerId: {
    type: String,
    required: true,
    index: true
  },
  // Store contributor reference privately for ownership checks; never exposed to manifest
  contributorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    select: false
  },
  speechMode: {
    type: String,
    enum: ['natural', 'prompted'],
    required: true
  },
  promptCategory: {
    type: String,
    enum: [
      'fertilizer',
      'pesticide',
      'labor',
      'machinery_fuel',
      'seeds_plants',
      'irrigation',
      'transport',
      'general_expense',
      'unprompted'
    ],
    default: 'unprompted'
  },
  promptId: {
    type: String,
    default: null
  },
  promptText: {
    type: String,
    default: null
  },
  language: {
    type: String,
    enum: ['si', 'en'],
    required: true,
    default: 'si'
  },
  accentOrDialect: {
    type: String,
    default: 'standard'
  },
  noiseEnvironment: {
    type: String,
    enum: ['quiet', 'field_moderate', 'windy', 'machinery_noise'],
    default: 'quiet'
  },
  recordingSource: {
    type: String,
    enum: ['browser_mic', 'file_upload'],
    default: 'browser_mic'
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'unknown'],
    default: 'unknown'
  },

  // Private storage location on disk; never exposed over API
  storedFileName: {
    type: String,
    required: true,
    select: false
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSizeBytes: {
    type: Number,
    required: true
  },
  durationSeconds: {
    type: Number,
    required: true
  },

  // Human Review & Ground Truth Transcript Workflow
  reviewStatus: {
    type: String,
    enum: ['pending', 'reviewed', 'rejected'],
    default: 'pending',
    index: true
  },
  referenceTranscript: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: null
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },

  // Dataset Versioning & Partitioning
  datasetVersion: {
    type: String,
    default: 'v1.0'
  },
  splitAssignment: {
    type: String,
    enum: ['train', 'val', 'test', 'unassigned'],
    default: 'unassigned'
  },
  splitPolicy: {
    type: String,
    default: 'speaker_hash_v1'
  },

  // Retention, Deletion & Idempotency
  retentionExpiresAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  clientRequestId: {
    type: String,
    unique: true,
    sparse: true
  },
  requestFingerprint: {
    type: String,
    default: null,
    index: true
  }
}, { timestamps: true });

export const VoiceDatasetRecording = mongoose.model('VoiceDatasetRecording', voiceDatasetRecordingSchema);

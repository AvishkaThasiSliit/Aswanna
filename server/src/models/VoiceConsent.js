import mongoose from 'mongoose';

const voiceConsentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  pseudonymousSpeakerId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  consentGiven: {
    type: Boolean,
    required: true,
    default: false
  },
  consentVersion: {
    type: String,
    required: true,
    default: '1.0'
  },
  agreedTerms: [{
    type: String
  }],
  consentedAt: {
    type: Date,
    default: Date.now
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revocationReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

export const VoiceConsent = mongoose.model('VoiceConsent', voiceConsentSchema);

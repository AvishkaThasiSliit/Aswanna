import { AppError } from './errors.js';

export const MIN_AUDIO_BYTES = 100;
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_AUDIO_DURATION_S = 60.5; // 60 seconds max

/**
 * Supported container metadata mapping.
 */
const SUPPORTED_CONTAINERS = {
  wav: { format: 'wav', mimeType: 'audio/wav', extension: 'wav' },
  ogg: { format: 'ogg', mimeType: 'audio/ogg', extension: 'ogg' },
  webm: { format: 'webm', mimeType: 'audio/webm', extension: 'webm' },
  flac: { format: 'flac', mimeType: 'audio/flac', extension: 'flac' },
  mp3: { format: 'mp3', mimeType: 'audio/mpeg', extension: 'mp3' },
  m4a: { format: 'm4a', mimeType: 'audio/mp4', extension: 'm4a' }
};

/**
 * Validates WAV container structural integrity, audio parameters, and data chunk bounds.
 * Returns { format, mimeType, extension, durationSeconds } or throws AppError.
 */
function validateWavStructure(buffer) {
  if (buffer.length < 44) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'WAV file header is truncated (< 44 bytes)', 400);
  }

  const riffHeader = buffer.toString('ascii', 0, 4);
  const waveHeader = buffer.toString('ascii', 8, 12);
  if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Invalid WAV header magic bytes', 400);
  }

  const riffSize = buffer.readUInt32LE(4);
  // RIFF size should roughly correspond to buffer length (riffSize + 8 bytes)
  if (riffSize < 36) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt WAV RIFF chunk size', 400);
  }

  let offset = 12;
  let fmtFound = false;
  let dataFound = false;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let bitsPerSample = 0;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkSize > buffer.length) {
      if (chunkId === 'data') {
        throw new AppError(
          'INVALID_AUDIO_FORMAT',
          `Truncated WAV data chunk: claims ${chunkSize} bytes, but file contains only ${buffer.length - (offset + 8)} bytes`,
          400
        );
      }
      throw new AppError('INVALID_AUDIO_FORMAT', `Corrupt WAV subchunk size (${chunkSize}) for ${chunkId}`, 400);
    }

    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || offset + 8 + 16 > buffer.length) {
        throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt or truncated WAV fmt chunk', 400);
      }
      fmtFound = true;
      audioFormat = buffer.readUInt16LE(offset + 8);
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      byteRate = buffer.readUInt32LE(offset + 16);
      bitsPerSample = buffer.readUInt16LE(offset + 22);

      // Validate audio parameters
      if (audioFormat !== 1 && audioFormat !== 3) {
        // 1 = PCM, 3 = IEEE Float
        throw new AppError('INVALID_AUDIO_FORMAT', `Unsupported WAV audio format code (${audioFormat}). Aswanna requires PCM or IEEE float audio.`, 400);
      }
      if (numChannels < 1 || numChannels > 2) {
        throw new AppError('INVALID_AUDIO_FORMAT', `Invalid channel count (${numChannels}). Audio must be mono or stereo.`, 400);
      }
      if (sampleRate < 8000 || sampleRate > 48000) {
        throw new AppError('INVALID_AUDIO_FORMAT', `Sample rate (${sampleRate} Hz) out of supported range (8000-48000 Hz)`, 400);
      }
      if (![16, 24, 32].includes(bitsPerSample)) {
        throw new AppError('INVALID_AUDIO_FORMAT', `Bits per sample (${bitsPerSample}) must be 16, 24, or 32`, 400);
      }
      const expectedByteRate = (sampleRate * numChannels * bitsPerSample) / 8;
      if (byteRate !== expectedByteRate) {
        throw new AppError('INVALID_AUDIO_FORMAT', 'WAV byte rate does not match sample rate, channels, and bit depth', 400);
      }
    } else if (chunkId === 'data') {
      dataFound = true;
      dataLength = chunkSize;
      // Deep decodability & integrity check:
      // Does buffer actually contain the claimed data payload?
      if (offset + 8 + dataLength > buffer.length) {
        // Allow at most 2 bytes difference due to word alignment / padding
        if (offset + 8 + dataLength > buffer.length + 2) {
          throw new AppError(
            'INVALID_AUDIO_FORMAT',
            `Truncated WAV data chunk: claims ${dataLength} bytes, but file contains only ${buffer.length - (offset + 8)} bytes`,
            400
          );
        }
      }
      if (dataLength < 4) {
        throw new AppError('INVALID_AUDIO_FORMAT', 'WAV data chunk contains no audio frames', 400);
      }
      break;
    }

    // Advance to next chunk (aligned to 2-byte word boundary)
    const paddedChunkSize = chunkSize + (chunkSize % 2);
    offset += 8 + paddedChunkSize;
  }

  if (!fmtFound || !dataFound) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'WAV missing essential fmt or data subchunks', 400);
  }

  const durationSeconds = Math.round((dataLength / byteRate) * 100) / 100;
  return {
    ...SUPPORTED_CONTAINERS.wav,
    durationSeconds
  };
}

/**
 * Validates WebM / Matroska container structure.
 */
function validateWebmStructure(buffer) {
  if (buffer.length < 32) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'WebM audio file is truncated', 400);
  }
  // Check EBML Header ID 0x1A 0x45 0xDF 0xA3
  if (
    buffer[0] !== 0x1A ||
    buffer[1] !== 0x45 ||
    buffer[2] !== 0xDF ||
    buffer[3] !== 0xA3
  ) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Invalid WebM EBML header magic bytes', 400);
  }

  // Scan first 512 bytes for DocType "webm" or "matroska"
  const scanLimit = Math.min(buffer.length, 512);
  const headerSlice = buffer.slice(0, scanLimit).toString('latin1');
  if (!headerSlice.includes('webm') && !headerSlice.includes('matroska')) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'WebM header missing valid DocType element', 400);
  }

  return { ...SUPPORTED_CONTAINERS.webm };
}

/**
 * Validates OGG container structure.
 */
function validateOggStructure(buffer) {
  if (buffer.length < 28) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'OGG audio file is truncated (< 28 bytes)', 400);
  }
  if (buffer.toString('ascii', 0, 4) !== 'OggS') {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Invalid OGG magic pattern', 400);
  }
  // OGG stream structure version must be 0
  if (buffer[4] !== 0x00) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Unsupported OGG version', 400);
  }
  const pageSegments = buffer[26];
  if (buffer.length < 27 + pageSegments) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Truncated OGG page segment table', 400);
  }

  return { ...SUPPORTED_CONTAINERS.ogg };
}

/**
 * Validates FLAC container structure.
 */
function validateFlacStructure(buffer) {
  if (buffer.length < 42) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'FLAC audio file is truncated (< 42 bytes)', 400);
  }
  if (buffer.toString('ascii', 0, 4) !== 'fLaC') {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Invalid FLAC magic pattern', 400);
  }
  // First metadata block must be STREAMINFO (block type 0)
  const blockHeader = buffer[4];
  const blockType = blockHeader & 0x7F;
  if (blockType !== 0) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'FLAC missing mandatory STREAMINFO header block', 400);
  }
  const blockSize = (buffer[5] << 16) | (buffer[6] << 8) | buffer[7];
  if (blockSize !== 34) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt FLAC STREAMINFO block size', 400);
  }

  return { ...SUPPORTED_CONTAINERS.flac };
}

/**
 * Validates MP3 structure (ID3v2 tag or MPEG audio sync frame).
 */
function validateMp3Structure(buffer) {
  if (buffer.length < 32) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'MP3 audio file is truncated', 400);
  }

  // Case A: ID3v2 container header
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    const version = buffer[3];
    if (version < 2 || version > 4) {
      throw new AppError('INVALID_AUDIO_FORMAT', `Unsupported ID3 version: 2.${version}`, 400);
    }
    return { ...SUPPORTED_CONTAINERS.mp3 };
  }

  // Case B: Direct MPEG audio sync frame (0xFF 0xEx/0xFx)
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    const mpegVersion = (buffer[1] & 0x18) >> 3;
    const layer = (buffer[1] & 0x06) >> 1;
    const bitrateIdx = (buffer[2] & 0xF0) >> 4;
    const sampleRateIdx = (buffer[2] & 0x0C) >> 2;

    if (mpegVersion === 1) {
      // Reserved MPEG version
      throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt MP3 header (reserved MPEG version)', 400);
    }
    if (layer === 0) {
      // Reserved layer
      throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt MP3 header (reserved layer)', 400);
    }
    if (bitrateIdx === 0x0F) {
      // Bad bitrate
      throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt MP3 header (invalid bitrate index)', 400);
    }
    if (sampleRateIdx === 0x03) {
      // Reserved sample rate
      throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt MP3 header (reserved sample rate index)', 400);
    }

    return { ...SUPPORTED_CONTAINERS.mp3 };
  }

  throw new AppError('INVALID_AUDIO_FORMAT', 'Invalid MP3 audio header', 400);
}

function validateM4aStructure(buffer) {
  if (buffer.length < 32) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'M4A audio file is truncated (< 32 bytes)', 400);
  }
  const ftypBox = buffer.toString('ascii', 4, 8);
  if (ftypBox !== 'ftyp') {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Invalid M4A/MP4 container', 400);
  }
  const ftypSize = buffer.readUInt32BE(0);
  if (ftypSize < 16 || ftypSize > buffer.length) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Corrupt M4A ftyp box length', 400);
  }

  const majorBrand = buffer.toString('ascii', 8, 12);
  const supportedBrands = ['M4A ', 'mp41', 'mp42', 'isom', 'dash', 'audi'];
  const boxContent = buffer.slice(8, ftypSize).toString('ascii');
  if (!supportedBrands.some(b => majorBrand.includes(b.trim()) || boxContent.includes(b.trim()))) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'Unsupported MP4/M4A brand container', 400);
  }

  // Deep ISOBMFF decodability check: verify subsequent top-level boxes (moov / mdat)
  let offset = ftypSize;
  let hasMediaOrMetadata = false;

  while (offset + 8 <= buffer.length) {
    const boxSize = buffer.readUInt32BE(offset);
    const boxType = buffer.toString('ascii', offset + 4, offset + 8);

    if (boxSize < 8) {
      // 0 means runs until EOF, which is valid only for mdat at the end
      if (boxSize === 0 && boxType === 'mdat') {
        hasMediaOrMetadata = true;
        break;
      }
      throw new AppError('INVALID_AUDIO_FORMAT', `Corrupt M4A atom box size (${boxSize}) for ${boxType}`, 400);
    }

    if (boxSize > buffer.length) {
      throw new AppError('INVALID_AUDIO_FORMAT', `Corrupt M4A atom box size (${boxSize}) for ${boxType} exceeds file size`, 400);
    }

    if (offset + boxSize > buffer.length + 4) {
      throw new AppError('INVALID_AUDIO_FORMAT', `Truncated M4A atom box (${boxType} claims ${boxSize} bytes, file has ${buffer.length - offset})`, 400);
    }

    if (boxType === 'moov' || boxType === 'mdat') {
      hasMediaOrMetadata = true;
    }

    offset += boxSize;
  }

  if (!hasMediaOrMetadata) {
    throw new AppError('INVALID_AUDIO_FORMAT', 'M4A container missing mandatory moov metadata or mdat media payload', 400);
  }

  return { ...SUPPORTED_CONTAINERS.m4a };
}

/**
 * Identifies container format and validates deep container integrity.
 */
export function detectAudioContainer(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // 1. WAV
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return validateWavStructure(buffer);
  }

  // 2. OGG
  if (buffer.toString('ascii', 0, 4) === 'OggS') {
    return validateOggStructure(buffer);
  }

  // 3. WebM
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return validateWebmStructure(buffer);
  }

  // 4. FLAC
  if (buffer.toString('ascii', 0, 4) === 'fLaC') {
    return validateFlacStructure(buffer);
  }

  // 5. MP3
  if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) {
    return validateMp3Structure(buffer);
  }

  // 6. M4A / MP4
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return validateM4aStructure(buffer);
  }

  return null;
}

/**
 * Validates audio buffer strictly against content, size, format, decodability, and duration.
 * Throws AppError with descriptive HTTP 400 details on validation failure.
 */
export function validateAudioBuffer(buffer, options = {}) {
  if (!buffer || buffer.length === 0) {
    throw new AppError('EMPTY_AUDIO_FILE', 'Audio file is empty', 400);
  }

  if (buffer.length < MIN_AUDIO_BYTES) {
    throw new AppError(
      'INVALID_AUDIO_FORMAT',
      `Audio file is too small (${buffer.length} bytes) to be a valid audio recording`,
      400
    );
  }

  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new AppError(
      'AUDIO_SIZE_EXCEEDED',
      `Audio file size (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds 15 MB limit`,
      400
    );
  }

  const container = detectAudioContainer(buffer);
  if (!container) {
    throw new AppError(
      'INVALID_AUDIO_FORMAT',
      'Uploaded file content does not match any supported audio format (WAV, WebM, OGG, MP3, FLAC, M4A)',
      400
    );
  }

  // Check claimed MIME or extension mismatch if provided
  if (options.claimedMime) {
    const normClaimed = options.claimedMime.toLowerCase().split(';')[0].trim();
    const isGeneric = ['application/octet-stream', 'audio/*'].includes(normClaimed);
    if (!isGeneric && !normClaimed.includes(container.format) && !container.mimeType.includes(normClaimed)) {
      // E.g. Claimed audio/wav but payload is MP3
      if ((normClaimed.includes('wav') && container.format !== 'wav') ||
          (normClaimed.includes('mp3') && container.format !== 'mp3') ||
          (normClaimed.includes('webm') && container.format !== 'webm') ||
          (normClaimed.includes('ogg') && container.format !== 'ogg')) {
        throw new AppError(
          'INVALID_AUDIO_FORMAT',
          `Content-Type header (${options.claimedMime}) does not match detected audio format (${container.format})`,
          400
        );
      }
    }
  }

  let durationSeconds = container.durationSeconds;
  if (!durationSeconds && options.claimedDuration) {
    durationSeconds = Number(options.claimedDuration);
  }

  // Duration guard
  if (durationSeconds > MAX_AUDIO_DURATION_S) {
    throw new AppError(
      'AUDIO_DURATION_EXCEEDED',
      `Audio duration (${durationSeconds.toFixed(1)}s) exceeds 60 seconds limit`,
      400
    );
  }

  // Default fallback estimated duration if not computable from container header
  if (!durationSeconds || durationSeconds <= 0) {
    durationSeconds = options.claimedDuration && Number(options.claimedDuration) > 0
      ? Number(options.claimedDuration)
      : Math.max(1.0, Math.min(30.0, Math.round((buffer.length / 16000) * 10) / 10));
  }

  return {
    isValid: true,
    format: container.format,
    mimeType: container.mimeType,
    extension: container.extension,
    sizeBytes: buffer.length,
    durationSeconds
  };
}

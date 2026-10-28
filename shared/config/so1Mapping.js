/**
 * SO1 Cultivation Cost Prediction Integration Configuration
 * Maps SO1 (Cost of Cultivation) ML outputs into SO3's 8 financial tracking categories.
 */

export const SO1_CONFIG = {
  baseUrl: process.env.SO1_BASE_URL || 'http://127.0.0.1:8000',
  timeoutMs: parseInt(process.env.SO1_TIMEOUT_MS || '3000', 10),
  defaultReferenceYear: 2025,
  defaultUsdLkrRate: 300.73,
  recommendationCacheTtlMs: parseInt(process.env.SO1_REC_CACHE_TTL_MS || String(24 * 60 * 60 * 1000), 10),
  recommendationErrorCacheTtlMs: parseInt(process.env.SO1_REC_ERROR_CACHE_TTL_MS || String(30 * 1000), 10),
};

/**
 * Crop nomenclature aliases between SO3 front-end entries and SO1 model catalog
 */
export const SO1_CROP_ALIASES = {
  Chili: 'Green Chilli',
  chili: 'Green Chilli',
  'Green Chili': 'Green Chilli',
  'green chilli': 'Green Chilli',
  Paddy: 'Paddy',
  Maize: 'Maize',
  Tomato: 'Tomato',
};

/**
 * 1:1 Mappings from SO1 breakdown keys to SO3 categories
 */
export const SO1_DIRECT_CATEGORY_MAP = {
  'Seeds': 'seed',
  'Fertilizer': 'fertilizer',
  'Cultivation Labour': 'labour',
  'Mechanized Irrigation': 'irrigation',
};

/**
 * Compound category split ratios
 * PLACEHOLDER: CONFIRM WITH SO1 LEAD
 * Empirical DoA survey estimates indicate:
 * - Machinery hire vs diesel fuel split in mechanized operations (~70% machinery, 30% fuel)
 * - Agrochemicals vs miscellaneous other materials (~85% agrochemicals, 15% other bags/twine/packing)
 */
export const SO1_COMPOUND_SPLITS = {
  // Land Preparation + Fuel & Machinery -> machinery and fuel
  machineryFuel: {
    machinery: 0.70, // PLACEHOLDER: CONFIRM WITH SO1 LEAD
    fuel: 0.30,      // PLACEHOLDER: CONFIRM WITH SO1 LEAD
  },
  // Agrochemicals & Other -> agrochemical and other
  agrochemicalOther: {
    agrochemical: 0.85, // PLACEHOLDER: CONFIRM WITH SO1 LEAD
    other: 0.15,        // PLACEHOLDER: CONFIRM WITH SO1 LEAD
  },
};

/**
 * Standard Sri Lanka Agrarian Districts supported natively by SO1
 */
export const SO1_SUPPORTED_DISTRICTS = [
  'Ampara', 'Ampara (East)', 'Ampara (West)', 'Anuradhapura', 'Badulla',
  'Batticaloa', 'Colombo', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kurunegala', 'Mahaweli System B', 'Mahaweli System C', 'Mahaweli System H',
  'Mannar', 'Matale', 'Monaragala', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam',
  'Trincomalee', 'Udawalawa', 'Vavuniya', 'Whole Island'
];

/**
 * Canonical SO3 8 Categories
 */
export const SO3_CATEGORIES = [
  'seed',
  'fertilizer',
  'agrochemical',
  'labour',
  'machinery',
  'fuel',
  'irrigation',
  'other',
];

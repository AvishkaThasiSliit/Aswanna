import { SRI_LANKA_DISTRICTS } from '../constants/districts.js';
import { VALIDATION_LIMITS } from '../config/validationLimits.js';

export const landSchema = [
  {
    key: 'landType',
    paperLabelSi: 'ගොඩ / මඩ',
    labelEn: 'Land Type',
    type: 'select',
    required: false,
    options: ['upland', 'lowland'],
    rules: {
      enum: ['upland', 'lowland'],
    },
  },
  {
    key: 'district',
    paperLabelSi: 'දිස්ත්‍රික්කය',
    labelEn: 'District',
    type: 'select',
    required: false,
    options: SRI_LANKA_DISTRICTS,
    rules: {
      enum: SRI_LANKA_DISTRICTS,
    },
  },
  {
    key: 'agrarianServiceCentre',
    paperLabelSi: 'ගොවිජන සේවා මධ්‍යස්ථානය',
    labelEn: 'Agrarian Service Centre',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.land.agrarianServiceCentre.max,
      noHtml: true,
    },
  },
  {
    key: 'gnDivision',
    paperLabelSi: 'ග්‍රා.නි.වසම',
    labelEn: 'GN Division',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.land.gnDivision.max,
      noHtml: true,
    },
  },
  {
    key: 'tenure',
    paperLabelSi: 'අයිතිය',
    labelEn: 'Tenure',
    type: 'select',
    required: false,
    options: ['freehold', 'ande', 'bhaddha', 'kuli', 'state', 'private'],
    rules: {
      enum: ['freehold', 'ande', 'bhaddha', 'kuli', 'state', 'private'],
    },
  },
  {
    key: 'extentUnit',
    paperLabelSi: 'බිම් ප්‍රමාණය (ඒකකය)',
    labelEn: 'Extent Unit',
    type: 'select',
    required: false,
    options: ['hectare', 'acre', 'rood', 'perch'],
    rules: {
      enum: ['hectare', 'acre', 'rood', 'perch'],
    },
  },
  {
    key: 'extentValue',
    paperLabelSi: 'ඉඩම් ප්රමාණය',
    labelEn: 'Extent',
    type: 'number',
    required: true,
    rules: {
      required: true,
      min: VALIDATION_LIMITS.land.extentValue.min,
      max: VALIDATION_LIMITS.land.extentValue.max,
    },
  },
  {
    key: 'extentAcres',
    paperLabelSi: 'අක්කර',
    labelEn: 'Extent in Acres',
    type: 'number',
    computed: true,
  },
  {
    key: 'waterSourceType',
    paperLabelSi: 'වාරි / වර්ෂා පෝෂිත',
    labelEn: 'Water Source Type',
    type: 'select',
    required: false,
    options: ['irrigated', 'rainfed'],
    rules: {
      enum: ['irrigated', 'rainfed'],
    },
  },
  {
    key: 'irrigationSource',
    paperLabelSi: 'වාරි ජල මූලාශ්‍රය',
    labelEn: 'Irrigation Source',
    type: 'text',
    required: false,
    rules: {
      requiredIf: { field: 'waterSourceType', equals: 'irrigated' },
      maxLength: VALIDATION_LIMITS.land.irrigationSource.max,
      noHtml: true,
    },
  },
  {
    key: 'landCode',
    paperLabelSi: 'ඉඩමේ කේතය / පී.එල්.ආර්. අංකය',
    labelEn: 'Land Code',
    type: 'text',
    required: true,
    rules: {
      required: true,
      pattern: 'landCode',
      minLength: VALIDATION_LIMITS.land.landCode.min,
      maxLength: VALIDATION_LIMITS.land.landCode.max,
      noHtml: true,
    },
  },
];

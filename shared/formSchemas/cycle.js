import { VALIDATION_LIMITS } from '../config/validationLimits.js';
import { SRI_LANKA_DISTRICTS } from '../constants/districts.js';

export const cycleSchema = [
  {
    key: 'landId',
    labelSi: 'වගා ඉඩම',
    labelEn: 'Land ID',
    type: 'text',
    required: false,
    paperField: false,
    rules: {
      required: false,
    },
  },
  {
    key: 'crop',
    labelSi: 'බෝගය',
    labelEn: 'Crop',
    type: 'select',
    required: true,
    paperField: false,
    rules: {
      required: true,
      minLength: VALIDATION_LIMITS.cycle.crop.min,
      maxLength: VALIDATION_LIMITS.cycle.crop.max,
      noHtml: true,
    },
  },
  {
    key: 'season',
    labelSi: 'කන්නය',
    labelEn: 'Season',
    type: 'select',
    required: true,
    options: ['Yala', 'Maha'],
    paperField: false,
    rules: {
      required: true,
      enum: ['Yala', 'Maha'],
    },
  },
  {
    key: 'startDate',
    labelSi: 'ආරම්භක දිනය',
    labelEn: 'Start Date',
    type: 'date',
    required: true,
    paperField: false,
    rules: {
      required: true,
    },
  },
  {
    key: 'district',
    labelSi: 'දිස්ත්‍රික්කය',
    labelEn: 'District',
    type: 'select',
    required: false,
    options: SRI_LANKA_DISTRICTS,
    paperField: false,
    rules: {
      enum: SRI_LANKA_DISTRICTS,
    },
  },
  {
    key: 'extentValue',
    labelSi: 'බිම් ප්‍රමාණය',
    labelEn: 'Extent Value',
    type: 'number',
    required: false,
    paperField: false,
    rules: {
      min: VALIDATION_LIMITS.land.extentValue.min,
      max: VALIDATION_LIMITS.land.extentValue.max,
    },
  },
  {
    key: 'extentUnit',
    labelSi: 'ඒකකය',
    labelEn: 'Extent Unit',
    type: 'select',
    required: false,
    options: ['hectare', 'acre', 'rood', 'perch'],
    paperField: false,
    rules: {
      enum: ['hectare', 'acre', 'rood', 'perch'],
    },
  },
  {
    key: 'status',
    labelSi: 'තත්ත්වය',
    labelEn: 'Status',
    type: 'select',
    required: false,
    options: ['active', 'closed'],
    paperField: false,
    rules: {
      enum: ['active', 'closed'],
    },
  },
];

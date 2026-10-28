import { VALIDATION_LIMITS } from '../config/validationLimits.js';

export const machinerySchema = [
  {
    key: 'equipment',
    paperLabelSi: 'උපකරණය',
    labelEn: 'Equipment',
    type: 'text',
    required: false,
    rules: {
      minLength: VALIDATION_LIMITS.machinery.equipment.min,
      maxLength: VALIDATION_LIMITS.machinery.equipment.max,
      noHtml: true,
    },
  },
  {
    key: 'quantity',
    paperLabelSi: 'ප්‍රමාණය',
    labelEn: 'Quantity',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.machinery.quantity.min,
      max: VALIDATION_LIMITS.machinery.quantity.max,
      integer: true,
    },
  },
  {
    key: 'purchasedOn.year',
    paperLabelSi: 'මිලදී ගත් වසර',
    labelEn: 'Purchase Year',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.machinery.purchasedOn.year.min,
      maxCurrentYear: true,
      integer: true,
    },
  },
  {
    key: 'purchasedOn.month',
    paperLabelSi: 'මිලදී ගත් මාසය',
    labelEn: 'Purchase Month',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.machinery.purchasedOn.month.min,
      max: VALIDATION_LIMITS.machinery.purchasedOn.month.max,
      integer: true,
    },
  },
  {
    key: 'purchasedOn.day',
    paperLabelSi: 'මිලදී ගත් දිනය',
    labelEn: 'Purchase Day',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.machinery.purchasedOn.day.min,
      max: VALIDATION_LIMITS.machinery.purchasedOn.day.max,
      integer: true,
    },
  },
  {
    key: 'purchaseValue',
    paperLabelSi: 'මිලදී ගත් වටිනාකම',
    labelEn: 'Purchase Value',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.machinery.purchaseValue.min,
      max: VALIDATION_LIMITS.machinery.purchaseValue.max,
      integer: true,
      rupees: true,
    },
  },
  {
    key: 'annotationNote',
    paperLabelSi: 'සටහන',
    labelEn: 'Note',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.machinery.annotationNote.max,
      noHtml: true,
    },
  },
];

import { VALIDATION_LIMITS } from '../config/validationLimits.js';

export const saleSchema = [
  {
    key: 'round',
    paperLabelSi: 'මුරය',
    labelEn: 'Round',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.sale.round.min,
      integer: true,
    },
  },
  {
    key: 'saleDate',
    paperLabelSi: 'අස්වනු විකුණු දිනය',
    labelEn: 'Sale Date',
    type: 'date',
    required: false,
    rules: {
      notInFuture: true,
      crossField: 'firstHarvest',
    },
  },
  {
    key: 'quantitySold',
    paperLabelSi: 'විකුණු ප්‍රමාණය',
    labelEn: 'Quantity Sold',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.sale.quantitySold.min,
      max: VALIDATION_LIMITS.sale.quantitySold.max,
    },
  },
  {
    key: 'income',
    paperLabelSi: 'ආදායම රු',
    labelEn: 'Income',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.sale.income.min,
      max: VALIDATION_LIMITS.sale.income.max,
      integer: true,
      rupees: true,
    },
  },
  {
    key: 'soldTo',
    paperLabelSi: 'අස්වනු විකුණුවේ කාටද',
    labelEn: 'Sold To',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.sale.soldTo.max,
      noHtml: true,
    },
  },
];

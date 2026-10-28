import { VALIDATION_LIMITS } from '../config/validationLimits.js';

export const harvestSchema = [
  {
    key: 'round',
    paperLabelSi: 'මුරය',
    labelEn: 'Round',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.harvest.round.min,
      integer: true,
    },
  },
  {
    key: 'harvestDate',
    paperLabelSi: 'අස්වනු නෙලූ දිනය',
    labelEn: 'Harvest Date',
    type: 'date',
    required: false,
    rules: {
      notInFuture: true,
      crossField: 'cycle.startDate',
    },
  },
  {
    key: 'yield',
    paperLabelSi: 'අස්වැන්න',
    labelEn: 'Yield',
    type: 'number',
    required: false,
    rules: {
      min: VALIDATION_LIMITS.harvest.yield.min,
      max: VALIDATION_LIMITS.harvest.yield.max,
    },
  },
];

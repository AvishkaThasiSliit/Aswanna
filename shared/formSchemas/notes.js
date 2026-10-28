import { VALIDATION_LIMITS } from '../config/validationLimits.js';

export const notesSchema = [
  {
    key: 'pestsAndDiseases',
    paperLabelSi: 'රෝග හා පලිබෝධ',
    labelEn: 'Pests and Diseases',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.notes.pestsAndDiseases.max,
      noHtml: true,
    },
  },
  {
    key: 'otherCropLosses',
    paperLabelSi: 'වෙනත් බෝග හානි',
    labelEn: 'Other Crop Losses',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.notes.otherCropLosses.max,
      noHtml: true,
    },
  },
  {
    key: 'areaNotHarvested',
    paperLabelSi: 'අස්වැන්න නෙලා නොගත් බිම් ප්‍රමාණය',
    labelEn: 'Area Not Harvested',
    type: 'number',
    required: false,
    rules: {
      min: 0,
      max: VALIDATION_LIMITS.notes.areaNotHarvested.max,
    },
  },
  {
    key: 'other',
    paperLabelSi: 'වෙනත්',
    labelEn: 'Other',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.notes.other.max,
      noHtml: true,
    },
  },
];

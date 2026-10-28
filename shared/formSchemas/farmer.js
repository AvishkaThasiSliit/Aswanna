import { SRI_LANKA_DISTRICTS } from '../constants/districts.js';
import { VALIDATION_LIMITS } from '../config/validationLimits.js';

export const farmerSchema = [
  {
    key: 'name',
    paperLabelSi: 'නම',
    labelEn: 'Name',
    type: 'text',
    required: true,
    rules: {
      required: true,
      minLength: VALIDATION_LIMITS.farmer.name.min,
      maxLength: VALIDATION_LIMITS.farmer.name.max,
      noHtml: true,
    },
  },
  {
    key: 'dateOfBirth',
    paperLabelSi: 'උපන් දිනය',
    labelEn: 'Date of Birth',
    type: 'date',
    required: false,
    rules: {
      notInFuture: true,
      minYear: VALIDATION_LIMITS.farmer.dateOfBirth.minYear,
    },
  },
  {
    key: 'nic',
    paperLabelSi: 'ජා.හැ.අංකය',
    labelEn: 'NIC',
    type: 'text',
    required: false,
    rules: {
      pattern: 'nic',
      maxLength: VALIDATION_LIMITS.farmer.nic.max,
      crossField: 'dateOfBirth',
      noHtml: true,
    },
  },
  {
    key: 'phone',
    paperLabelSi: 'දුරකථන අංකය',
    labelEn: 'Phone',
    type: 'text',
    required: false,
    rules: {
      pattern: 'phone',
      maxLength: VALIDATION_LIMITS.farmer.phone.max,
      noHtml: true,
    },
  },
  {
    key: 'address',
    paperLabelSi: 'ලිපිනය',
    labelEn: 'Address',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.farmer.address.max,
      noHtml: true,
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
    key: 'divisionalSecretariat',
    paperLabelSi: 'ප්‍රා.ලේ කොට්ඨාශය',
    labelEn: 'Divisional Secretariat',
    type: 'text',
    required: false,
    rules: {
      maxLength: VALIDATION_LIMITS.farmer.divisionalSecretariat.max,
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
      maxLength: VALIDATION_LIMITS.farmer.gnDivision.max,
      noHtml: true,
    },
  },
];

/**
 * Validation limits, ranges, patterns, and plausibility caps.
 * NOTE: Any unit price ranges, daily caps, or crop yield bounds are placeholders
 * and marked CONFIRM WITH DoA. Do NOT remove these markers without official DoA sign-off.
 */

export const VALIDATION_LIMITS = {
  global: {
    maxStringLength: 5000,
    maxBodySize: '500kb',
    maxAddressLength: 250,
    maxNameLength: 100,
    maxNoteLength: 1000,
  },

  farmer: {
    name: { min: 2, max: 100 },
    nic: {
      oldPattern: /^[0-9]{9}[vVxX]$/,
      newPattern: /^[0-9]{12}$/,
      max: 12,
    },
    phone: {
      pattern: /^0[0-9]{9}$/,
      max: 15,
    },
    address: { max: 250 },
    divisionalSecretariat: { max: 100 },
    gnDivision: { max: 100 },
    dateOfBirth: {
      minYear: 1900,
      minAgeYears: 10, /* CONFIRM WITH DoA */
    },
  },

  machinery: {
    equipment: { min: 2, max: 100 },
    quantity: { min: 1, max: 100, integer: true }, /* CONFIRM WITH DoA */
    purchasedOn: {
      year: { min: 1950, maxCurrentYear: true },
      month: { min: 1, max: 12 },
      day: { min: 1, max: 31 },
    },
    purchaseValue: { min: 0, max: 100000000, integer: true }, /* CONFIRM WITH DoA */
    annotationNote: { max: 500 },
  },

  land: {
    landCode: {
      pattern: /^[A-Za-z0-9_\-\.\/]+$/,
      min: 1,
      max: 30,
    },
    extentValue: { min: 0.01, max: 10000 }, /* CONFIRM WITH DoA */
    agrarianServiceCentre: { max: 100 },
    gnDivision: { max: 100 },
    irrigationSource: { max: 100 },
  },

  cycle: {
    crop: { min: 2, max: 50 },
    seasonMonths: {
      // Yala: April - August; Maha: September - March /* CONFIRM WITH DoA */
      Yala: [4, 5, 6, 7, 8],
      Maha: [9, 10, 11, 12, 1, 2, 3],
    },
    maxDurationDays: 365, /* CONFIRM WITH DoA */
  },

  expense: {
    maxDailyTotalCostWarning: 500000, /* CONFIRM WITH DoA */
    activityCode: { max: 50 },
    inputs: {
      quantity: { min: 0, max: 100000 }, /* CONFIRM WITH DoA */
      unit: { max: 30 },
      inputType: { max: 100 },
      cost: { min: 0, max: 10000000, integer: true }, /* CONFIRM WITH DoA */
      unitPricePlausibility: { min: 1, max: 50000 }, /* CONFIRM WITH DoA */
    },
    machinery: {
      method: { max: 100 },
      unitPrice: { min: 0, max: 1000000, integer: true }, /* CONFIRM WITH DoA */
      quantity: { min: 0, max: 1000 }, /* CONFIRM WITH DoA */
      cost: { min: 0, max: 5000000, integer: true }, /* CONFIRM WITH DoA */
      unitPricePlausibility: { min: 500, max: 150000 }, /* CONFIRM WITH DoA */
    },
    labour: {
      familyLabour: { min: 0, max: 100, step: 0.5 }, /* CONFIRM WITH DoA */
      hiredLabour: { min: 0, max: 500, step: 0.5 }, /* CONFIRM WITH DoA */
      dailyWage: { min: 0, max: 50000, integer: true }, /* CONFIRM WITH DoA */
      cost: { min: 0, max: 5000000, integer: true }, /* CONFIRM WITH DoA */
      wagePlausibility: { min: 1000, max: 15000 }, /* CONFIRM WITH DoA */
    },
    other: {
      description: { max: 250 },
      amount: { min: 0, max: 5000000, integer: true }, /* CONFIRM WITH DoA */
    },
  },

  harvest: {
    round: { min: 1, integer: true },
    yield: { min: 0.01, max: 1000000 }, /* CONFIRM WITH DoA */
  },

  sale: {
    round: { min: 1, integer: true },
    quantitySold: { min: 0.01, max: 1000000 }, /* CONFIRM WITH DoA */
    income: { min: 0, max: 100000000, integer: true }, /* CONFIRM WITH DoA */
    soldTo: { max: 150 },
    pricePerKgPlausibility: { min: 10, max: 5000 }, /* CONFIRM WITH DoA */
  },

  notes: {
    pestsAndDiseases: { max: 1000 },
    otherCropLosses: { max: 1000 },
    areaNotHarvested: { max: 100 },
    other: { max: 1000 },
  },
};

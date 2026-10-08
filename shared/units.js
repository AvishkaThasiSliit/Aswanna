export const convertToAcres = (value, unit) => {
  if (typeof value !== 'number') return 0;
  switch (unit) {
    case 'hectare':
      return value * 2.47105;
    case 'acre':
      return value;
    case 'rood':
      return value / 4;
    case 'perch':
      return value / 160;
    default:
      return 0;
  }
};

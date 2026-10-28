/**
 * Agronomic & Irrigation Command Aliases for Sri Lanka District Polygons
 * Maps DOA non-district values (Mahaweli Systems, Udawalawa, Sub-district zones)
 * onto the corresponding 25 administrative district polygons.
 */

export const DISTRICT_ALIASES = {
  'Mahaweli System H': {
    targetPolygons: ['Anuradhapura'],
    label: 'Mahaweli System H',
    description: 'Irrigation command in Anuradhapura / Kala Wewa basin'
  },
  'Mahaweli System B': {
    targetPolygons: ['Polonnaruwa', 'Batticaloa'],
    label: 'Mahaweli System B',
    description: 'Irrigation command in Polonnaruwa / Batticaloa border'
  },
  'Mahaweli System C': {
    targetPolygons: ['Badulla', 'Polonnaruwa', 'Ampara'],
    label: 'Mahaweli System C',
    description: 'Mahaweli Right Bank command spanning Badulla and Dehiattakandiya'
  },
  'Ampara (East)': {
    targetPolygons: ['Ampara'],
    label: 'Ampara (East)',
    description: 'Eastern coastal agricultural tract of Ampara'
  },
  'Ampara (West)': {
    targetPolygons: ['Ampara'],
    label: 'Ampara (West)',
    description: 'Western inland agrarian division of Ampara (Uhana/Damana)'
  },
  'Udawalawa': {
    targetPolygons: ['Ratnapura', 'Monaragala', 'Hambantota'],
    label: 'Udawalawa Irrigation Command',
    description: 'Walawe basin spanning Ratnapura, Monaragala and Hambantota'
  },
  'Whole Island': {
    targetPolygons: [
      'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
      'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
      'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
      'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
      'Monaragala', 'Ratnapura', 'Kegalle'
    ],
    label: 'Whole Island',
    description: 'All 25 administrative agricultural districts in Sri Lanka'
  }
};

/**
 * Resolves an agrarian district or special zone to the list of polygon district names.
 */
export function resolveDistrictToPolygons(name, allDistricts = []) {
  if (!name) return [];
  if (DISTRICT_ALIASES[name]) {
    return DISTRICT_ALIASES[name].targetPolygons;
  }
  return [name];
}

/**
 * Expands a list of crop-valid districts (which may include non-district values)
 * into a Set of polygon district names that should be enabled.
 */
export function resolveValidDistrictsToPolygons(validList = [], allDistricts = []) {
  const result = new Set();
  for (const item of validList) {
    if (DISTRICT_ALIASES[item]) {
      DISTRICT_ALIASES[item].targetPolygons.forEach(p => result.add(p));
    } else {
      result.add(item);
    }
  }
  return result;
}

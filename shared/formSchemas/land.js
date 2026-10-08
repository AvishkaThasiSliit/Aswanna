export const landSchema = [
  { key: 'landType', paperLabelSi: 'ගොඩ / මඩ', labelEn: 'Land Type', type: 'select', required: false, options: ['upland', 'lowland'] },
  { key: 'district', paperLabelSi: 'දිස්ත්‍රික්කය', labelEn: 'District', type: 'text', required: false },
  { key: 'agrarianServiceCentre', paperLabelSi: 'ගොවිජන සේවා මධ්‍යස්ථානය', labelEn: 'Agrarian Service Centre', type: 'text', required: false },
  { key: 'gnDivision', paperLabelSi: 'ග්‍රා.නි.වසම', labelEn: 'GN Division', type: 'text', required: false },
  { key: 'tenure', paperLabelSi: 'අයිතිය', labelEn: 'Tenure', type: 'select', required: false, options: ['freehold', 'ande', 'bhaddha', 'kuli', 'state', 'private'] },
  { key: 'extentUnit', paperLabelSi: 'බිම් ප්‍රමාණය (ඒකකය)', labelEn: 'Extent Unit', type: 'select', required: false, options: ['hectare', 'acre', 'rood', 'perch'] },
  { key: 'extentValue', paperLabelSi: 'ඉඩම් ප්රමාණය', labelEn: 'Extent', type: 'number', required: false },
  { key: 'extentAcres', paperLabelSi: 'අක්කර', labelEn: 'Extent in Acres', type: 'number', computed: true },
  { key: 'waterSourceType', paperLabelSi: 'වාරි / වර්ෂා පෝෂිත', labelEn: 'Water Source Type', type: 'select', required: false, options: ['irrigated', 'rainfed'] },
  { key: 'irrigationSource', paperLabelSi: 'වාරි ජල මූලාශ්‍රය', labelEn: 'Irrigation Source', type: 'text', required: false },
  { key: 'landCode', paperLabelSi: 'ඉඩමේ කේතය / පී.එල්.ආර්. අංකය', labelEn: 'Land Code', type: 'text', required: true }
];

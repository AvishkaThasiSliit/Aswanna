export const saleSchema = [
  { key: 'round', paperLabelSi: 'මුරය', labelEn: 'Round', type: 'number', required: true },
  { key: 'saleDate', paperLabelSi: 'අස්වනු විකුණු දිනය', labelEn: 'Sale Date', type: 'date', required: false },
  { key: 'quantitySold', paperLabelSi: 'විකුණු ප්‍රමාණය', labelEn: 'Quantity Sold', type: 'number', required: false },
  { key: 'income', paperLabelSi: 'ආදායම රු', labelEn: 'Income', type: 'number', required: false },
  { key: 'soldTo', paperLabelSi: 'අස්වනු විකුණුවේ කාටද', labelEn: 'Sold To', type: 'text', required: false }
];

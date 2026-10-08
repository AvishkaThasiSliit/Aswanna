export const machinerySchema = [
  { key: 'equipment', paperLabelSi: 'උපකරණය', labelEn: 'Equipment', type: 'text', required: false },
  { key: 'quantity', paperLabelSi: 'ප්‍රමාණය', labelEn: 'Quantity', type: 'number', required: false },
  { key: 'purchasedOn.year', paperLabelSi: 'මිලදී ගත් වසර', labelEn: 'Purchase Year', type: 'number', required: false },
  { key: 'purchasedOn.month', paperLabelSi: 'මිලදී ගත් මාසය', labelEn: 'Purchase Month', type: 'number', required: false },
  { key: 'purchasedOn.day', paperLabelSi: 'මිලදී ගත් දිනය', labelEn: 'Purchase Day', type: 'number', required: false },
  { key: 'purchaseValue', paperLabelSi: 'මිලදී ගත් වටිනාකම', labelEn: 'Purchase Value', type: 'number', required: false }
];

export const farmerSchema = [
  { key: 'name', paperLabelSi: 'නම', labelEn: 'Name', type: 'text', required: true },
  { key: 'dateOfBirth', paperLabelSi: 'උපන් දිනය', labelEn: 'Date of Birth', type: 'date', required: false },
  { key: 'nic', paperLabelSi: 'ජා.හැ.අංකය', labelEn: 'NIC', type: 'text', required: false },
  { key: 'phone', paperLabelSi: 'දුරකථන අංකය', labelEn: 'Phone', type: 'text', required: false },
  { key: 'address', paperLabelSi: 'ලිපිනය', labelEn: 'Address', type: 'text', required: false },
  { key: 'district', paperLabelSi: 'දිස්ත්‍රික්කය', labelEn: 'District', type: 'text', required: false },
  { key: 'divisionalSecretariat', paperLabelSi: 'ප්‍රා.ලේ කොට්ඨාශය', labelEn: 'Divisional Secretariat', type: 'text', required: false },
  { key: 'gnDivision', paperLabelSi: 'ග්‍රා.නි.වසම', labelEn: 'GN Division', type: 'text', required: false }
];

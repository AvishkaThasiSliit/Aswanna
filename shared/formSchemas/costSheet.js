import { CATEGORY_TAGS } from '../categoryMap.js';

export const costSheetGroups = {
  inputs:   { paperLabelSi: 'යෙදවුම් වියදම',        labelEn: 'Inputs',   repeatable: true  },
  machinery:{ paperLabelSi: 'යන්ත්‍ර සූත්‍ර වියදම', labelEn: 'Machinery', repeatable: false },
  labour:   { paperLabelSi: 'ශ්‍රම වියදම',           labelEn: 'Labour',   repeatable: false },
  other:    { paperLabelSi: 'වෙනත් වියදම/තොරතුරු',   labelEn: 'Other',    repeatable: false }
};

export const costSheetSchema = [
  { key: 'entryDate',    paperLabelSi: 'දිනය',               labelEn: 'Date',          type: 'date',   required: true },
  { key: 'dayStatus',    labelSi: 'දින තත්ත්වය',             labelEn: 'Day Status',    type: 'select', required: true, default: 'worked', paperField: false, options: ['worked', 'no_work'] },
  { key: 'activityCode', paperLabelSi: 'ක්රියාකාරකම (code)',   labelEn: 'Activity Code', type: 'select', source: 'ActivityCode', requiredUnless: { dayStatus: 'no_work' } },

  { key: 'inputs.categoryTag', labelSi: 'යෙදවුම් වර්ගය',     labelEn: 'Category Tag', type: 'select', required: true,  paperField: false, options: CATEGORY_TAGS, group: 'inputs' },
  { key: 'inputs.inputType',   paperLabelSi: 'වර්ගය',        labelEn: 'Input Type',   type: 'text',   required: false, group: 'inputs' },
  { key: 'inputs.quantity',    paperLabelSi: 'ප්‍රමාණය',     labelEn: 'Quantity',     type: 'number', required: false, group: 'inputs',   validation: { min: 0 } },
  { key: 'inputs.unit',        labelSi: 'ඒකකය',              labelEn: 'Unit',         type: 'text',   required: false, paperField: false,  group: 'inputs' },
  { key: 'inputs.cost',        paperLabelSi: 'වියදම',        labelEn: 'Cost',         type: 'number', required: false, group: 'inputs',   validation: { min: 0, integer: true } },

  { key: 'machinery.method',    paperLabelSi: 'ක්‍රමය',      labelEn: 'Method',      type: 'text',   required: false, group: 'machinery' },
  { key: 'machinery.unitPrice', paperLabelSi: 'ඒකක මිල',     labelEn: 'Unit Price',  type: 'number', required: false, group: 'machinery', validation: { min: 0, integer: true } },
  // documented deviation from the paper
  { key: 'machinery.quantity',  labelSi: 'ප්‍රමාණය',         labelEn: 'Quantity',    type: 'number', required: false, paperField: false,  group: 'machinery', validation: { min: 0 } },
  { key: 'machinery.cost',      paperLabelSi: 'වියදම',       labelEn: 'Cost',        type: 'number', required: false, group: 'machinery', validation: { min: 0, integer: true } },

  { key: 'labour.familyLabour', paperLabelSi: 'පවුලේ ශ්‍රමය', labelEn: 'Family Labour', type: 'number', required: false, group: 'labour', validation: { min: 0 } },
  { key: 'labour.hiredLabour',  paperLabelSi: 'කුලී ශ්‍රමය',  labelEn: 'Hired Labour',  type: 'number', required: false, group: 'labour', validation: { min: 0 } },
  { key: 'labour.dailyWage',    paperLabelSi: 'දිනක වැටුප',   labelEn: 'Daily Wage',    type: 'number', required: false, group: 'labour', validation: { min: 0, integer: true } },
  { key: 'labour.cost',         paperLabelSi: 'වියදම',        labelEn: 'Cost',          type: 'number', required: false, computed: true, group: 'labour', validation: { min: 0, integer: true } },

  { key: 'other.description', paperLabelSi: 'වෙනත් වියදම/තොරතුරු', labelEn: 'Description', type: 'text',   required: false, group: 'other' },
  { key: 'other.amount',      paperLabelSi: 'වියදම',                 labelEn: 'Amount',      type: 'number', required: false, group: 'other', validation: { min: 0, integer: true } },

  { key: 'subtotals.inputs',   labelSi: 'යෙදවුම් උප එකතුව',      labelEn: 'Inputs Subtotal',   type: 'number', computed: true, paperField: false, validation: { min: 0, integer: true } },
  { key: 'subtotals.machinery',labelSi: 'යන්ත්‍ර සූත්‍ර උප එකතුව', labelEn: 'Machinery Subtotal',type: 'number', computed: true, paperField: false, validation: { min: 0, integer: true } },
  { key: 'subtotals.labour',   labelSi: 'ශ්‍රම උප එකතුව',         labelEn: 'Labour Subtotal',   type: 'number', computed: true, paperField: false, validation: { min: 0, integer: true } },
  { key: 'subtotals.other',    labelSi: 'වෙනත් උප එකතුව',        labelEn: 'Other Subtotal',    type: 'number', computed: true, paperField: false, validation: { min: 0, integer: true } },
  { key: 'totalAmount', paperLabelSi: 'දවසේ මුළු වියදම රු.', labelEn: 'Total Amount', type: 'number', computed: true, validation: { min: 0, integer: true } }
];

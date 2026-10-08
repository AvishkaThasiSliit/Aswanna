import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coverageData = [
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "නම", "modelPath": "FarmerProfile.name", "formSchemaKey": "farmer.name", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "උපන් දිනය", "modelPath": "FarmerProfile.dateOfBirth", "formSchemaKey": "farmer.dateOfBirth", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "ජා.හැ.අංකය", "modelPath": "FarmerProfile.nic", "formSchemaKey": "farmer.nic", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "දුරකථන අංකය", "modelPath": "FarmerProfile.phone", "formSchemaKey": "farmer.phone", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "ලිපිනය", "modelPath": "FarmerProfile.address", "formSchemaKey": "farmer.address", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "දිස්ත්‍රික්කය", "modelPath": "FarmerProfile.district", "formSchemaKey": "farmer.district", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "ප්‍රා.ලේ කොට්ඨාශය", "modelPath": "FarmerProfile.divisionalSecretariat", "formSchemaKey": "farmer.divisionalSecretariat", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ගොවියාගේ තොරතුරු", "paperLabelSi": "ග්‍රා.නි.වසම", "modelPath": "FarmerProfile.gnDivision", "formSchemaKey": "farmer.gnDivision", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු", "paperLabelSi": "උපකරණය", "modelPath": "MachineryOwned.equipment", "formSchemaKey": "machinery.equipment", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු", "paperLabelSi": "ප්‍රමාණය", "modelPath": "MachineryOwned.quantity", "formSchemaKey": "machinery.quantity", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු", "paperLabelSi": "මිලදී ගත් වසර", "modelPath": "MachineryOwned.purchasedOn.year", "formSchemaKey": "machinery.purchasedOn.year", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු", "paperLabelSi": "මිලදී ගත් මාසය", "modelPath": "MachineryOwned.purchasedOn.month", "formSchemaKey": "machinery.purchasedOn.month", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු", "paperLabelSi": "මිලදී ගත් දිනය", "modelPath": "MachineryOwned.purchasedOn.day", "formSchemaKey": "machinery.purchasedOn.day", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු", "paperLabelSi": "මිලදී ගත් වටිනාකම", "modelPath": "MachineryOwned.purchaseValue", "formSchemaKey": "machinery.purchaseValue", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "ගොඩ / මඩ", "modelPath": "Land.landType", "formSchemaKey": "land.landType", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "දිස්ත්‍රික්කය", "modelPath": "Land.district", "formSchemaKey": "land.district", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "ගොවිජන සේවා මධ්‍යස්ථානය", "modelPath": "Land.agrarianServiceCentre", "formSchemaKey": "land.agrarianServiceCentre", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "ග්‍රා.නි.වසම", "modelPath": "Land.gnDivision", "formSchemaKey": "land.gnDivision", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "භුක්තිය", "modelPath": "Land.tenure", "formSchemaKey": "land.tenure", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "බිම් ප්‍රමාණය (ඒකකය)", "modelPath": "Land.extentUnit", "formSchemaKey": "land.extentUnit", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "බිම් ප්‍රමාණය", "modelPath": "Land.extentValue", "formSchemaKey": "land.extentValue", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "අක්කර", "modelPath": "Land.extentAcres", "formSchemaKey": "land.extentAcres", "entryStyle": "computed", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "වාරි / වර්ෂා පෝෂිත", "modelPath": "Land.waterSourceType", "formSchemaKey": "land.waterSourceType", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "වාරි ජල මූලාශ්‍රය", "modelPath": "Land.irrigationSource", "formSchemaKey": "land.irrigationSource", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "වගා ඉඩම් විස්තර", "paperLabelSi": "ඉඩමේ කේතය / PLR අංකය", "modelPath": "Land.landCode", "formSchemaKey": "land.landCode", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "දිනය", "modelPath": "Expense.entryDate", "formSchemaKey": "costSheet.entryDate", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "ක්‍රියාකාරකම", "modelPath": "Expense.activityCode", "formSchemaKey": "costSheet.activityCode", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "වර්ගය", "modelPath": "Expense.inputs.inputType", "formSchemaKey": "costSheet.inputs.inputType", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "ප්‍රමාණය", "modelPath": "Expense.inputs.quantity", "formSchemaKey": "costSheet.inputs.quantity", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "වියදම", "modelPath": "Expense.inputs.cost", "formSchemaKey": "costSheet.inputs.cost", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "ක්‍රමය", "modelPath": "Expense.machinery.method", "formSchemaKey": "costSheet.machinery.method", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "ඒකක මිල", "modelPath": "Expense.machinery.unitPrice", "formSchemaKey": "costSheet.machinery.unitPrice", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "ප්‍රමාණය", "modelPath": "Expense.machinery.quantity", "formSchemaKey": "costSheet.machinery.quantity", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "වියදම", "modelPath": "Expense.machinery.cost", "formSchemaKey": "costSheet.machinery.cost", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "පවුලේ ශ්‍රමය", "modelPath": "Expense.labour.familyLabour", "formSchemaKey": "costSheet.labour.familyLabour", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "කුලී ශ්‍රමය", "modelPath": "Expense.labour.hiredLabour", "formSchemaKey": "costSheet.labour.hiredLabour", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "දිනක වැටුප", "modelPath": "Expense.labour.dailyWage", "formSchemaKey": "costSheet.labour.dailyWage", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "වියදම", "modelPath": "Expense.labour.cost", "formSchemaKey": "costSheet.labour.cost", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "විස්තරය", "modelPath": "Expense.other.description", "formSchemaKey": "costSheet.other.description", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "වියදම", "modelPath": "Expense.other.amount", "formSchemaKey": "costSheet.other.amount", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "Cost Sheet", "paperLabelSi": "දවසේ මුළු වියදම රු.", "modelPath": "Expense.totalAmount", "formSchemaKey": "costSheet.totalAmount", "entryStyle": "computed", "test": "Covered" },
  { "paperSection": "අස්වැන්න", "paperLabelSi": "මුරය", "modelPath": "Harvest.round", "formSchemaKey": "harvest.round", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "අස්වැන්න", "paperLabelSi": "අස්වනු නෙලූ දිනය", "modelPath": "Harvest.harvestDate", "formSchemaKey": "harvest.harvestDate", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "අස්වැන්න", "paperLabelSi": "අස්වැන්න", "modelPath": "Harvest.yield", "formSchemaKey": "harvest.yield", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ආදායම", "paperLabelSi": "මුරය", "modelPath": "Sale.round", "formSchemaKey": "sale.round", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ආදායම", "paperLabelSi": "අස්වනු විකුණු දිනය", "modelPath": "Sale.saleDate", "formSchemaKey": "sale.saleDate", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ආදායම", "paperLabelSi": "විකුණු ප්‍රමාණය", "modelPath": "Sale.quantitySold", "formSchemaKey": "sale.quantitySold", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ආදායම", "paperLabelSi": "ආදායම රු", "modelPath": "Sale.income", "formSchemaKey": "sale.income", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "ආදායම", "paperLabelSi": "අස්වනු විකුණුවේ කාටද", "modelPath": "Sale.soldTo", "formSchemaKey": "sale.soldTo", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "විශේෂ කාරණා", "paperLabelSi": "රෝග හා පලිබෝධ", "modelPath": "CycleNotes.pestsAndDiseases", "formSchemaKey": "notes.pestsAndDiseases", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "විශේෂ කාරණා", "paperLabelSi": "වෙනත් බෝග හානි", "modelPath": "CycleNotes.otherCropLosses", "formSchemaKey": "notes.otherCropLosses", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "විශේෂ කාරණා", "paperLabelSi": "අස්වැන්න නෙලා නොගත් බිම් ප්‍රමාණය", "modelPath": "CycleNotes.areaNotHarvested", "formSchemaKey": "notes.areaNotHarvested", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "විශේෂ කාරණා", "paperLabelSi": "වෙනත්", "modelPath": "CycleNotes.other", "formSchemaKey": "notes.other", "entryStyle": "entered", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "මුළු වියදම", "modelPath": "CycleSummary.totalCost", "formSchemaKey": "summary.totalCost", "entryStyle": "derived", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "මුළු ආදායම", "modelPath": "CycleSummary.totalIncome", "formSchemaKey": "summary.totalIncome", "entryStyle": "derived", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "ලාභය", "modelPath": "CycleSummary.profit", "formSchemaKey": "summary.profit", "entryStyle": "derived", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Total Harvest", "modelPath": "CycleSummary.totalHarvest", "formSchemaKey": "summary.totalHarvest", "entryStyle": "derived", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Cost per Kg", "modelPath": "CycleSummary.costPerKg", "formSchemaKey": "summary.costPerKg", "entryStyle": "derived", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Activity Calendar", "modelPath": "ActivityCalendar.calendar", "formSchemaKey": "calendar.calendar", "entryStyle": "derived", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Subtotal Inputs", "modelPath": "Expense.subtotals.inputs", "formSchemaKey": "costSheet.subtotals.inputs", "entryStyle": "computed", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Subtotal Machinery", "modelPath": "Expense.subtotals.machinery", "formSchemaKey": "costSheet.subtotals.machinery", "entryStyle": "computed", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Subtotal Labour", "modelPath": "Expense.subtotals.labour", "formSchemaKey": "costSheet.subtotals.labour", "entryStyle": "computed", "test": "Covered" },
  { "paperSection": "DERIVED", "paperLabelSi": "Subtotal Other", "modelPath": "Expense.subtotals.other", "formSchemaKey": "costSheet.subtotals.other", "entryStyle": "computed", "test": "Covered" }
];

fs.mkdirSync(path.join(__dirname, '../coverage'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../coverage/paper-coverage.json'), JSON.stringify(coverageData, null, 2));

console.log('Coverage JSON generated successfully.');

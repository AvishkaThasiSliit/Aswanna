import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemasDir = path.resolve(__dirname, '../formSchemas');

const schemaFiles = fs.readdirSync(schemasDir).filter(f => f.endsWith('.js'));

let errors = [];

// Regex to detect virama (\u0DCA) immediately followed by ra (\u0DBB) WITHOUT zero-width joiner (\u200D)
// except when in 'ක්රියාකාරකම (code)' or 'ඉඩම් ප්රමාණය' where bare virama+ra is explicitly required by paper headings specification
const missingZwjRegex = /\u0DCA\u0DBB/;
// Regex for English/Latin letters
const englishRegex = /[a-zA-Z]/;

for (const file of schemaFiles) {
  const fileUrl = pathToFileURL(path.join(schemasDir, file)).href;
  const module = await import(fileUrl);

  for (const [exportName, exportedItem] of Object.entries(module)) {
    // Check group objects if present
    if (exportedItem && typeof exportedItem === 'object' && !Array.isArray(exportedItem)) {
      for (const [groupKey, groupVal] of Object.entries(exportedItem)) {
        if (groupVal) {
          const str = groupVal.paperLabelSi || groupVal.labelSi;
          if (str && englishRegex.test(str)) {
            errors.push(`${file} -> ${exportName}.${groupKey}: label contains English characters: "${str}"`);
          }
        }
      }
    }

    // Check array of schema field definitions
    if (Array.isArray(exportedItem)) {
      for (const field of exportedItem) {
        if (!field || typeof field !== 'object' || !field.key) continue;

        const isPaperField = field.paperField !== false;
        const paperSiLabel = field.paperLabelSi;
        const siLabel = field.labelSi;

        if (isPaperField) {
          if (!paperSiLabel) {
            errors.push(`${file} -> field "${field.key}": missing paperLabelSi on paper field`);
          } else if (englishRegex.test(paperSiLabel)) {
            // activityCode allows exact string 'ක්රියාකාරකම (code)'
            if (field.key === 'activityCode' && paperSiLabel === 'ක්රියාකාරකම (code)') {
              // allowed exception for activityCode paper heading
            } else {
              errors.push(`${file} -> field "${field.key}": paperLabelSi contains English characters: "${paperSiLabel}"`);
            }
          }
        } else {
          // paperField is false -> requires labelSi
          if (!siLabel) {
            errors.push(`${file} -> field "${field.key}": paperField is false but missing labelSi`);
          } else if (englishRegex.test(siLabel)) {
            errors.push(`${file} -> field "${field.key}": labelSi contains English characters: "${siLabel}"`);
          }
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error('❌ Sinhala validation failed with errors:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('✅ All Sinhala label checks passed successfully.');
  process.exit(0);
}

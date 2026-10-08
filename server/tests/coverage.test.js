import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { User } from '../src/models/User.js';
import { FarmerProfile } from '../src/models/FarmerProfile.js';
import { MachineryOwned } from '../src/models/MachineryOwned.js';
import { Land } from '../src/models/Land.js';
import { Cycle } from '../src/models/Cycle.js';
import { ActivityCode } from '../src/models/ActivityCode.js';
import { Expense } from '../src/models/Expense.js';
import { Harvest } from '../src/models/Harvest.js';
import { Sale } from '../src/models/Sale.js';
import { CycleNotes } from '../src/models/CycleNotes.js';

import { farmerSchema } from '../../shared/formSchemas/farmer.js';
import { landSchema } from '../../shared/formSchemas/land.js';
import { machinerySchema } from '../../shared/formSchemas/machinery.js';
import { costSheetSchema } from '../../shared/formSchemas/costSheet.js';
import { harvestSchema } from '../../shared/formSchemas/harvest.js';
import { saleSchema } from '../../shared/formSchemas/sale.js';
import { notesSchema } from '../../shared/formSchemas/notes.js';
import { summarySchema } from '../../shared/formSchemas/summary.js';
import { calendarSchema } from '../../shared/formSchemas/calendar.js';
import { CATEGORY_TAGS } from '../../shared/categoryMap.js';

const models = {
  FarmerProfile,
  MachineryOwned,
  Land,
  Expense,
  Harvest,
  Sale,
  CycleNotes
};

const schemas = {
  farmer: farmerSchema,
  land: landSchema,
  machinery: machinerySchema,
  costSheet: costSheetSchema,
  harvest: harvestSchema,
  sale: saleSchema,
  notes: notesSchema,
  summary: summarySchema,
  calendar: calendarSchema
};

const requiredPaperSections = [
  'FarmerProfile',
  'MachineryOwned',
  'Land',
  'Expense',
  'Harvest',
  'Sale',
  'CycleNotes',
  'CycleSummary',
  'ActivityCalendar'
];

const requiredSchemaNames = [
  'farmer',
  'machinery',
  'land',
  'costSheet',
  'harvest',
  'sale',
  'notes',
  'summary',
  'calendar'
];

const allowedExtras = {
  'costSheet.dayStatus': 'App tracking field for worked/no_work status',
  'costSheet.inputs.categoryTag': 'App categorization helper for expense input items',
  'costSheet.inputs.unit': 'Unit of measurement for input items',
  'costSheet.machinery.quantity': 'Documented deviation from paper for machinery quantity',
  'costSheet.subtotals.inputs': 'Computed subtotal for inputs category',
  'costSheet.subtotals.machinery': 'Computed subtotal for machinery category',
  'costSheet.subtotals.labour': 'Computed subtotal for labour category',
  'costSheet.subtotals.other': 'Computed subtotal for other category',
};

function hasMongoosePath(model, relPath) {
  if (!model || !model.schema) return false;
  if (model.schema.path(relPath)) return true;
  const parts = relPath.split('.');
  let currentSchema = model.schema;
  for (let i = 0; i < parts.length; i++) {
    const p = parts.slice(0, i + 1).join('.');
    const directPath = currentSchema.path(p);
    if (directPath) return true;
    const leaf = parts[i];
    const leafPath = currentSchema.path(leaf);
    if (leafPath) {
      if (i === parts.length - 1) return true;
      if (leafPath.schema) {
        currentSchema = leafPath.schema;
      }
    }
  }
  return false;
}

describe('Coverage Matrix', () => {
  const coverageDataPath = path.resolve(__dirname, '../../shared/coverage/paper-coverage.json');
  const coverageData = JSON.parse(fs.readFileSync(coverageDataPath, 'utf-8'));

  test('(d) all required paper sections and schemas are present', () => {
    const sectionsInMatrix = new Set(coverageData.map(c => c.paperSection));
    requiredPaperSections.forEach(sec => {
      expect(sectionsInMatrix.has(sec)).toBe(true);
    });

    requiredSchemaNames.forEach(sch => {
      expect(schemas[sch]).toBeDefined();
    });
  });

  test('(a) & (b) matrix entries point to valid modelPaths and formSchemaKeys', () => {
    coverageData.forEach(entry => {
      if (entry.entryStyle !== 'derived' && !['CycleSummary', 'ActivityCalendar'].includes(entry.paperSection)) {
        const model = models[entry.paperSection];
        expect(model).toBeDefined();
        const modelPathParts = entry.modelPath.split('.');
        const relPath = modelPathParts.slice(1).join('.');
        expect(hasMongoosePath(model, relPath)).toBe(true);
      }

      const parts = entry.formSchemaKey.split('.');
      const schemaName = parts[0];
      const key = parts.slice(1).join('.');
      
      const schemaDef = schemas[schemaName];
      expect(schemaDef).toBeDefined();
      
      const fieldDef = schemaDef.find(f => f.key === key);
      expect(fieldDef).toBeDefined();
    });
  });

  test('(c) every form-schema field has a matrix row or is in allowedExtras', () => {
    Object.keys(schemas).forEach(schemaName => {
      schemas[schemaName].forEach(field => {
        const fullKey = `${schemaName}.${field.key}`;
        const match = coverageData.find(c => c.formSchemaKey === fullKey);
        if (!match) {
          const extraReason = allowedExtras[fullKey];
          expect(extraReason).toBeDefined();
          expect(typeof extraReason).toBe('string');
          expect(extraReason.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });

  test('every paper field in form schemas has a valid paperLabelSi string', () => {
    Object.keys(schemas).forEach(schemaName => {
      schemas[schemaName].forEach(field => {
        if (field.paperField !== false) {
          expect(field.paperLabelSi).toBeDefined();
          expect(typeof field.paperLabelSi).toBe('string');
          expect(field.paperLabelSi.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });

  test('categoryTag list matches categoryMap.js canonical tags', () => {
    expect(CATEGORY_TAGS).toEqual([
      'seed',
      'fertilizer',
      'agrochemical',
      'labour',
      'machinery',
      'fuel',
      'irrigation',
      'other'
    ]);
    const categoryTagField = costSheetSchema.find(f => f.key === 'inputs.categoryTag');
    expect(categoryTagField).toBeDefined();
    expect(categoryTagField.options).toEqual(CATEGORY_TAGS);
  });
});

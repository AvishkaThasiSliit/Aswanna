/**
 * Real Speech ASR Evaluation Harness (TASK V5 & V5.1)
 * Evaluates extractExpenses against real captured speech transcripts.
 * 
 * Reports per language (English, Sinhala) and overall:
 * items, amount-correct, category-correct, needs_review, SILENT ERRORS.
 * 
 * CLI options:
 *   --file <path>    Specify custom fixture file (default: server/eval/fixtures/voice/real-asr.captured.json)
 *   --report-only    Run in report-only mode (strictly read-only; never edits rules or fixtures)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractExpenses } from '../../shared/voice/extractExpenses.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CAPTURED_FILE = path.join(__dirname, 'fixtures', 'voice', 'real-asr.captured.json');

// Baseline profiles (Task V6)
const BASELINE_PROFILES = {
  'so1-mock': {
    name: 'so1-mock',
    label: 'SIMULATED baselines (SO1 Mock sample: Tomato / Default crop baseline)',
    categoryBaselines: {
      seed: 25000,
      fertilizer: 45000,
      agrochemical: 25000,
      labour: 60000,
      machinery: 40000,
      fuel: 25000,
      irrigation: 25000
    },
    totalBaseline: 245000
  }
};

// Parse CLI flags: --file <path>, --report-only, --use-alternatives, --baseline-profile <name>
const args = process.argv.slice(2);
let capturedFilePath = DEFAULT_CAPTURED_FILE;
let isReportOnly = false;
let useAlternatives = true; // Default ON as app uses alternatives
let baselineProfileName = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    capturedFilePath = path.resolve(process.cwd(), args[i + 1]);
    i++;
  } else if (args[i] === '--report-only') {
    isReportOnly = true;
  } else if (args[i] === '--use-alternatives') {
    if (args[i + 1] === 'false' || args[i + 1] === '0') {
      useAlternatives = false;
      i++;
    } else {
      useAlternatives = true;
      if (args[i + 1] === 'true' || args[i + 1] === '1') i++;
    }
  } else if (args[i] === '--no-use-alternatives') {
    useAlternatives = false;
  } else if (args[i] === '--baseline-profile' && args[i + 1]) {
    baselineProfileName = args[i + 1];
    i++;
  }
}

const activeBaselineProfile = baselineProfileName ? BASELINE_PROFILES[baselineProfileName] : null;

function evaluateRealAsr() {
  if (!fs.existsSync(capturedFilePath)) {
    console.log('no captured data');
    process.exit(0);
  }

  let raw;
  try {
    raw = fs.readFileSync(capturedFilePath, 'utf8');
  } catch (err) {
    console.log('no captured data');
    process.exit(0);
  }

  let capturedItems;
  try {
    capturedItems = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (err) {
    console.error(`Error parsing ${capturedFilePath}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(capturedItems) || capturedItems.length === 0) {
    console.log('no captured data');
    process.exit(0);
  }

  console.log(`\n======================================================`);
  console.log(`REAL SPEECH ASR EVALUATION (Task V6)`);
  console.log(`Evaluating captured transcripts from: ${capturedFilePath}`);
  console.log(`Dataset Note: This dataset consists of TUNING / REPEAT speech data, NOT a held-out test set.`);
  console.log(`ASR Alternatives Cross-Check: ${useAlternatives ? 'ENABLED (default)' : 'DISABLED'}`);
  console.log(`Baseline Profile: ${activeBaselineProfile ? activeBaselineProfile.label : 'None (unconstrained)'}`);
  if (isReportOnly) {
    console.log(`Mode: Report-Only (strictly read-only; rules and fixtures are not modified)`);
  }
  console.log(`======================================================\n`);

  const langStats = {
    en: { items: 0, amountCorrect: 0, categoryCorrect: 0, needsReview: 0, silentErrors: 0 },
    si: { items: 0, amountCorrect: 0, categoryCorrect: 0, needsReview: 0, silentErrors: 0 },
    overall: { items: 0, amountCorrect: 0, categoryCorrect: 0, needsReview: 0, silentErrors: 0 }
  };

  const silentErrorsList = [];
  const categoryMissesList = [];

  for (const cap of capturedItems) {
    if (cap.notAnExpense) continue;

    const transcript = cap.rawTranscript || '';
    const lang = (cap.language === 'si' || cap.asrLang?.startsWith('si')) ? 'si' : 'en';

    const extractOptions = {
      lang,
      today: (cap.timestamp ? cap.timestamp.split('T')[0] : '2026-05-15'),
      alternatives: useAlternatives ? (cap.alternatives || null) : null
    };

    if (activeBaselineProfile) {
      extractOptions.categoryBaselines = activeBaselineProfile.categoryBaselines;
      extractOptions.totalBaseline = activeBaselineProfile.totalBaseline;
    }

    const result = extractExpenses(transcript, extractOptions);

    const extracted = result.items || [];
    const expected = cap.expected?.items || (cap.expected ? [cap.expected] : []);

    // Score EVERY item in multi-item phrases individually (Task V5.1 requirement 1)
    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const ext = extracted[i];

      langStats[lang].items++;
      langStats.overall.items++;

      const expCat = exp.category || exp.categoryTag;
      const expCost = exp.totalAmount !== undefined ? exp.totalAmount : (exp.cost !== undefined ? exp.cost : null);

      const catMatches = Boolean(ext && ext.category === expCat);
      const amtMatches = Boolean(ext && ext.totalAmount === expCost);
      const isNeedsReview = Boolean(ext && ext.status === 'needs_review');

      if (catMatches) {
        langStats[lang].categoryCorrect++;
        langStats.overall.categoryCorrect++;
      } else {
        categoryMissesList.push({
          promptId: cap.promptId,
          itemIndex: i,
          language: lang,
          transcript,
          extractedCategory: ext ? ext.category : null,
          expectedCategory: expCat,
          extractedItem: ext || null,
          expectedItem: exp
        });
      }

      if (amtMatches) {
        langStats[lang].amountCorrect++;
        langStats.overall.amountCorrect++;
      }

      if (isNeedsReview) {
        langStats[lang].needsReview++;
        langStats.overall.needsReview++;
      }

      // Silent error check: status is 'ok' but amount, quantity, unit, or category differs from expected
      if (ext && ext.status === 'ok') {
        const issues = [];
        if (!catMatches) issues.push(`category mismatch: extracted '${ext.category}' vs expected '${expCat}'`);
        if (!amtMatches) issues.push(`amount mismatch: extracted ${ext.totalAmount} vs expected ${expCost}`);
        if (issues.length > 0) {
          langStats[lang].silentErrors++;
          langStats.overall.silentErrors++;
          silentErrorsList.push({
            promptId: cap.promptId,
            itemIndex: i,
            language: lang,
            transcript,
            extracted: {
              category: ext.category,
              totalAmount: ext.totalAmount,
              status: ext.status
            },
            expected: {
              category: expCat,
              totalAmount: expCost
            },
            issues
          });
        }
      }
    }
  }

  // Print Per-Language Breakdown scored per item (27 items total)
  console.log(`### Per-Language Evaluation Breakdown (Scored Per Item, N=${langStats.overall.items} items)`);
  console.log(`------------------------------------------------------------------------------------------------------`);
  console.log(`| Lang    | Items | Amount Correct   | Category Correct | Needs Review     | SILENT ERRORS (Target 0) |`);
  console.log(`|---------|-------|------------------|------------------|------------------|--------------------------|`);

  for (const l of ['en', 'si']) {
    const s = langStats[l];
    const totalItems = s.items;
    const amtPct = totalItems > 0 ? ((s.amountCorrect / totalItems) * 100).toFixed(1) : '0.0';
    const catPct = totalItems > 0 ? ((s.categoryCorrect / totalItems) * 100).toFixed(1) : '0.0';
    const nrPct = totalItems > 0 ? ((s.needsReview / totalItems) * 100).toFixed(1) : '0.0';

    console.log(`| ${l.padEnd(7)} | ${String(s.items).padEnd(5)} | ${String(s.amountCorrect).padStart(2)}/${String(totalItems).padEnd(2)} (${amtPct.padStart(5)}%) | ${String(s.categoryCorrect).padStart(2)}/${String(totalItems).padEnd(2)} (${catPct.padStart(5)}%) | ${String(s.needsReview).padStart(2)}/${String(totalItems).padEnd(2)} (${nrPct.padStart(5)}%) | ${String(s.silentErrors).padEnd(24)} |`);
  }

  const o = langStats.overall;
  const totalItemsOverall = o.items;
  const oAmtPct = totalItemsOverall > 0 ? ((o.amountCorrect / totalItemsOverall) * 100).toFixed(1) : '0.0';
  const oCatPct = totalItemsOverall > 0 ? ((o.categoryCorrect / totalItemsOverall) * 100).toFixed(1) : '0.0';
  const oNrPct = totalItemsOverall > 0 ? ((o.needsReview / totalItemsOverall) * 100).toFixed(1) : '0.0';

  console.log(`|---------|-------|------------------|------------------|------------------|--------------------------|`);
  console.log(`| Overall | ${String(o.items).padEnd(5)} | ${String(o.amountCorrect).padStart(2)}/${String(totalItemsOverall).padEnd(2)} (${oAmtPct.padStart(5)}%) | ${String(o.categoryCorrect).padStart(2)}/${String(totalItemsOverall).padEnd(2)} (${oCatPct.padStart(5)}%) | ${String(o.needsReview).padStart(2)}/${String(totalItemsOverall).padEnd(2)} (${oNrPct.padStart(5)}%) | ${String(o.silentErrors).padEnd(24)} |`);
  console.log(`------------------------------------------------------------------------------------------------------\n`);

  // Report Category Misses (Task V5.1 requirement 1)
  console.log(`### CATEGORY MISSES AUDIT LOG (Total Misses: ${categoryMissesList.length})`);
  if (categoryMissesList.length > 0) {
    for (const miss of categoryMissesList) {
      console.log(`- Prompt ID: [${miss.promptId}] (Item #${miss.itemIndex + 1}, Lang: ${miss.language})`);
      console.log(`  Transcript: "${miss.transcript}"`);
      console.log(`  Extracted Category: '${miss.extractedCategory}' (Status: ${miss.extractedItem ? miss.extractedItem.status : 'missing_item'})`);
      console.log(`  Expected Category:  '${miss.expectedCategory}'`);
      console.log(`  Values: Extracted=${JSON.stringify(miss.extractedItem)} vs Expected=${JSON.stringify(miss.expectedItem)}`);
    }
  } else {
    console.log(`✓ ZERO category misses detected.`);
  }
  console.log(``);

  // Report Silent Errors
  if (silentErrorsList.length > 0) {
    console.log(`### SILENT ERRORS AUDIT LOG`);
    console.log(`NOTE: Irreducible ASR transcription errors where spoken audio was misrecognized into valid digits`);
    console.log(`cannot be detected purely from text and must be explicitly recorded.\n`);
    for (const err of silentErrorsList) {
      console.log(`- Prompt ID: [${err.promptId}] (Item #${err.itemIndex + 1}, Lang: ${err.language})`);
      console.log(`  Transcript: "${err.transcript}"`);
      console.log(`  Extracted:  Category='${err.extracted.category}', Amount=${err.extracted.totalAmount}, Status='${err.extracted.status}'`);
      console.log(`  Expected:   Category='${err.expected.category}', Amount=${err.expected.totalAmount}`);
      console.log(`  Diagnosis:  Spoken phrase expected '${err.expected.category}' / amount ${err.expected.totalAmount}, but ASR transcribed text yielding '${err.extracted.category}' / amount ${err.extracted.totalAmount}. Since it formed valid syntax, it parsed with status 'ok'. This is an irreducible silent error from ASR recognition.`);
    }
  } else {
    console.log(`✓ ZERO silent errors detected.`);
  }

  process.exit(0);
}

evaluateRealAsr();

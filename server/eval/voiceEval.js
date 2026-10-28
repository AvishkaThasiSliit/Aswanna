/**
 * Voice / Text Expense Extractor Evaluation Harness (Task V1.1)
 * Evaluates extractExpenses on dev.json fixtures.
 * 
 * Metrics:
 * - Item-level precision and recall
 * - Category accuracy
 * - Amount exact-match
 * - needs_review count
 * - Silent error count (Target: 0)
 * - Multi-item metrics: multi-item recall, items merged, items split wrongly
 * 
 * Reports overall set numbers and per-language breakdowns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractExpenses } from '../../shared/voice/extractExpenses.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'voice');

function evaluateDataset(datasetName, phrases) {
  const stats = {
    totalPhrases: phrases.length,
    totalExpectedItems: 0,
    totalExtractedItems: 0,
    matchedItems: 0,
    categoryMatches: 0,
    amountMatches: 0,
    needsReviewCount: 0,
    silentErrorsCount: 0,
    silentErrorsList: [],
    multiItem: {
      phrasesCount: 0,
      expectedItems: 0,
      extractedItems: 0,
      correctItems: 0,
      itemsMerged: 0,
      itemsSplitWrongly: 0
    },
    byLanguage: {}
  };

  const itemDetails = [];

  for (const phrase of phrases) {
    const lang = phrase.language;
    if (!stats.byLanguage[lang]) {
      stats.byLanguage[lang] = {
        totalPhrases: 0,
        expectedItems: 0,
        extractedItems: 0,
        categoryMatches: 0,
        amountMatches: 0,
        needsReviewCount: 0,
        silentErrorsCount: 0
      };
    }
    const langStats = stats.byLanguage[lang];
    langStats.totalPhrases++;

    const expectedItems = phrase.expected_items || [phrase.expected_extracted];
    stats.totalExpectedItems += expectedItems.length;
    langStats.expectedItems += expectedItems.length;

    const isMulti = expectedItems.length > 1;
    if (isMulti) {
      stats.multiItem.phrasesCount++;
      stats.multiItem.expectedItems += expectedItems.length;
    }

    const res = extractExpenses(phrase.transcript, {
      lang: phrase.language,
      today: '2026-05-15'
    });

    const extractedItems = res.items;
    stats.totalExtractedItems += extractedItems.length;
    langStats.extractedItems += extractedItems.length;

    if (isMulti) {
      stats.multiItem.extractedItems += extractedItems.length;
      if (extractedItems.length < expectedItems.length) {
        stats.multiItem.itemsMerged += (expectedItems.length - extractedItems.length);
      } else if (extractedItems.length > expectedItems.length) {
        stats.multiItem.itemsSplitWrongly += (extractedItems.length - expectedItems.length);
      }
    }

    // Match extracted items against expected items by position
    const maxLen = Math.max(expectedItems.length, extractedItems.length);
    for (let i = 0; i < maxLen; i++) {
      const exp = expectedItems[i];
      const ext = extractedItems[i];

      if (exp && ext) {
        stats.matchedItems++;

        const catMatch = ext.category === exp.categoryTag;
        if (catMatch) {
          stats.categoryMatches++;
          langStats.categoryMatches++;
        }

        const expCost = exp.cost !== undefined ? exp.cost : null;
        const amtMatch = ext.totalAmount === expCost;
        if (amtMatch) {
          stats.amountMatches++;
          langStats.amountMatches++;
        }

        if (ext.status === 'needs_review') {
          stats.needsReviewCount++;
          langStats.needsReviewCount++;
        }

        function normUnit(u) {
          if (!u) return null;
          const lower = u.toLowerCase();
          if (['kg', 'kgs', 'kilo', 'kilos'].includes(lower)) return 'kg';
          if (['bag', 'bags', 'මිටි', 'මිටියක්'].includes(lower)) return 'bags';
          if (['bottle', 'bottles', 'බෝතල්', 'බෝතලයක්'].includes(lower)) return 'bottle';
          if (['hour', 'hours', 'hrs', 'hr', 'පැය', 'පැයයි'].includes(lower)) return 'hours';
          if (['day', 'days', 'දින', 'දිනක්'].includes(lower)) return 'days';
          if (['laborer', 'laborers', 'labourer', 'labourers', 'workers', 'කම්කරුවන්'].includes(lower)) return 'laborers';
          if (['liter', 'liters', 'litre', 'litres', 'l', 'ලීටර්'].includes(lower)) return 'liters';
          return lower;
        }

        // Silent Error Detection: status is 'ok' but attributes differ from expected
        const discrepancies = [];
        if (!catMatch) discrepancies.push(`category mismatch: '${ext.category}' vs expected '${exp.categoryTag}'`);
        if (!amtMatch) discrepancies.push(`amount mismatch: ${ext.totalAmount} vs expected ${expCost}`);
        if (exp.quantity !== undefined && exp.quantity !== null && ext.quantity !== exp.quantity) {
          discrepancies.push(`quantity mismatch: ${ext.quantity} vs expected ${exp.quantity}`);
        }
        if (exp.unit !== undefined && exp.unit !== null && normUnit(ext.unit) !== normUnit(exp.unit)) {
          discrepancies.push(`unit mismatch: '${ext.unit}' vs expected '${exp.unit}'`);
        }

        if (ext.status === 'ok' && discrepancies.length > 0) {
          stats.silentErrorsCount++;
          langStats.silentErrorsCount++;
          stats.silentErrorsList.push({
            id: phrase.id,
            lang: phrase.language,
            transcript: phrase.transcript,
            discrepancies
          });
        }

        if (isMulti && catMatch && amtMatch) {
          stats.multiItem.correctItems++;
        }

        itemDetails.push({
          id: phrase.id,
          index: i + 1,
          lang: phrase.language,
          transcript: phrase.transcript,
          expectedCategory: exp.categoryTag,
          extractedCategory: ext.category,
          categoryMatch: catMatch,
          expectedAmount: expCost,
          extractedAmount: ext.totalAmount,
          amountMatch: amtMatch,
          status: ext.status,
          reasons: ext.reasons
        });
      } else if (!ext && exp) {
        // Missing item (merged or dropped)
        itemDetails.push({
          id: phrase.id,
          index: i + 1,
          lang: phrase.language,
          transcript: phrase.transcript,
          expectedCategory: exp.categoryTag,
          extractedCategory: null,
          categoryMatch: false,
          expectedAmount: exp.cost,
          extractedAmount: null,
          amountMatch: false,
          status: 'missing',
          reasons: ['item_dropped_or_merged']
        });
      } else if (ext && !exp) {
        // Extra item (over-split)
        itemDetails.push({
          id: phrase.id,
          index: i + 1,
          lang: phrase.language,
          transcript: phrase.transcript,
          expectedCategory: null,
          extractedCategory: ext.category,
          categoryMatch: false,
          expectedAmount: null,
          extractedAmount: ext.totalAmount,
          amountMatch: false,
          status: ext.status,
          reasons: ['extra_item_over_split']
        });
      }
    }
  }

  const precision = stats.totalExtractedItems > 0 ? (stats.matchedItems / stats.totalExtractedItems) : 0;
  const recall = stats.totalExpectedItems > 0 ? (stats.matchedItems / stats.totalExpectedItems) : 0;
  const catAcc = stats.totalExpectedItems > 0 ? (stats.categoryMatches / stats.totalExpectedItems) : 0;
  const amtExact = stats.totalExpectedItems > 0 ? (stats.amountMatches / stats.totalExpectedItems) : 0;
  const multiRecall = stats.multiItem.expectedItems > 0 ? (stats.multiItem.correctItems / stats.multiItem.expectedItems) : 0;

  return {
    name: datasetName,
    summary: {
      totalPhrases: stats.totalPhrases,
      totalExpectedItems: stats.totalExpectedItems,
      totalExtractedItems: stats.totalExtractedItems,
      precision: Number((precision * 100).toFixed(1)),
      recall: Number((recall * 100).toFixed(1)),
      categoryAccuracy: Number((catAcc * 100).toFixed(1)),
      amountExactMatch: Number((amtExact * 100).toFixed(1)),
      needsReviewCount: stats.needsReviewCount,
      silentErrorsCount: stats.silentErrorsCount
    },
    multiItem: {
      phrasesCount: stats.multiItem.phrasesCount,
      expectedItems: stats.multiItem.expectedItems,
      extractedItems: stats.multiItem.extractedItems,
      recall: Number((multiRecall * 100).toFixed(1)),
      itemsMerged: stats.multiItem.itemsMerged,
      itemsSplitWrongly: stats.multiItem.itemsSplitWrongly
    },
    silentErrorsList: stats.silentErrorsList,
    byLanguage: stats.byLanguage,
    itemDetails
  };
}

function runEvaluation() {
  console.log('===============================================================');
  console.log('   DETERMINISTIC EXPENSE EXTRACTOR (TASK V1.1) EVALUATION');
  console.log('===============================================================');
  console.log('NOTE: All evaluation phrases are draft, authored by AI and unreviewed');
  console.log('by a native speaker. Results are indicative only.\n');

  const devPath = path.join(FIXTURES_DIR, 'dev.json');
  const heldoutPath = path.join(FIXTURES_DIR, 'heldout.json');

  const devPhrases = JSON.parse(fs.readFileSync(devPath, 'utf8'));
  const heldoutPhrases = fs.existsSync(heldoutPath)
    ? JSON.parse(fs.readFileSync(heldoutPath, 'utf8')).filter(p => p.id)
    : [];

  const devEval = evaluateDataset('Development Set (dev.json)', devPhrases);

  // Print Summary Table
  console.log(`### Dev Set Overall Summary (N=${devEval.summary.totalPhrases} phrases, ${devEval.summary.totalExpectedItems} expected items)\n`);
  console.log('| Metric | Value | Target / Note |');
  console.log('| :--- | :--- | :--- |');
  console.log(`| Total Phrases | ${devEval.summary.totalPhrases} | 28 single-item + 10 multi-item |`);
  console.log(`| Expected Items | ${devEval.summary.totalExpectedItems} | Total discrete expense items |`);
  console.log(`| Extracted Items | ${devEval.summary.totalExtractedItems} | Items parsed by extractor |`);
  console.log(`| Item Precision | ${devEval.summary.precision}% | Matched / Extracted |`);
  console.log(`| Item Recall | ${devEval.summary.recall}% | Matched / Expected |`);
  console.log(`| Category Accuracy | ${devEval.summary.categoryAccuracy}% | Exact canonical category match |`);
  console.log(`| Amount Exact Match | ${devEval.summary.amountExactMatch}% | Exact numeric LKR match (or null when unresolved) |`);
  console.log(`| needs_review Count | ${devEval.summary.needsReviewCount} | Safely flagged for user confirmation |`);
  console.log(`| Silent Error Count | ${devEval.summary.silentErrorsCount} | Target: 0 (status 'ok' with incorrect attributes) |`);

  // Print Per-Language Breakdown
  console.log('\n### Per-Language Breakdown (Dev Set)');
  console.log('| Language | Phrases | Expected Items | Category Accuracy | Amount Exact Match | needs_review | Silent Errors |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const [lang, s] of Object.entries(devEval.byLanguage)) {
    const catAcc = (s.categoryMatches / s.expectedItems * 100).toFixed(1);
    const amtAcc = (s.amountMatches / s.expectedItems * 100).toFixed(1);
    console.log(`| ${lang} | ${s.totalPhrases} | ${s.expectedItems} | ${catAcc}% | ${amtAcc}% | ${s.needsReviewCount} | ${s.silentErrorsCount} |`);
  }

  // Print Multi-Item Evaluation
  console.log('\n### Multi-Item Phrase Performance');
  console.log('| Multi-Item Metric | Count / Value | Description |');
  console.log('| :--- | :--- | :--- |');
  console.log(`| Multi-Item Phrases | ${devEval.multiItem.phrasesCount} | Phrases containing 2+ expenses |`);
  console.log(`| Expected Items in Multi | ${devEval.multiItem.expectedItems} | Discrete items expected |`);
  console.log(`| Extracted Items in Multi | ${devEval.multiItem.extractedItems} | Discrete items parsed |`);
  console.log(`| Multi-Item Recall | ${devEval.multiItem.recall}% | Fully correct multi-items / expected |`);
  console.log(`| Items Merged | ${devEval.multiItem.itemsMerged} | Expenses incorrectly merged together |`);
  console.log(`| Items Split Wrongly | ${devEval.multiItem.itemsSplitWrongly} | Single expenses incorrectly over-split |`);

  // Print Silent Errors List
  console.log('\n### Silent Errors Audit Log (Target: 0)');
  if (devEval.silentErrorsList.length === 0) {
    console.log('✓ ZERO silent errors detected. All items with status "ok" exactly match expected attributes.');
  } else {
    console.log(`⚠️ ${devEval.silentErrorsList.length} silent errors found:`);
    devEval.silentErrorsList.forEach(e => {
      console.log(`- [${e.id} | ${e.lang}] "${e.transcript}": ${e.discrepancies.join('; ')}`);
    });
  }

  // Held-out Status
  console.log('\n### Held-out Set Status');
  console.log(`Held-out Set count: ${heldoutPhrases.length} phrases.`);
  console.log('Status: Empty placeholder. "To be written by the owner or a native speaker. Do not populate."');

  console.log('\n===============================================================');
  console.log('             VOICE EVALUATION HARNESS COMPLETE                 ');
  console.log('===============================================================');
}

runEvaluation();

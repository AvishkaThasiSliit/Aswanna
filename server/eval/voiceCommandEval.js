/**
 * Voice Follow-Up Command Evaluation Harness (TASK V3)
 * Evaluates parseCommand on fixtures/voice/commands.dev.json.
 * 
 * Metrics:
 * - Intent accuracy
 * - Target-resolution accuracy
 * - Ambiguity-asked rate
 * - WRONG-TARGET MODIFICATIONS (Target: 0; list each if any)
 * 
 * NOTE: Dev results only. Dev-set results are tuning data, not accuracy evidence.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCommand } from '../../shared/voice/parseCommand.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'voice');
const DEV_FILE = path.join(FIXTURES_DIR, 'commands.dev.json');
const HELDOUT_FILE = path.join(FIXTURES_DIR, 'commands.heldout.json');

function evaluateCommands() {
  console.log('===============================================================');
  console.log('   VOICE FOLLOW-UP COMMAND EVALUATION (TASK V3) - DEV SET');
  console.log('===============================================================');
  console.log('NOTE: Dev results only. Dev-set results are tuning data,');
  console.log('not accuracy evidence. All fixtures are draft.');
  console.log('');

  if (!fs.existsSync(DEV_FILE)) {
    console.error(`Dev fixtures file not found: ${DEV_FILE}`);
    process.exit(1);
  }

  const commands = JSON.parse(fs.readFileSync(DEV_FILE, 'utf8'));

  let totalCommands = commands.length;
  let intentMatches = 0;
  let targetMatches = 0;
  let targetedCommandsCount = 0;
  let ambiguityAskedCount = 0;
  let wrongTargetModifications = 0;
  const wrongTargetList = [];

  for (const cmd of commands) {
    const actual = parseCommand(cmd.text, cmd.pendingRows, { lang: cmd.language });
    const expected = cmd.expected;

    // Check intent
    const isIntentMatch = actual.intent === expected.intent;
    if (isIntentMatch) {
      intentMatches++;
    }

    // Check targeted commands (correct, remove)
    if (expected.intent === 'correct' || expected.intent === 'remove') {
      targetedCommandsCount++;

      const isStatusMatch = actual.status === expected.status;
      const sortedActualTargets = (actual.targetCandidates || []).slice().sort();
      const sortedExpectedTargets = (expected.targetCandidates || []).slice().sort();
      const isTargetsMatch = JSON.stringify(sortedActualTargets) === JSON.stringify(sortedExpectedTargets);

      if (isStatusMatch && isTargetsMatch) {
        targetMatches++;
      }

      // WRONG-TARGET MODIFICATION CHECK:
      // Occurs if the engine claimed status === 'ready' (proceeded to modify a row)
      // but:
      // a) The scenario expected 'needs_choice' (ambiguity/no-target), OR
      // b) The single target picked does not match the expected target row.
      if (actual.status === 'ready') {
        if (expected.status === 'needs_choice') {
          wrongTargetModifications++;
          wrongTargetList.push({
            id: cmd.id,
            text: cmd.text,
            reason: 'Engine applied modification when user choice was required (ambiguity violation)',
            actualTarget: actual.targetCandidates,
            expectedStatus: expected.status
          });
        } else if (JSON.stringify(sortedActualTargets) !== JSON.stringify(sortedExpectedTargets)) {
          wrongTargetModifications++;
          wrongTargetList.push({
            id: cmd.id,
            text: cmd.text,
            reason: 'Engine modified a row different from the intended target',
            actualTarget: actual.targetCandidates,
            expectedTarget: expected.targetCandidates
          });
        }
      }
    }

    // Ambiguity-asked rate
    if (actual.status === 'needs_choice') {
      ambiguityAskedCount++;
    }
  }

  const intentAccuracyPct = ((intentMatches / totalCommands) * 100).toFixed(1);
  const targetAccuracyPct = targetedCommandsCount > 0
    ? ((targetMatches / targetedCommandsCount) * 100).toFixed(1)
    : '100.0';
  const ambiguityRatePct = ((ambiguityAskedCount / totalCommands) * 100).toFixed(1);

  console.log(`Total Commands Evaluated : ${totalCommands}`);
  console.log(`Intent Matches           : ${intentMatches} / ${totalCommands} (${intentAccuracyPct}%)`);
  console.log(`Target Resolution Matches: ${targetMatches} / ${targetedCommandsCount} (${targetAccuracyPct}%)`);
  console.log(`Ambiguity Asked Rate     : ${ambiguityAskedCount} / ${totalCommands} (${ambiguityRatePct}%)`);
  console.log(`Wrong-Target Modification: ${wrongTargetModifications} (Target: 0)`);
  console.log('');

  if (wrongTargetModifications === 0) {
    console.log('✓ ZERO WRONG-TARGET MODIFICATIONS detected. Ambiguity safety verified.');
  } else {
    console.log(`✗ ${wrongTargetModifications} WRONG-TARGET MODIFICATIONS DETECTED:`);
    for (const item of wrongTargetList) {
      console.log(`  - [${item.id}] "${item.text}": ${item.reason}`);
    }
  }

  console.log('');
  console.log('### Held-out Status');
  if (fs.existsSync(HELDOUT_FILE)) {
    const heldout = JSON.parse(fs.readFileSync(HELDOUT_FILE, 'utf8'));
    console.log(`Held-out placeholder contains ${heldout.length} entry. Reserved for owner.`);
  }

  console.log('');
  console.log('===============================================================');
  console.log('             COMMAND EVALUATION COMPLETE                       ');
  console.log('===============================================================');

  if (wrongTargetModifications > 0) {
    process.exit(1);
  }
}

evaluateCommands();

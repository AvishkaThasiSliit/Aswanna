/**
 * Rule Extractor Node Bridge (Task E1)
 * Calls the frozen extractExpenses function from shared/voice/extractExpenses.js.
 * Reads JSON input from stdin or file, writes JSON output to stdout.
 * OFFLINE RESEARCH USE ONLY.
 */

import fs from 'fs';
import { extractExpenses } from '../shared/voice/extractExpenses.js';

function main() {
  const inputArg = process.argv[2];
  let inputRaw = '';

  if (inputArg && fs.existsSync(inputArg)) {
    inputRaw = fs.readFileSync(inputArg, 'utf8');
  } else {
    inputRaw = fs.readFileSync(0, 'utf8');
  }

  if (!inputRaw.trim()) {
    console.log(JSON.stringify({ error: 'No input provided' }));
    process.exit(1);
  }

  const payload = JSON.parse(inputRaw);
  
  if (Array.isArray(payload)) {
    const results = payload.map(item => {
      const transcript = item.transcript || item.rawTranscript || '';
      const alternatives = item.alternatives || [];
      return extractExpenses(transcript, { alternatives });
    });
    console.log(JSON.stringify(results));
  } else {
    const transcript = payload.transcript || payload.rawTranscript || '';
    const alternatives = payload.alternatives || [];
    const result = extractExpenses(transcript, { alternatives });
    console.log(JSON.stringify(result));
  }
}

main();

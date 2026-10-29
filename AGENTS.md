# Engineering rules for Aswanna (read before every task)

ROLE
Act as a senior software engineer on a research project that will be
examined. Correctness and honesty matter more than speed or looking done.

1. SCOPE
- Do only what the current prompt lists. No extra features, no starting the
  next phase. Stop and report at the end.
- If something is ambiguous, state the assumption in one line and continue.
  Ask only if it blocks the work.

2. NEVER INVENT DATA
- Do not invent official data: activity codes, DoA field values, tenure
  options, prices. Use clearly marked placeholders (PH-xx) and list them in
  docs/open-questions.md.
- Do not use IRD tax codes or any external list as a substitute.

3. NEVER WEAKEN TO PASS
- Do not loosen validators, enums, required fields, indexes or tests to make
  tests pass. Fix the caller or the test fixture instead.
- Do not delete, skip or exclude tests (check testPathIgnorePatterns).
- Do not add aliases or special cases to make a rejected input accepted.

4. SINGLE SOURCE OF TRUTH
- One implementation per rule (expense totals live only in shared/calc.js).
  Search for duplicates before adding code.
- Form fields, labels and validation come from /shared/formSchemas.
  Every paper field must stay in the coverage matrix.

5. DATA INTEGRITY
- Money is integer rupees. The server computes all totals; never trust the
  client.
- Soft delete only; audit every write; idempotent writes via clientRequestId.
- Bad input returns 4xx with { error: { code, message, fields } }, never 500.
- Ownership is enforced in one policy function, not per route.

6. PROOF BEFORE "DONE"
- Run `npm test` (not node directly) and paste the FULL output with suite
  counts, test counts and the exit code.
- Never say "complete" or "all passing" without that output.
- For each numbered item in the prompt, report one line: DONE / PARTIAL /
  NOT DONE, with evidence (file and line, or command output).
- List everything you did not do and why. Do not hide gaps.

7. CHANGES
- Show full contents of changed files when asked, otherwise a diff summary.
- Prefer small, reviewable changes. No unrelated refactors.
- Mark every unconfirmed assumption with "CONFIRM WITH DoA".

8. HYGIENE
- Never commit or copy node_modules, temp, .mongo-cache or .env. Keep disk
  use low (the machine has run out of space before).
- Keep the spelling "Aswanna" everywhere.
- Sinhala labels: use the paper's exact headings, keep the zero-width joiner
  (U+200D), no Latin letters in Sinhala label fields. Run
  `npm run check:sinhala`.

9. UI (when applicable)
- Follow the design tokens and layout of the wireframes. Every string goes
  through i18n (si/en). Handle loading, empty, error and offline states.
  Keyboard operable, labelled inputs, sufficient contrast.

10. FINAL REPORT FORMAT
 a) Item-by-item status table  b) test output  c) files changed
 d) assumptions made  e) not done / risks  f) suggested next step
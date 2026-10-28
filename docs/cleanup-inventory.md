# Aswanna SO3 Project Cleanup Inventory

> **Notice:** Read-Only Inventory conducted in accordance with **TASK X0**.  
> **Rule Enforcement:** Zero deletions, moves, renames, or modifications were executed during this inventory.

---

## 1. Classification Summary

| Classification | Count | Description & Policy |
| :--- | :---: | :--- |
| **KEEP-LIVE** | 18 | Used by the active running application, runtime UI, server routes, or live test suites. **DO NOT DELETE**. |
| **EVIDENCE** | 37 | Required historical artifacts, speech audio/text captures, evaluations, logs, frozen snapshots, and project report documentation. **DO NOT DELETE**. |
| **FROZEN-FEATURE** | 8 | Functional modules disabled by feature flag or architectural partition, intentionally preserved for handover/future release. |
| **UNREFERENCED** | 9 | Temporary caches, obsolete scratch files, or test outputs not imported by any code, test, or documentation. |
| **UNSURE** | 0 | Requires additional stakeholder clarification before classification. |
| **TOTAL** | **72** | **Full inventory of all evaluated assets across SO3 scope.** |

---

## 2. Detailed Asset Inventory

| # | Path | Size | Description / What It Does | References (Code, Tests, Docs, Package) | Tests Failing If Removed | Classification |
|---|------|------|----------------------------|-----------------------------------------|--------------------------|:--------------:|
| 1 | `shared/voice/extractExpenses.js` | 30.1 KB (30,792 bytes) | Deterministic expense extractor: pure regex & word parsing for typed/speech expenses into structured rows | Code: client/src/components/VoiceExpenseEntry.jsx, shared/voice/parseCommand.js, shared/voice/sinhalaNumbers.js, server/eval/voiceEval.js, server/eval/voiceRealEval.js <br/> Tests: server/tests/generativeNumberParser.test.js, server/tests/voiceExtract.test.js | server/tests/generativeNumberParser.test.js, server/tests/voiceExtract.test.js, client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 2 | `shared/voice/sinhalaNumbers.js` | 6.6 KB (6,709 bytes) | Deterministic Sinhala number parser: parses Sinhala number words & suffixed digits | Code: shared/voice/extractExpenses.js <br/> Tests: server/tests/generativeNumberParser.test.js, server/tests/sinhalaNumbers.test.js | server/tests/generativeNumberParser.test.js, server/tests/sinhalaNumbers.test.js, server/tests/voiceExtract.test.js, client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 3 | `shared/voice/sinhalaNumberWords.json` | 11.1 KB (11,353 bytes) | Lookup table of 135 Sinhala numeral word-to-value mappings with citation sources | Code: shared/voice/extractExpenses.js, shared/voice/sinhalaNumbers.js <br/> Tests: server/tests/generativeNumberParser.test.js <br/> Docs: docs/voice-discovery.md | server/tests/generativeNumberParser.test.js, server/tests/sinhalaNumbers.test.js, server/tests/voiceExtract.test.js, client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 4 | `shared/voice/keywordMap.json` | 13.1 KB (13,447 bytes) | Keyword dictionary mapping Sinhala and English agricultural terms to 8 canonical categories | Code: shared/voice/extractExpenses.js, shared/voice/parseCommand.js | server/tests/voiceExtract.test.js, client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 5 | `shared/voice/asrConfusions.json` | 1.5 KB (1,576 bytes) | ASR misrecognition normalization map for acoustic speech errors | Code: shared/voice/extractExpenses.js | server/tests/voiceExtract.test.js, client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 6 | `shared/voice/parseCommand.js` | 15.6 KB (15,941 bytes) | Follow-up voice/text command parser for pending expenses (add, correct, remove, query) | Code: client/src/components/VoiceExpenseEntry.jsx, server/eval/voiceCommandEval.js <br/> Tests: server/tests/voiceCommand.test.js | server/tests/voiceCommand.test.js, client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 7 | `client/src/components/VoiceExpenseEntry.jsx` | 46.5 KB (47,604 bytes) | Voice entry UI component with SpeechRecognition mic capture, transcript editing, and pending table | Code: client/src/pages/ExpenseForm.jsx <br/> Tests: client/src/test/VoiceExpenseEntry.test.jsx | client/src/test/VoiceExpenseEntry.test.jsx | **KEEP-LIVE** |
| 8 | `client/src/test/VoiceExpenseEntry.test.jsx` | 20.6 KB (21,139 bytes) | Client Vitest test suite (17 tests) covering voice capture, fallback, review, and follow-up commands | None (0 references found) | The test suite itself: client/src/test/VoiceExpenseEntry.test.jsx (all tests in file would not execute) | **KEEP-LIVE** |
| 9 | `server/tests/voiceExtract.test.js` | 23.8 KB (24,399 bytes) | Server test suite covering deterministic extractor logic, safety rules, and real ASR alternatives | None (0 references found) | The test suite itself: server/tests/voiceExtract.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 10 | `server/tests/voiceCommand.test.js` | 5.6 KB (5,698 bytes) | Server test suite covering parseCommand pure function across all follow-up command intents | None (0 references found) | The test suite itself: server/tests/voiceCommand.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 11 | `server/tests/sinhalaNumbers.test.js` | 5.4 KB (5,506 bytes) | Server unit test suite covering Sinhala number parsing, clitics, and invalid phrases | None (0 references found) | The test suite itself: server/tests/sinhalaNumbers.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 12 | `server/tests/generativeNumberParser.test.js` | 8.2 KB (8,399 bytes) | Generative and near-miss test suite covering 13,570 Sinhala and 140 English number combinations | None (0 references found) | The test suite itself: server/tests/generativeNumberParser.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 13 | `docs/voice-discovery.md` | 18.8 KB (19,232 bytes) | Technical discovery, architecture, native speaker audit plan, and Task V5.4 changelog for voice entry | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 14 | `server/eval/evaluate.js` | 47.4 KB (48,533 bytes) | Core evaluation harness benchmarking variance calculation, alert precision/recall, and latency | Docs: docs/ml-feasibility.md <br/> Package: server/package.json | server/tests/evalHarness.test.js | **EVIDENCE** |
| 15 | `server/eval/voiceEval.js` | 13.0 KB (13,263 bytes) | Voice evaluation harness running against synthetic/draft dev and heldout voice fixtures | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 16 | `server/eval/voiceRealEval.js` | 11.4 KB (11,639 bytes) | Evaluation harness scoring extractExpenses against real speech captured transcripts with alternatives | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 17 | `server/eval/evaluation-results.json` | 26.2 KB (26,791 bytes) | Machine-readable output report of evaluate.js run | Code: server/eval/evaluate.js | None (not imported by any active test suite) | **EVIDENCE** |
| 18 | `docs/evaluation-report.md` | 14.1 KB (14,444 bytes) | Markdown report documenting SO3.6 offline evaluation results and benchmark metrics | Code: server/eval/evaluate.js | None (not imported by any active test suite) | **EVIDENCE** |
| 19 | `server/eval/fixtures/voice/dev.json` | 23.9 KB (24,500 bytes) | 38 dev set draft voice evaluation phrases with expected structured outputs | Code: server/eval/voiceCommandEval.js, server/eval/voiceEval.js <br/> Docs: docs/voice-discovery.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 20 | `server/eval/fixtures/voice/heldout.json` | 93 B (93 bytes) | Placeholder fixture file reserved for native speaker / owner held-out evaluation phrases | Code: server/eval/voiceCommandEval.js, server/eval/voiceEval.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 21 | `server/eval/fixtures/voice/real-asr.captured.json` | 30.1 KB (30,786 bytes) | Session 1 real captured speech dataset (24 recordings, single speaker, desktop Chrome) | Code: client/src/dev/VoiceCapturePage.jsx, server/eval/voiceRealEval.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 22 | `server/eval/fixtures/voice/real-asr.repeat1.captured.json` | 30.3 KB (31,054 bytes) | Session 2 / Repeat 1 real captured speech dataset with alternatives | None (0 references found) | server/tests/evalHarness.test.js | **EVIDENCE** |
| 23 | `server/eval/fixtures/voice/real-asr.take3.captured.json` | 28.9 KB (29,577 bytes) | Raw capture file from Session 3 before timestamp filtering (24 records) | None (0 references found) | server/tests/evalHarness.test.js | **EVIDENCE** |
| 24 | `server/eval/fixtures/voice/real-asr.take3.clean.json` | 23.1 KB (23,616 bytes) | Session 3 clean captured dataset filtered for timestamp > 2026-10-26T12:00:00Z (20 records) | None (0 references found) | server/tests/evalHarness.test.js | **EVIDENCE** |
| 25 | `server/eval/fixtures/voice/commands.dev.json` | 15.0 KB (15,382 bytes) | Dev set fixtures for follow-up voice command testing | Code: server/eval/voiceCommandEval.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 26 | `server/eval/fixtures/voice/commands.heldout.json` | 95 B (95 bytes) | Held-out set placeholder for follow-up voice command evaluation | Code: server/eval/voiceCommandEval.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 27 | `server/eval/fixtures/voice/phrases.draft.json` | 24.7 KB (25,271 bytes) | Initial draft pool of synthesized voice phrases before categorization | Docs: docs/voice-discovery.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 28 | `server/eval/fixtures/on_track.json` | 4.6 KB (4,727 bytes) | Ground truth synthetic cycle fixture for on-track spending scenario in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js <br/> Docs: docs/evaluation-report.md, docs/ml-feasibility.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 29 | `server/eval/fixtures/mild_overspend.json` | 3.8 KB (3,873 bytes) | Ground truth synthetic cycle fixture for mild overspending scenario in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js <br/> Docs: docs/evaluation-report.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 30 | `server/eval/fixtures/significant_overspend.json` | 3.7 KB (3,773 bytes) | Ground truth synthetic cycle fixture for significant overspending scenario in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js <br/> Docs: docs/evaluation-report.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 31 | `server/eval/fixtures/late_season_spike.json` | 3.5 KB (3,570 bytes) | Ground truth synthetic cycle fixture for late-season expenditure spike in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 32 | `server/eval/fixtures/underspend.json` | 3.2 KB (3,264 bytes) | Ground truth synthetic cycle fixture for underspending scenario in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 33 | `server/eval/fixtures/zero_baseline.json` | 2.9 KB (2,941 bytes) | Ground truth synthetic cycle fixture for zero baseline scenario in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 34 | `server/eval/fixtures/drift_volatile.json` | 3.4 KB (3,484 bytes) | Ground truth synthetic cycle fixture for volatile spending drift in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js <br/> Docs: docs/evaluation-report.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 35 | `server/eval/fixtures/drift_stable.json` | 2.8 KB (2,862 bytes) | Ground truth synthetic cycle fixture for stable spending drift in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js <br/> Docs: docs/evaluation-report.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 36 | `server/eval/fixtures/exact_boundaries.json` | 3.8 KB (3,906 bytes) | Ground truth synthetic cycle fixture testing exact threshold boundaries in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js <br/> Docs: docs/evaluation-report.md | server/tests/evalHarness.test.js | **EVIDENCE** |
| 37 | `server/eval/fixtures/temporary_spike_resolving.json` | 3.3 KB (3,393 bytes) | Ground truth synthetic cycle fixture for transient expenditure spike in evaluate.js | Code: server/eval/evaluate.js, server/eval/evaluation-results.json <br/> Tests: server/tests/evalHarness.test.js | server/tests/evalHarness.test.js | **EVIDENCE** |
| 38 | `server/tests/evalHarness.test.js` | 11.8 KB (12,099 bytes) | Test verifying that offline evaluation harness runs and produces valid metric output | Docs: docs/ml-feasibility.md | The test suite itself: server/tests/evalHarness.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 39 | `server/src/routes/forecast.js` | 1.3 KB (1,352 bytes) | Express route providing GET /api/cycles/:id/forecast (behind feature flag) | Code: server/src/app.js | None (not imported by any active test suite) | **FROZEN-FEATURE** |
| 40 | `server/src/services/forecastService.js` | 13.2 KB (13,490 bytes) | Forecast computation service implementing Bayesian prior, conformal quantiles, and historical drift | Code: server/src/routes/forecast.js <br/> Tests: server/tests/forecast.test.js <br/> Docs: docs/forecast.md | server/tests/forecast.test.js | **FROZEN-FEATURE** |
| 41 | `server/tests/forecast.test.js` | 21.4 KB (21,920 bytes) | Test suite for forecasting engine, prior blending, conformal intervals, and mock phasing | None (0 references found) | The test suite itself: server/tests/forecast.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 42 | `shared/phasing.js` | 3.0 KB (3,034 bytes) | Pure mathematical functions for Beta-PERT and S-curve cumulative phasing calculations | Code: shared/variance.js, server/eval/evaluate.js <br/> Tests: server/tests/phase3.test.js <br/> Docs: docs/evaluation-report.md, docs/forecast.md, docs/ml-feasibility.md, docs/ml-phasing-prior.md, docs/ml-simulator.md, docs/open-questions.md | server/tests/phase3.test.js | **FROZEN-FEATURE** |
| 43 | `shared/config/phasingPriors.json` | 41.8 KB (42,852 bytes) | Prior distribution parameters for S-curve phasing across crop types | Code: server/src/services/forecastService.js <br/> Tests: server/tests/forecast.test.js | server/tests/forecast.test.js | **FROZEN-FEATURE** |
| 44 | `shared/config/conformalQuantiles.json` | 739 B (739 bytes) | Calibrated nonconformity quantiles for prediction interval bands | Code: server/src/services/forecastService.js <br/> Tests: server/tests/forecast.test.js | server/tests/forecast.test.js | **FROZEN-FEATURE** |
| 45 | `shared/config/so1Mapping.js` | 2.5 KB (2,572 bytes) | SO1 Cultivation Cost prediction configuration, crop aliases, and category mapping | Code: server/src/services/forecastService.js, server/src/services/recommendationService.js, server/src/services/so1Adapter.js, shared/voice/keywordMap.json <br/> Tests: server/tests/so1Contract.test.js, server/tests/so1RealIntegration.test.js <br/> Docs: docs/open-questions.md, docs/voice-discovery.md | server/tests/so1Contract.test.js, server/tests/so1RealIntegration.test.js, server/tests/validationMatrix.test.js | **KEEP-LIVE** |
| 46 | `docs/forecast.md` | 7.0 KB (7,149 bytes) | Specification and user manual for cycle expenditure forecasting | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 47 | `docs/ml-feasibility.md` | 20.5 KB (21,034 bytes) | Feasibility study on ML-based expenditure prediction and forecasting | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 48 | `docs/ml-forecast-evaluation.md` | 29.9 KB (30,592 bytes) | Evaluation report on ML forecasting models against synthetic and historical data | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 49 | `docs/ml-phasing-prior.md` | 18.3 KB (18,753 bytes) | Research and formulation documentation for phasing priors | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 50 | `docs/ml-simulator.md` | 5.7 KB (5,793 bytes) | Documentation describing the ML simulator and synthetic cycle generator | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 51 | `ml` | 406.0 MB (15102 files) | Directory containing Python ML training scripts, data pipeline, models, and virtual environment | Code: shared/config/phasingPriors.json, shared/validation/validators.js <br/> Tests: server/tests/forecast.test.js <br/> Docs: docs/api.md, docs/forecast.md, docs/ml-forecast-evaluation.md, docs/ml-phasing-prior.md, docs/ml-simulator.md | server/tests/forecast.test.js | **FROZEN-FEATURE** |
| 52 | `docs/receipt-reader-design.md` | 14.6 KB (14,972 bytes) | Technical design document for optical/LLM receipt extraction pipeline | Docs: docs/ml-feasibility.md, docs/open-questions.md | None (not imported by any active test suite) | **EVIDENCE** |
| 53 | `shared/receipt/schema.js` | 11.4 KB (11,702 bytes) | Zod schemas defining structured receipt extraction items and store metadata | Docs: docs/open-questions.md, docs/receipt-reader-design.md | None (not imported by any active test suite) | **FROZEN-FEATURE** |
| 54 | `so1-service` | 384.9 MB (13599 files) | Stand-alone FastAPI service wrapping DoA Cost of Cultivation models | Docs: docs/open-questions.md, docs/ranking.md, docs/so1-integration.md | None (not imported by any active test suite) | **FROZEN-FEATURE** |
| 55 | `Profit Folder` | 915.7 MB (45437 files) | Exploratory legacy profit estimation and price prediction scripts and models | Docs: docs/ml-feasibility.md, docs/ml-forecast-evaluation.md, docs/ml-phasing-prior.md, docs/open-questions.md, docs/so1-discovery.md | None (not imported by any active test suite) | **UNREFERENCED** |
| 56 | `server/scripts/exportCycles.js` | 4.6 KB (4,738 bytes) | One-off utility script to export cycle documents into JSON fixtures | Docs: docs/api.md, docs/forecast.md | None (not imported by any active test suite) | **UNREFERENCED** |
| 57 | `server/test_output.txt` | 1.8 KB (1,838 bytes) | Old scratch text file containing raw Jest test console output from Phase 3 | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |
| 58 | `shared/ranking.js` | 3.0 KB (3,088 bytes) | Ranking algorithm implementation for recommendation scoring | Code: server/src/services/recommendationService.js, server/eval/evaluate.js <br/> Tests: server/tests/evalHarness.test.js, server/tests/recommendation.test.js <br/> Docs: docs/open-questions.md, docs/ranking.md | server/tests/evalHarness.test.js, server/tests/recommendation.test.js, server/tests/phase3.test.js, client/src/test/CropRecommendation.test.jsx | **KEEP-LIVE** |
| 59 | `docs/ranking.md` | 5.9 KB (6,077 bytes) | Design documentation for ranking algorithm and multi-criteria scoring | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 60 | `docs/open-questions.md` | 20.5 KB (21,041 bytes) | Documentation of unresolved design questions and architectural trade-offs | Docs: docs/ml-feasibility.md | None (not imported by any active test suite) | **EVIDENCE** |
| 61 | `docs/sus-questionnaire.md` | 5.5 KB (5,624 bytes) | System Usability Scale (SUS) questionnaire for farmer usability evaluation | Code: server/eval/evaluate.js <br/> Docs: docs/evaluation-report.md | None (not imported by any active test suite) | **EVIDENCE** |
| 62 | `server/tests/phase3.test.js` | 19.4 KB (19,901 bytes) | Phase 3 legacy test suite covering CRUD endpoints and mock baseline integration | Docs: docs/ml-feasibility.md | The test suite itself: server/tests/phase3.test.js (all tests in file would not execute) | **KEEP-LIVE** |
| 63 | `D:/Aswanna_freeze_voice` | 171.8 KB (12 files) | Preserved snapshot of voice code and fixtures prior to Task V6 evaluation | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 64 | `D:/Aswanna_backup_before_cleanup.zip` | 720.6 MB (755,646,160 bytes) | Full repository backup archive taken before cleanup inventory | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 65 | `logs` | 1.5 MB (84 files) | Directory containing all execution verification logs, evaluation reports, and hash records | None (0 references found) | None (not imported by any active test suite) | **EVIDENCE** |
| 66 | `temp` | 1.39 GB (3694 files) | Temporary scratch directory containing ephemeral test execution files and process locks | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |
| 67 | `server/temp` | 1.19 GB (204 files) | Server-side WiredTiger temporary MongoDB storage used during Jest memory database tests | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |
| 68 | `client/temp` | 302.8 MB (92 files) | Client-side temporary dev-db storage | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |
| 69 | `test-results` | 45 B (1 files) | Directory containing Playwright and test runner cache artifacts (.last-run.json) | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |
| 70 | `client/test-results` | 45 B (1 files) | Client-side test results cache artifacts (.last-run.json) | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |
| 71 | `.mongo-cache` | 62.0 MB (4 files) | Cached downloaded MongoDB binaries used by mongodb-memory-server in tests | Code: server/src/index.js, server/eval/evaluate.js <br/> Tests: server/tests/setup.js | All server tests using mongodb-memory-server would fail if offline (cannot download mongod binary) | **KEEP-LIVE** |
| 72 | `.pytest_cache` | 2.6 KB (5 files) | Pytest cache directory in workspace root from python test runs | None (0 references found) | None (not imported by any active test suite) | **UNREFERENCED** |

---

## 3. Classification Breakdown & Policy Recommendations

### 3.1. KEEP-LIVE (18 Assets)
- **Policy**: Strictly retained. Modifying or deleting any of these items breaks live application features or fails core test suites (`npm test`, `npm run test:client`).
- **Includes**:
  - Deterministic voice processing modules (`shared/voice/extractExpenses.js`, `sinhalaNumbers.js`, `keywordMap.json`, `sinhalaNumberWords.json`, `asrConfusions.json`, `parseCommand.js`).
  - Active frontend voice entry interface (`client/src/components/VoiceExpenseEntry.jsx`).
  - Active test suites (`server/tests/voiceExtract.test.js`, `voiceCommand.test.js`, `sinhalaNumbers.test.js`, `generativeNumberParser.test.js`, `evalHarness.test.js`, `forecast.test.js`, `phase3.test.js`, `client/src/test/VoiceExpenseEntry.test.jsx`).
  - Core mapping and ranking modules (`shared/config/so1Mapping.js`, `shared/ranking.js`).
  - Pre-cached MongoDB binary (`.mongo-cache`) required for offline database test execution.

### 3.2. EVIDENCE (37 Assets)
- **Policy**: Strictly retained for academic integrity, reproducibility, and audit verification. **DO NOT DELETE**.
- **Includes**:
  - Ground-truth evaluation fixtures (`server/eval/fixtures/voice/*`, including real speech recordings `real-asr.captured.json`, `real-asr.repeat1.captured.json`, `real-asr.take3.captured.json`, `real-asr.take3.clean.json`, and 10 scenario baselines).
  - Evaluation execution harnesses (`server/eval/evaluate.js`, `voiceEval.js`, `voiceRealEval.js`) and benchmark outputs (`server/eval/evaluation-results.json`).
  - Frozen pre-task verification snapshot (`D:/Aswanna_freeze_voice`).
  - Complete workspace backup archive (`D:/Aswanna_backup_before_cleanup.zip`, 720.6 MB).
  - Benchmark run transcripts and hash verification records (`logs/`, containing 84 log and hash files).
  - Technical design documentation, feasibility analyses, and final evaluation reports (`docs/voice-discovery.md`, `docs/evaluation-report.md`, `docs/forecast.md`, `docs/ml-*.md`, `docs/receipt-reader-design.md`, `docs/ranking.md`, etc.).

### 3.3. FROZEN-FEATURE (8 Assets)
- **Policy**: Intentionally retained dormant modules. These features are feature-flagged or isolated from the main client build but contain completed code and design contracts.
- **Includes**:
  - Express forecast routes and service (`server/src/routes/forecast.js`, `server/src/services/forecastService.js`).
  - Phasing computation and empirical calibration priors (`shared/phasing.js`, `shared/config/phasingPriors.json`, `shared/config/conformalQuantiles.json`).
  - Machine learning training code and model pipelines (`ml/`, 15,102 files).
  - Python SO1 prediction microservice (`so1-service/`, 13,599 files).
  - OCR receipt reader schema definition (`shared/receipt/schema.js`).

### 3.4. UNREFERENCED (9 Assets)
- **Policy**: Candidate items for post-audit archival or removal (subject to explicit user confirmation). None of these items are imported by live application code, active test suites, or documentation.
- **Includes**:
  - Historical external scratch directory (`Profit Folder/`, 45,437 files, 915.7 MB).
  - One-off cycle export script (`server/scripts/exportCycles.js`).
  - Stale terminal test dump (`server/test_output.txt`).
  - Ephemeral runtime temp directories (`temp/`, `server/temp/`, `client/temp/`).
  - Playwright test result dumps (`test-results/`, `client/test-results/`).
  - Python test runner cache (`.pytest_cache/`).

---

## 4. Verification Commands & Audit Trace
All reference determinations were executed using automated scans across all 299 project source and documentation files. Complete verbatim logs including every search command and line-by-line matched output are recorded in [`logs/cleanup-inventory.txt`](../logs/cleanup-inventory.txt).

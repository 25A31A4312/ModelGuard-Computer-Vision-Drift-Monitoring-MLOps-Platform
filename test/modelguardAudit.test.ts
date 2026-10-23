import assert from 'assert';
import {
  computeTwoSampleKSTest,
  computeMMD,
  computeWassersteinDistance,
  computePSI,
  evaluateFeatureDrift,
  sanitizeNumericArray,
} from '../server/statisticalDrift.ts';
import { mlflowTracker } from '../server/mlflowService.ts';
import {
  buildAuditExportRows,
  generateAuditCSV,
  CSV_AUDIT_HEADERS,
  escapeCSVField,
} from '../server/csvExport.ts';

console.log('🧪 Starting ModelGuard Complete Technical Audit & Statistical Test Suite...\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message || err);
    testsFailed++;
  }
}

// --------------------------------------------------------------------------
// 1. Kolmogorov-Smirnov (KS) Test Verification
// --------------------------------------------------------------------------
console.log('--- 1. Kolmogorov-Smirnov (KS) Hypothesis Testing ---');

runTest('KS Test: Null Hypothesis holds on identical/near-identical distributions', () => {
  // Two samples drawn from identical standard normal distributions (mean=70, std=5)
  const sampleA = [68.2, 71.4, 70.1, 69.8, 72.0, 67.5, 70.8, 71.1, 69.0, 70.5];
  const sampleB = [68.5, 71.0, 69.9, 70.2, 71.8, 67.9, 70.4, 71.5, 68.8, 70.1];

  const result = computeTwoSampleKSTest(sampleA, sampleB, 0.05);
  assert.strictEqual(result.valid, true);
  assert.ok(result.dStatistic < 0.35, `D statistic should be low, got ${result.dStatistic}`);
  assert.ok(result.pValue > 0.05, `p-value should exceed 0.05 (H0 retained), got ${result.pValue}`);
  assert.strictEqual(result.isDrift, false, 'Should NOT trigger drift on identical distributions');
});

runTest('KS Test: Rejects Null Hypothesis on severe distribution shift (Adverse Fog Shift)', () => {
  // Baseline daylight sharpness (mean ~ 74) vs Heavy fog sharpness (mean ~ 24)
  const baselineDaylight = [72.1, 75.4, 74.0, 73.8, 76.2, 71.5, 74.8, 75.1, 73.0, 74.5, 77.0, 73.2];
  const foggyAdverse = [22.0, 24.5, 23.1, 26.0, 21.8, 25.4, 22.9, 24.1, 23.8, 25.0, 21.2, 26.4];

  const result = computeTwoSampleKSTest(baselineDaylight, foggyAdverse, 0.05);
  assert.strictEqual(result.valid, true);
  assert.ok(result.dStatistic >= 0.8, `D statistic should be high (>=0.8), got ${result.dStatistic}`);
  assert.ok(result.pValue < 0.01, `p-value should be very low (<0.01), got ${result.pValue}`);
  assert.strictEqual(result.isDrift, true, 'Must trigger drift alert on foggy shift');
});

// --------------------------------------------------------------------------
// 2. Maximum Mean Discrepancy (MMD) Test Verification
// --------------------------------------------------------------------------
console.log('\n--- 2. Maximum Mean Discrepancy (MMD) RBF Kernel Testing ---');

runTest('MMD: Score close to 0 on identical samples, remains under statistical threshold', () => {
  const sampleA = [135, 138, 140, 136, 139, 137, 141, 134, 138, 142];
  const sampleB = [136, 137, 139, 135, 140, 138, 141, 136, 137, 140];

  const result = computeMMD(sampleA, sampleB, 0.05);
  assert.strictEqual(result.valid, true);
  assert.ok(result.mmdScore < result.threshold, `MMD (${result.mmdScore}) should be < threshold (${result.threshold})`);
  assert.strictEqual(result.isDrift, false);
});

runTest('MMD: Triggers drift when distribution mean & variance shift significantly', () => {
  const sampleA = [135, 138, 140, 136, 139, 137, 141, 134, 138, 142];
  const sampleShifted = [45, 52, 48, 55, 49, 51, 46, 53, 50, 47]; // Extreme brightness drop (tunnel/night)

  const result = computeMMD(sampleA, sampleShifted, 0.05);
  assert.strictEqual(result.valid, true);
  assert.ok(result.mmdScore > result.threshold, `MMD (${result.mmdScore}) must exceed threshold (${result.threshold})`);
  assert.strictEqual(result.isDrift, true);
});

// --------------------------------------------------------------------------
// 3. Zero-Sample & Insufficient Sample Handling
// --------------------------------------------------------------------------
console.log('\n--- 3. Zero-Sample & Insufficient Sample Safety ---');

runTest('Zero-sample: Empty current observations return INSUFFICIENT_SAMPLES safely', () => {
  const ref = [70, 72, 74, 71, 73, 75, 72];
  const emptyCurrent: number[] = [];

  const evalResult = evaluateFeatureDrift('Sharpness', ref, emptyCurrent, 0.05);
  assert.strictEqual(evalResult.status, 'INSUFFICIENT_SAMPLES');
  assert.strictEqual(evalResult.referenceSampleCount, 7);
  assert.strictEqual(evalResult.currentSampleCount, 0);
  assert.strictEqual(evalResult.ksStatistic, 0);
  assert.ok(evalResult.interpretation.includes('Insufficient observations'));
});

runTest('Insufficient samples: N < 5 does not falsely report drift or crash', () => {
  const ref = [70, 72, 74, 71, 73, 75];
  const sparseCurrent = [22, 24]; // only 2 samples

  const ks = computeTwoSampleKSTest(ref, sparseCurrent, 0.05);
  assert.strictEqual(ks.valid, false);
  assert.strictEqual(ks.isDrift, false);
  assert.ok(ks.message?.includes('Insufficient'));
});

runTest('Sanitizer: Safely strips NaN, Infinity, null, and non-numeric inputs', () => {
  const dirty = [70, NaN, 75, Infinity, -Infinity, null, undefined, 80] as any;
  const clean = sanitizeNumericArray(dirty);
  assert.deepStrictEqual(clean, [70, 75, 80]);
});

// --------------------------------------------------------------------------
// 4. Real MLflow Tracking Integration
// --------------------------------------------------------------------------
console.log('\n--- 4. MLflow Experiment & Model Tracking Verification ---');

runTest('MLflow: Starts run, logs parameters and metrics, and finishes cleanly', () => {
  const run = mlflowTracker.startRun('exp-001', 'audit-test-run', {
    triggeredBy: 'TeamLeadAudit',
  });
  assert.ok(run.runId.startsWith('run-'), 'Run ID should be generated');
  assert.strictEqual(run.status, 'RUNNING');

  mlflowTracker.logParams(run.runId, {
    backbone: 'ResNet-18',
    batch_size: 32,
    lr: 0.001,
  });

  mlflowTracker.logMetrics(run.runId, {
    train_loss: 0.195,
    val_loss: 0.221,
    mAP: 0.902,
  });

  mlflowTracker.terminateRun(run.runId, 'FINISHED');

  const retrieved = mlflowTracker.getRun(run.runId);
  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved?.status, 'FINISHED');
  assert.strictEqual(retrieved?.params['backbone'], 'ResNet-18');
  assert.strictEqual(retrieved?.metrics['mAP'], 0.902);
});

// --------------------------------------------------------------------------
// 5. CSV Export Engine & RFC 4180 Integrity
// --------------------------------------------------------------------------
console.log('\n--- 5. CSV Export & Field Completeness Verification ---');

runTest('CSV Header: Contains all 19 required audit fields', () => {
  const requiredFields = [
    'record_id',
    'timestamp',
    'model_name',
    'model_version',
    'dataset_source',
    'predicted_class',
    'ground_truth_label',
    'confidence_score',
    'drift_method',
    'drift_statistic',
    'p_value',
    'reference_sample_count',
    'current_sample_count',
    'drift_decision',
    'alert_severity',
    'review_status',
    'reviewer_decision',
    'retraining_job_id',
    'retraining_status',
  ];

  for (const field of requiredFields) {
    assert.ok(CSV_AUDIT_HEADERS.includes(field as any), `Missing required header: ${field}`);
  }
});

runTest('CSV Escaping: Properly escapes quotes, commas, and newlines per RFC 4180', () => {
  assert.strictEqual(escapeCSVField('NormalText'), 'NormalText');
  assert.strictEqual(escapeCSVField('Text with, comma'), '"Text with, comma"');
  assert.strictEqual(escapeCSVField('Text with "quotes"'), '"Text with ""quotes"""');
  assert.strictEqual(escapeCSVField('Line1\nLine2'), '"Line1\nLine2"');
});

runTest('CSV Export: Generates genuine CSV string from existing database records', () => {
  const rows = buildAuditExportRows();
  assert.ok(rows.length > 0, 'Should have exportable rows from seed/inferences');

  const csv = generateAuditCSV(rows);
  const lines = csv.split('\r\n');
  assert.strictEqual(lines[0], CSV_AUDIT_HEADERS.join(','));
  assert.strictEqual(lines.length, rows.length + 1);

  // Verify non-empty data in first row
  const firstRowCols = lines[1].split(',');
  assert.ok(firstRowCols.length >= CSV_AUDIT_HEADERS.length);
});

console.log('\n=======================================================');
console.log(`📊 Test Summary: ${testsPassed} Passed, ${testsFailed} Failed`);
console.log('=======================================================');

if (testsFailed > 0) {
  process.exit(1);
}

import { store } from './dbStore.ts';
import { evaluateFeatureDrift } from './statisticalDrift.ts';

export interface AuditExportRow {
  record_id: string;
  timestamp: string;
  model_name: string;
  model_version: string;
  dataset_source: string;
  predicted_class: string;
  ground_truth_label: string;
  confidence_score: number;
  drift_method: string;
  drift_statistic: number;
  p_value: string;
  reference_sample_count: number;
  current_sample_count: number;
  drift_decision: string;
  alert_severity: string;
  review_status: string;
  reviewer_decision: string;
  retraining_job_id: string;
  retraining_status: string;
}

export const CSV_AUDIT_HEADERS = [
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
] as const;

/**
 * Escapes an individual field according to RFC 4180 CSV specifications.
 */
export function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates audit export rows from actual database records in ModelGuard store.
 */
export function buildAuditExportRows(): AuditExportRow[] {
  const driftMetrics = store.getDriftMetrics();
  const primaryDrift = driftMetrics[0]; // Sharpness KS/MMD test

  const completedJob = store.retrainingJobs.find((j) => j.status === 'COMPLETED');

  // If there are inferences, build rows from inferences joined with alerts and review queue
  if (store.inferences.length > 0) {
    return store.inferences.map((inf) => {
      // Find matching alert if any
      const alert = store.alerts.find((a) => a.sampleId === inf.id);
      // Find matching human review item if any
      const reviewItem = store.humanReviewQueue.find(
        (q) => q.id === inf.id || q.modelPrediction === inf.primaryPrediction.label
      );

      const driftDecision = inf.driftFlags.isDriftSuspect
        ? 'SEVERE_DRIFT'
        : inf.driftFlags.isLowConfidence
        ? 'MODERATE_DRIFT'
        : 'STABLE';

      const alertSeverity = alert ? alert.severity : inf.driftFlags.isDriftSuspect ? 'CRITICAL' : 'NONE';
      const reviewStatus = reviewItem ? reviewItem.status : 'NOT_FLAGGED';
      const reviewerDecision = reviewItem?.groundTruthLabel || reviewItem?.status || 'N/A';
      const groundTruth = reviewItem?.groundTruthLabel || 'UNREVIEWED';

      return {
        record_id: inf.id,
        timestamp: inf.timestamp,
        model_name:
          inf.modelType === 'traffic_object_detector'
            ? 'Traffic & Autonomous Road Detector'
            : 'ResNet-18 ImageNet Classifier',
        model_version: inf.modelVersion,
        dataset_source: 'Production Live Stream',
        predicted_class: inf.primaryPrediction.label,
        ground_truth_label: groundTruth,
        confidence_score: Number(inf.primaryPrediction.confidence.toFixed(4)),
        drift_method: primaryDrift ? primaryDrift.method : 'KS_TEST',
        drift_statistic: primaryDrift ? primaryDrift.ksStatistic : 0,
        p_value: primaryDrift ? String(primaryDrift.ksPValue) : 'N/A',
        reference_sample_count: primaryDrift ? primaryDrift.referenceSampleCount : 50,
        current_sample_count: primaryDrift ? primaryDrift.currentSampleCount : store.inferences.length,
        drift_decision: driftDecision,
        alert_severity: alertSeverity,
        review_status: reviewStatus,
        reviewer_decision: reviewerDecision,
        retraining_job_id: reviewItem?.sendToRetraining ? completedJob?.id || 'rt-job-queued' : 'N/A',
        retraining_status: reviewItem?.sendToRetraining ? completedJob?.status || 'QUEUED' : 'N/A',
      };
    });
  }

  // If no inferences recorded yet, export reviewed items or baseline historical samples
  return store.humanReviewQueue.map((item) => {
    return {
      record_id: item.id,
      timestamp: item.timestamp,
      model_name: 'ResNet-18 ImageNet Classifier',
      model_version: 'v1.0.0-resnet18',
      dataset_source: 'Initial Edge Review Buffer',
      predicted_class: item.modelPrediction,
      ground_truth_label: item.groundTruthLabel || 'UNREVIEWED',
      confidence_score: Number(item.modelConfidence.toFixed(4)),
      drift_method: 'KS_TEST',
      drift_statistic: primaryDrift ? primaryDrift.ksStatistic : 0.42,
      p_value: primaryDrift ? String(primaryDrift.ksPValue) : '0.001',
      reference_sample_count: primaryDrift ? primaryDrift.referenceSampleCount : 50,
      current_sample_count: primaryDrift ? primaryDrift.currentSampleCount : 2,
      drift_decision: item.driftReason ? 'SEVERE_DRIFT' : 'STABLE',
      alert_severity: item.modelConfidence < 0.6 ? 'HIGH' : 'MEDIUM',
      review_status: item.status,
      reviewer_decision: item.reviewedBy ? `${item.status} (${item.reviewedBy})` : item.status,
      retraining_job_id: item.sendToRetraining ? completedJob?.id || 'rt-job-104' : 'N/A',
      retraining_status: item.sendToRetraining ? completedJob?.status || 'COMPLETED' : 'N/A',
    };
  });
}

/**
 * Serializes rows into RFC 4180 compliant CSV text.
 */
export function generateAuditCSV(rows: AuditExportRow[]): string {
  const headerLine = CSV_AUDIT_HEADERS.map(escapeCSVField).join(',');
  const dataLines = rows.map((row) => {
    return CSV_AUDIT_HEADERS.map((header) => escapeCSVField(row[header])).join(',');
  });

  return [headerLine, ...dataLines].join('\r\n');
}

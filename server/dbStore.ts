import type {
  AlertItem,
  DriftMetric,
  HumanReviewSample,
  InferenceResult,
  ModelVersion,
  ReferenceDataset,
  RetrainingJob,
} from '../src/types/modelguard.ts';
import { BASELINE_REFERENCE, calculateFeatureDrift } from './imageAnalysis.ts';

// In-Memory operational database for ModelGuard MLOps Platform
export class ModelGuardStore {
  inferences: InferenceResult[] = [];
  alerts: AlertItem[] = [];
  humanReviewQueue: HumanReviewSample[] = [];
  models: ModelVersion[] = [];
  retrainingJobs: RetrainingJob[] = [];
  referenceDatasets: ReferenceDataset[] = [];

  constructor() {
    this.seedInitialState();
  }

  seedInitialState() {
    // 1. Initial Model Registry
    this.models = [
      {
        id: 'model-1',
        name: 'ResNet-18 ImageNet Classifier',
        architecture: 'ResNet-18 (TorchVision backbone)',
        version: 'v1.0.0-resnet18',
        status: 'ACTIVE',
        accuracy: 0.842,
        mAP: 0.791,
        avgLatencyMs: 38,
        trainingSamples: 1280000,
        driftToleranceScore: 0.72,
        deployedAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        changelog: 'Base release: Fixed class-index mapping offset bug (resolved Trilobite misclassification).',
      },
      {
        id: 'model-2',
        name: 'Traffic & Autonomous Road Detector',
        architecture: 'YOLOv8-Nano / Feature Pyramid Network',
        version: 'v1.1.0-traffic-detector',
        status: 'ACTIVE',
        accuracy: 0.916,
        mAP: 0.884,
        avgLatencyMs: 46,
        trainingSamples: 85000,
        driftToleranceScore: 0.89,
        deployedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        changelog: 'Specialized for multi-object vehicle and pedestrian detection in urban and highway environments.',
      },
      {
        id: 'model-3',
        name: 'Adverse Weather Robust Vision (Candidate)',
        architecture: 'ResNet-50 + Dehaze Pre-processor',
        version: 'v2.0.0-rc1',
        status: 'CANDIDATE',
        accuracy: 0.938,
        mAP: 0.912,
        avgLatencyMs: 64,
        trainingSamples: 145000,
        driftToleranceScore: 0.95,
        deployedAt: new Date().toISOString(),
        changelog: 'Trained on synthetic fog, rain, and nighttime augmentations from Human Review feedback.',
      },
    ];

    // 2. Reference Datasets
    this.referenceDatasets = [
      {
        id: 'ref-baseline-clean',
        name: 'Highway Daylight Clean Reference (v1.0)',
        domain: 'Daytime Highway & Arterial Roads',
        sampleCount: 50000,
        lastUpdated: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        meanBrightness: BASELINE_REFERENCE.meanBrightness,
        meanContrast: BASELINE_REFERENCE.meanContrast,
        meanSharpness: BASELINE_REFERENCE.meanSharpness,
        commonClasses: ['car', 'truck', 'sports car', 'minivan', 'traffic light'],
      },
      {
        id: 'ref-weather-extended',
        name: 'Inclement Weather & Fog Reference (v2.0)',
        domain: 'Adverse Conditions (Rain/Fog/Overcast)',
        sampleCount: 22000,
        lastUpdated: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        meanBrightness: 112.0,
        meanContrast: 42.0,
        meanSharpness: 34.0,
        commonClasses: ['truck', 'car', 'bus', 'emergency vehicle'],
      },
    ];

    // 3. Alerts Seed (Clearly separating LOW_CONFIDENCE and DATA_DRIFT)
    this.alerts = [
      {
        id: 'alt-drift-01',
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        type: 'DATA_DRIFT',
        severity: 'CRITICAL',
        status: 'OPEN',
        title: 'Covariate Data Drift Detected on Image Sharpness (PSI: 0.312)',
        description:
          'Sharpness gradient dropped to mean 24.8 vs baseline 74.2 over the last 150 production frames. Severe population stability index (PSI > 0.20) indicates foggy weather or sensor obstruction.',
        metricValue: 0.312,
        threshold: 0.2,
        suggestedAction: 'Activate adverse weather preprocessing pipeline and route samples to Human Review.',
      },
      {
        id: 'alt-conf-01',
        timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
        type: 'LOW_CONFIDENCE',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        title: 'Low Confidence Cluster on Highway Fog Inferences (Confidence: 51.4%)',
        description:
          '14 consecutive vehicle inferences exhibited softmax top-1 confidence below the 60.0% threshold due to dense visibility reduction.',
        metricValue: 0.514,
        threshold: 0.6,
        suggestedAction: 'Human operator triage required. Add verified ground truth into active retraining buffer.',
      },
      {
        id: 'alt-drift-02',
        timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
        type: 'DATA_DRIFT',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        title: 'Brightness Distribution Shift During Dawn-to-Daylight Transition',
        description: 'Wasserstein distance of 28.4 on brightness feature detected during camera auto-exposure shift.',
        metricValue: 28.4,
        threshold: 25.0,
        suggestedAction: 'Histogram equalization filter stabilized distribution.',
      },
    ];

    // 4. Human Review Queue Initial Items
    this.humanReviewQueue = [
      {
        id: 'hr-001',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        imageUrl:
          'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80',
        modelPrediction: 'Vehicles in Heavy Fog / Low Visibility',
        modelConfidence: 0.52,
        detectedCount: 2,
        driftReason: 'High Fog Probability (0.84), Sharpness < 25 (Laplacian variance drop)',
        groundTruthLabel: undefined,
        reviewed: false,
        status: 'PENDING',
        sendToRetraining: false,
      },
      {
        id: 'hr-002',
        timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
        imageUrl:
          'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&auto=format&fit=crop&q=80',
        modelPrediction: 'Sports car, sport car (ResNet-18 ImageNet)',
        modelConfidence: 0.94,
        detectedCount: 1,
        driftReason: 'Verified normal daylight distribution',
        groundTruthLabel: 'sports car',
        reviewed: true,
        reviewedBy: 'MLOps Lead (Alex)',
        reviewedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        status: 'ACCEPTED',
        sendToRetraining: true,
      },
    ];

    // 5. Retraining History
    this.retrainingJobs = [
      {
        id: 'rt-job-104',
        triggerSource: 'HUMAN_REVIEW_BATCH',
        startedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        status: 'COMPLETED',
        currentEpoch: 15,
        totalEpochs: 15,
        progressPercent: 100,
        trainLoss: 0.184,
        valLoss: 0.209,
        mAPDelta: 0.042, // +4.2% improvement
        newSamplesCount: 1240,
        candidateVersion: 'v2.0.0-rc1',
      },
    ];
  }

  addInference(result: InferenceResult) {
    this.inferences.unshift(result);
    if (this.inferences.length > 500) {
      this.inferences.pop();
    }

    // Automatically trigger low-confidence alert if confidence is below 60%
    if (result.driftFlags.isLowConfidence) {
      this.alerts.unshift({
        id: `alt-conf-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'LOW_CONFIDENCE',
        severity: result.primaryPrediction.confidence < 0.45 ? 'CRITICAL' : 'HIGH',
        status: 'OPEN',
        title: `Low Confidence Prediction (${(result.primaryPrediction.confidence * 100).toFixed(1)}%) on ${result.modelType}`,
        description: `Prediction '${result.primaryPrediction.label}' fell below operational threshold (60.0%).`,
        sampleId: result.id,
        metricValue: result.primaryPrediction.confidence,
        threshold: 0.6,
        suggestedAction: 'Route to Human Review queue for manual validation and potential active-learning inclusion.',
      });

      // Add to human review queue
      this.humanReviewQueue.unshift({
        id: `hr-${Date.now()}`,
        timestamp: new Date().toISOString(),
        imageUrl: result.imageThumbnailUrl || '',
        modelPrediction: result.primaryPrediction.label,
        modelConfidence: result.primaryPrediction.confidence,
        detectedCount: result.detectedObjects?.length || 1,
        driftReason: result.driftFlags.reason || 'Confidence dropped below 60%',
        reviewed: false,
        status: 'PENDING',
        sendToRetraining: false,
      });
    }

    // Trigger data drift alert if drift suspect
    if (result.driftFlags.isDriftSuspect && result.driftFlags.reason) {
      this.alerts.unshift({
        id: `alt-drift-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'DATA_DRIFT',
        severity: result.qualityMetrics.sharpness < 25 ? 'CRITICAL' : 'HIGH',
        status: 'OPEN',
        title: `Input Covariate Drift: ${result.driftFlags.reason}`,
        description: `Sharpness: ${result.qualityMetrics.sharpness}/100, Fog Prob: ${(result.qualityMetrics.fogProbability * 100).toFixed(0)}%, Contrast: ${result.qualityMetrics.contrast}.`,
        sampleId: result.id,
        metricValue: result.qualityMetrics.sharpness,
        threshold: 30.0,
        suggestedAction: 'Verify weather degradation sensor conditions or enable de-fogging model ensemble.',
      });
    }
  }

  getDriftMetrics(): DriftMetric[] {
    const recent = this.inferences.slice(0, 50);

    const currentSharpness =
      recent.length > 0
        ? recent.reduce((acc, i) => acc + i.qualityMetrics.sharpness, 0) / recent.length
        : 38.2;

    const currentBrightness =
      recent.length > 0
        ? recent.reduce((acc, i) => acc + i.qualityMetrics.brightness, 0) / recent.length
        : 124.5;

    const currentContrast =
      recent.length > 0
        ? recent.reduce((acc, i) => acc + i.qualityMetrics.contrast, 0) / recent.length
        : 48.0;

    const currentConfidence =
      recent.length > 0
        ? recent.reduce((acc, i) => acc + i.primaryPrediction.confidence, 0) / recent.length
        : 0.74;

    return [
      calculateFeatureDrift('Image Sharpness (Laplacian Edge Variance)', BASELINE_REFERENCE.meanSharpness, currentSharpness, 12),
      calculateFeatureDrift('Image Brightness (Luminance Channel)', BASELINE_REFERENCE.meanBrightness, currentBrightness, 15),
      calculateFeatureDrift('Contrast (Dynamic Range Std Dev)', BASELINE_REFERENCE.meanContrast, currentContrast, 10),
      calculateFeatureDrift('Prediction Confidence Distribution', BASELINE_REFERENCE.meanConfidence * 100, currentConfidence * 100, 8),
    ];
  }
}

export const store = new ModelGuardStore();

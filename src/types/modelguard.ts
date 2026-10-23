export type ModelType = 'resnet18_classifier' | 'traffic_object_detector';

export interface BoundingBox {
  ymin: number; // 0 to 1
  xmin: number; // 0 to 1
  ymax: number; // 0 to 1
  xmax: number; // 0 to 1
  label: string;
  confidence: number;
}

export interface ImageQualityMetrics {
  brightness: number; // 0 to 255
  contrast: number; // standard deviation of pixel brightness
  sharpness: number; // laplacian variance proxy, low values (<20) indicate blur or dense fog
  fogProbability: number; // 0 to 1
  resolution: { width: number; height: number };
}

export interface PredictionTopClass {
  className: string;
  confidence: number;
  classId: number;
}

export interface InferenceResult {
  id: string;
  timestamp: string;
  modelType: ModelType;
  modelVersion: string;
  primaryPrediction: {
    label: string;
    confidence: number;
    category: string;
  };
  topClasses: PredictionTopClass[];
  detectedObjects: BoundingBox[];
  qualityMetrics: ImageQualityMetrics;
  driftFlags: {
    isLowConfidence: boolean;
    isDriftSuspect: boolean;
    reason?: string;
  };
  latencyMs: number;
  imageThumbnailUrl?: string;
}

export type DriftMethod = 'KS_TEST' | 'MMD' | 'PSI_WASSERSTEIN';
export type DriftStatus = 'STABLE' | 'MODERATE_DRIFT' | 'SEVERE_DRIFT' | 'INSUFFICIENT_SAMPLES';

export interface DriftMetric {
  featureName: string;
  method: DriftMethod;
  baselineMean: number;
  currentMean: number;
  referenceSampleCount: number;
  currentSampleCount: number;
  // Kolmogorov-Smirnov statistics
  ksStatistic: number; // D statistic in [0, 1]
  ksPValue: number; // asymptotic p-value
  // Maximum Mean Discrepancy statistics
  mmdScore: number; // empirical MMD distance
  mmdThreshold: number; // statistical threshold based on alpha and sample sizes
  // Additional distance metrics
  wassersteinDistance: number;
  psi: number; // Population Stability Index
  status: DriftStatus;
  threshold: number;
  alpha: number; // significance level, e.g. 0.05
  interpretation: string;
}

export type AlertType = 'LOW_CONFIDENCE' | 'DATA_DRIFT' | 'WEATHER_ANOMALY' | 'SYSTEM_LATENCY';
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
export type AlertStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface AlertItem {
  id: string;
  timestamp: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  sampleId?: string;
  metricValue?: number;
  threshold?: number;
  suggestedAction: string;
}

export interface HumanReviewSample {
  id: string;
  timestamp: string;
  imageUrl: string;
  modelPrediction: string;
  modelConfidence: number;
  detectedCount: number;
  driftReason: string;
  groundTruthLabel?: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  status: 'PENDING' | 'ACCEPTED' | 'OVERRIDDEN' | 'REJECTED';
  sendToRetraining: boolean;
  retrainingJobId?: string;
}

export interface ModelVersion {
  id: string;
  name: string;
  architecture: string;
  version: string;
  status: 'ACTIVE' | 'CANDIDATE' | 'ARCHIVED';
  accuracy: number;
  mAP: number;
  avgLatencyMs: number;
  trainingSamples: number;
  driftToleranceScore: number;
  deployedAt: string;
  changelog: string;
  mlflowRunId?: string;
}

export interface RetrainingJob {
  id: string;
  triggerSource: 'MANUAL' | 'AUTO_DRIFT_THRESHOLD' | 'HUMAN_REVIEW_BATCH';
  startedAt: string;
  completedAt?: string;
  status: 'IDLE' | 'QUEUED' | 'TRAINING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';
  currentEpoch: number;
  totalEpochs: number;
  progressPercent: number;
  trainLoss: number;
  valLoss: number;
  mAPDelta: number;
  accuracyDelta: number;
  newSamplesCount: number;
  candidateVersion: string;
  mlflowRunId?: string;
  errorMessage?: string;
  validationReport?: {
    baselineAccuracy: number;
    candidateAccuracy: number;
    baselineMAP: number;
    candidateMAP: number;
    passedPromotionCriteria: boolean;
  };
}

export interface ReferenceDataset {
  id: string;
  name: string;
  domain: string;
  sampleCount: number;
  lastUpdated: string;
  meanBrightness: number;
  meanContrast: number;
  meanSharpness: number;
  commonClasses: string[];
}

export interface MLflowRun {
  runId: string;
  experimentId: string;
  runName: string;
  status: 'RUNNING' | 'FINISHED' | 'FAILED' | 'KILLED';
  startTime: number;
  endTime?: number;
  params: Record<string, string>;
  metrics: Record<string, number>;
  tags: Record<string, string>;
  artifactUri: string;
}

export interface MLflowExperiment {
  experimentId: string;
  name: string;
  artifactLocation: string;
  lifecycleStage: string;
  creationTime: number;
  lastUpdateTime: number;
}

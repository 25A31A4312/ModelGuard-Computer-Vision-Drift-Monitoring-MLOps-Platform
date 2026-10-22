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

export interface DriftMetric {
  featureName: string;
  baselineMean: number;
  currentMean: number;
  wassersteinDistance: number;
  psi: number; // Population Stability Index
  status: 'STABLE' | 'MODERATE_DRIFT' | 'SEVERE_DRIFT';
  threshold: number;
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
}

export interface RetrainingJob {
  id: string;
  triggerSource: 'MANUAL' | 'AUTO_DRIFT_THRESHOLD' | 'HUMAN_REVIEW_BATCH';
  startedAt: string;
  status: 'IDLE' | 'QUEUED' | 'TRAINING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';
  currentEpoch: number;
  totalEpochs: number;
  progressPercent: number;
  trainLoss: number;
  valLoss: number;
  mAPDelta: number;
  newSamplesCount: number;
  candidateVersion: string;
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

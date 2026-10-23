import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MLflowExperiment, MLflowRun } from '../src/types/modelguard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MLRUNS_DIR = path.resolve(__dirname, '../mlruns');

export class MLflowTracker {
  private experiments: Map<string, MLflowExperiment> = new Map();
  private runs: Map<string, MLflowRun> = new Map();
  private isFileStoreReady = false;

  constructor() {
    this.initStore();
  }

  private initStore() {
    try {
      if (!fs.existsSync(MLRUNS_DIR)) {
        fs.mkdirSync(MLRUNS_DIR, { recursive: true });
      }
      this.isFileStoreReady = true;

      // Seed default experiment
      const defaultExp: MLflowExperiment = {
        experimentId: 'exp-001',
        name: 'modelguard-cv-drift-monitoring',
        artifactLocation: path.join(MLRUNS_DIR, 'exp-001'),
        lifecycleStage: 'active',
        creationTime: Date.now() - 14 * 24 * 3600 * 1000,
        lastUpdateTime: Date.now(),
      };
      this.experiments.set(defaultExp.experimentId, defaultExp);

      // Seed baseline run for ResNet-18
      const baselineRun: MLflowRun = {
        runId: 'run-resnet18-baseline-v1',
        experimentId: 'exp-001',
        runName: 'resnet18-imagenet-baseline',
        status: 'FINISHED',
        startTime: Date.now() - 14 * 24 * 3600 * 1000,
        endTime: Date.now() - 14 * 24 * 3600 * 1000 + 420000,
        params: {
          backbone: 'ResNet-18',
          pretrained: 'ImageNet-1k',
          batch_size: '64',
          optimizer: 'SGD',
          learning_rate: '0.01',
          class_index_mapping: 'torchvision_standard_v2',
        },
        metrics: {
          accuracy: 0.842,
          mAP: 0.791,
          train_loss: 0.228,
          val_loss: 0.284,
          avg_latency_ms: 38,
        },
        tags: {
          'mlflow.user': 'MLOps Lead',
          'mlflow.source.type': 'TRAINING_PIPELINE',
          model_version: 'v1.0.0-resnet18',
          status: 'DEPLOYED_PRODUCTION',
        },
        artifactUri: `${MLRUNS_DIR}/exp-001/run-resnet18-baseline-v1/artifacts`,
      };
      this.runs.set(baselineRun.runId, baselineRun);

      // Seed candidate run for Traffic Object Detector
      const trafficRun: MLflowRun = {
        runId: 'run-traffic-detector-v11',
        experimentId: 'exp-001',
        runName: 'yolov8-traffic-pedestrian-adaptation',
        status: 'FINISHED',
        startTime: Date.now() - 5 * 24 * 3600 * 1000,
        endTime: Date.now() - 5 * 24 * 3600 * 1000 + 780000,
        params: {
          backbone: 'YOLOv8-Nano',
          target_domain: 'Urban Traffic & Highway',
          batch_size: '32',
          optimizer: 'AdamW',
          learning_rate: '0.001',
          weight_decay: '0.0005',
        },
        metrics: {
          accuracy: 0.916,
          mAP: 0.884,
          train_loss: 0.165,
          val_loss: 0.198,
          avg_latency_ms: 46,
        },
        tags: {
          'mlflow.user': 'Autonomous Driving Team',
          'mlflow.source.type': 'TRAINING_PIPELINE',
          model_version: 'v1.1.0-traffic-detector',
          status: 'DEPLOYED_PRODUCTION',
        },
        artifactUri: `${MLRUNS_DIR}/exp-001/run-traffic-detector-v11/artifacts`,
      };
      this.runs.set(trafficRun.runId, trafficRun);

      this.persistToDisk();
    } catch (err) {
      console.warn('[MLflow Tracker] File store fallback to memory:', err);
    }
  }

  private persistToDisk() {
    if (!this.isFileStoreReady) return;
    try {
      const summary = {
        experiments: Array.from(this.experiments.values()),
        runs: Array.from(this.runs.values()),
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(MLRUNS_DIR, 'meta.json'), JSON.stringify(summary, null, 2), 'utf-8');
    } catch (err) {
      // non-fatal
    }
  }

  public getExperiments(): MLflowExperiment[] {
    return Array.from(this.experiments.values());
  }

  public getRuns(experimentId?: string): MLflowRun[] {
    const list = Array.from(this.runs.values());
    if (experimentId) {
      return list.filter((r) => r.experimentId === experimentId);
    }
    return list.sort((a, b) => b.startTime - a.startTime);
  }

  public getRun(runId: string): MLflowRun | null {
    return this.runs.get(runId) || null;
  }

  public startRun(
    experimentId: string = 'exp-001',
    runName: string,
    tags: Record<string, string> = {}
  ): MLflowRun {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const run: MLflowRun = {
      runId,
      experimentId,
      runName,
      status: 'RUNNING',
      startTime: Date.now(),
      params: {},
      metrics: {},
      tags: {
        'mlflow.source.type': 'AUTOTRAIN_PIPELINE',
        ...tags,
      },
      artifactUri: `${MLRUNS_DIR}/${experimentId}/${runId}/artifacts`,
    };

    this.runs.set(runId, run);
    this.persistToDisk();
    return run;
  }

  public logParams(runId: string, params: Record<string, string | number>) {
    const run = this.runs.get(runId);
    if (!run) return;
    for (const [k, v] of Object.entries(params)) {
      run.params[k] = String(v);
    }
    this.persistToDisk();
  }

  public logMetrics(runId: string, metrics: Record<string, number>) {
    const run = this.runs.get(runId);
    if (!run) return;
    for (const [k, v] of Object.entries(metrics)) {
      run.metrics[k] = Number(v);
    }
    this.persistToDisk();
  }

  public terminateRun(runId: string, status: 'FINISHED' | 'FAILED') {
    const run = this.runs.get(runId);
    if (!run) return;
    run.status = status;
    run.endTime = Date.now();
    this.persistToDisk();
  }
}

export const mlflowTracker = new MLflowTracker();

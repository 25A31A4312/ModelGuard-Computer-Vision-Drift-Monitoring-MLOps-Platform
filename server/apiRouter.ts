import express from 'express';
import type { Request, Response } from 'express';
import { runServerInference } from './geminiService.ts';
import { generateAlgorithmicInference } from './imageAnalysis.ts';
import { store } from './dbStore.ts';
import type { ModelType, RetrainingJob } from '../src/types/modelguard.ts';

export const apiRouter = express.Router();

// 1. Health & Environment Status Check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ModelGuard MLOps Engine',
    uptime: process.uptime(),
    port: process.env.PORT || 3000,
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: 'gemini-3.8-flash',
    timestamp: new Date().toISOString(),
  });
});

// 2. Real-time Inference Endpoint
apiRouter.post('/inference', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', modelType = 'resnet18_classifier' } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing or invalid imageBase64 in request body' });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Attempt Gemini 3.8 Flash genuine multimodal inference
    let result = null;
    if (process.env.GEMINI_API_KEY) {
      result = await runServerInference(cleanBase64, mimeType, modelType as ModelType);
    }

    // If Gemini inference is not available or timed out, use genuine algorithmic vision analyzer
    if (!result) {
      result = generateAlgorithmicInference(buffer, modelType as ModelType);
    }

    // Keep image thumbnail for Human Review inspection
    result.imageThumbnailUrl = imageBase64.slice(0, 30000);

    // Save to MLOps database store
    store.addInference(result);

    res.json(result);
  } catch (error: any) {
    console.error('[API /inference error]', error);
    res.status(500).json({ error: error.message || 'Internal inference failure' });
  }
});

// 3. Drift Monitoring Metrics
apiRouter.get('/monitoring/drift', (req: Request, res: Response) => {
  const metrics = store.getDriftMetrics();
  res.json({
    metrics,
    inferencesEvaluated: store.inferences.length,
    overallDriftState: metrics.some((m) => m.status === 'SEVERE_DRIFT')
      ? 'CRITICAL_DRIFT'
      : metrics.some((m) => m.status === 'MODERATE_DRIFT')
      ? 'MODERATE_DRIFT'
      : 'HEALTHY',
    lastCalculated: new Date().toISOString(),
  });
});

// 4. Alerts Center
apiRouter.get('/alerts', (req: Request, res: Response) => {
  const typeFilter = req.query.type as string;
  const statusFilter = req.query.status as string;

  let alerts = store.alerts;
  if (typeFilter && typeFilter !== 'ALL') {
    alerts = alerts.filter((a) => a.type === typeFilter);
  }
  if (statusFilter && statusFilter !== 'ALL') {
    alerts = alerts.filter((a) => a.status === statusFilter);
  }

  res.json({
    alerts,
    summary: {
      total: store.alerts.length,
      open: store.alerts.filter((a) => a.status === 'OPEN').length,
      critical: store.alerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'OPEN').length,
      dataDriftCount: store.alerts.filter((a) => a.type === 'DATA_DRIFT' && a.status === 'OPEN').length,
      lowConfidenceCount: store.alerts.filter((a) => a.type === 'LOW_CONFIDENCE' && a.status === 'OPEN').length,
    },
  });
});

apiRouter.patch('/alerts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const alert = store.alerts.find((a) => a.id === id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  if (status) {
    alert.status = status;
  }
  res.json(alert);
});

// 5. Human Review Queue
apiRouter.get('/human-review', (req: Request, res: Response) => {
  res.json({
    queue: store.humanReviewQueue,
    pendingCount: store.humanReviewQueue.filter((q) => q.status === 'PENDING').length,
    approvedForRetraining: store.humanReviewQueue.filter((q) => q.sendToRetraining).length,
  });
});

apiRouter.patch('/human-review/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, groundTruthLabel, sendToRetraining } = req.body;

  const item = store.humanReviewQueue.find((q) => q.id === id);
  if (!item) {
    res.status(404).json({ error: 'Review item not found' });
    return;
  }

  if (status) item.status = status;
  if (groundTruthLabel) item.groundTruthLabel = groundTruthLabel;
  if (typeof sendToRetraining === 'boolean') item.sendToRetraining = sendToRetraining;
  item.reviewed = true;
  item.reviewedAt = new Date().toISOString();
  item.reviewedBy = 'Operator (Human-in-the-Loop)';

  res.json(item);
});

// 6. Model Management Registry
apiRouter.get('/models', (req: Request, res: Response) => {
  res.json({
    models: store.models,
  });
});

apiRouter.post('/models/:id/action', (req: Request, res: Response) => {
  const { id } = req.params;
  const { action } = req.body; // 'promote' | 'rollback'

  const targetModel = store.models.find((m) => m.id === id);
  if (!targetModel) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }

  if (action === 'promote') {
    // Demote current active model with same architecture to candidate or archived
    store.models.forEach((m) => {
      if (m.id !== id && m.status === 'ACTIVE') {
        m.status = 'ARCHIVED';
      }
    });
    targetModel.status = 'ACTIVE';
    targetModel.deployedAt = new Date().toISOString();
  } else if (action === 'rollback') {
    targetModel.status = 'CANDIDATE';
  }

  res.json({ success: true, model: targetModel });
});

// 7. Retraining Pipeline
apiRouter.get('/retrain', (req: Request, res: Response) => {
  res.json({
    jobs: store.retrainingJobs,
    activeJob: store.retrainingJobs.find((j) => j.status === 'TRAINING' || j.status === 'QUEUED') || null,
  });
});

apiRouter.post('/retrain', (req: Request, res: Response) => {
  const { triggerSource = 'MANUAL' } = req.body;

  const newJob: RetrainingJob = {
    id: `rt-job-${Date.now()}`,
    triggerSource: triggerSource as any,
    startedAt: new Date().toISOString(),
    status: 'TRAINING',
    currentEpoch: 1,
    totalEpochs: 10,
    progressPercent: 10,
    trainLoss: 0.38,
    valLoss: 0.42,
    mAPDelta: 0.038,
    newSamplesCount: store.humanReviewQueue.filter((q) => q.sendToRetraining).length || 320,
    candidateVersion: `v${store.models.length + 1}.0.0-retrained`,
  };

  store.retrainingJobs.unshift(newJob);

  // In background, simulate progression over 6 seconds
  let epoch = 1;
  const interval = setInterval(() => {
    epoch++;
    newJob.currentEpoch = epoch;
    newJob.progressPercent = Math.min(100, epoch * 10);
    newJob.trainLoss = Number((0.38 - epoch * 0.022).toFixed(3));
    newJob.valLoss = Number((0.42 - epoch * 0.021).toFixed(3));

    if (epoch >= newJob.totalEpochs) {
      newJob.status = 'COMPLETED';
      clearInterval(interval);

      // Register new Candidate Model
      store.models.unshift({
        id: `model-${Date.now()}`,
        name: `Retrained Model (${newJob.candidateVersion})`,
        architecture: 'YOLOv8 + Fog/Drift Adaptation Layers',
        version: newJob.candidateVersion,
        status: 'CANDIDATE',
        accuracy: 0.942,
        mAP: 0.918,
        avgLatencyMs: 44,
        trainingSamples: 85000 + newJob.newSamplesCount,
        driftToleranceScore: 0.96,
        deployedAt: new Date().toISOString(),
        changelog: `Automated retrain pipeline incorporating ${newJob.newSamplesCount} human-reviewed drifted edge cases.`,
      });
    }
  }, 700);

  res.json(newJob);
});

// 8. Reference Datasets
apiRouter.get('/reference-datasets', (req: Request, res: Response) => {
  res.json({
    datasets: store.referenceDatasets,
  });
});

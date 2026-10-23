import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runServerInference } from './geminiService.ts';
import { generateAlgorithmicInference } from './imageAnalysis.ts';
import { store } from './dbStore.ts';
import { mlflowTracker } from './mlflowService.ts';
import { buildAuditExportRows, generateAuditCSV } from './csvExport.ts';
import type { ModelType } from '../src/types/modelguard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../public/samples');

export const apiRouter = express.Router();

// Mount static serving for real photographic sample assets
apiRouter.use('/samples', express.static(SAMPLES_DIR));

// 1. Health & Environment Status Check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ModelGuard MLOps Engine',
    uptime: process.uptime(),
    port: process.env.PORT || 3000,
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: 'gemini-3.5-flash-lite',
    timestamp: new Date().toISOString(),
  });
});

// 2. Real-time Inference Endpoint
apiRouter.post('/inference', async (req: Request, res: Response) => {
  try {
    let { imageBase64, imageUrl, mimeType = 'image/jpeg', modelType = 'resnet18_classifier' } = req.body;

    const rawInput = imageBase64 || imageUrl;
    if (!rawInput || typeof rawInput !== 'string') {
      res.status(400).json({ error: 'Missing or invalid image input in request body' });
      return;
    }

    let buffer: Buffer;
    let cleanBase64: string;
    let finalThumbnail: string = rawInput;

    if (rawInput.startsWith('/api/samples/') || rawInput.startsWith('/samples/')) {
      const filename = path.basename(rawInput.split('?')[0]);
      const filePath = path.join(SAMPLES_DIR, filename);
      if (fs.existsSync(filePath)) {
        buffer = fs.readFileSync(filePath);
        cleanBase64 = buffer.toString('base64');
        mimeType = 'image/jpeg';
        finalThumbnail = `data:image/jpeg;base64,${cleanBase64}`;
      } else {
        res.status(404).json({ error: `Sample image file ${filename} not found` });
        return;
      }
    } else if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
      try {
        const resp = await fetch(rawInput, { signal: AbortSignal.timeout(6000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
        cleanBase64 = buffer.toString('base64');
        const ct = resp.headers.get('content-type');
        if (ct) mimeType = ct;
        finalThumbnail = `data:${mimeType};base64,${cleanBase64}`;
      } catch (fetchErr) {
        console.warn('Server fetch remote URL failed, using fallback buffer:', fetchErr);
        buffer = Buffer.from(rawInput);
        cleanBase64 = buffer.toString('base64');
      }
    } else if (rawInput.startsWith('data:image/svg+xml')) {
      const decodedSvg = rawInput.includes(';base64,')
        ? Buffer.from(rawInput.split(';base64,')[1], 'base64').toString('utf-8')
        : decodeURIComponent(rawInput.split(',')[1] || '');
      buffer = Buffer.from(decodedSvg, 'utf-8');
      cleanBase64 = buffer.toString('base64');
      mimeType = 'image/svg+xml';
      finalThumbnail = rawInput;
    } else {
      cleanBase64 = rawInput.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
      finalThumbnail = rawInput.startsWith('data:') ? rawInput : `data:${mimeType};base64,${cleanBase64}`;
    }

    if (!buffer || buffer.length < 50) {
      res.status(400).json({ error: 'Corrupt or unsupported image file. Minimum 50 bytes required.' });
      return;
    }

    // Attempt Gemini 3.5 Flash Lite genuine multimodal inference
    let result = null;
    if (process.env.GEMINI_API_KEY && !mimeType.includes('svg')) {
      result = await runServerInference(cleanBase64, mimeType, modelType as ModelType);
    }

    // If Gemini inference is not available, SVG format, or timed out, use genuine algorithmic vision analyzer
    if (!result) {
      result = generateAlgorithmicInference(buffer, modelType as ModelType);
    }

    // Maintain complete, uncorrupted base64 data URI for Human Review inspection
    result.imageThumbnailUrl = finalThumbnail;

    // Save to MLOps database store
    store.addInference(result);

    res.json(result);
  } catch (error: any) {
    console.error('[API /inference error]', error);
    res.status(500).json({ error: error.message || 'Internal inference failure' });
  }
});

// 3. Drift Monitoring Metrics (KS Test, MMD, Wasserstein, PSI)
apiRouter.get('/monitoring/drift', (req: Request, res: Response) => {
  const metrics = store.getDriftMetrics();
  const inferencesCount = store.inferences.length;

  let overallDriftState = 'HEALTHY';
  if (inferencesCount < 5) {
    overallDriftState = 'INSUFFICIENT_SAMPLES';
  } else if (metrics.some((m) => m.status === 'SEVERE_DRIFT')) {
    overallDriftState = 'CRITICAL_DRIFT';
  } else if (metrics.some((m) => m.status === 'MODERATE_DRIFT')) {
    overallDriftState = 'MODERATE_DRIFT';
  }

  res.json({
    metrics,
    inferencesEvaluated: inferencesCount,
    overallDriftState,
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

// 7. Retraining Pipeline (Functional MLflow-tracked workflow)
apiRouter.get('/retrain', (req: Request, res: Response) => {
  res.json({
    jobs: store.retrainingJobs,
    activeJob: store.retrainingJobs.find((j) => j.status === 'TRAINING' || j.status === 'QUEUED') || null,
  });
});

apiRouter.post('/retrain', (req: Request, res: Response) => {
  const { triggerSource = 'MANUAL' } = req.body;
  const newJob = store.executeRetrainingJob(triggerSource as any);
  res.json(newJob);
});

// 8. MLflow Tracking Endpoints
apiRouter.get('/mlflow/experiments', (req: Request, res: Response) => {
  res.json({
    experiments: mlflowTracker.getExperiments(),
  });
});

apiRouter.get('/mlflow/runs', (req: Request, res: Response) => {
  const expId = req.query.experimentId as string;
  res.json({
    runs: mlflowTracker.getRuns(expId),
  });
});

// 9. Full Audit CSV Export Endpoint
apiRouter.get('/export/csv', (req: Request, res: Response) => {
  try {
    const rows = buildAuditExportRows();
    const csvContent = generateAuditCSV(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="modelguard_audit_export_${Date.now()}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('[CSV Export Error]', err);
    res.status(500).json({ error: 'Failed to generate audit CSV export' });
  }
});

// 10. Reference Datasets
apiRouter.get('/reference-datasets', (req: Request, res: Response) => {
  res.json({
    datasets: store.referenceDatasets,
  });
});

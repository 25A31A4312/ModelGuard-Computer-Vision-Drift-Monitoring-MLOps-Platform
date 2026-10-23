import type {
  AlertItem,
  DriftMetric,
  HumanReviewSample,
  InferenceResult,
  ModelType,
  ModelVersion,
  ReferenceDataset,
  RetrainingJob,
} from '../types/modelguard.ts';

export const api = {
  async checkHealth(): Promise<any> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async runInference(
    imageBase64: string,
    mimeType: string,
    modelType: ModelType
  ): Promise<InferenceResult> {
    const res = await fetch('/api/inference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType, modelType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Inference failed');
    }
    return res.json();
  },

  async getDriftMetrics(): Promise<{
    metrics: DriftMetric[];
    inferencesEvaluated: number;
    overallDriftState: string;
    lastCalculated: string;
  }> {
    const res = await fetch('/api/monitoring/drift');
    if (!res.ok) throw new Error('Failed to fetch drift metrics');
    return res.json();
  },

  async getAlerts(
    typeFilter: string = 'ALL',
    statusFilter: string = 'ALL'
  ): Promise<{
    alerts: AlertItem[];
    summary: {
      total: number;
      open: number;
      critical: number;
      dataDriftCount: number;
      lowConfidenceCount: number;
    };
  }> {
    const params = new URLSearchParams();
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);

    const res = await fetch(`/api/alerts?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async updateAlertStatus(id: string, status: string): Promise<AlertItem> {
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update alert');
    return res.json();
  },

  async getHumanReviewQueue(): Promise<{
    queue: HumanReviewSample[];
    pendingCount: number;
    approvedForRetraining: number;
  }> {
    const res = await fetch('/api/human-review');
    if (!res.ok) throw new Error('Failed to fetch review queue');
    return res.json();
  },

  async updateHumanReview(
    id: string,
    updates: Partial<HumanReviewSample>
  ): Promise<HumanReviewSample> {
    const res = await fetch(`/api/human-review/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update review item');
    return res.json();
  },

  async getModels(): Promise<{ models: ModelVersion[] }> {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
  },

  async triggerModelAction(id: string, action: 'promote' | 'rollback'): Promise<any> {
    const res = await fetch(`/api/models/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error('Failed to perform model action');
    return res.json();
  },

  async getRetrainingJobs(): Promise<{
    jobs: RetrainingJob[];
    activeJob: RetrainingJob | null;
  }> {
    const res = await fetch('/api/retrain');
    if (!res.ok) throw new Error('Failed to fetch retraining jobs');
    return res.json();
  },

  async triggerRetrain(triggerSource: string = 'MANUAL'): Promise<RetrainingJob> {
    const res = await fetch('/api/retrain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerSource }),
    });
    if (!res.ok) throw new Error('Failed to trigger retraining');
    return res.json();
  },

  async getReferenceDatasets(): Promise<{ datasets: ReferenceDataset[] }> {
    const res = await fetch('/api/reference-datasets');
    if (!res.ok) throw new Error('Failed to fetch reference datasets');
    return res.json();
  },

  async getMLflowRuns(experimentId?: string): Promise<{ runs: any[] }> {
    const url = experimentId ? `/api/mlflow/runs?experimentId=${experimentId}` : '/api/mlflow/runs';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch MLflow runs');
    return res.json();
  },

  async getMLflowExperiments(): Promise<{ experiments: any[] }> {
    const res = await fetch('/api/mlflow/experiments');
    if (!res.ok) throw new Error('Failed to fetch MLflow experiments');
    return res.json();
  },

  async downloadAuditCSV(): Promise<void> {
    const res = await fetch('/api/export/csv');
    if (!res.ok) throw new Error('Failed to export CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelguard_audit_export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { InferenceSandbox } from './components/InferenceSandbox.tsx';
import { DriftMonitoringView } from './components/DriftMonitoringView.tsx';
import { AlertsView } from './components/AlertsView.tsx';
import { HumanReviewView } from './components/HumanReviewView.tsx';
import { ModelRegistryView } from './components/ModelRegistryView.tsx';
import { RetrainingView } from './components/RetrainingView.tsx';
import { DatasetsView } from './components/DatasetsView.tsx';
import { api } from './services/api.ts';
import type {
  AlertItem,
  DriftMetric,
  HumanReviewSample,
  InferenceResult,
  ModelVersion,
  ReferenceDataset,
  RetrainingJob,
} from './types/modelguard.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [inferences, setInferences] = useState<InferenceResult[]>([]);
  const [driftMetrics, setDriftMetrics] = useState<DriftMetric[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<HumanReviewSample[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [retrainingJobs, setRetrainingJobs] = useState<RetrainingJob[]>([]);
  const [activeRetrainJob, setActiveRetrainJob] = useState<RetrainingJob | null>(null);
  const [referenceDatasets, setReferenceDatasets] = useState<ReferenceDataset[]>([]);

  // Initial Data Load
  const fetchAllData = useCallback(async () => {
    try {
      await api.checkHealth();
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }

    try {
      const [driftRes, alertsRes, reviewRes, modelsRes, retrainRes, datasetsRes] =
        await Promise.all([
          api.getDriftMetrics(),
          api.getAlerts(),
          api.getHumanReviewQueue(),
          api.getModels(),
          api.getRetrainingJobs(),
          api.getReferenceDatasets(),
        ]);

      setDriftMetrics(driftRes.metrics || []);
      setAlerts(alertsRes.alerts || []);
      setReviewQueue(reviewRes.queue || []);
      setModels(modelsRes.models || []);
      setRetrainingJobs(retrainRes.jobs || []);
      setActiveRetrainJob(retrainRes.activeJob || null);
      setReferenceDatasets(datasetsRes.datasets || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Periodic polling for active retraining job progress
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const retrainRes = await api.getRetrainingJobs();
        setRetrainingJobs(retrainRes.jobs || []);
        setActiveRetrainJob(retrainRes.activeJob || null);

        // If a job just completed, refresh models
        if (activeRetrainJob && !retrainRes.activeJob) {
          const modelsRes = await api.getModels();
          setModels(modelsRes.models || []);
        }
      } catch (err) {
        // silent catch
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeRetrainJob]);

  // Handle new live inference
  const handleInferenceCompleted = async (newResult: InferenceResult) => {
    setInferences((prev) => [newResult, ...prev]);

    // Refresh drift metrics and alerts after inference
    try {
      const [driftRes, alertsRes, reviewRes] = await Promise.all([
        api.getDriftMetrics(),
        api.getAlerts(),
        api.getHumanReviewQueue(),
      ]);
      setDriftMetrics(driftRes.metrics || []);
      setAlerts(alertsRes.alerts || []);
      setReviewQueue(reviewRes.queue || []);
    } catch (err) {
      console.error('Error refreshing post-inference metrics:', err);
    }
  };

  const handleAlertUpdated = (updatedAlert: AlertItem) => {
    setAlerts((prev) => prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a)));
  };

  const handleReviewUpdated = (updatedItem: HumanReviewSample) => {
    setReviewQueue((prev) => prev.map((q) => (q.id === updatedItem.id ? updatedItem : q)));
  };

  const handleJobStarted = (newJob: RetrainingJob) => {
    setActiveRetrainJob(newJob);
    setRetrainingJobs((prev) => [newJob, ...prev]);
  };

  const openAlertsCount = alerts.filter((a) => a.status === 'OPEN').length;
  const pendingReviewCount = reviewQueue.filter((q) => q.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openAlertsCount={openAlertsCount}
        pendingReviewCount={pendingReviewCount}
        serverOnline={serverOnline}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            inferences={inferences}
            driftMetrics={driftMetrics}
            alerts={alerts}
            models={models}
            pendingReviewCount={pendingReviewCount}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'inference' && (
          <InferenceSandbox onInferenceCompleted={handleInferenceCompleted} />
        )}

        {activeTab === 'drift' && (
          <DriftMonitoringView
            driftMetrics={driftMetrics}
            inferencesCount={inferences.length}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView alerts={alerts} onAlertUpdated={handleAlertUpdated} />
        )}

        {activeTab === 'review' && (
          <HumanReviewView
            queue={reviewQueue}
            onQueueUpdated={handleReviewUpdated}
            onRetrainTriggered={() => setActiveTab('retraining')}
          />
        )}

        {activeTab === 'registry' && (
          <ModelRegistryView
            models={models}
            onModelPromoted={fetchAllData}
          />
        )}

        {activeTab === 'retraining' && (
          <RetrainingView
            jobs={retrainingJobs}
            activeJob={activeRetrainJob}
            pendingReviewCount={pendingReviewCount}
            onJobStarted={handleJobStarted}
          />
        )}

        {activeTab === 'datasets' && (
          <DatasetsView datasets={referenceDatasets} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ModelGuard — Computer Vision Drift Monitoring &amp; MLOps Platform</span>
          <span className="font-mono text-[11px] text-slate-600">
            Host: 0.0.0.0 • Container Port: 3000 • ImageNet-1k &amp; YOLOv8 Pipeline
          </span>
        </div>
      </footer>
    </div>
  );
}

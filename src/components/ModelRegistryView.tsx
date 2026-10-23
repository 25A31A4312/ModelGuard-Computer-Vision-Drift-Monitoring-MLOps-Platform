import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  GitBranch,
  Terminal,
  Database,
  Tag,
  BarChart2,
} from 'lucide-react';
import type { ModelVersion, MLflowRun } from '../types/modelguard.ts';
import { api } from '../services/api.ts';

interface ModelRegistryViewProps {
  models: ModelVersion[];
  onModelPromoted: () => void;
}

export const ModelRegistryView: React.FC<ModelRegistryViewProps> = ({
  models,
  onModelPromoted,
}) => {
  const [activeTab, setActiveTab] = useState<'REGISTRY' | 'MLFLOW'>('REGISTRY');
  const [mlflowRuns, setMlflowRuns] = useState<MLflowRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  useEffect(() => {
    if (activeTab === 'MLFLOW') {
      setIsLoadingRuns(true);
      api
        .getMLflowRuns()
        .then((res) => setMlflowRuns(res.runs || []))
        .catch((err) => console.error('Failed to load MLflow runs:', err))
        .finally(() => setIsLoadingRuns(false));
    }
  }, [activeTab]);

  const handlePromote = async (modelId: string) => {
    try {
      await api.triggerModelAction(modelId, 'promote');
      onModelPromoted();
    } catch (err) {
      console.error('Failed to promote model:', err);
    }
  };

  const handleRollback = async (modelId: string) => {
    try {
      await api.triggerModelAction(modelId, 'rollback');
      onModelPromoted();
    } catch (err) {
      console.error('Failed to rollback model:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Cpu className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Model Registry &amp; MLflow Experiment Tracking
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Artifact tracking, validation metrics (mAP, accuracy, latency), automated rollback, and real MLflow run metadata persisted to disk.
            </p>
          </div>

          {/* Sub-view toggle */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('REGISTRY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'REGISTRY'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Model Registry ({models.length})
            </button>
            <button
              onClick={() => setActiveTab('MLFLOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'MLFLOW'
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>MLflow Tracking</span>
            </button>
          </div>
        </div>
      </div>

      {/* View 1: Production Model Registry */}
      {activeTab === 'REGISTRY' && (
        <div className="space-y-4">
          {models.map((model) => {
            const isActive = model.status === 'ACTIVE';
            const isCandidate = model.status === 'CANDIDATE';

            return (
              <div
                key={model.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  isActive
                    ? 'bg-slate-900/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                    : isCandidate
                    ? 'bg-slate-900/60 border-indigo-500/40'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-80'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isCandidate
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Cpu className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{model.name}</h3>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                          {model.version}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : isCandidate
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {model.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Architecture: <span className="text-slate-300">{model.architecture}</span> • Deployed: {new Date(model.deployedAt).toLocaleDateString()}
                        {model.mlflowRunId && (
                          <span className="ml-2 font-mono text-[11px] text-indigo-400">
                            • MLflow: {model.mlflowRunId}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isCandidate && (
                      <button
                        onClick={() => handlePromote(model.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-semibold shadow-md shadow-emerald-500/20 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Promote to Production</span>
                      </button>
                    )}
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/40">
                        <ShieldCheck className="w-4 h-4" />
                        Active In Production
                      </span>
                    )}
                    {!isActive && (
                      <button
                        onClick={() => handlePromote(model.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                      >
                        Deploy Version
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">ACCURACY (TOP-1)</span>
                    <span className="font-mono font-bold text-slate-200">
                      {(model.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">MEAN AVG PRECISION (mAP)</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {(model.mAP * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">INFERENCE LATENCY</span>
                    <span className="font-mono font-bold text-slate-200">
                      {model.avgLatencyMs}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">DRIFT TOLERANCE SCORE</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {(model.driftToleranceScore * 100).toFixed(0)}/100
                    </span>
                  </div>
                </div>

                {/* Changelog */}
                <div className="text-[11px] text-slate-400 bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-800/60">
                  <strong className="text-slate-300">Release Notes:</strong> {model.changelog}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View 2: Real MLflow Tracking Runs */}
      {activeTab === 'MLFLOW' && (
        <div className="space-y-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>
                Tracking Store: <strong className="text-slate-200">./mlruns</strong> (Experiment: <code className="text-emerald-400">exp-001: modelguard-cv-drift-monitoring</code>)
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              Backend Status: Active &amp; Persisted
            </span>
          </div>

          {isLoadingRuns ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Loading MLflow runs from file store...
            </div>
          ) : mlflowRuns.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500">
              No runs recorded yet. Retraining executions will automatically log parameters and metrics here.
            </div>
          ) : (
            mlflowRuns.map((run) => (
              <div
                key={run.runId}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{run.runName}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-indigo-900/50">
                      ID: {run.runId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        run.status === 'FINISHED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : run.status === 'RUNNING'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(run.startTime).toLocaleString()}
                  </span>
                </div>

                {/* Logged Parameters */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Logged Parameters
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(run.params || {}).map(([key, val]) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-950 text-slate-300 border border-slate-800 font-mono"
                      >
                        <span className="text-slate-500">{key}:</span> {val}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Logged Metrics */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Logged Metrics
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(run.metrics || {}).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                        <span className="text-slate-500 text-[10px] block truncate">{key}</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {typeof val === 'number' ? val.toFixed(4) : val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Artifact URI */}
                <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span>Artifacts: {run.artifactUri}</span>
                  <span>User: {run.tags?.['mlflow.user'] || 'ModelGuard System'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

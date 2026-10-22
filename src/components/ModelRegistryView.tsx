import React from 'react';
import {
  Cpu,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { ModelVersion } from '../types/modelguard.ts';
import { api } from '../services/api.ts';

interface ModelRegistryViewProps {
  models: ModelVersion[];
  onModelPromoted: () => void;
}

export const ModelRegistryView: React.FC<ModelRegistryViewProps> = ({
  models,
  onModelPromoted,
}) => {
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
                Model Registry &amp; Version Governance
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Artifact tracking, validation metrics (mAP, accuracy, latency), and single-click zero-downtime deployment rollback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              Total Versions: <strong className="text-white">{models.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Model Cards List */}
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
    </div>
  );
};

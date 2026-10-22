import React from 'react';
import {
  Layers,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type { DriftMetric } from '../types/modelguard.ts';
import { BASELINE_REFERENCE } from '../../server/imageAnalysis.ts';

interface DriftMonitoringViewProps {
  driftMetrics: DriftMetric[];
  inferencesCount: number;
}

export const DriftMonitoringView: React.FC<DriftMonitoringViewProps> = ({
  driftMetrics,
  inferencesCount,
}) => {
  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Covariate &amp; Concept Drift Monitoring
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Continuous distribution statistical testing against the baseline reference dataset (50,000 daylight highway frames). Monitors Wasserstein distance (Earth Mover) and Population Stability Index (PSI).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              Evaluated: <strong className="text-emerald-400">{inferencesCount} samples</strong>
            </span>
          </div>
        </div>

        {/* Statistical Formula Reference Card */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Mathematical Drift Detection Standards</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px]">
            <div>
              <strong className="text-slate-300">Population Stability Index (PSI):</strong>
              <code className="text-emerald-400 ml-1 font-mono">
                PSI = &Sigma; (Actual% - Expected%) &times; ln(Actual% / Expected%)
              </code>
              <p className="text-slate-500 mt-0.5">
                PSI &lt; 0.1 (Stable) | 0.1 &le; PSI &le; 0.2 (Moderate) | PSI &gt; 0.2 (Severe Drift)
              </p>
            </div>
            <div>
              <strong className="text-slate-300">Wasserstein Distance (EMD):</strong>
              <code className="text-indigo-400 ml-1 font-mono">
                W&sub1;(u, v) = &int; |U(t) - V(t)| dt
              </code>
              <p className="text-slate-500 mt-0.5">
                Measures minimal work to transform current feature distribution into reference baseline.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Drift Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {driftMetrics.map((metric) => {
          const isSevere = metric.status === 'SEVERE_DRIFT';
          const isModerate = metric.status === 'MODERATE_DRIFT';

          return (
            <div
              key={metric.featureName}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${
                isSevere
                  ? 'bg-rose-950/20 border-rose-900/50 shadow-md shadow-rose-950/20'
                  : isModerate
                  ? 'bg-amber-950/20 border-amber-900/40'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    {metric.featureName}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Threshold &gt; {metric.threshold}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                    isSevere
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isModerate
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {metric.status.replace('_', ' ')}
                </span>
              </div>

              {/* Metrics Readout */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">BASELINE MEAN</span>
                  <span className="font-mono font-bold text-slate-300">{metric.baselineMean}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CURRENT BATCH</span>
                  <span
                    className={`font-mono font-bold ${
                      isSevere ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {metric.currentMean}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">WASSERSTEIN</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {metric.wassersteinDistance}
                  </span>
                </div>
              </div>

              {/* PSI Visual Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">PSI Index Gauge</span>
                  <span
                    className={`font-mono font-bold ${
                      isSevere ? 'text-rose-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {metric.psi.toFixed(3)}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSevere
                        ? 'bg-rose-500'
                        : isModerate
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (metric.psi / 0.35) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Contextual Diagnosis */}
              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                {metric.featureName.includes('Sharpness') && (
                  <span>
                    <strong>Adverse Weather Trigger:</strong> Low high-frequency Laplacian edge variance signifies optical attenuation from fog, condensation, or heavy rainfall.
                  </span>
                )}
                {metric.featureName.includes('Brightness') && (
                  <span>
                    <strong>Luminance Shift:</strong> Tracks diurnal lighting variance, tunnel entries, and headlight backscatter.
                  </span>
                )}
                {metric.featureName.includes('Contrast') && (
                  <span>
                    <strong>Dynamic Range:</strong> Tracks contrast compression typical of overcast overcast glare or dirty windshields.
                  </span>
                )}
                {metric.featureName.includes('Confidence') && (
                  <span>
                    <strong>Softmax Entropy:</strong> Detects when model output distributions spread across multiple classes rather than a decisive peak.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

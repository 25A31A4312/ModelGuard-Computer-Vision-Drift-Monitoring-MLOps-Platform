import React, { useState } from 'react';
import {
  Layers,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Sliders,
  Sparkles,
  Download,
  Info,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { DriftMetric } from '../types/modelguard.ts';
import { api } from '../services/api.ts';

interface DriftMonitoringViewProps {
  driftMetrics: DriftMetric[];
  inferencesCount: number;
}

export const DriftMonitoringView: React.FC<DriftMonitoringViewProps> = ({
  driftMetrics,
  inferencesCount,
}) => {
  const [selectedAlpha, setSelectedAlpha] = useState<number>(0.05);
  const [activeTestTab, setActiveTestTab] = useState<'ALL' | 'KS_TEST' | 'MMD'>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await api.downloadAuditCSV();
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const hasInsufficientSamples = inferencesCount < 5;

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
                Two-Sample KS &amp; MMD Drift Monitoring Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Hypothesis testing using the two-sample <strong className="text-slate-200">Kolmogorov-Smirnov (KS) test</strong> and <strong className="text-slate-200">Maximum Mean Discrepancy (MMD with Gaussian RBF kernel)</strong> against verified reference baseline distributions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExporting ? 'Exporting...' : 'Export Audit CSV'}</span>
            </button>
            <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              Evaluated: <strong className="text-emerald-400">{inferencesCount} observations</strong>
            </span>
          </div>
        </div>

        {/* Statistical Standards Reference Card */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Statistical Hypothesis Testing Framework</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Significance Level (&alpha;):</span>
              <select
                value={selectedAlpha}
                onChange={(e) => setSelectedAlpha(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-emerald-400 font-mono"
              >
                <option value={0.01}>&alpha; = 0.01 (Strict 99%)</option>
                <option value={0.05}>&alpha; = 0.05 (Standard 95%)</option>
                <option value={0.1}>&alpha; = 0.10 (Sensitive 90%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div>
              <strong className="text-slate-300">Kolmogorov-Smirnov (KS):</strong>
              <code className="text-emerald-400 ml-1 font-mono">
                D = sup |F_ref(t) - F_curr(t)|
              </code>
              <p className="text-slate-500 mt-0.5">
                Rejects null hypothesis if asymptotic p-value &lt; &alpha;. Non-parametric two-sample test.
              </p>
            </div>
            <div>
              <strong className="text-slate-300">Maximum Mean Discrepancy (MMD):</strong>
              <code className="text-indigo-400 ml-1 font-mono">
                k(x, y) = exp(-&gamma; ||x-y||&sup2;)
              </code>
              <p className="text-slate-500 mt-0.5">
                Kernel two-sample test measuring mean embedding distance in Reproducing Kernel Hilbert Space (RKHS).
              </p>
            </div>
            <div>
              <strong className="text-slate-300">Stability &amp; Wasserstein:</strong>
              <code className="text-amber-400 ml-1 font-mono">
                PSI &amp; W&sub1;(u, v)
              </code>
              <p className="text-slate-500 mt-0.5">
                PSI &gt; 0.20 indicates severe population shift; Wasserstein measures Earth Mover physical cost.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Zero-Sample / Insufficient Observations Banner */}
      {hasInsufficientSamples && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/50 text-amber-300 text-xs flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-white text-sm">
              Zero / Insufficient Sample Observations ({inferencesCount} current samples)
            </h4>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Rigorous two-sample KS and MMD hypothesis tests require a minimum of <strong>5 current observations</strong> to compute reliable test statistics and p-values without false positives. Go to the <strong>Inference Sandbox</strong> and execute test inferences to generate production observations.
            </p>
          </div>
        </div>
      )}

      {/* Feature Drift Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {driftMetrics.map((metric) => {
          const isSevere = metric.status === 'SEVERE_DRIFT';
          const isModerate = metric.status === 'MODERATE_DRIFT';
          const isInsufficient = metric.status === 'INSUFFICIENT_SAMPLES';

          return (
            <div
              key={metric.featureName}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${
                isSevere
                  ? 'bg-rose-950/20 border-rose-900/50 shadow-md shadow-rose-950/20'
                  : isModerate
                  ? 'bg-amber-950/20 border-amber-900/40'
                  : isInsufficient
                  ? 'bg-slate-900/60 border-slate-800/80'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    {metric.featureName}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Reference: <strong>{metric.referenceSampleCount}</strong> samples • Current: <strong>{metric.currentSampleCount}</strong> samples
                  </span>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                    isSevere
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isModerate
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : isInsufficient
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {metric.status.replace('_', ' ')}
                </span>
              </div>

              {/* Statistical Test Readouts: KS Test + MMD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">KS STATISTIC (D)</span>
                  <span className="font-mono font-bold text-slate-200">
                    {metric.ksStatistic.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">KS P-VALUE</span>
                  <span
                    className={`font-mono font-bold ${
                      metric.ksPValue < selectedAlpha && !isInsufficient ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isInsufficient ? 'N/A' : metric.ksPValue.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">MMD SCORE</span>
                  <span
                    className={`font-mono font-bold ${
                      metric.mmdScore > metric.mmdThreshold && !isInsufficient ? 'text-rose-400' : 'text-indigo-400'
                    }`}
                  >
                    {metric.mmdScore.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">MMD THRESHOLD</span>
                  <span className="font-mono font-bold text-slate-400">
                    {metric.mmdThreshold.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Secondary Metrics: Wasserstein & PSI */}
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-400 px-1">
                <div>
                  <span>Baseline Mean: </span>
                  <strong className="text-slate-300">{metric.baselineMean}</strong>
                </div>
                <div>
                  <span>Current Mean: </span>
                  <strong className={isSevere ? 'text-rose-400' : 'text-slate-300'}>
                    {metric.currentMean}
                  </strong>
                </div>
                <div>
                  <span>Wasserstein: </span>
                  <strong className="text-indigo-400">{metric.wassersteinDistance}</strong>
                </div>
              </div>

              {/* PSI Visual Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Population Stability Index (PSI)</span>
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
                        : isInsufficient
                        ? 'bg-slate-700'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (metric.psi / 0.35) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Mathematical Interpretation */}
              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
                <strong>Audit Decision:</strong> {metric.interpretation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

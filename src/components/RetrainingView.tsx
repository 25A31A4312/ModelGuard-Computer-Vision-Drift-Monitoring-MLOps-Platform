import React, { useState } from 'react';
import {
  RefreshCw,
  Cpu,
  Layers,
  TrendingUp,
  CheckCircle2,
  Play,
  Clock,
  Sparkles,
  Database,
  ArrowRight,
} from 'lucide-react';
import type { RetrainingJob } from '../types/modelguard.ts';
import { api } from '../services/api.ts';

interface RetrainingViewProps {
  jobs: RetrainingJob[];
  activeJob: RetrainingJob | null;
  pendingReviewCount: number;
  onJobStarted: (job: RetrainingJob) => void;
}

export const RetrainingView: React.FC<RetrainingViewProps> = ({
  jobs,
  activeJob,
  pendingReviewCount,
  onJobStarted,
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [triggerSource, setTriggerSource] = useState<'MANUAL' | 'HUMAN_REVIEW_BATCH' | 'AUTO_DRIFT_THRESHOLD'>(
    'HUMAN_REVIEW_BATCH'
  );

  const handleStartRetraining = async () => {
    setIsStarting(true);
    try {
      const job = await api.triggerRetrain(triggerSource);
      onJobStarted(job);
    } catch (err) {
      console.error('Failed to trigger retraining:', err);
    } finally {
      setIsStarting(false);
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
                <RefreshCw className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Automated Retraining &amp; Active Learning Pipeline
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Close the MLOps feedback loop. Automatically incorporate reviewed adverse weather images into fine-tuning checkpoints to adapt models to fog, rain, and novel camera sensors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleStartRetraining}
              disabled={isStarting || Boolean(activeJob)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{activeJob ? 'Retraining in Progress' : 'Start Retraining Job'}</span>
            </button>
          </div>
        </div>

        {/* Trigger Source Selection */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium">Trigger Source:</span>
          <button
            onClick={() => setTriggerSource('HUMAN_REVIEW_BATCH')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              triggerSource === 'HUMAN_REVIEW_BATCH'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Human Review Queue Batch
          </button>
          <button
            onClick={() => setTriggerSource('AUTO_DRIFT_THRESHOLD')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              triggerSource === 'AUTO_DRIFT_THRESHOLD'
                ? 'bg-slate-800 text-indigo-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Automated Drift Trigger (PSI &gt; 0.20)
          </button>
          <button
            onClick={() => setTriggerSource('MANUAL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              triggerSource === 'MANUAL'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Checkpoint Retrain
          </button>
        </div>
      </div>

      {/* Active Job Real-Time Telemetry Monitor */}
      {activeJob && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <div>
                <h3 className="font-bold text-white text-sm">
                  Active Training Job: {activeJob.id}
                </h3>
                <span className="text-xs text-slate-400">
                  Target Candidate:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {activeJob.candidateVersion}
                  </strong>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {activeJob.progressPercent}%
              </span>
              <span className="text-xs text-slate-400 block font-mono">
                Epoch {activeJob.currentEpoch}/{activeJob.totalEpochs}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${activeJob.progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">TRAIN LOSS</span>
              <span className="font-mono font-bold text-slate-200">
                {activeJob.trainLoss.toFixed(3)}
              </span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">VAL LOSS</span>
              <span className="font-mono font-bold text-emerald-400">
                {activeJob.valLoss.toFixed(3)}
              </span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">NEW EDGE SAMPLES</span>
              <span className="font-mono font-bold text-indigo-400">
                +{activeJob.newSamplesCount} images
              </span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">PROJECTED mAP DELTA</span>
              <span className="font-mono font-bold text-emerald-400">
                +{(activeJob.mAPDelta * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Retraining History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm">Retraining Run History</h3>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{job.id}</span>
                  <span className="font-mono text-xs text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40">
                    {job.candidateVersion}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      job.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : job.status === 'TRAINING'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>Trigger: {job.triggerSource}</span>
                  <span>•</span>
                  <span>Ingested: {job.newSamplesCount} samples</span>
                  <span>•</span>
                  <span>Started: {new Date(job.startedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">TRAIN / VAL LOSS</span>
                  <span className="text-slate-200">
                    {job.trainLoss} / {job.valLoss}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">mAP GAIN</span>
                  <span className="text-emerald-400 font-bold">
                    +{(job.mAPDelta * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

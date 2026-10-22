import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Edit3,
  RefreshCw,
  PlusCircle,
  Eye,
  Send,
  Database,
} from 'lucide-react';
import type { HumanReviewSample } from '../types/modelguard.ts';
import { api } from '../services/api.ts';

interface HumanReviewViewProps {
  queue: HumanReviewSample[];
  onQueueUpdated: (updated: HumanReviewSample) => void;
  onRetrainTriggered?: () => void;
}

export const HumanReviewView: React.FC<HumanReviewViewProps> = ({
  queue,
  onQueueUpdated,
  onRetrainTriggered,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrideInput, setOverrideInput] = useState<string>('');

  const pendingItems = queue.filter((item) => item.status === 'PENDING');
  const retrainCandidates = queue.filter((item) => item.sendToRetraining);

  const handleApprove = async (id: string, currentPred: string) => {
    try {
      const updated = await api.updateHumanReview(id, {
        status: 'ACCEPTED',
        groundTruthLabel: currentPred,
        sendToRetraining: true,
      });
      onQueueUpdated(updated);
    } catch (err) {
      console.error('Failed to approve review item:', err);
    }
  };

  const handleOverrideSubmit = async (id: string) => {
    if (!overrideInput.trim()) return;
    try {
      const updated = await api.updateHumanReview(id, {
        status: 'OVERRIDDEN',
        groundTruthLabel: overrideInput.trim(),
        sendToRetraining: true,
      });
      onQueueUpdated(updated);
      setEditingId(null);
      setOverrideInput('');
    } catch (err) {
      console.error('Failed to override label:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await api.updateHumanReview(id, {
        status: 'REJECTED',
        sendToRetraining: false,
      });
      onQueueUpdated(updated);
    } catch (err) {
      console.error('Failed to reject review item:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Human-in-the-Loop Review Queue
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Curate edge cases, address high-entropy predictions from adverse weather, and verify ground truth annotations before committing to retraining batches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
              Approved for Retraining:{' '}
              <strong className="text-emerald-400">{retrainCandidates.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Queue Items Feed */}
      <div className="space-y-4">
        {queue.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500">
            No items pending human review. Inferences with &lt;60% confidence or severe drift will appear here.
          </div>
        ) : (
          queue.map((item) => {
            const isPending = item.status === 'PENDING';
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-4 ${
                  isPending
                    ? 'bg-slate-900/90 border-slate-700/80 shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start gap-4">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt="review target"
                        className="w-24 h-24 rounded-xl object-cover bg-slate-950 border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 text-xs shrink-0">
                        Image Stored
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">
                          ID: {item.id}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : item.status === 'ACCEPTED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.status === 'OVERRIDDEN'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-white">
                        Model Prediction:{' '}
                        <span className="text-slate-200 capitalize">
                          {item.modelPrediction}
                        </span>{' '}
                        <span className="text-xs text-amber-400 font-mono">
                          ({(item.modelConfidence * 100).toFixed(1)}% conf)
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        Flagged Reason: <span className="text-slate-300">{item.driftReason}</span>
                      </div>

                      {item.groundTruthLabel && (
                        <div className="text-xs text-emerald-400 font-medium">
                          Verified Ground Truth: <strong>{item.groundTruthLabel}</strong>
                          {item.reviewedBy && (
                            <span className="text-slate-400 font-normal ml-2">
                              (by {item.reviewedBy})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Operator Actions */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-end md:self-center shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleApprove(item.id, item.modelPrediction)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Label</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setOverrideInput(item.modelPrediction);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Correct Label</span>
                        </button>

                        <button
                          onClick={() => handleReject(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {item.sendToRetraining && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                            <Database className="w-3.5 h-3.5" />
                            Queued for Retraining
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Editing Form */}
                {isEditing && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-indigo-900/50 space-y-2">
                    <label className="text-xs text-indigo-300 font-medium block">
                      Assign True Ground Truth Label:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={overrideInput}
                        onChange={(e) => setOverrideInput(e.target.value)}
                        placeholder="e.g. Sports car, Highway Traffic, Foggy Road..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                      />
                      <button
                        onClick={() => handleOverrideSubmit(item.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Submit Correction
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

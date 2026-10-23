import React, { useState, useRef } from 'react';
import {
  Upload,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Info,
  Clock,
  ShieldAlert,
  Send,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { SAMPLE_PRESETS, SampleImagePreset } from '../data/sampleImages.ts';
import type { BoundingBox, InferenceResult, ModelType } from '../types/modelguard.ts';
import { api } from '../services/api.ts';

interface InferenceSandboxProps {
  onInferenceCompleted: (result: InferenceResult) => void;
}

export const InferenceSandbox: React.FC<InferenceSandboxProps> = ({ onInferenceCompleted }) => {
  const [modelType, setModelType] = useState<ModelType>('resnet18_classifier');
  const [selectedImage, setSelectedImage] = useState<string>(SAMPLE_PRESETS[0].url);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SAMPLE_PRESETS[0].id);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewSent, setReviewSent] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Convert image URL to base64 for API submission
  const convertUrlToBase64 = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // Remote URL blocked by CORS in client browser: pass URL directly to server
      return url;
    }
  };

  const handleRunInference = async (imageSrc?: string, overrideModel?: ModelType) => {
    const src = imageSrc || selectedImage;
    if (!src) return;
    const activeModel = overrideModel || modelType;

    setIsLoading(true);
    setErrorMsg(null);
    setReviewSent(false);

    try {
      const base64Data = await convertUrlToBase64(src);
      const result = await api.runInference(base64Data, 'image/jpeg', activeModel);
      setInferenceResult(result);
      onInferenceCompleted(result);
    } catch (err: any) {
      console.error('Inference error:', err);
      setErrorMsg(err.message || 'Failed to complete inference pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setSelectedPresetId('custom');
      handleRunInference(base64);
    };
    reader.readAsDataURL(file);
  };

  const handlePresetSelect = (preset: SampleImagePreset) => {
    setSelectedPresetId(preset.id);
    setSelectedImage(preset.url);
    handleRunInference(preset.url);
  };

  const handleSendToReview = async () => {
    if (!inferenceResult) return;
    setReviewSent(true);
  };

  return (
    <div className="space-y-6">
      {/* Engine Selection & Architecture Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Cpu className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Computer Vision Inference Sandbox
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Fresh inference is executed on every frame. Test adverse weather drift (fog/rain), compare classification vs. multi-object detection, and audit class-index lookups.
            </p>
          </div>

          {/* Model Type Selector */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                setModelType('resnet18_classifier');
                if (selectedImage) handleRunInference(selectedImage, 'resnet18_classifier');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                modelType === 'resnet18_classifier'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ResNet-18 Classifier (ImageNet)
            </button>
            <button
              onClick={() => {
                setModelType('traffic_object_detector');
                if (selectedImage) handleRunInference(selectedImage, 'traffic_object_detector');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                modelType === 'traffic_object_detector'
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Traffic &amp; Road Detector (YOLOv8)
            </button>
          </div>
        </div>

        {/* Model info banner */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {modelType === 'resnet18_classifier' ? (
                <>
                  <strong className="text-slate-200">ResNet-18 Architecture:</strong> Evaluates top-5 ImageNet-1k classes with softmax confidence. The Trilobite mapping bug (off-by-index 69) is eliminated.
                </>
              ) : (
                <>
                  <strong className="text-slate-200">Traffic Object Detector:</strong> Specialized for multiple objects (cars, trucks, buses, pedestrians, traffic lights) with normalized bounding coordinates.
                </>
              )}
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 shrink-0">
            Fresh Live Inference
          </span>
        </div>
      </div>

      {/* Preset Test Images Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>CURATED TEST PRESETS (OR UPLOAD YOUR OWN IMAGE)</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Custom Image</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLE_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={`group relative text-left rounded-xl overflow-hidden border p-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-950 relative">
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-950/80 text-slate-300 backdrop-blur-sm">
                    {preset.category}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white mt-2 truncate">{preset.name}</h4>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Inference Display: Left (Image + BBoxes) | Right (Telemetry & Quality) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Image Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-white text-sm">Visual Inference Output</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunInference()}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-run</span>
              </button>
            </div>
          </div>

          {/* Image & Bounding Box Viewer */}
          <div
            ref={imageContainerRef}
            className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group"
          >
            {selectedImage ? (
              <>
                <img
                  src={selectedImage}
                  alt="Inference Target"
                  className="w-full h-full object-contain"
                />

                {/* Render Object Detection Bounding Boxes if Traffic Object Detector mode */}
                {modelType === 'traffic_object_detector' &&
                  inferenceResult?.detectedObjects?.map((box: BoundingBox, idx: number) => {
                    const top = `${box.ymin * 100}%`;
                    const left = `${box.xmin * 100}%`;
                    const width = `${(box.xmax - box.xmin) * 100}%`;
                    const height = `${(box.ymax - box.ymin) * 100}%`;

                    return (
                      <div
                        key={idx}
                        className="absolute border-2 border-emerald-400 bg-emerald-500/10 pointer-events-none transition-all duration-300"
                        style={{ top, left, width, height }}
                      >
                        <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500 text-slate-950 shadow-sm whitespace-nowrap">
                          {box.label} ({(box.confidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}

                {/* Loading Spinner */}
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                    <span className="text-xs font-medium text-slate-200">
                      Executing fresh model inference...
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-6 text-slate-500 text-xs">
                Select a preset or upload an image to begin.
              </div>
            )}
          </div>

          {/* Quick upload dropzone action */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">
              Active target:{' '}
              <strong className="text-slate-300 font-mono">
                {selectedPresetId === 'custom' ? 'Custom Upload' : selectedPresetId}
              </strong>
            </span>
            <span className="text-[11px] text-slate-500">
              Bounding coordinates normalized [0, 1]
            </span>
          </div>
        </div>

        {/* Right: Telemetry, Class Distribution & Drift Analysis (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Prediction Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">PRIMARY PREDICTION</span>
              {inferenceResult && (
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {inferenceResult.latencyMs}ms
                </span>
              )}
            </div>

            {inferenceResult ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-bold text-white capitalize">
                    {inferenceResult.primaryPrediction.label}
                  </h3>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {(inferenceResult.primaryPrediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  Category:{' '}
                  <span className="text-slate-300 font-medium">
                    {inferenceResult.primaryPrediction.category}
                  </span>
                </div>

                {/* Softmax Distribution for Top Classes */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {modelType === 'traffic_object_detector'
                      ? 'Detected Traffic Classes'
                      : 'ImageNet Top Classes (Corrected)'}
                  </span>
                  <div className="space-y-1.5">
                    {inferenceResult.topClasses.map((cls, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 capitalize truncate max-w-[200px]">
                            {cls.className}
                          </span>
                          <span className="font-mono text-slate-400">
                            {(cls.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                          <div
                            className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, cls.confidence * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Awaiting inference execution...
              </div>
            )}
          </div>

          {/* Physical Image Quality & Drift Flagging Card */}
          {inferenceResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  IMAGE QUALITY &amp; ADVERSE WEATHER
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    inferenceResult.driftFlags.isDriftSuspect
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {inferenceResult.driftFlags.isDriftSuspect ? 'COVARIATE DRIFT' : 'NORMAL RANGE'}
                </span>
              </div>

              {/* Quality Meters */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">SHARPNESS (LAPLACIAN)</span>
                  <span
                    className={`text-base font-bold font-mono ${
                      inferenceResult.qualityMetrics.sharpness < 30
                        ? 'text-rose-400'
                        : 'text-slate-200'
                    }`}
                  >
                    {inferenceResult.qualityMetrics.sharpness}/100
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {inferenceResult.qualityMetrics.sharpness < 30 ? 'Fog/blur severe' : 'Sharp edges'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">FOG PROBABILITY</span>
                  <span
                    className={`text-base font-bold font-mono ${
                      inferenceResult.qualityMetrics.fogProbability > 0.4
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {(inferenceResult.qualityMetrics.fogProbability * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {inferenceResult.qualityMetrics.fogProbability > 0.4
                      ? 'Weather anomaly'
                      : 'Clear visibility'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">BRIGHTNESS</span>
                  <span className="text-base font-bold font-mono text-slate-200">
                    {inferenceResult.qualityMetrics.brightness}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Luminance channel</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">CONTRAST</span>
                  <span className="text-base font-bold font-mono text-slate-200">
                    {inferenceResult.qualityMetrics.contrast}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Dynamic range</span>
                </div>
              </div>

              {/* Drift Reason Banner */}
              {inferenceResult.driftFlags.reason && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-xs text-amber-300/90 space-y-1">
                  <span className="font-semibold flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    MLOps Drift Advisory
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    {inferenceResult.driftFlags.reason}
                  </p>
                </div>
              )}

              {/* Action Button: Route to Human Review */}
              <div className="pt-2">
                <button
                  onClick={handleSendToReview}
                  disabled={reviewSent}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    reviewSent
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>
                    {reviewSent
                      ? 'Dispatched to Human Review Queue'
                      : 'Send Sample to Human Review Queue'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

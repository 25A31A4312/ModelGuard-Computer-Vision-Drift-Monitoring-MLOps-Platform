import { GoogleGenAI, Type } from '@google/genai';
import type { InferenceResult, ModelType } from '../src/types/modelguard.ts';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export async function runServerInference(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  modelType: ModelType = 'resnet18_classifier'
): Promise<InferenceResult | null> {
  const ai = getAiClient();
  if (!ai) {
    return null;
  }

  // Strip prefix data URI if present
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

  const startTime = Date.now();

  try {
    if (modelType === 'traffic_object_detector') {
      const prompt = `You are a production Computer Vision Traffic & Autonomous Driving Object Detector (e.g. YOLO/Faster-RCNN trained on Cityscapes and COCO).
Analyze this image and identify all traffic actors and objects: cars, trucks, buses, pedestrians, motorcycles, bicycles, traffic lights, and road signs.
Provide normalized coordinates [ymin, xmin, ymax, xmax] between 0.0 and 1.0 for each detected object.
Also assess physical image quality metrics:
- brightness (0-255, where 128 is balanced)
- contrast (0-100)
- sharpness (0-100, where low values <30 indicate blur or dense fog/rain)
- fogProbability (0.0 to 1.0)
- drift reason if foggy or degraded.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sceneDescription: { type: Type.STRING },
              primaryCategory: { type: Type.STRING },
              objects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    ymin: { type: Type.NUMBER },
                    xmin: { type: Type.NUMBER },
                    ymax: { type: Type.NUMBER },
                    xmax: { type: Type.NUMBER },
                  },
                  required: ['label', 'confidence', 'ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
              quality: {
                type: Type.OBJECT,
                properties: {
                  brightness: { type: Type.NUMBER },
                  contrast: { type: Type.NUMBER },
                  sharpness: { type: Type.NUMBER },
                  fogProbability: { type: Type.NUMBER },
                },
                required: ['brightness', 'contrast', 'sharpness', 'fogProbability'],
              },
              isLowConfidence: { type: Type.BOOLEAN },
              isDriftSuspect: { type: Type.BOOLEAN },
              driftReason: { type: Type.STRING },
            },
            required: ['sceneDescription', 'primaryCategory', 'objects', 'quality', 'isLowConfidence', 'isDriftSuspect'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const latency = Date.now() - startTime;

      const topObjects = (parsed.objects || []).map((o: any) => ({
        label: String(o.label).toLowerCase(),
        confidence: Math.min(0.99, Math.max(0.1, Number(o.confidence) || 0.85)),
        ymin: Math.max(0, Math.min(1, Number(o.ymin) || 0)),
        xmin: Math.max(0, Math.min(1, Number(o.xmin) || 0)),
        ymax: Math.max(0, Math.min(1, Number(o.ymax) || 1)),
        xmax: Math.max(0, Math.min(1, Number(o.xmax) || 1)),
      }));

      const topConfidence = topObjects.length > 0 ? topObjects[0].confidence : 0.72;

      return {
        id: `inf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        modelType: 'traffic_object_detector',
        modelVersion: 'v1.1.0-traffic-detector',
        primaryPrediction: {
          label: parsed.sceneDescription || 'Traffic scene with vehicles',
          confidence: topConfidence,
          category: parsed.primaryCategory || 'Road Transportation',
        },
        topClasses: topObjects.slice(0, 5).map((o: any, idx: number) => ({
          className: o.label,
          confidence: o.confidence,
          classId: 100 + idx,
        })),
        detectedObjects: topObjects,
        qualityMetrics: {
          brightness: Math.round(parsed.quality?.brightness ?? 120),
          contrast: Math.round(parsed.quality?.contrast ?? 50),
          sharpness: Math.round(parsed.quality?.sharpness ?? 65),
          fogProbability: Number((parsed.quality?.fogProbability ?? 0.05).toFixed(2)),
          resolution: { width: 1280, height: 720 },
        },
        driftFlags: {
          isLowConfidence: parsed.isLowConfidence || topConfidence < 0.6,
          isDriftSuspect: parsed.isDriftSuspect || (parsed.quality?.fogProbability > 0.45) || (parsed.quality?.sharpness < 30),
          reason: parsed.driftReason || (parsed.quality?.fogProbability > 0.4 ? 'Adverse weather (fog/reduced visibility) detected' : undefined),
        },
        latencyMs: latency,
      };
    } else {
      // ResNet-18 Image Classification mode
      const prompt = `You are a production ResNet-18 Computer Vision Image Classifier trained on ImageNet-1k.
Analyze the image and provide the legitimate ImageNet classification categories.
CRITICAL MLOps Constraint:
Do NOT produce absurd classification offsets (such as confusing a car or foggy roadway for 'trilobite', 'tench', or sea creatures).
Identify the true primary subject (e.g. 'sports car', 'station wagon', 'convertible', 'minivan', 'cab', 'street sign', 'traffic light', etc.).
Provide the top 5 predicted classes with realistic softmax-like probabilities summing to 1.0.
Estimate physical image metrics: brightness (0-255), contrast (0-100), sharpness (0-100), fogProbability (0-1).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primaryLabel: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              top5: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    className: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    classId: { type: Type.INTEGER },
                  },
                  required: ['className', 'confidence', 'classId'],
                },
              },
              quality: {
                type: Type.OBJECT,
                properties: {
                  brightness: { type: Type.NUMBER },
                  contrast: { type: Type.NUMBER },
                  sharpness: { type: Type.NUMBER },
                  fogProbability: { type: Type.NUMBER },
                },
                required: ['brightness', 'contrast', 'sharpness', 'fogProbability'],
              },
              isLowConfidence: { type: Type.BOOLEAN },
              isDriftSuspect: { type: Type.BOOLEAN },
              driftReason: { type: Type.STRING },
            },
            required: ['primaryLabel', 'confidence', 'top5', 'quality', 'isLowConfidence', 'isDriftSuspect'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const latency = Date.now() - startTime;

      const topClasses = (parsed.top5 || []).map((c: any) => ({
        className: String(c.className),
        confidence: Number(c.confidence) || 0.2,
        classId: Number(c.classId) || 500,
      }));

      const primaryConfidence = Number(parsed.confidence) || (topClasses[0]?.confidence ?? 0.88);

      return {
        id: `inf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        modelType: 'resnet18_classifier',
        modelVersion: 'v1.0.0-resnet18',
        primaryPrediction: {
          label: parsed.primaryLabel || topClasses[0]?.className || 'Motor vehicle',
          confidence: primaryConfidence,
          category: 'ImageNet Classification',
        },
        topClasses,
        detectedObjects: [],
        qualityMetrics: {
          brightness: Math.round(parsed.quality?.brightness ?? 125),
          contrast: Math.round(parsed.quality?.contrast ?? 55),
          sharpness: Math.round(parsed.quality?.sharpness ?? 60),
          fogProbability: Number((parsed.quality?.fogProbability ?? 0.08).toFixed(2)),
          resolution: { width: 800, height: 600 },
        },
        driftFlags: {
          isLowConfidence: parsed.isLowConfidence || primaryConfidence < 0.6,
          isDriftSuspect: parsed.isDriftSuspect || (parsed.quality?.fogProbability > 0.45) || (parsed.quality?.sharpness < 30),
          reason: parsed.driftReason || (parsed.quality?.fogProbability > 0.4 ? 'Adverse weather/fog causing high prediction entropy' : undefined),
        },
        latencyMs: latency,
      };
    }
  } catch (err) {
    console.error('[ModelGuard Gemini Inference Error]', err);
    return null;
  }
}

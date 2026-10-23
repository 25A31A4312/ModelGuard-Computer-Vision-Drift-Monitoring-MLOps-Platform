import type { DriftMetric, DriftStatus } from '../src/types/modelguard.ts';

/**
 * Filter and validate numerical arrays, removing NaN, Infinity, and nulls.
 */
export function sanitizeNumericArray(arr: (number | null | undefined)[]): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
}

/**
 * Two-Sample Kolmogorov-Smirnov (KS) Test
 * Compares reference sample X (length m) and current sample Y (length n).
 * Returns KS statistic D in [0, 1] and asymptotic p-value in [0, 1].
 */
export function computeTwoSampleKSTest(
  refSample: number[],
  currSample: number[],
  alpha: number = 0.05
): {
  dStatistic: number;
  pValue: number;
  isDrift: boolean;
  sampleCountRef: number;
  sampleCountCurr: number;
  valid: boolean;
  message?: string;
} {
  const X = sanitizeNumericArray(refSample).sort((a, b) => a - b);
  const Y = sanitizeNumericArray(currSample).sort((a, b) => a - b);

  const m = X.length;
  const n = Y.length;

  if (m < 5 || n < 5) {
    return {
      dStatistic: 0,
      pValue: 1.0,
      isDrift: false,
      sampleCountRef: m,
      sampleCountCurr: n,
      valid: false,
      message: `Insufficient samples (Reference: ${m}, Current: ${n}). Minimum 5 samples required for KS test.`,
    };
  }

  // Merge unique values across both samples to evaluate supremum difference
  let i = 0;
  let j = 0;
  let dMax = 0;

  while (i < m && j < n) {
    const valX = X[i];
    const valY = Y[j];

    if (valX <= valY) {
      i++;
    }
    if (valY <= valX) {
      j++;
    }

    const cdfX = i / m;
    const cdfY = j / n;
    const diff = Math.abs(cdfX - cdfY);
    if (diff > dMax) {
      dMax = diff;
    }
  }

  // Handle remaining elements
  while (i < m) {
    i++;
    const diff = Math.abs(i / m - 1);
    if (diff > dMax) dMax = diff;
  }
  while (j < n) {
    j++;
    const diff = Math.abs(1 - j / n);
    if (diff > dMax) dMax = diff;
  }

  const dStatistic = Number(Math.min(1.0, Math.max(0.0, dMax)).toFixed(4));

  // Asymptotic p-value approximation via Kolmogorov distribution
  // lambda = (sqrt(m*n / (m+n)) + 0.12 + 0.11 / sqrt(m*n / (m+n))) * D
  const effectiveN = (m * n) / (m + n);
  const sqrtN = Math.sqrt(effectiveN);
  const lambda = (sqrtN + 0.12 + 0.11 / Math.max(1, sqrtN)) * dStatistic;

  let pValue = 1.0;
  if (lambda > 0.05) {
    let sum = 0;
    for (let k = 1; k <= 50; k++) {
      const term = Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
      sum += term;
      if (Math.abs(term) < 1e-12) break;
    }
    pValue = Math.min(1.0, Math.max(0.0, 2 * sum));
  }
  pValue = Number(pValue.toFixed(4));

  const isDrift = pValue < alpha;

  return {
    dStatistic,
    pValue,
    isDrift,
    sampleCountRef: m,
    sampleCountCurr: n,
    valid: true,
  };
}

/**
 * Maximum Mean Discrepancy (MMD) with Gaussian Radial Basis Function (RBF) Kernel.
 * Computes empirical MMD distance between reference sample X and current sample Y.
 */
export function computeMMD(
  refSample: number[],
  currSample: number[],
  alpha: number = 0.05
): {
  mmdScore: number;
  threshold: number;
  isDrift: boolean;
  sampleCountRef: number;
  sampleCountCurr: number;
  valid: boolean;
  bandwidth: number;
  message?: string;
} {
  const X = sanitizeNumericArray(refSample);
  const Y = sanitizeNumericArray(currSample);

  const m = X.length;
  const n = Y.length;

  if (m < 5 || n < 5) {
    return {
      mmdScore: 0,
      threshold: 0.15,
      isDrift: false,
      sampleCountRef: m,
      sampleCountCurr: n,
      valid: false,
      bandwidth: 1.0,
      message: `Insufficient observations for MMD kernel test (Ref: ${m}, Curr: ${n}). Minimum 5 required.`,
    };
  }

  // Compute pooled sample standard deviation for RBF bandwidth sigma
  const all = [...X, ...Y];
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  const variance = all.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, all.length - 1);
  const std = Math.sqrt(variance);
  const sigma = Math.max(0.1, std);
  const gamma = 1 / (2 * sigma * sigma);

  const rbf = (a: number, b: number) => Math.exp(-gamma * Math.pow(a - b, 2));

  // Compute sum K(X, X)
  let kXX = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      kXX += rbf(X[i], X[j]);
    }
  }

  // Compute sum K(Y, Y)
  let kYY = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      kYY += rbf(Y[i], Y[j]);
    }
  }

  // Compute sum K(X, Y)
  let kXY = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      kXY += rbf(X[i], Y[j]);
    }
  }

  const mmdSquared = kXX / (m * m) - (2 * kXY) / (m * n) + kYY / (n * n);
  const mmdScore = Number(Math.sqrt(Math.max(0, mmdSquared)).toFixed(4));

  // Theoretical statistical threshold for MMD under H0 at significance alpha
  // bound ~ sqrt(2/m + 2/n) * sqrt(ln(1/alpha)) * 0.75
  const threshold = Number(
    (Math.sqrt(2 / m + 2 / n) * Math.sqrt(Math.log(1 / alpha)) * 0.75).toFixed(4)
  );

  const isDrift = mmdScore > threshold;

  return {
    mmdScore,
    threshold,
    isDrift,
    sampleCountRef: m,
    sampleCountCurr: n,
    valid: true,
    bandwidth: Number(sigma.toFixed(2)),
  };
}

/**
 * Wasserstein-1 Distance (Earth Mover's Distance) for sorted 1D distributions.
 */
export function computeWassersteinDistance(refSample: number[], currSample: number[]): number {
  const X = sanitizeNumericArray(refSample).sort((a, b) => a - b);
  const Y = sanitizeNumericArray(currSample).sort((a, b) => a - b);

  if (X.length === 0 || Y.length === 0) return 0;

  // Linear interpolation of quantile steps
  const steps = 100;
  let sumDiff = 0;
  for (let s = 0; s <= steps; s++) {
    const q = s / steps;
    const idxX = Math.min(X.length - 1, Math.floor(q * (X.length - 1)));
    const idxY = Math.min(Y.length - 1, Math.floor(q * (Y.length - 1)));
    sumDiff += Math.abs(X[idxX] - Y[idxY]);
  }
  return Number((sumDiff / (steps + 1)).toFixed(2));
}

/**
 * Population Stability Index (PSI) using 10 equal-width bins.
 */
export function computePSI(refSample: number[], currSample: number[]): number {
  const X = sanitizeNumericArray(refSample);
  const Y = sanitizeNumericArray(currSample);

  if (X.length < 5 || Y.length < 5) return 0;

  const minVal = Math.min(...X, ...Y);
  const maxVal = Math.max(...X, ...Y);
  if (minVal === maxVal) return 0;

  const bins = 10;
  const binWidth = (maxVal - minVal) / bins;

  const refCounts = new Array(bins).fill(0);
  const currCounts = new Array(bins).fill(0);

  for (const v of X) {
    const b = Math.min(bins - 1, Math.floor((v - minVal) / binWidth));
    refCounts[b]++;
  }
  for (const v of Y) {
    const b = Math.min(bins - 1, Math.floor((v - minVal) / binWidth));
    currCounts[b]++;
  }

  let psi = 0;
  for (let b = 0; b < bins; b++) {
    // Add Laplace smoothing (epsilon) to prevent division by zero or ln(0)
    const expected = (refCounts[b] + 0.5) / (X.length + 0.5 * bins);
    const actual = (currCounts[b] + 0.5) / (Y.length + 0.5 * bins);
    psi += (actual - expected) * Math.log(actual / expected);
  }

  return Number(Math.max(0, psi).toFixed(4));
}

/**
 * Comprehensive Drift Evaluator combining KS Test, MMD, Wasserstein, and PSI.
 */
export function evaluateFeatureDrift(
  featureName: string,
  refSample: number[],
  currSample: number[],
  alpha: number = 0.05
): DriftMetric {
  const X = sanitizeNumericArray(refSample);
  const Y = sanitizeNumericArray(currSample);

  const refMean = X.length > 0 ? X.reduce((a, b) => a + b, 0) / X.length : 0;
  const currMean = Y.length > 0 ? Y.reduce((a, b) => a + b, 0) / Y.length : 0;

  // Zero-sample / insufficient sample handling
  if (X.length < 5 || Y.length < 5) {
    return {
      featureName,
      method: 'KS_TEST',
      baselineMean: Number(refMean.toFixed(1)),
      currentMean: Number(currMean.toFixed(1)),
      referenceSampleCount: X.length,
      currentSampleCount: Y.length,
      ksStatistic: 0,
      ksPValue: 1.0,
      mmdScore: 0,
      mmdThreshold: 0.15,
      wassersteinDistance: 0,
      psi: 0,
      status: 'INSUFFICIENT_SAMPLES',
      threshold: 0.05,
      alpha,
      interpretation: `Insufficient observations (Reference: ${X.length}, Current: ${Y.length}). Minimum 5 required for statistical tests.`,
    };
  }

  const ksResult = computeTwoSampleKSTest(X, Y, alpha);
  const mmdResult = computeMMD(X, Y, alpha);
  const wasserstein = computeWassersteinDistance(X, Y);
  const psi = computePSI(X, Y);

  // Status decision
  let status: DriftStatus = 'STABLE';
  if (ksResult.isDrift && mmdResult.isDrift && psi >= 0.2) {
    status = 'SEVERE_DRIFT';
  } else if (ksResult.isDrift || mmdResult.isDrift || psi >= 0.1) {
    status = 'MODERATE_DRIFT';
  }

  let interpretation = 'Distribution stable across KS test (p=' + ksResult.pValue + ') and MMD.';
  if (status === 'SEVERE_DRIFT') {
    interpretation = `Significant Covariate Drift confirmed (KS p=${ksResult.pValue} < ${alpha}, MMD=${mmdResult.mmdScore} > ${mmdResult.threshold}, PSI=${psi}).`;
  } else if (status === 'MODERATE_DRIFT') {
    interpretation = `Moderate distribution shift detected (KS p=${ksResult.pValue}, MMD=${mmdResult.mmdScore}, PSI=${psi}).`;
  }

  return {
    featureName,
    method: 'KS_TEST',
    baselineMean: Number(refMean.toFixed(1)),
    currentMean: Number(currMean.toFixed(1)),
    referenceSampleCount: X.length,
    currentSampleCount: Y.length,
    ksStatistic: ksResult.dStatistic,
    ksPValue: ksResult.pValue,
    mmdScore: mmdResult.mmdScore,
    mmdThreshold: mmdResult.threshold,
    wassersteinDistance: wasserstein,
    psi,
    status,
    threshold: alpha,
    alpha,
    interpretation,
  };
}

const model = require('../ai/model.json');

const WINDOW_SIZE = 12;
const MAX_AGE_SECONDS = 120;
const MAX_GAP_SECONDS = 60;
const DISCLAIMER = 'AI-generated decision support. Not a diagnosis.';
const DATA_NOTE = 'Model trained on simulated data; not clinical data.';

function valuesFor(readings, metric) {
  return readings.map((reading) => Number(reading[metric]));
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function populationStandardDeviation(values, average) {
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function slope(values) {
  const averageX = (values.length - 1) / 2;
  const averageY = mean(values);
  const denominator = values.reduce((total, _value, index) => total + (index - averageX) ** 2, 0);
  const numerator = values.reduce((total, value, index) => total + (index - averageX) * (value - averageY), 0);
  return denominator ? numerator / denominator : 0;
}

function extractFeatures(readings) {
  if (!Array.isArray(readings) || readings.length < WINDOW_SIZE) return null;
  const window = readings.slice(-WINDOW_SIZE);
  const metrics = {};

  for (const metric of ['heartRate', 'spo2', 'temperature']) {
    const values = valuesFor(window, metric);
    const average = mean(values);
    metrics[`${metric}_mean`] = average;
    metrics[`${metric}_std`] = populationStandardDeviation(values, average);
    metrics[`${metric}_slope`] = slope(values);
  }

  metrics.outside_threshold_count = window.reduce((count, reading) => count + (
    Number(reading.heartRate) > 120
    || Number(reading.spo2) < 92
    || Number(reading.temperature) > 38
      ? 1
      : 0
  ), 0);

  return model.featureNames.map((featureName) => Number(metrics[featureName].toFixed(6)));
}

function timestampValue(reading) {
  if (!reading?.timestamp) return null;
  const date = new Date(reading.timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readingTime(reading) {
  if (reading?.timestamp) {
    const date = new Date(reading.timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (Number.isFinite(Number(reading?.timestampOffsetSeconds))) {
    return new Date(Number(reading.timestampOffsetSeconds) * 1000);
  }
  return null;
}

function metricLabel(featureName) {
  if (featureName.startsWith('heartRate')) return 'Heart rate';
  if (featureName.startsWith('spo2')) return 'SpO2';
  return 'Temperature';
}

function isConcerning(featureName, featureValue, standardizedValue) {
  if (featureName === 'outside_threshold_count') return featureValue > 0;
  if (featureName.endsWith('_slope')) {
    return featureName.startsWith('spo2') ? featureValue < 0 : featureValue > 0;
  }
  if (featureName.endsWith('_mean')) {
    if (featureName.startsWith('heartRate')) return featureValue > 120;
    if (featureName.startsWith('spo2')) return featureValue < 92;
    return featureValue > 38;
  }
  return featureName.endsWith('_std') && standardizedValue > 0;
}

function factorMessage(featureName, featureValue, standardizedValue) {
  const label = metricLabel(featureName);
  if (featureName.endsWith('_slope')) {
    return `${label} trend is ${featureValue < 0 ? 'falling' : 'rising'}`;
  }
  if (featureName.endsWith('_mean')) {
    return `${label} is ${featureName.startsWith('spo2') ? 'low' : 'high'}`;
  }
  if (featureName.endsWith('_std')) {
    return `${label} variability is high`;
  }
  return `${Math.round(featureValue)} readings are outside alert thresholds`;
}

function noPrediction(base, status, extra = {}) {
  return {
    ...base,
    ...extra,
    status,
    riskLevel: null,
    probabilities: {},
    score: null,
    contributingFactors: []
  };
}

function analyzeRisk(readings) {
  const inputReadings = Array.isArray(readings) ? readings : [];
  const window = inputReadings.slice(-WINDOW_SIZE);
  const base = {
    window: {
      readingCount: inputReadings.length,
      firstTimestamp: timestampValue(window[0]),
      lastTimestamp: timestampValue(window[window.length - 1])
    },
    modelVersion: model.modelVersion,
    generatedAt: new Date().toISOString(),
    dataNote: DATA_NOTE,
    disclaimer: DISCLAIMER
  };

  const features = extractFeatures(inputReadings);
  if (!features) return noPrediction(base, 'insufficient_data');

  const newestReading = window[window.length - 1];
  const newestDate = readingTime(newestReading);
  if (!newestDate) {
    return noPrediction(base, 'insufficient_data', { reason: 'Recent readings are not continuous.' });
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - newestDate.getTime()) / 1000));
  if (newestReading.timestamp && ageSeconds > MAX_AGE_SECONDS) {
    return noPrediction(base, 'stale', {
      latestReadingAt: newestDate.toISOString(),
      ageSeconds
    });
  }

  for (let index = 1; index < window.length; index += 1) {
    const previousDate = readingTime(window[index - 1]);
    const currentDate = readingTime(window[index]);
    if (!previousDate || !currentDate) {
      return noPrediction(base, 'insufficient_data', { reason: 'Recent readings are not continuous.' });
    }
    const gapSeconds = (currentDate.getTime() - previousDate.getTime()) / 1000;
    if (gapSeconds > MAX_GAP_SECONDS) {
      return noPrediction(base, 'insufficient_data', { reason: 'Recent readings are not continuous.' });
    }
  }

  const standardized = features.map((value, index) => (value - model.scalerMeans[index]) / model.scalerScales[index]);
  const logits = model.coefficients.map((coefficients, classIndex) => (
    coefficients.reduce((total, coefficient, featureIndex) => total + coefficient * standardized[featureIndex], model.intercepts[classIndex])
  ));
  const maxLogit = Math.max(...logits);
  const exponentials = logits.map((logit) => Math.exp(logit - maxLogit));
  const exponentialTotal = exponentials.reduce((total, value) => total + value, 0);
  const probabilityValues = exponentials.map((value) => value / exponentialTotal);
  const predictedIndex = probabilityValues.indexOf(Math.max(...probabilityValues));
  const riskLevel = model.classNames[predictedIndex];
  const probabilities = Object.fromEntries(model.classNames.map((className, index) => [className, probabilityValues[index]]));
  const contributions = model.featureNames.map((featureName, index) => ({
    feature: featureName,
    featureValue: features[index],
    standardizedValue: standardized[index],
    contribution: model.coefficients[predictedIndex][index] * standardized[index]
  }));
  const meaningfulFactors = contributions
    .filter((factor) => isConcerning(factor.feature, factor.featureValue, factor.standardizedValue))
    .filter((factor) => factor.contribution > 0)
    .sort((first, second) => second.contribution - first.contribution)
    .slice(0, 3)
    .map((factor) => ({
      feature: factor.feature,
      contribution: factor.contribution,
      message: factorMessage(factor.feature, factor.featureValue, factor.standardizedValue)
    }));
  const contributingFactors = riskLevel === 'low'
    ? [{ message: 'No sustained trend or abnormal readings detected' }]
    : meaningfulFactors.length > 0
      ? meaningfulFactors
      : [{ message: 'Pattern detected by the model; no single factor dominates' }];

  return {
    ...base,
    status: 'ok',
    riskLevel,
    probabilities,
    score: probabilityValues[predictedIndex],
    contributingFactors
  };
}

module.exports = { extractFeatures, analyzeRisk };

const model = require('../ai/model.json');

const WINDOW_SIZE = 12;
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

function factorMessage(featureName, standardizedValue) {
  const direction = standardizedValue >= 0 ? 'rising' : 'declining';
  if (featureName.endsWith('_slope')) {
    const label = featureName.startsWith('heartRate') ? 'Heart rate' : featureName.startsWith('spo2') ? 'SpO2' : 'Temperature';
    return `${label} trend is ${direction}`;
  }
  if (featureName.endsWith('_mean')) {
    const label = featureName.startsWith('heartRate') ? 'Heart rate' : featureName.startsWith('spo2') ? 'SpO2' : 'Temperature';
    return `${label} level is ${standardizedValue >= 0 ? 'elevated' : 'lower'} than its training baseline`;
  }
  if (featureName.endsWith('_std')) {
    const label = featureName.startsWith('heartRate') ? 'Heart rate' : featureName.startsWith('spo2') ? 'SpO2' : 'Temperature';
    return `${label} variability is ${standardizedValue >= 0 ? 'high' : 'low'}`;
  }
  return `${Math.round(Math.max(0, standardizedValue))} readings are outside alert thresholds`;
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
  if (!features) {
    return {
      ...base,
      status: 'insufficient_data',
      riskLevel: null,
      probabilities: {},
      score: null,
      contributingFactors: []
    };
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
    contribution: model.coefficients[predictedIndex][index] * standardized[index],
    message: factorMessage(featureName, standardized[index])
  }));

  return {
    ...base,
    status: 'ok',
    riskLevel,
    probabilities,
    score: probabilityValues[predictedIndex],
    contributingFactors: contributions
      .sort((first, second) => Math.abs(second.contribution) - Math.abs(first.contribution))
      .slice(0, 3)
  };
}

module.exports = { extractFeatures, analyzeRisk };

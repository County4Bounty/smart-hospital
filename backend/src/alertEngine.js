const DEFAULT_THRESHOLDS = {
  heartRate: { min: 50, max: 120 },
  spo2: { min: 92, max: 100 },
  temperature: { min: 36, max: 38 }
};

const DEFAULT_THRESHOLD_DOCS = [
  { key: 'heartRate_low', label: 'Heart rate low', value: 50, direction: 'below', unit: 'bpm' },
  { key: 'heartRate_high', label: 'Heart rate high', value: 120, direction: 'above', unit: 'bpm' },
  { key: 'spo2_low', label: 'SpO2 low', value: 92, direction: 'below', unit: '%' },
  { key: 'spo2_high', label: 'SpO2 high', value: 100, direction: 'above', unit: '%' },
  { key: 'temperature_low', label: 'Temperature low', value: 36, direction: 'below', unit: 'C' },
  { key: 'temperature_high', label: 'Temperature high', value: 38, direction: 'above', unit: 'C' }
];

let thresholdConfig = { ...DEFAULT_THRESHOLDS };

function normalizeThresholdConfig(thresholds = DEFAULT_THRESHOLDS) {
  const nextConfig = {};
  for (const metric of Object.keys(DEFAULT_THRESHOLDS)) {
    nextConfig[metric] = {
      min: Number(thresholds?.[metric]?.min ?? DEFAULT_THRESHOLDS[metric].min),
      max: Number(thresholds?.[metric]?.max ?? DEFAULT_THRESHOLDS[metric].max)
    };
  }
  return nextConfig;
}

function buildThresholdMapFromDocs(thresholds = []) {
  const map = {
    heartRate: { ...DEFAULT_THRESHOLDS.heartRate },
    spo2: { ...DEFAULT_THRESHOLDS.spo2 },
    temperature: { ...DEFAULT_THRESHOLDS.temperature }
  };

  for (const threshold of thresholds) {
    const value = Number(threshold.value);
    if (!threshold?.key || !Number.isFinite(value)) continue;

    const metric = String(threshold.key).replace(/_(low|high)$/, '');
    if (!Object.hasOwn(map, metric)) continue;

    if (threshold.direction === 'below') map[metric].min = value;
    if (threshold.direction === 'above') map[metric].max = value;
  }

  return map;
}

function getThresholdConfig() {
  return normalizeThresholdConfig(thresholdConfig);
}

function refreshThresholdCache(nextThresholds = DEFAULT_THRESHOLDS) {
  thresholdConfig = normalizeThresholdConfig(nextThresholds);
  return getThresholdConfig();
}

function validateReading(reading) {
  const numericFields = ['heartRate', 'spo2', 'temperature'];
  const errors = numericFields
    .filter((field) => reading[field] === undefined || !Number.isFinite(Number(reading[field])))
    .map((field) => `${field} must be a number`);

  if (Number(reading.heartRate) < 20 || Number(reading.heartRate) > 240) errors.push('heartRate is outside sensor limits');
  if (Number(reading.spo2) < 50 || Number(reading.spo2) > 100) errors.push('spo2 is outside sensor limits');
  if (Number(reading.temperature) < 25 || Number(reading.temperature) > 45) errors.push('temperature is outside sensor limits');
  return errors;
}

function detectAlerts(reading, thresholds = getThresholdConfig()) {
  const thresholdSet = normalizeThresholdConfig(thresholds || getThresholdConfig());
  return Object.entries(thresholdSet).flatMap(([metric, range]) => {
    const value = Number(reading[metric]);
    if (value < range.min) return [{ alertType: `${metric}_low`, value, threshold: range.min, direction: 'below' }];
    if (value > range.max) return [{ alertType: `${metric}_high`, value, threshold: range.max, direction: 'above' }];
    return [];
  });
}

module.exports = {
  DEFAULT_THRESHOLDS,
  DEFAULT_THRESHOLD_DOCS,
  buildThresholdMapFromDocs,
  getThresholdConfig,
  refreshThresholdCache,
  validateReading,
  detectAlerts
};

const DEFAULT_THRESHOLDS = {
  heartRate: { min: 50, max: 120 },
  spo2: { min: 92, max: 100 },
  temperature: { min: 36, max: 38 }
};

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

function detectAlerts(reading, thresholds = DEFAULT_THRESHOLDS) {
  return Object.entries(thresholds).flatMap(([metric, range]) => {
    const value = Number(reading[metric]);
    if (value < range.min) return [{ alertType: `${metric}_low`, value, threshold: range.min, direction: 'below' }];
    if (value > range.max) return [{ alertType: `${metric}_high`, value, threshold: range.max, direction: 'above' }];
    return [];
  });
}

module.exports = { DEFAULT_THRESHOLDS, validateReading, detectAlerts };

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectAlerts, validateReading, getThresholdConfig, refreshThresholdCache } = require('../src/alertEngine');

test('detects deterministic low oxygen alert', () => {
  const alerts = detectAlerts({ heartRate: 90, spo2: 88, temperature: 37 });
  assert.deepEqual(alerts[0], { alertType: 'spo2_low', value: 88, threshold: 92, direction: 'below' });
});

test('rejects impossible sensor values', () => {
  assert.ok(validateReading({ heartRate: 400, spo2: 80, temperature: 37 }).includes('heartRate is outside sensor limits'));
});

test('reads threshold config from cache and refreshes it', () => {
  assert.deepEqual(getThresholdConfig(), {
    heartRate: { min: 50, max: 120 },
    spo2: { min: 92, max: 100 },
    temperature: { min: 36, max: 38 }
  });

  refreshThresholdCache({
    heartRate: { min: 45, max: 130 },
    spo2: { min: 90, max: 100 },
    temperature: { min: 35, max: 39 }
  });

  assert.deepEqual(getThresholdConfig(), {
    heartRate: { min: 45, max: 130 },
    spo2: { min: 90, max: 100 },
    temperature: { min: 35, max: 39 }
  });
});

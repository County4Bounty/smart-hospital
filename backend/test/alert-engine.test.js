const test = require('node:test');
const assert = require('node:assert/strict');
const { detectAlerts, validateReading } = require('../src/alertEngine');

test('detects deterministic low oxygen alert', () => {
  const alerts = detectAlerts({ heartRate: 90, spo2: 88, temperature: 37 });
  assert.deepEqual(alerts[0], { alertType: 'spo2_low', value: 88, threshold: 92, direction: 'below' });
});

test('rejects impossible sensor values', () => {
  assert.ok(validateReading({ heartRate: 400, spo2: 80, temperature: 37 }).includes('heartRate is outside sensor limits'));
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { analyzeRisk, extractFeatures } = require('../src/aiRisk');

const parityPath = path.join(__dirname, '..', 'ai', 'parity_samples.json');
const parity = JSON.parse(fs.readFileSync(parityPath, 'utf8'));

test('Node AI risk probabilities match Python parity samples', () => {
  assert.ok(parity.samples.length >= 10);
  for (const sample of parity.samples) {
    const analysis = analyzeRisk(sample.readings);
    assert.equal(analysis.status, 'ok', sample.scenario);
    for (const className of parity.classNames) {
      const difference = Math.abs(analysis.probabilities[className] - sample.probabilities[className]);
      assert.ok(difference <= 1e-6, `${sample.scenario} ${className} difference ${difference}`);
    }
  }
});

test('extractFeatures requires a complete 12-reading window', () => {
  assert.equal(extractFeatures([]), null);
  assert.equal(extractFeatures(new Array(11).fill({ heartRate: 80, spo2: 98, temperature: 37 })), null);
});

test('returns stale when the newest reading is older than two minutes', () => {
  const newestTimestamp = Date.now() - 121000;
  const readings = Array.from({ length: 12 }, (_value, index) => ({
    heartRate: 80,
    spo2: 98,
    temperature: 37,
    timestamp: new Date(newestTimestamp - (11 - index) * 5000).toISOString()
  }));

  const analysis = analyzeRisk(readings);
  assert.equal(analysis.status, 'stale');
  assert.equal(analysis.riskLevel, null);
  assert.equal(analysis.latestReadingAt, readings.at(-1).timestamp);
  assert.ok(analysis.ageSeconds > 120);
});

test('returns insufficient_data when the recent window has a large timestamp gap', () => {
  let timestamp = Date.now() - 111000;
  const readings = Array.from({ length: 12 }, (_value, index) => {
    const reading = { heartRate: 80, spo2: 98, temperature: 37, timestamp: new Date(timestamp).toISOString() };
    timestamp += index === 6 ? 61000 : 5000;
    return reading;
  });

  const analysis = analyzeRisk(readings);
  assert.equal(analysis.status, 'insufficient_data');
  assert.equal(analysis.reason, 'Recent readings are not continuous.');
  assert.equal(analysis.riskLevel, null);
});

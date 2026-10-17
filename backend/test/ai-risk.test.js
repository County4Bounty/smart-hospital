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

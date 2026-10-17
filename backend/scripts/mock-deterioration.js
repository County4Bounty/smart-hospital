/**
 * Single-patient deterioration demo for the offline AI risk model.
 *
 * Usage:
 *   node backend/scripts/mock-deterioration.js [patientId] [intervalMs]
 *
 * The gradual deterioration phase uses the exact drift rates and Gaussian noise
 * process from backend/ai/generate_dataset.py: HR +0.5/step, SpO2 -0.15/step,
 * temperature +0.02/step, with normal-profile noise on every reading.
 * Stop with Ctrl+C.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ENV_PATH = path.join(__dirname, '..', '.env');
const patientId = process.argv[2] || 'P-1001';
const intervalMs = Number(process.argv[3] || 2000);
const deviceId = `ESP32-${patientId}`;
const normalProfile = {
  heartRate: [70, 82],
  spo2: [96, 99],
  temperature: [36.6, 37.1]
};

if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
  throw new Error('intervalMs must be a positive number');
}

function readEnvPassword() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Could not find backend/.env at ${ENV_PATH}`);
  }
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const emailLine = content.split('\n').find((line) => line.startsWith('BOOTSTRAP_USER_EMAIL='));
  const passwordLine = content.split('\n').find((line) => line.startsWith('BOOTSTRAP_USER_PASSWORD='));
  if (!emailLine || !passwordLine) {
    throw new Error('BOOTSTRAP_USER_EMAIL or BOOTSTRAP_USER_PASSWORD missing from .env');
  }
  return {
    email: emailLine.split('=').slice(1).join('=').trim(),
    password: passwordLine.split('=').slice(1).join('=').trim()
  };
}

function gaussianNoise(mean, standardDeviation) {
  const first = Math.max(Number.MIN_VALUE, Math.random());
  const second = Math.random();
  return mean + Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second) * standardDeviation;
}

function sampleNormal() {
  return Object.fromEntries(Object.entries(normalProfile).map(([metric, bounds]) => {
    const midpoint = (bounds[0] + bounds[1]) / 2;
    const spread = (bounds[1] - bounds[0]) / 5;
    return [metric, gaussianNoise(midpoint, spread)];
  }));
}

function generateBaselineReading() {
  const normal = sampleNormal();
  return {
    heartRate: Number(normal.heartRate.toFixed(3)),
    spo2: Number(normal.spo2.toFixed(3)),
    temperature: Number(normal.temperature.toFixed(3))
  };
}

function generateDeterioratingReading(step) {
  const normal = sampleNormal();
  return {
    heartRate: Number((normal.heartRate + 0.5 * step).toFixed(3)),
    spo2: Number((normal.spo2 - 0.15 * step).toFixed(3)),
    temperature: Number((normal.temperature + 0.02 * step).toFixed(3))
  };
}

let token = null;
let credentials = null;

async function login() {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  token = data.token;
  console.log(`[auth] Logged in as ${data.user.email} (${data.user.role})`);
}

async function postReading(vitals, phase) {
  const body = { patientId, deviceId, ...vitals };
  let response = await fetch(`${API_BASE}/api/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });

  if (response.status === 401) {
    console.log('[auth] Token expired, logging in again...');
    await login();
    response = await fetch(`${API_BASE}/api/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  }

  if (response.ok) {
    console.log(`[${patientId}] ${phase}  HR=${body.heartRate} SpO2=${body.spo2} T=${body.temperature}`);
  } else {
    console.error(`[${patientId}] ${phase} POST failed: ${response.status} ${await response.text()}`);
  }
}

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function main() {
  credentials = readEnvPassword();
  await login();
  console.log(`Posting deterioration demo for ${patientId} to ${API_BASE} with device ${deviceId}.`);
  console.log(`Interval: ${intervalMs} ms. Posting 12 baseline readings, then deteriorating readings.`);
  console.log('Press Ctrl+C to stop.\n');

  for (let baselineIndex = 0; baselineIndex < 12; baselineIndex += 1) {
    await postReading(generateBaselineReading(), 'baseline');
    await delay(intervalMs);
  }

  let deteriorationStep = 0;
  while (true) {
    await postReading(generateDeterioratingReading(deteriorationStep), 'deteriorating');
    deteriorationStep += 1;
    await delay(intervalMs);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

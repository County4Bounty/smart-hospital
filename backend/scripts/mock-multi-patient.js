/**
 * Multi-patient mock data generator.
 *
 * Posts simulated vital-sign readings for several patients to the backend,
 * on independent timers, so a demo/dashboard has live-looking data without
 * needing real ESP32 hardware or a Wokwi simulation running.
 *
 * This is for local development and demos only. It uses the same
 * /api/readings endpoint and JSON shape as the real ESP32 firmware, so it
 * exercises the real validation and alert-generation code paths.
 *
 * Usage:
 *   node backend/scripts/mock-multi-patient.js
 *
 * Requires the backend to be running locally (default http://localhost:4000)
 * and reads the bootstrap login credentials from backend/.env.
 *
 * Stop with Ctrl+C.
 */

const fs = require('fs');
const path = require('path');

// ---- Config -----------------------------------------------------------

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ENV_PATH = path.join(__dirname, '..', '.env');

// Each patient gets its own independent "abnormal window" cycle length and
// offset, so they don't all spike at the same time - closer to a real ward.
const PATIENTS = [
  {
    patientId: 'P-1001',
    intervalMs: 4000,
    cycleMs: 30000,
    abnormalWindowMs: 6000,
    cycleOffsetMs: 0,
    normal: { heartRate: [70, 82], spo2: [96, 99], temperature: [36.6, 37.1] },
    abnormal: { heartRate: 145, spo2: 87, temperature: 38.6 } // matches earlier ESP32 mock values
  },
  {
    patientId: 'P-1002',
    intervalMs: 5000,
    cycleMs: 45000,
    abnormalWindowMs: 7000,
    cycleOffsetMs: 15000, // offset so it doesn't line up with P-1001
    normal: { heartRate: [65, 76], spo2: [97, 99], temperature: [36.5, 37.0] },
    abnormal: { heartRate: 132, spo2: 89, temperature: 38.2 }
  },
  {
    patientId: 'P-1003',
    intervalMs: 6000,
    cycleMs: 60000,
    abnormalWindowMs: 8000,
    cycleOffsetMs: 30000,
    normal: { heartRate: [72, 85], spo2: [95, 98], temperature: [36.7, 37.3] },
    abnormal: { heartRate: 128, spo2: 90, temperature: 38.0 }
  }
];

// ---- Helpers ------------------------------------------------------------

function readEnvPassword() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Could not find backend/.env at ${ENV_PATH}`);
  }
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const emailLine = content.split('\n').find((l) => l.startsWith('BOOTSTRAP_USER_EMAIL='));
  const pwLine = content.split('\n').find((l) => l.startsWith('BOOTSTRAP_USER_PASSWORD='));
  if (!emailLine || !pwLine) {
    throw new Error('BOOTSTRAP_USER_EMAIL or BOOTSTRAP_USER_PASSWORD missing from .env');
  }
  return {
    email: emailLine.split('=').slice(1).join('=').trim(),
    password: pwLine.split('=').slice(1).join('=').trim()
  };
}

function randomInRange([min, max]) {
  return +(min + Math.random() * (max - min)).toFixed(1);
}

function isAbnormalWindow(patient, now) {
  const t = (now + patient.cycleOffsetMs) % patient.cycleMs;
  return t < patient.abnormalWindowMs;
}

function generateReading(patient, now) {
  if (isAbnormalWindow(patient, now)) {
    return { ...patient.abnormal };
  }
  return {
    heartRate: randomInRange(patient.normal.heartRate),
    spo2: randomInRange(patient.normal.spo2),
    temperature: randomInRange(patient.normal.temperature)
  };
}

let token = null;
let credentials = null;

async function login() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  token = data.token;
  console.log(`[auth] Logged in as ${data.user.email} (${data.user.role})`);
}

async function postReading(patient) {
  const vitals = generateReading(patient, Date.now());
  const body = { patientId: patient.patientId, ...vitals };

  let res = await fetch(`${API_BASE}/api/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });

  // If the token expired, log in again once and retry this one reading.
  if (res.status === 401) {
    console.log('[auth] Token expired, logging in again...');
    await login();
    res = await fetch(`${API_BASE}/api/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  }

  const tag = isAbnormalWindow(patient, Date.now()) ? 'ABNORMAL' : 'normal';
  if (res.ok) {
    console.log(
      `[${patient.patientId}] ${tag}  HR=${body.heartRate} SpO2=${body.spo2} T=${body.temperature}`
    );
  } else {
    console.error(`[${patient.patientId}] POST failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  credentials = readEnvPassword();
  await login();

  console.log(`Posting mock readings for ${PATIENTS.length} patients to ${API_BASE}.`);
  console.log('Press Ctrl+C to stop.\n');

  for (const patient of PATIENTS) {
    // Stagger the first post slightly so they don't all fire in the same tick.
    setTimeout(() => {
      postReading(patient);
      setInterval(() => postReading(patient), patient.intervalMs);
    }, Math.random() * 1000);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
require('dotenv').config();

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { DEFAULT_THRESHOLD_DOCS, buildThresholdMapFromDocs, refreshThresholdCache } = require('../src/alertEngine');
const { Alert, Device, HealthReading, Patient, Threshold, User } = require('../src/models');

const testMongoUri = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/smart_hospital_test';
if (testMongoUri === process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI_TEST must point to a separate database from MONGODB_URI.');
}

let server;
let baseUrl;
let adminToken;
let nurseToken;

async function request(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json();
  return { status: response.status, body };
}

async function login(email, password) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200);
  return response.body.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createTestPatient(patientId = 'P-TEST-001') {
  return Patient.create({
    patientId,
    name: 'Integration Patient',
    age: 42,
    gender: 'Female',
    roomNumber: 'TEST-01',
    assignedDoctor: 'Dr. Test',
    status: 'Stable'
  });
}

test.before(async () => {
  await mongoose.connect(testMongoUri);
  await Promise.all([
    Alert.deleteMany({}),
    Device.deleteMany({}),
    HealthReading.deleteMany({}),
    Patient.deleteMany({}),
    Threshold.deleteMany({}),
    User.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('IntegrationPassword123!', 10);
  await User.create([
    { name: 'Integration Admin', email: 'integration-admin@test.local', passwordHash, role: 'admin' },
    { name: 'Integration Nurse', email: 'integration-nurse@test.local', passwordHash, role: 'nurse' }
  ]);
  const thresholds = await Threshold.insertMany(DEFAULT_THRESHOLD_DOCS);
  refreshThresholdCache(buildThresholdMapFromDocs(thresholds));

  const app = createApp({ emit() {} });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  adminToken = await login('integration-admin@test.local', 'IntegrationPassword123!');
  nurseToken = await login('integration-nurse@test.local', 'IntegrationPassword123!');
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('POST /api/auth/login succeeds with valid credentials and rejects invalid credentials', async () => {
  const valid = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'integration-admin@test.local', password: 'IntegrationPassword123!' })
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.user.role, 'admin');
  assert.ok(valid.body.token);

  const invalid = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'integration-admin@test.local', password: 'wrong-password' })
  });
  assert.equal(invalid.status, 401);
});

test('POST /api/readings creates alerts for abnormal values but not normal values', async () => {
  const patient = await createTestPatient('P-READING-001');
  const headers = authHeaders(adminToken);

  const abnormal = await request('/api/readings', {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId: patient.patientId, heartRate: 145, spo2: 87, temperature: 38.6 })
  });
  assert.equal(abnormal.status, 201);
  assert.deepEqual(abnormal.body.alerts.map((alert) => alert.alertType).sort(), ['heartRate_high', 'spo2_low', 'temperature_high']);
  assert.equal(await Alert.countDocuments({ patientId: patient.patientId }), 3);

  const normalPatient = await createTestPatient('P-READING-002');
  const normal = await request('/api/readings', {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientId: normalPatient.patientId, heartRate: 80, spo2: 98, temperature: 37 })
  });
  assert.equal(normal.status, 201);
  assert.deepEqual(normal.body.alerts, []);
  assert.equal(await Alert.countDocuments({ patientId: normalPatient.patientId }), 0);
});

test('GET /api/ai/risk/:patientId handles insufficient and sufficient readings', async () => {
  const shortPatient = await createTestPatient('P-AI-SHORT-001');
  await HealthReading.insertMany(Array.from({ length: 3 }, (_value, index) => ({
    patientId: shortPatient.patientId,
    heartRate: 80,
    spo2: 98,
    temperature: 37,
    timestamp: new Date(Date.now() - (3 - index) * 5000)
  })));

  const insufficient = await request(`/api/ai/risk/${shortPatient.patientId}`, {
    headers: authHeaders(adminToken)
  });
  assert.equal(insufficient.status, 200);
  assert.equal(insufficient.body.status, 'insufficient_data');
  assert.equal(insufficient.body.riskLevel, null);

  const completePatient = await createTestPatient('P-AI-COMPLETE-001');
  await HealthReading.insertMany(Array.from({ length: 12 }, (_value, index) => ({
    patientId: completePatient.patientId,
    heartRate: 80 + index * 0.2,
    spo2: 98 - index * 0.05,
    temperature: 37 + index * 0.01,
    timestamp: new Date(Date.now() - (12 - index) * 5000)
  })));

  const complete = await request(`/api/ai/risk/${completePatient.patientId}`, {
    headers: authHeaders(adminToken)
  });
  assert.equal(complete.status, 200);
  assert.equal(complete.body.status, 'ok');
  assert.ok(['low', 'moderate', 'high'].includes(complete.body.riskLevel));
  assert.equal(complete.body.window.readingCount, 12);
  assert.equal(Object.keys(complete.body.probabilities).length, 3);
});

test('GET /api/ai/risk/:patientId rejects unauthenticated requests', async () => {
  const response = await request('/api/ai/risk/P-AI-UNAUTH-001');
  assert.equal(response.status, 401);
});

test('GET /api/ai/risk/:patientId reports stale and non-continuous readings', async () => {
  const stalePatient = await createTestPatient('P-AI-STALE-001');
  const staleNewest = Date.now() - 121000;
  await HealthReading.insertMany(Array.from({ length: 12 }, (_value, index) => ({
    patientId: stalePatient.patientId,
    heartRate: 80,
    spo2: 98,
    temperature: 37,
    timestamp: new Date(staleNewest - (11 - index) * 5000)
  })));

  const stale = await request(`/api/ai/risk/${stalePatient.patientId}`, {
    headers: authHeaders(adminToken)
  });
  assert.equal(stale.status, 200);
  assert.equal(stale.body.status, 'stale');
  assert.ok(stale.body.ageSeconds > 120);

  const gapPatient = await createTestPatient('P-AI-GAP-001');
  let timestamp = Date.now() - 111000;
  await HealthReading.insertMany(Array.from({ length: 12 }, (_value, index) => {
    const reading = {
      patientId: gapPatient.patientId,
      heartRate: 80,
      spo2: 98,
      temperature: 37,
      timestamp: new Date(timestamp)
    };
    timestamp += index === 6 ? 61000 : 5000;
    return reading;
  }));

  const gap = await request(`/api/ai/risk/${gapPatient.patientId}`, {
    headers: authHeaders(adminToken)
  });
  assert.equal(gap.status, 200);
  assert.equal(gap.body.status, 'insufficient_data');
  assert.equal(gap.body.reason, 'Recent readings are not continuous.');
});

test('admin can create and update patients while non-admin is rejected', async () => {
  const patientPayload = {
    patientId: 'P-ADMIN-001',
    name: 'Created Patient',
    age: 0,
    gender: 'Other',
    roomNumber: 'NEWBORN-01',
    assignedDoctor: 'Dr. Test',
    status: 'Stable'
  };
  const created = await request('/api/patients', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify(patientPayload)
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.patientId, patientPayload.patientId);

  const updated = await request('/api/patients/P-ADMIN-001', {
    method: 'PATCH',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ name: 'Updated Patient', status: 'Watch' })
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, 'Updated Patient');
  assert.equal((await Patient.findOne({ patientId: 'P-ADMIN-001' })).status, 'Watch');

  const rejected = await request('/api/patients', {
    method: 'POST',
    headers: authHeaders(nurseToken),
    body: JSON.stringify(patientPayload)
  });
  assert.equal(rejected.status, 403);

  const updateRejected = await request('/api/patients/P-ADMIN-001', {
    method: 'PATCH',
    headers: authHeaders(nurseToken),
    body: JSON.stringify({ status: 'Critical' })
  });
  assert.equal(updateRejected.status, 403);
});

test('POST /api/devices rejects duplicate IDs and unknown patient assignments', async () => {
  const patient = await createTestPatient('P-DEVICE-001');
  const headers = authHeaders(adminToken);
  const payload = { deviceId: 'DEVICE-TEST-001', label: 'Integration Device', assignedPatientId: patient.patientId };

  const created = await request('/api/devices', { method: 'POST', headers, body: JSON.stringify(payload) });
  assert.equal(created.status, 201);

  const duplicate = await request('/api/devices', { method: 'POST', headers, body: JSON.stringify(payload) });
  assert.equal(duplicate.status, 409);

  const unknownPatient = await request('/api/devices', {
    method: 'POST',
    headers,
    body: JSON.stringify({ deviceId: 'DEVICE-TEST-002', label: 'Unknown Patient Device', assignedPatientId: 'P-NOT-FOUND' })
  });
  assert.equal(unknownPatient.status, 404);
});

test('authenticated routes reject missing and invalid tokens', async () => {
  const missing = await request('/api/patients');
  assert.equal(missing.status, 401);

  const invalid = await request('/api/patients', {
    headers: { Authorization: 'Bearer invalid-token' }
  });
  assert.equal(invalid.status, 401);
});

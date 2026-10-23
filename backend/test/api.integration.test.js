require('dotenv').config();

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { jwtSecret } = require('../src/config');
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

test('admin user management creates safe users with normalized email and bcrypt password', async () => {
  const response = await request('/api/users', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({
      name: '  Managed User  ',
      email: '  Managed.User@TEST.LOCAL ',
      password: 'ManagedPassword123!',
      role: 'doctor',
      passwordHash: 'ignored',
      _id: 'ignored',
      isActive: false
    })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body).sort(), ['email', 'id', 'isActive', 'name', 'role']);
  assert.deepEqual(response.body, {
    id: response.body.id,
    name: 'Managed User',
    email: 'managed.user@test.local',
    role: 'doctor',
    isActive: true
  });
  assert.equal(response.body.passwordHash, undefined);

  const stored = await User.findById(response.body.id).select('+passwordHash').lean();
  assert.equal(stored.email, 'managed.user@test.local');
  assert.notEqual(stored.passwordHash, 'ignored');
  assert.equal(await bcrypt.compare('ManagedPassword123!', stored.passwordHash), true);

  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'MANAGED.USER@TEST.LOCAL', password: 'ManagedPassword123!' })
  });
  assert.equal(loginResponse.status, 200);

  const listing = await request('/api/users', { headers: authHeaders(adminToken) });
  assert.equal(listing.status, 200);
  const listedUser = listing.body.find((user) => user.email === 'managed.user@test.local');
  assert.deepEqual(Object.keys(listedUser).sort(), ['email', 'id', 'isActive', 'name', 'role']);
  assert.equal(listedUser.passwordHash, undefined);
});

test('user management rejects unauthorized callers, invalid fields, and unknown IDs', async () => {
  const unauthenticatedPost = await request('/api/users', { method: 'POST', body: JSON.stringify({}) });
  assert.equal(unauthenticatedPost.status, 401);
  const unauthenticatedPatch = await request('/api/users/not-an-id', { method: 'PATCH', body: JSON.stringify({ name: 'Nope' }) });
  assert.equal(unauthenticatedPatch.status, 401);

  const invalidCallers = [nurseToken];
  const bootstrap = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: process.env.BOOTSTRAP_USER_EMAIL, password: process.env.BOOTSTRAP_USER_PASSWORD })
  });
  assert.equal(bootstrap.status, 200);
  invalidCallers.push(bootstrap.body.token);
  for (const token of invalidCallers) {
    const post = await request('/api/users', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({}) });
    assert.equal(post.status, 403);
    const patch = await request('/api/users/not-an-id', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ name: 'Nope' }) });
    assert.equal(patch.status, 403);
  }

  const invalidPayloads = [
    { name: '', email: 'valid@test.local', password: 'ValidPassword123!', role: 'nurse' },
    { name: 'Invalid', email: 'not-an-email', password: 'ValidPassword123!', role: 'nurse' },
    { name: 'Invalid', email: 'invalid-role@test.local', password: 'ValidPassword123!', role: 'surgeon' },
    { name: 'Invalid', email: 'short-password@test.local', password: 'short', role: 'nurse' }
  ];
  for (const payload of invalidPayloads) {
    const response = await request('/api/users', { method: 'POST', headers: authHeaders(adminToken), body: JSON.stringify(payload) });
    assert.equal(response.status, 400);
  }

  const target = await User.create({ name: 'Validation Target', email: 'validation-target@test.local', passwordHash: await bcrypt.hash('TargetPassword123!', 10), role: 'nurse' });
  const invalidUpdates = [
    { isActive: 'false' },
    { role: 'invalid-role' },
    { email: 'invalid-email' },
    { name: '   ' },
    { password: 'NewPassword123!' },
    { passwordHash: 'ignored' },
    { _id: new mongoose.Types.ObjectId().toString() }
  ];
  for (const updates of invalidUpdates) {
    const response = await request(`/api/users/${target._id}`, { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify(updates) });
    assert.equal(response.status, Object.keys(updates).some((key) => ['password', 'passwordHash', '_id'].includes(key)) ? 400 : 400);
  }
  const emptyPatch = await request(`/api/users/${target._id}`, { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify({}) });
  assert.equal(emptyPatch.status, 400);

  const malformed = await request('/api/users/not-an-object-id', { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify({ name: 'Nope' }) });
  assert.equal(malformed.status, 400);
  const unknown = await request(`/api/users/${new mongoose.Types.ObjectId()}`, { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify({ name: 'Nope' }) });
  assert.equal(unknown.status, 404);
  const bootstrapPatch = await request('/api/users/U-1', { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify({ role: 'admin' }) });
  assert.equal(bootstrapPatch.status, 404);
});

test('user management handles duplicate emails and ignores extra patch fields', async () => {
  const first = await request('/api/users', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ name: 'First Duplicate', email: 'duplicate@test.local', password: 'DuplicatePassword123!', role: 'nurse' })
  });
  assert.equal(first.status, 201);

  const duplicate = await request('/api/users', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ name: 'Second Duplicate', email: ' DUPLICATE@TEST.LOCAL ', password: 'DuplicatePassword123!', role: 'nurse' })
  });
  assert.equal(duplicate.status, 409);

  const second = await User.create({ name: 'Second User', email: 'second-user@test.local', passwordHash: await bcrypt.hash('SecondPassword123!', 10), role: 'nurse' });
  const originalPasswordHash = second.passwordHash;
  const update = await request(`/api/users/${second._id}`, {
    method: 'PATCH',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ email: ' DUPLICATE@TEST.LOCAL ', name: 'Updated Second', password: 'IgnoredPassword123!', passwordHash: 'ignored', _id: new mongoose.Types.ObjectId().toString() })
  });
  assert.equal(update.status, 409);

  const safeUpdate = await request(`/api/users/${second._id}`, {
    method: 'PATCH',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ name: 'Updated Second', password: 'IgnoredPassword123!', passwordHash: 'ignored', _id: new mongoose.Types.ObjectId().toString() })
  });
  assert.equal(safeUpdate.status, 200);
  assert.equal(safeUpdate.body.name, 'Updated Second');
  const stored = await User.findById(second._id).select('+passwordHash').lean();
  assert.equal(stored.passwordHash, originalPasswordHash);
  assert.equal(stored.email, 'second-user@test.local');
});

test('deactivation and reactivation apply to an already-issued token', async () => {
  const user = await User.create({ name: 'Lifecycle User', email: 'lifecycle@test.local', passwordHash: await bcrypt.hash('LifecyclePassword123!', 10), role: 'nurse' });
  const token = await login('lifecycle@test.local', 'LifecyclePassword123!');

  const deactivated = await request(`/api/users/${user._id}`, { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify({ isActive: false }) });
  assert.equal(deactivated.status, 200);
  assert.equal((await request('/api/patients', { headers: authHeaders(token) })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'lifecycle@test.local', password: 'LifecyclePassword123!' }) })).status, 403);

  const reactivated = await request(`/api/users/${user._id}`, { method: 'PATCH', headers: authHeaders(adminToken), body: JSON.stringify({ isActive: true }) });
  assert.equal(reactivated.status, 200);
  assert.equal((await request('/api/patients', { headers: authHeaders(token) })).status, 200);
});

test('admins cannot demote or deactivate themselves and preserve another active admin', async () => {
  const self = await User.create({ name: 'Self Admin', email: 'self-admin@test.local', passwordHash: await bcrypt.hash('SelfAdminPassword123!', 10), role: 'admin' });
  const selfToken = await login('self-admin@test.local', 'SelfAdminPassword123!');
  assert.equal((await request(`/api/users/${self._id}`, { method: 'PATCH', headers: authHeaders(selfToken), body: JSON.stringify({ role: 'nurse' }) })).status, 403);
  assert.equal((await request(`/api/users/${self._id}`, { method: 'PATCH', headers: authHeaders(selfToken), body: JSON.stringify({ isActive: false }) })).status, 403);

  const target = await User.create({ name: 'Second Admin', email: 'second-admin@test.local', passwordHash: await bcrypt.hash('SecondAdminPassword123!', 10), role: 'admin' });
  const demoted = await request(`/api/users/${target._id}`, { method: 'PATCH', headers: authHeaders(selfToken), body: JSON.stringify({ role: 'nurse' }) });
  assert.equal(demoted.status, 200);
  const deactivationTarget = await User.create({ name: 'Third Admin', email: 'third-admin@test.local', passwordHash: await bcrypt.hash('ThirdAdminPassword123!', 10), role: 'admin' });
  const deactivated = await request(`/api/users/${deactivationTarget._id}`, { method: 'PATCH', headers: authHeaders(selfToken), body: JSON.stringify({ isActive: false }) });
  assert.equal(deactivated.status, 200);
  assert.equal((await request('/api/users', { headers: authHeaders(selfToken) })).status, 200);
});

test('a MongoDB role change takes effect for an already-issued JWT', async () => {
  const passwordHash = await bcrypt.hash('RoleChangePassword123!', 10);
  const user = await User.create({ name: 'Role Change Admin', email: 'role-change@test.local', passwordHash, role: 'admin' });
  const token = await login('role-change@test.local', 'RoleChangePassword123!');

  await User.updateOne({ _id: user._id }, { $set: { role: 'nurse' } });
  const response = await request('/api/users', { headers: authHeaders(token) });
  assert.equal(response.status, 403);
});

test('inactive, missing-active-field, and deleted users are handled for existing JWTs', async () => {
  const passwordHash = await bcrypt.hash('StatusPassword123!', 10);
  const inactive = await User.create({ name: 'Inactive User', email: 'inactive-token@test.local', passwordHash, role: 'nurse' });
  const inactiveToken = await login('inactive-token@test.local', 'StatusPassword123!');
  await User.updateOne({ _id: inactive._id }, { $set: { isActive: false } });
  const inactiveResponse = await request('/api/patients', { headers: authHeaders(inactiveToken) });
  assert.equal(inactiveResponse.status, 401);

  const legacy = await User.create({ name: 'Legacy User', email: 'legacy-user@test.local', passwordHash, role: 'nurse' });
  await User.updateOne({ _id: legacy._id }, { $unset: { isActive: 1 } });
  const legacyToken = await login('legacy-user@test.local', 'StatusPassword123!');
  const legacyResponse = await request('/api/patients', { headers: authHeaders(legacyToken) });
  assert.equal(legacyResponse.status, 200);
  const legacyListing = await request('/api/users', { headers: authHeaders(adminToken) });
  assert.equal(legacyListing.body.find((user) => user.email === 'legacy-user@test.local').isActive, true);

  const deleted = await User.create({ name: 'Deleted User', email: 'deleted-user@test.local', passwordHash, role: 'nurse' });
  const deletedToken = await login('deleted-user@test.local', 'StatusPassword123!');
  await User.deleteOne({ _id: deleted._id });
  const deletedResponse = await request('/api/patients', { headers: authHeaders(deletedToken) });
  assert.equal(deletedResponse.status, 401);
});

test('inactive MongoDB users require a valid password before deactivation is disclosed', async () => {
  const passwordHash = await bcrypt.hash('InactiveLoginPassword123!', 10);
  await User.create({ name: 'Inactive Login User', email: 'inactive-login@test.local', passwordHash, role: 'nurse', isActive: false });

  const wrongPassword = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'inactive-login@test.local', password: 'wrong-password' })
  });
  assert.equal(wrongPassword.status, 401);
  assert.notEqual(wrongPassword.body.message, 'Account is deactivated');

  const correctPassword = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'inactive-login@test.local', password: 'InactiveLoginPassword123!' })
  });
  assert.equal(correctPassword.status, 403);
  assert.deepEqual(correctPassword.body, { message: 'Account is deactivated' });
});

test('bootstrap doctor remains a doctor and cannot access admin routes', async () => {
  assert.ok(process.env.BOOTSTRAP_USER_EMAIL);
  assert.ok(process.env.BOOTSTRAP_USER_PASSWORD);
  const bootstrap = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: process.env.BOOTSTRAP_USER_EMAIL, password: process.env.BOOTSTRAP_USER_PASSWORD })
  });
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body.user.role, 'doctor');

  const doctorRoute = await request('/api/patients', { headers: authHeaders(bootstrap.body.token) });
  assert.equal(doctorRoute.status, 200);
  const adminRoute = await request('/api/users', { headers: authHeaders(bootstrap.body.token) });
  assert.equal(adminRoute.status, 403);
});

test('a signed token with a malformed non-ObjectId subject returns 401', async () => {
  const token = jwt.sign({ sub: 'not-an-object-id', role: 'admin', name: 'Malformed' }, jwtSecret, { expiresIn: '8h' });
  const response = await request('/api/users', { headers: authHeaders(token) });
  assert.equal(response.status, 401);
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

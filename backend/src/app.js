const express = require('express');
const cors = require('cors');
const {
  validateReading,
  detectAlerts,
  getThresholdConfig,
  refreshThresholdCache,
  buildThresholdMapFromDocs
} = require('./alertEngine');
const { login, requireAuth, requireRole } = require('./auth');
const { Patient, HealthReading, Alert, User, Threshold } = require('./models');

function serializeReading(reading) {
  return { ...reading.toObject(), id: reading._id.toString() };
}

function serializeAlert(alert) {
  return { ...alert.toObject(), id: alert._id.toString() };
}

function serializePatient(patient) {
  return { ...patient.toObject(), id: patient._id.toString() };
}

function serializeThreshold(threshold) {
  return { ...threshold.toObject(), id: threshold._id.toString() };
}

function createApp(io) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'smart-hospital-api' }));
  app.post('/api/auth/login', async (req, res) => {
    const session = await login(req.body.email, req.body.password);
    if (!session) return res.status(401).json({ message: 'Invalid email or password' });
    return res.json(session);
  });
  app.get('/api/patients', requireAuth, async (_req, res) => res.json(await Patient.find().sort({ patientId: 1 }).lean()));
  app.post('/api/patients', requireAuth, requireRole('admin'), async (req, res) => {
    const { patientId, name, age, gender, roomNumber, assignedDoctor, status } = req.body || {};
    const requiredFields = [patientId, name, age, gender, roomNumber, assignedDoctor, status];
    if (requiredFields.some((value) => value === undefined || value === null || value === '')) {
      return res.status(400).json({ message: 'Missing required patient fields' });
    }

    const exists = await Patient.exists({ patientId: String(patientId).trim() });
    if (exists) return res.status(409).json({ message: 'Patient ID already exists' });

    const patient = await Patient.create({
      patientId: String(patientId).trim(),
      name: String(name).trim(),
      age: Number(age),
      gender: String(gender).trim(),
      roomNumber: String(roomNumber).trim(),
      assignedDoctor: String(assignedDoctor).trim(),
      status: String(status).trim()
    });
    io?.emit('patient.created', serializePatient(patient));
    return res.status(201).json(serializePatient(patient));
  });
  app.patch('/api/patients/:patientId', requireAuth, requireRole('admin'), async (req, res) => {
    const { patientId } = req.params;
    const patient = await Patient.findOne({ patientId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const allowedFields = ['patientId', 'name', 'age', 'gender', 'roomNumber', 'assignedDoctor', 'status'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'patientId' ? String(req.body[field]).trim() : req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No patient fields provided' });

    if (updates.patientId && updates.patientId !== patient.patientId) {
      const duplicate = await Patient.exists({ patientId: updates.patientId });
      if (duplicate) return res.status(409).json({ message: 'Patient ID already exists' });
    }

    Object.assign(patient, updates);
    await patient.save();
    io?.emit('patient.updated', serializePatient(patient));
    return res.json(serializePatient(patient));
  });
  app.get('/api/patients/:patientId', requireAuth, async (req, res) => {
    const patient = await Patient.findOne({ patientId: req.params.patientId }).lean();
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    return res.json(patient);
  });
  app.get('/api/readings/:patientId', requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const results = await HealthReading.find({ patientId: req.params.patientId })
      .sort({ timestamp: -1 })
      .limit(limit);
    return res.json(results.reverse().map(serializeReading));
  });
  app.get('/api/alerts', requireAuth, async (req, res) => {
    const query = req.query.patientId ? { patientId: req.query.patientId } : {};
    const results = await Alert.find(query).sort({ timestamp: -1 });
    return res.json(results.map(serializeAlert));
  });
  app.get('/api/users', requireAuth, requireRole('admin'), async (_req, res) => {
    const users = await User.find({}).select('name email role').sort({ name: 1 }).lean();
    return res.json(users.map((user) => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role })));
  });
  app.get('/api/thresholds', requireAuth, async (_req, res) => {
    const thresholds = await Threshold.find({}).sort({ key: 1 }).lean();
    return res.json(thresholds.map((threshold) => ({ ...threshold, id: threshold._id.toString() })));
  });
  app.patch('/api/thresholds/:key', requireAuth, requireRole('admin'), async (req, res) => {
    const { key } = req.params;
    const value = Number(req.body.value);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ message: 'Threshold value must be a non-negative number.' });
    }

    const threshold = await Threshold.findOne({ key });
    if (!threshold) return res.status(404).json({ message: 'Threshold not found' });

    threshold.value = value;
    await threshold.save();

    const thresholds = await Threshold.find({}).sort({ key: 1 }).lean();
    refreshThresholdCache(buildThresholdMapFromDocs(thresholds));

    return res.json(serializeThreshold(threshold));
  });
  app.get('/api/config/thresholds', requireAuth, (_req, res) => res.json(getThresholdConfig()));
  app.post('/api/readings', requireAuth, async (req, res) => {
    const { patientId, heartRate, spo2, temperature, timestamp } = req.body;
    const patient = await Patient.findOne({ patientId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    const errors = validateReading({ heartRate, spo2, temperature });
    if (errors.length) return res.status(400).json({ message: 'Invalid sensor data', errors });

    const reading = await HealthReading.create({
      patientId,
      heartRate: Number(heartRate),
      spo2: Number(spo2),
      temperature: Number(temperature),
      ...(timestamp ? { timestamp } : {})
    });
    const detected = detectAlerts(reading).map((alert) => ({ patientId, ...alert, status: 'open', timestamp: reading.timestamp }));
    const savedAlerts = detected.length ? await Alert.insertMany(detected) : [];
    if (savedAlerts.length) {
      patient.status = savedAlerts.some((alert) => alert.alertType.startsWith('spo2')) ? 'Critical' : 'Watch';
      await patient.save();
      savedAlerts.forEach((alert) => io?.emit('alert.created', serializeAlert(alert)));
    }
    io?.emit('reading.created', serializeReading(reading));
    return res.status(201).json({ reading: serializeReading(reading), alerts: savedAlerts.map(serializeAlert) });
  });
  app.patch('/api/alerts/:alertId/acknowledge', requireAuth, async (req, res) => {
    const alert = await Alert.findByIdAndUpdate(req.params.alertId, {
      status: 'acknowledged',
      acknowledgedAt: new Date()
    }, { new: true });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    return res.json(serializeAlert(alert));
  });
  return app;
}
module.exports = { createApp };

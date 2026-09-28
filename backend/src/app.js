const express = require('express');
const cors = require('cors');
const { validateReading, detectAlerts, DEFAULT_THRESHOLDS } = require('./alertEngine');
const { login, requireAuth } = require('./auth');
const { Patient, HealthReading, Alert } = require('./models');

function serializeReading(reading) {
  return { ...reading.toObject(), id: reading._id.toString() };
}

function serializeAlert(alert) {
  return { ...alert.toObject(), id: alert._id.toString() };
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
  app.get('/api/config/thresholds', requireAuth, (_req, res) => res.json(DEFAULT_THRESHOLDS));
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

const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  age: { type: Number, min: 0, max: 130, required: true },
  gender: { type: String, required: true },
  roomNumber: { type: String, required: true },
  assignedDoctor: { type: String, required: true },
  status: { type: String, enum: ['Stable', 'Watch', 'Critical'], default: 'Stable' }
}, { timestamps: true });

const healthReadingSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  heartRate: { type: Number, required: true },
  spo2: { type: Number, required: true },
  temperature: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
});

const alertSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  alertType: { type: String, required: true },
  value: { type: Number, required: true },
  threshold: { type: Number, required: true },
  direction: { type: String, enum: ['below', 'above'], required: true },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
  acknowledgedAt: { type: Date },
  timestamp: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'doctor', 'nurse'], required: true }
}, { timestamps: true });

const thresholdSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  value: { type: Number, required: true },
  direction: { type: String, enum: ['above', 'below'], required: true },
  unit: { type: String, required: true }
}, { timestamps: true });

module.exports = {
  Patient: mongoose.models.Patient || mongoose.model('Patient', patientSchema),
  HealthReading: mongoose.models.HealthReading || mongoose.model('HealthReading', healthReadingSchema),
  Alert: mongoose.models.Alert || mongoose.model('Alert', alertSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Threshold: mongoose.models.Threshold || mongoose.model('Threshold', thresholdSchema)
};

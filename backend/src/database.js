const mongoose = require('mongoose');
const { mongoUri } = require('./config');
const { Patient } = require('./models');

const defaultPatients = [
  { patientId: 'P-1001', name: 'Aarav Mehta', age: 64, gender: 'Male', roomNumber: 'ICU-04', assignedDoctor: 'Dr. Priya Shah', status: 'Critical' },
  { patientId: 'P-1002', name: 'Maya Rodriguez', age: 42, gender: 'Female', roomNumber: 'Ward-12', assignedDoctor: 'Dr. Priya Shah', status: 'Stable' },
  { patientId: 'P-1003', name: 'Noah Williams', age: 71, gender: 'Male', roomNumber: 'Ward-08', assignedDoctor: 'Dr. Daniel Kim', status: 'Watch' }
];

async function seedPatients() {
  if (await Patient.exists()) return;
  await Patient.insertMany(defaultPatients);
}

async function connectDatabase() {
  if (!mongoUri) return false;
  try {
    await mongoose.connect(mongoUri);
    await seedPatients();
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.warn(`MongoDB unavailable; using local prototype store: ${error.message}`);
    return false;
  }
}
module.exports = { connectDatabase };

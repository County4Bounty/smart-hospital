require('dotenv').config({ path: '../.env' });

const bcrypt = require('bcrypt');
const { connectDatabase } = require('../src/database');
const { User } = require('../src/models');
const mongoose = require('mongoose');

const seedUsers = [
  { email: 'admin@smart-hospital.local', name: 'System Admin', role: 'admin' },
  { email: 'nurse@smart-hospital.local', name: 'Alex Rivera', role: 'nurse' },
  { email: 'doctor2@smart-hospital.local', name: 'Daniel Kim', role: 'doctor' }
];

async function main() {
  const connected = await connectDatabase();
  if (!connected) {
    console.log('MongoDB unavailable; seed skipped.');
    return;
  }

  const password = process.env.SEED_USER_PASSWORD || 'DevPassword123!';
  const results = { created: [], skipped: [] };

  for (const candidate of seedUsers) {
    const email = candidate.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      results.skipped.push(email);
      console.log(`Skipped existing user: ${email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await User.create({
      name: candidate.name,
      email,
      passwordHash,
      role: candidate.role
    });

    results.created.push({ email: created.email, role: created.role });
    console.log(`Created user: ${created.email} (${created.role})`);
  }

  console.log('Seed summary:', JSON.stringify(results, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error.message);
  mongoose.disconnect().finally(() => process.exit(1));
});

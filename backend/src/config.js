require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};

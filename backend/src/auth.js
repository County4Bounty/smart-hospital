const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwtSecret } = require('./config');
const { User } = require('./models');
const bootstrapEmail = process.env.BOOTSTRAP_USER_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_USER_PASSWORD;

const demoUsers = bootstrapEmail && bootstrapPassword ? [{ id: 'U-1', name: 'Priya Shah', email: bootstrapEmail.toLowerCase(), role: 'doctor', passwordHash: bcrypt.hashSync(bootstrapPassword, 10) }] : [];

class InvalidAuthenticationError extends Error {}
class AuthenticationDatabaseError extends Error {}

async function login(email, password) {
  const user = demoUsers.find((item) => item.email === String(email).toLowerCase());
  if (user && (await bcrypt.compare(password, user.passwordHash))) {
    const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: '8h' });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  const mongoUser = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash').lean();
  if (!mongoUser || !(await bcrypt.compare(password, mongoUser.passwordHash))) return null;
  if (mongoUser.isActive === false) {
    const error = new Error('Account is deactivated');
    error.statusCode = 403;
    throw error;
  }

  const token = jwt.sign({ sub: mongoUser._id.toString(), role: mongoUser.role, name: mongoUser.name }, jwtSecret, { expiresIn: '8h' });
  return { token, user: { id: mongoUser._id.toString(), name: mongoUser.name, email: mongoUser.email, role: mongoUser.role } };
}

async function authenticateToken(token) {
  let claims;
  try {
    claims = jwt.verify(token, jwtSecret);
  } catch {
    throw new InvalidAuthenticationError('Invalid or expired token');
  }

  if (claims.sub === 'U-1') {
    return { sub: 'U-1', role: 'doctor', name: 'Priya Shah' };
  }
  if (typeof claims.sub !== 'string' || !mongoose.Types.ObjectId.isValid(claims.sub)) {
    throw new InvalidAuthenticationError('Invalid user identity');
  }

  let user;
  try {
    user = await User.findById(claims.sub).select('name email role isActive').lean();
  } catch {
    throw new AuthenticationDatabaseError('Unable to verify user');
  }
  if (!user || user.isActive === false) {
    throw new InvalidAuthenticationError('Invalid or inactive user');
  }
  return { sub: user._id.toString(), role: user.role, name: user.name };
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    req.user = await authenticateToken(token);
    return next();
  } catch (error) {
    if (error instanceof AuthenticationDatabaseError) return res.status(500).json({ message: 'Authentication service unavailable' });
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { authenticateToken, login, requireAuth, requireRole };

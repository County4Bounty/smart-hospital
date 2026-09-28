const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./config');
const bootstrapEmail = process.env.BOOTSTRAP_USER_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_USER_PASSWORD;

const demoUsers = bootstrapEmail && bootstrapPassword ? [{ id: 'U-1', name: 'Priya Shah', email: bootstrapEmail.toLowerCase(), role: 'doctor', passwordHash: bcrypt.hashSync(bootstrapPassword, 10) }] : [];

async function login(email, password) {
  const user = demoUsers.find((item) => item.email === String(email).toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: '8h' });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { req.user = jwt.verify(token, jwtSecret); return next(); } catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}

module.exports = { login, requireAuth };

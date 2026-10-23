const http = require('node:http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { authenticateToken } = require('./auth');
const { port, corsOrigin } = require('./config');
const { connectDatabase } = require('./database');

const io = new Server({ cors: { origin: corsOrigin } });
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('unauthorized'));
  try { socket.user = await authenticateToken(token); return next(); } catch { return next(new Error('unauthorized')); }
});
const app = createApp(io);
const server = http.createServer(app);
io.attach(server);
io.on('connection', (socket) => socket.emit('connected', { service:'smart-hospital-api' }));
connectDatabase().finally(() => server.listen(port, () => console.log(`Smart Hospital API listening on http://localhost:${port}`)));

const http = require('node:http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { port, corsOrigin, jwtSecret } = require('./config');
const { connectDatabase } = require('./database');

const io = new Server({ cors: { origin: corsOrigin } });
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('unauthorized'));
  try {
    const user = jwt.verify(token, jwtSecret);
    socket.user = user;
    return next();
  } catch {
    return next(new Error('unauthorized'));
  }
});
const app = createApp(io);
const server = http.createServer(app);
io.attach(server);
io.on('connection', (socket) => socket.emit('connected', { service:'smart-hospital-api' }));
connectDatabase().finally(() => server.listen(port, () => console.log(`Smart Hospital API listening on http://localhost:${port}`)));

const http = require('node:http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { port, corsOrigin } = require('./config');
const { connectDatabase } = require('./database');

const server = http.createServer();
const io = new Server(server, { cors: { origin: corsOrigin } });
const app = createApp(io);
server.on('request', app);
io.on('connection', (socket) => socket.emit('connected', { service: 'smart-hospital-api' }));
connectDatabase().finally(() => server.listen(port, () => console.log(`Smart Hospital API listening on http://localhost:${port}`)));

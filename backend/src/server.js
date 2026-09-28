const http = require('node:http');
const { Server } = require('socket.io');
const { createApp } = require('./app');
const { port, corsOrigin } = require('./config');
const { connectDatabase } = require('./database');

const io = new Server({ cors: { origin: corsOrigin } });
const app = createApp(io);
const server = http.createServer(app);
io.attach(server);
io.on('connection', (socket) => socket.emit('connected', { service:'smart-hospital-api' }));
connectDatabase().finally(() => server.listen(port, () => console.log(`Smart Hospital API listening on http://localhost:${port}`)));
/**
 * Redstring — Express + Socket.io Server
 * =========================================
 * Entry point for the entire backend.
 *
 * Responsibilities:
 *  1. Spin up Express HTTP server
 *  2. Attach Socket.io to it (same port, different upgrade path)
 *  3. Connect to MongoDB and Redis
 *  4. Register all REST routes
 *  5. Register all Socket.io namespaces
 *  6. Start cron jobs (lab timers, weather ticks)
 *
 * Run: node server.js
 * Dev: nodemon server.js
 */

require('dotenv').config();
const express       = require('express');
const http          = require('http');
const { Server }    = require('socket.io');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');

const { connectRedis } = require('./services/redisService');

async function startServer() {
    try {
        // Connect to Redis first
        await connectRedis();

        // Then start your Express/Socket.io server
        const app = express();
        const server = http.createServer(app);
        // ... rest of your server setup
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer();
const { startCronJobs }    = require('./services/cronService');

// ── Routes ────────────────────────────────────
const authRoutes     = require('./routes/auth.routes');
const caseRoutes     = require('./routes/case.routes');
const roomRoutes     = require('./routes/room.routes');
const sessionRoutes  = require('./routes/session.routes');
const userRoutes     = require('./routes/user.routes');

// ── Socket.io handlers ────────────────────────
const { registerWarRoomHandlers }  = require('./sockets/warRoom.socket');
const { registerCaseEventHandlers }= require('./sockets/caseEvents.socket');

// ─────────────────────────────────────────────
//  APP SETUP
// ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// Allowed origins: React Native metro, web dev, and production
const ALLOWED_ORIGINS = [
    'http://localhost:3000',  // Web dev
    'http://localhost:8081',  // Expo metro
    process.env.FRONTEND_URL, // Production web
].filter(Boolean);

// ── Socket.io ─────────────────────────────────
const io = new Server(server, {
    cors: {
        origin:      ALLOWED_ORIGINS,
        methods:     ['GET', 'POST'],
        credentials: true,
    },
    // Allow long-polling fallback for mobile clients on bad connections
    transports: ['websocket', 'polling'],
    // Ping timeout: if a client doesn't respond in the 10s, disconnect
    pingTimeout:  10000,
    pingInterval: 25000,
});

// ── Middleware ────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting: 200 requests per 15 minutes per IP
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
}));

// Attach io instance to every request so controllers can emit events
app.use((req, _res, next) => { req.io = io; next(); });

// ── REST Routes ───────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/cases',    caseRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users',    userRoutes);

// Health check (used by Docker/load balancer)
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Global Error Handler ──────────────────────
app.use((err, _req, res, _next) => {
    console.error('[ERROR]', err.message, err.stack);
    const status = err.statusCode || 500;
    res.status(status).json({
        error:   err.message || 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// ─────────────────────────────────────────────
//  SOCKET.IO NAMESPACES
// ─────────────────────────────────────────────

/**
 * /war-room namespace — multiplayer investigation rooms
 * Every room is a Socket.io "room" (channel) within this namespace.
 * Event flow:
 *   a client joins → server validates → client added to room channel
 *   client acts → server processes → server broadcasts to room
 */
const warRoomNsp = io.of('/war-room');
registerWarRoomHandlers(warRoomNsp);

/**
 * /case-events namespace — solo player case updates
 * Used for: lab timer completions, twist notifications, weather shifts.
 * Each connected socket joins a personal channel: `user:${userId}`
 */
const caseEventsNsp = io.of('/case-events');
registerCaseEventHandlers(caseEventsNsp);

// ─────────────────────────────────────────────
//  STARTUP SEQUENCE
// ─────────────────────────────────────────────
async function start() {
    try {
        // 1. Connect MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/redstring', {
            dbName: 'redstring',
        });
        console.log('✅  MongoDB connected');

        // 2. Connect Redis
        await connectRedis();
        console.log('✅  Redis connected');

        // 3. Start background cron jobs
        startCronJobs(caseEventsNsp);
        console.log('✅  Cron jobs started');

        // 4. Start HTTP server
        const PORT = process.env.PORT || 4000;
        server.listen(PORT, () => {
            console.log(`🚀  Redstring server running on port ${PORT}`);
            console.log(`   REST API  → http://localhost:${PORT}/api`);
            console.log(`   Socket.io → ws://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌  Startup failed:', err);
        process.exit(1);
    }
}

start();

module.exports = { app, server, io };


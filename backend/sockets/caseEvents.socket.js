/**
 * Redstring — Case Events Socket.io Handler
 * ============================================
 * Namespace: /case-events
 *
 * Used for solo player real-time updates:
 *   - Lab timer completions (push notification + in-app)
 *   - Twist events during solo play
 *   - Weather shifts
 *   - Jump scare scheduler
 *
 * Each connected socket joins `user:{userId}` automatically.
 * The cron service calls broadcastTo* helpers to push events.
 */

const { socketAuth } = require('../middleware/auth.middleware');

function registerCaseEventHandlers(nsp) {
    nsp.use(socketAuth);

    nsp.on('connection', (socket) => {
        const { userId, displayName } = socket.data.user;

        // Each solo player gets their own private channel
        socket.join(`user:${userId}`);
        console.log(`[CaseEvents] ${displayName} connected`);

        // Client tells server which session is active (for jump scare scheduling)
        socket.on('session:active', ({ sessionId, sceneId }) => {
            socket.data.sessionId = sessionId;
            socket.data.sceneId   = sceneId;
        });

        // Client updates the current scene (affects jump scare pool)
        socket.on('scene:enter', ({ sceneId }) => {
            socket.data.sceneId = sceneId;
        });

        socket.on('disconnect', () => {
            console.log(`[CaseEvents] ${displayName} disconnected`);
        });
    });
}

// ─────────────────────────────────────────────
//  BROADCAST HELPERS
// ─────────────────────────────────────────────

/**
 * Push a lab result to a specific user
 */
function broadcastLabResultToUser(nsp, userId, payload) {
    nsp.to(`user:${userId}`).emit('lab:result', payload);
}

/**
 * Push a twist event to a specific user
 */
function broadcastTwistToUser(nsp, userId, twist) {
    nsp.to(`user:${userId}`).emit('twist:fired', twist);
}

/**
 * Push a weather change to a specific user
 */
function broadcastWeatherToUser(nsp, userId, weather) {
    nsp.to(`user:${userId}`).emit('weather:changed', weather);
}

/**
 * Trigger a jump scare for a specific user
 */
function broadcastJumpScareToUser(nsp, userId, scareEvent) {
    nsp.to(`user:${userId}`).emit('jump:scare', scareEvent);
}

module.exports = {
    registerCaseEventHandlers,
    broadcastLabResultToUser,
    broadcastTwistToUser,
    broadcastWeatherToUser,
    broadcastJumpScareToUser,
};
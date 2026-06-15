/**
 * RedString — Redis Service
 * ===========================
 * Handles:
 *  - Room state caching (sub-100ms reads for Socket.io)
 *  - Weather state TTL keys
 *  - Active timer lookups
 *  - Rate-limit counters (supplement to express-rate-limit)
 *
 * Uses: ioredis
 * Install: npm install ioredis
 */

const Redis = require('ioredis');

let client;

async function connectRedis() {
    const useTLS = process.env.REDIS_TLS === 'true';

    client = new Redis({
        host:        process.env.REDIS_HOST || 'localhost',
        port:        parseInt(process.env.REDIS_PORT) || 6379,
        password:    process.env.REDIS_PASSWORD || undefined,
        // Managed Redis providers (Upstash, ElastiCache, etc.) require TLS.
        // Set REDIS_TLS=true in production env vars to enable.
        ...(useTLS ? { tls: {} } : {}),
        // Auto-reconnect with exponential backoff
        retryStrategy: (times) => Math.min(times * 100, 3000),
        // Prefix all keys to avoid collisions
        keyPrefix: 'cs:',
    });

    client.on('error', (err) => console.error('[Redis] Error:', err.message));
    client.on('ready', () => console.log('[Redis] Connected'));

    // Test the connection
    await client.ping();
    return client;
}

function getClient() {
    if (!client) throw new Error('Redis not connected. Call connectRedis() first.');
    return client;
}

// ─────────────────────────────────────────────
//  GENERIC KEY-VALUE CACHE
// ─────────────────────────────────────────────

/**
 * Set a JSON value in Redis with optional TTL (seconds)
 */
async function setCache(key, value, ttlSeconds = 3600) {
    const redis = getClient();
    const serialised = JSON.stringify(value);
    if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialised);
    } else {
        await redis.set(key, serialised);
    }
}

/**
 * Get a cached JSON value
 */
async function getFromCache(key) {
    const redis = getClient();
    const raw = await redis.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return raw; }
}

/**
 * Delete a cached key
 */
async function deleteCache(key) {
    const redis = getClient();
    await redis.del(key);
}

// ─────────────────────────────────────────────
//  WEATHER STATE
// ─────────────────────────────────────────────

/**
 * Set a scripted weather event that expires automatically.
 * After TTL, the weather engine reverts to base conditions.
 */
async function setWeatherEvent(identifier, condition, durationMinutes) {
    const key = `weather:${identifier}`;
    await setCache(key, { condition, setAt: Date.now() }, durationMinutes * 60);
}

async function getActiveWeatherEvent(identifier) {
    return getFromCache(`weather:${identifier}`);
}

// ─────────────────────────────────────────────
//  ACTIVE TIMER FAST LOOKUP
// ─────────────────────────────────────────────

/**
 * Store a sorted set of timer completion timestamps for fast cron lookup.
 * ZADD cs:timers <completesAt_unix> <sessionId:timerId>
 */
async function registerTimer(sessionId, timerId, completesAt) {
    const redis = getClient();
    const score = new Date(completesAt).getTime();
    await redis.zadd('timers', score, `${sessionId}:${timerId}`);
}

/**
 * Get all timers that should have completed by now.
 * Called by cron every minute.
 */
async function getExpiredTimers() {
    const redis = getClient();
    const now = Date.now();
    // Get all members with score <= now
    const expired = await redis.zrangebyscore('timers', '-inf', now);
    if (expired.length > 0) {
        // Remove them from the set
        await redis.zremrangebyscore('timers', '-inf', now);
    }
    return expired.map(entry => {
        const [sessionId, timerId] = entry.split(':');
        return { sessionId, timerId };
    });
}

// ─────────────────────────────────────────────
//  JUMP SCARE THROTTLE
// ─────────────────────────────────────────────

/**
 * Ensure the same jump scare doesn't fire twice in a short window.
 * Sets a TTL flag after a scare fires.
 */
async function canFireJumpScare(userId, scareKey) {
    const redis = getClient();
    const key = `jumpscare:${userId}:${scareKey}`;
    const exists = await redis.exists(key);
    if (exists) return false;
    // Lock this scare for 5 minutes
    await redis.setex(key, 300, '1');
    return true;
}

// ─────────────────────────────────────────────
//  ROOM ONLINE MEMBER COUNT
// ─────────────────────────────────────────────

async function setRoomMemberOnline(roomCode, userId) {
    const redis = getClient();
    await redis.sadd(`room:online:${roomCode}`, userId);
    await redis.expire(`room:online:${roomCode}`, 60 * 60 * 4); // 4hr TTL
}

async function setRoomMemberOffline(roomCode, userId) {
    const redis = getClient();
    await redis.srem(`room:online:${roomCode}`, userId);
}

async function getOnlineMembers(roomCode) {
    const redis = getClient();
    return redis.smembers(`room:online:${roomCode}`);
}

module.exports = {
    connectRedis,
    getClient,
    setCache,
    getFromCache,
    deleteCache,
    setWeatherEvent,
    getActiveWeatherEvent,
    registerTimer,
    getExpiredTimers,
    canFireJumpScare,
    setRoomMemberOnline,
    setRoomMemberOffline,
    getOnlineMembers,
};
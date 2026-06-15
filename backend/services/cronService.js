/**
 * Redstring — Cron Service
 * ==========================
 * Background jobs that run on a schedule.
 *
 * Jobs:
 *  1. processLabTimers — every 1 min — complete expired lab timers, send push + socket
 *  2. weatherTick — every 5 min — update weather for active rooms/sessions
 *  3. jumpScareScheduler — every 3 min — trigger atmospheric scare for online players
 *  4. cleanupRooms — every 1 hr — mark abandoned room, clean stale sessions
 *
 * Use: node-cron
 * Install: npm install node-cron
 */

const cron = require('node-cron');

const PlayerSession = require('../schema/playerSession.schema');
const Room          = require('../schema/room.schema');
const CaseFile      = require('../schema/caseFile.schema');
const User          = require('../schema/user.schema');

const { processExpiredTimers, getCurrentWeather } = require('../game-engine/caseEngine');
const { getExpiredTimers, canFireJumpScare, setWeatherEvent } = require('./redisService');
const { sendPushNotification } = require('./notificationService');

const {
    broadcastLabResult,
    broadcastTwist,
    broadcastWeatherChange,
    broadcastJumpScare,
} = require('../sockets/warRoom.socket');

const {
    broadcastLabResultToUser,
    broadcastTwistToUser,
    broadcastWeatherToUser,
    broadcastJumpScareToUser,
} = require('../sockets/caseEvents.socket');

// ─────────────────────────────────────────────
//  INIT — called from server.js
// ─────────────────────────────────────────────

function startCronJobs(caseEventsNsp) {
    // ── 1. Lab Timer Processing (every minute) ────
    cron.schedule('* * * * *', async () => {
        try {
            await runLabTimerJob(caseEventsNsp);
        } catch (err) {
            console.error('[Cron] Lab timer job failed:', err.message);
        }
    });

    // ── 2. Weather Tick (every 5 minutes) ─────────
    cron.schedule('*/5 * * * *', async () => {
        try {
            await runWeatherTickJob(caseEventsNsp);
        } catch (err) {
            console.error('[Cron] Weather tick failed:', err.message);
        }
    });

    // ── 3. Jump Scare Scheduler (every 3 minutes) ─
    cron.schedule('*/3 * * * *', async () => {
        try {
            await runJumpScareJob(caseEventsNsp);
        } catch (err) {
            console.error('[Cron] Jump scare job failed:', err.message);
        }
    });

    // ── 4. Room Cleanup (every hour) ─────────────
    cron.schedule('0 * * * *', async () => {
        try {
            await runRoomCleanupJob();
        } catch (err) {
            console.error('[Cron] Room cleanup failed:', err.message);
        }
    });

    console.log('[Cron] All jobs scheduled');
}

// ─────────────────────────────────────────────
//  JOB 1 — LAB TIMER PROCESSING
// ─────────────────────────────────────────────

async function runLabTimerJob(caseEventsNsp) {
    // processExpiredTimers returns list of completed timers with session + user info
    const completedTimers = await processExpiredTimers();

    for (const item of completedTimers) {
        const { sessionId, userId, roomId, timerId, label, triggeredTwists } = item;

        // Get the case file to find the result clue details
        const session = await PlayerSession.findById(sessionId);
        if (!session) continue;

        const caseFile = await CaseFile.findOne({ caseId: session.caseId });
        const timerTemplate = caseFile?.passiveTimers?.find(t => t.timerId === timerId);
        if (!timerTemplate) continue;

        const payload = {
            timerId,
            label,
            resultClueId:  timerTemplate.resultClueId,
            notificationTitle: timerTemplate.notificationTitle,
            notificationBody:  timerTemplate.notificationBody,
            triggeredTwists,
        };

        if (roomId) {
            // Multiplayer: broadcast to whole room
            broadcastLabResult(null /* nsp injected below */, roomId.toString(), payload);
        } else {
            // Solo: push to individual user's socket channel
            broadcastLabResultToUser(caseEventsNsp, userId.toString(), payload);
        }

        // Send push notification (works even if the app is closed)
        const user = await User.findById(userId).select('fcmTokens settings');
        if (user?.settings?.notificationsEnabled && user.fcmTokens?.length > 0) {
            await sendPushNotification(
                user.fcmTokens,
                timerTemplate.notificationTitle,
                timerTemplate.notificationBody,
                { type: 'lab_result', sessionId: sessionId.toString(), timerId }
            );
        }

        // Broadcast any triggered twists
        for (const twist of triggeredTwists || []) {
            if (roomId) {
                broadcastTwist(null, roomId.toString(), twist);
            } else {
                broadcastTwistToUser(caseEventsNsp, userId.toString(), twist);
            }
        }

        console.log(`[Cron] Lab timer complete: ${label} → session ${sessionId}`);
    }
}

// ─────────────────────────────────────────────
//  JOB 2 — WEATHER TICK
// ─────────────────────────────────────────────

/**
 * Every 5 minutes, recalculate weather for all active rooms
 * and push updates if conditions changed.
 * Weather can affect:
 *  - Clue visibility in outdoor scenes
 *  - Jump scare probability
 *  - Ambient sound layer on a client
 */
async function runWeatherTickJob(caseEventsNsp) {
    const activeRooms = await Room.find({ status: 'active' })
        .select('_id roomCode caseId currentWeather');

    for (const room of activeRooms) {
        // Create a fake session-like object for getCurrentWeather
        const fakeSession = { caseId: room.caseId, weatherLog: [], triggeredTwistIds: [] };
        const weather = await getCurrentWeather(fakeSession);

        const prevCondition = room.currentWeather?.condition;
        if (weather.condition !== prevCondition) {
            // Condition changed — update DB and broadcast
            room.currentWeather = { ...weather, updatedAt: new Date() };
            await room.save();

            broadcastWeatherChange(null, room.roomCode, weather);
            console.log(`[Cron] Weather changed for room ${room.roomCode}: ${prevCondition} → ${weather.condition}`);
        }
    }

    // Also update solo active sessions
    const activeSessions = await PlayerSession.find({ status: 'active', roomId: null })
        .select('_id userId caseId weatherLog triggeredTwistIds');

    for (const session of activeSessions) {
        const weather = await getCurrentWeather(session);
        broadcastWeatherToUser(caseEventsNsp, session.userId.toString(), weather);
    }
}

// ─────────────────────────────────────────────
//  JOB 3 — JUMP SCARE SCHEDULER
// ─────────────────────────────────────────────

/**
 * Jump scares are probabilistic, not scripted (except twist-linked ones).
 * This job fires atmospheric scares for players who:
 *  - Are currently in a high-haunting-level scene
 *  - Have been in the scene for >2 minutes
 *  - Haven't seen a scare in the last 5 minutes
 *
 * Scare probability:
 *  hauntingLevel 1: 5% per tick
 *  hauntingLevel 2: 15%
 *  hauntingLevel 3: 30%
 *  hauntingLevel 4: 50%
 *  hauntingLevel 5: 80%
 */
const SCARE_PROBABILITY = { 0: 0, 1: 0.05, 2: 0.15, 3: 0.30, 4: 0.50, 5: 0.80 };

async function runJumpScareJob(caseEventsNsp) {
    // Only process R-rated content players (jump scares for adults)
    const onlineSessions = await PlayerSession.find({
        status: 'active',
        currentSceneId: { $exists: true, $ne: null },
    }).populate('userId', 'contentRating settings');

    for (const session of onlineSessions) {
        if (!session.userId) continue;
        const user = session.userId;
        if (user.contentRating !== 'R') continue; // PG13: no intense jump scares
        if (user.settings?.jumpScareIntensity === 'off') continue;

        const caseFile = await CaseFile.findOne({ caseId: session.caseId });
        if (!caseFile) continue;

        const scene = caseFile.scenes.find(s => s.sceneId === session.currentSceneId);
        if (!scene) continue;

        const hauntingLevel = scene.atmosphere?.hauntingLevel || 0;
        const probability   = SCARE_PROBABILITY[hauntingLevel] || 0;
        if (probability === 0) continue;

        // Random roll
        if (Math.random() > probability) continue;

        // Pick a random scare from the scene's pool
        const pool = scene.atmosphere?.jumpScarePool || caseFile.jumpScarePool || [];
        if (pool.length === 0) continue;

        const scareKey = pool[Math.floor(Math.random() * pool.length)];

        // Check Redis throttle — don't repeat the same scare within 5 min
        const canFire = await canFireJumpScare(user._id.toString(), scareKey);
        if (!canFire) continue;

        const intensity = user.settings?.jumpScareIntensity || 'full';

        const scareEvent = {
            scareKey,
            sceneId:   session.currentSceneId,
            intensity,
            timestamp: Date.now(),
        };

        // Send it to individual user
        broadcastJumpScareToUser(caseEventsNsp, user._id.toString(), scareEvent);
        console.log(`[Cron] Jump scare fired: ${scareKey} → user ${user._id}`);
    }
}

// ─────────────────────────────────────────────
//  JOB 4 — ROOM CLEANUP
// ─────────────────────────────────────────────

/**
 * Marks rooms as abandoned if all members have been offline for >2 hours.
 * Marks sessions as abandoned if the case timeline expired (e.g., 72hr case started 80hrs ago).
 */
async function runRoomCleanupJob() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Rooms where all members' lastSeenAt is > 2 hours ago
    const staleRooms = await Room.find({
        status: 'active',
        'members.isOnline': { $ne: true },
        'members.lastSeenAt': { $lt: twoHoursAgo },
    });

    for (const room of staleRooms) {
        const allOffline = room.members.every(
            m => !m.isOnline && m.lastSeenAt < twoHoursAgo
        );
        if (allOffline) {
            room.status = 'abandoned';
            await room.save();
            console.log(`[Cron] Room ${room.roomCode} marked abandoned`);
        }
    }

    // Expired sessions (case duration exceeded)
    const activeSessions = await PlayerSession.find({ status: 'active' });
    for (const session of activeSessions) {
        const caseFile = await CaseFile.findOne({ caseId: session.caseId });
        if (!caseFile) continue;

        const elapsedHours = (Date.now() - session.startedAt) / (1000 * 60 * 60);
        if (elapsedHours > caseFile.durationHours * 1.1) {
            // Grace period: 10% over time limit
            session.status = 'failed';
            await session.save();
            console.log(`[Cron] Session ${session._id} timed out`);
        }
    }
}

module.exports = { startCronJobs };
/**
 * Redstring — Core Game Engine
 * ================================
 * This module handles all game state transitions:
 *   - Examining a clue and unlocking children
 *   - Interrogating a suspect and cracking alibi layers
 *   - Checking if a twist should fire
 *   - Starting and resolving passive lab timers
 *   - Weather effects on gameplay
 *   - Processing final accusations
 *
 * All functions are pure (input → output) where possible.
 * Side effects (DB writes, push notifications) are handled
 * by the calling service layer (caseService.js).
 */

const CaseFile     = require('../schema/caseFile.schema');
const PlayerSession= require('../schema/playerSession.schema');
const Room         = require('../schema/room.schema');

// ─────────────────────────────────────────────
//  CLUE ENGINE
// ─────────────────────────────────────────────

/**
 * Player examines a clue.
 * Returns:
 *  - Updated clue state
 *  - List of newly unlocked child clue IDs
 *  - Whether a twist was triggered
 *  - Lab timer to start (if any)
 */
async function examineClue(sessionId, clueId) {
    const session = await PlayerSession.findById(sessionId);
    const caseFile = await CaseFile.findOne({ caseId: session.caseId });

    const clue = caseFile.clues.find(c => c.clueId === clueId);
    if (!clue) throw new Error(`Clue ${clueId} not found in case ${session.caseId}`);

    // Check weather degradation
    const weather = await getCurrentWeather(session);
    if (clue.weatherSensitive) {
        const degraded = checkWeatherDegradation(clue, weather);
        if (degraded.isDestroyed) {
            await updateClueState(session, clueId, 'destroyed', { degraded: true, degradedReason: degraded.reason });
            return {
                success: false,
                message: degraded.message,
                clueDestroyed: true,
            };
        }
    }

    // Mark clue as examined
    await updateClueState(session, clueId, 'examined');

    // Find newly unlocked child clues
    const unlockedChildren = caseFile.clues
        .filter(c => c.parentClueId === clueId)
        .map(c => c.clueId);

    // Mark children as 'found' (visible but not yet examined)
    for (const childId of unlockedChildren) {
        await updateClueState(session, childId, 'found');
    }

    // Check if this triggers a lab timer
    let labTimer = null;
    if (clue.requiresLabWork) {
        const timerTemplate = caseFile.passiveTimers.find(t => t.resultClueId === clueId);
        if (timerTemplate) {
            labTimer = await startLabTimer(session, timerTemplate, caseFile.difficulty);
        }
    }

    // Check for twist triggers
    const triggeredTwists = await checkTwistTriggers(session, caseFile, {
        type: 'clue_found',
        id: clueId
    });

    return {
        success: true,
        clueId,
        unlockedChildClueIds: unlockedChildren,
        labTimerStarted: labTimer,
        triggeredTwists,
        weatherNote: weather.activeEffects.length > 0 ? weather.activeEffects : null,
    };
}

// ─────────────────────────────────────────────
//  SUSPECT INTERROGATION ENGINE
// ─────────────────────────────────────────────

/**
 * Player interrogates a suspect.
 * Optionally presents evidence (clueId) to crack an alibi layer.
 * Returns the suspect's response and whether the alibi cracked.
 */
async function interrogateSuspect(sessionId, suspectId, presentClueId = null) {
    const session = await PlayerSession.findById(sessionId);
    const caseFile = await CaseFile.findOne({ caseId: session.caseId });

    const suspect = caseFile.suspects.find(s => s.suspectId === suspectId);
    if (!suspect) throw new Error(`Suspect ${suspectId} not found`);

    // Get or create interrogation state
    let interrogation = session.interrogations.find(i => i.suspectId === suspectId);
    if (!interrogation) {
        session.interrogations.push({
            suspectId,
            currentAlibiLayer: 0,
            lastInterrogatedAt: new Date(),
            evidencePresentedIds: [],
            behavioralNotes: [],
        });
        interrogation = session.interrogations[session.interrogations.length - 1];
    }

    interrogation.lastInterrogatedAt = new Date();

    const currentLayer = suspect.alibiChain[interrogation.currentAlibiLayer];
    let alibiBroke = false;
    let newStatement = currentLayer.statement;
    let revealText = null;

    // If player presented evidence, check if it cracks the current alibi layer
    if (presentClueId) {
        interrogation.evidencePresentedIds.push(presentClueId);

        if (currentLayer.crackedByClue === presentClueId) {
            alibiBroke = true;
            revealText = currentLayer.revealText;
            interrogation.currentAlibiLayer += 1;

            // Move to next layer if exists
            const nextLayer = suspect.alibiChain[interrogation.currentAlibiLayer];
            if (nextLayer) {
                newStatement = nextLayer.statement;
            } else {
                newStatement = '(Suspect has no further alibis to offer. They have shut down.)';
            }

            // Generate behavioral note
            interrogation.behavioralNotes.push(
                `Alibi layer ${interrogation.currentAlibiLayer - 1} broken at ${new Date().toISOString()} ` +
                `using clue: ${presentClueId}`
            );
        }
    }

    // Check for twist triggers
    const triggeredTwists = await checkTwistTriggers(session, caseFile, {
        type: 'suspect_interrogated',
        id: suspectId
    });

    await session.save();

    return {
        suspectId,
        suspectName: suspect.name,
        currentStatement: newStatement,
        alibiBroke,
        revealText,
        currentAlibiLayer: interrogation.currentAlibiLayer,
        totalAlibiLayers: suspect.alibiChain.length,
        // AI prompt hint — calling service sends this to LLM to generate realistic dialogue
        aiPromptContext: {
            suspectPersonality: suspect.personality,
            alibiBroke,
            evidencePresented: presentClueId,
            sessionHistory: interrogation.evidencePresentedIds,
        },
        triggeredTwists,
    };
}

// ─────────────────────────────────────────────
//  TWIST ENGINE
// ─────────────────────────────────────────────

/**
 * Check whether any untriggered twists should fire
 * given the current game event.
 */
async function checkTwistTriggers(session, caseFile, event) {
    const triggered = [];
    const alreadyFired = session.triggeredTwistIds || [];

    for (const twist of caseFile.twists) {
        if (alreadyFired.includes(twist.twistId)) continue;

        const shouldFire =
            twist.triggerType === event.type &&
            twist.triggerId === event.id;

        if (shouldFire) {
            // Apply twist effects
            if (twist.effects.newSceneUnlocked && !session.unlockedSceneIds.includes(twist.effects.newSceneUnlocked)) {
                session.unlockedSceneIds.push(twist.effects.newSceneUnlocked);
            }
            if (twist.effects.newSuspectUnlocked) {
                // Mark suspect as unlocked — implement in your suspect service
            }
            // Schedule weather shift
            if (twist.effects.weatherShift) {
                await scheduleWeatherEvent(session, twist.effects.weatherShift, 30); // 30 min duration
            }

            session.triggeredTwistIds.push(twist.twistId);
            triggered.push({
                twistId:       twist.twistId,
                title:         twist.title,
                narrativeText: twist.narrativeText,
                jumpScareEvent: twist.effects.jumpScareEvent,
            });
        }
    }

    await session.save();
    return triggered;
}

// ─────────────────────────────────────────────
//  PASSIVE TIMER ENGINE
// ─────────────────────────────────────────────

/**
 * Start a lab timer for a clue that requires analysis.
 * The duration is pulled from the template based on case difficulty.
 */
async function startLabTimer(session, timerTemplate, difficulty) {
    const durationMinutes = timerTemplate.durationByDifficulty[difficulty] || 240;
    const now = new Date();
    const completesAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const timerInstance = {
        timerId:      timerTemplate.timerId,
        label:        timerTemplate.label,
        submittedAt:  now,
        completesAt,
        isComplete:   false,
        notificationSent: false,
    };

    session.activeTimers.push(timerInstance);
    await session.save();

    return {
        timerId:      timerTemplate.timerId,
        label:        timerTemplate.label,
        completesAt,
        durationMinutes,
    };
}

/**
 * Called by cron job every minute.
 * Finds all sessions with expired timers, marks them complete,
 * queues push notifications, and unlocks result clues.
 */
async function processExpiredTimers() {
    const now = new Date();

    // Find sessions with pending timers that have expired
    const sessions = await PlayerSession.find({
        'activeTimers.completesAt': { $lte: now },
        'activeTimers.isComplete': false,
        status: 'active',
    });

    const results = [];
    for (const session of sessions) {
        const expiredTimers = session.activeTimers.filter(
            t => !t.isComplete && t.completesAt <= now
        );

        for (const timer of expiredTimers) {
            timer.isComplete = true;
            timer.resultDeliveredAt = now;

            // Unlock the result clue
            await updateClueState(session, getResultClueId(timer.timerId), 'found');

            // Check if this triggers a twist
            const caseFile = await CaseFile.findOne({ caseId: session.caseId });
            const twistResults = await checkTwistTriggers(session, caseFile, {
                type: 'lab_result_received',
                id: timer.timerId
            });

            results.push({
                sessionId:      session._id,
                userId:         session.userId,
                roomId:         session.roomId,
                timerId:        timer.timerId,
                label:          timer.label,
                triggeredTwists: twistResults,
            });
        }
        await session.save();
    }

    return results;  // Calling service sends push notifications for each result
}

// Helper — gets the clue that a timer unlocks
// In production, store this mapping directly rather than re-querying
async function getResultClueId(timerId) {
    // This would be cached in Redis in production
    const cases = await CaseFile.find({ 'passiveTimers.timerId': timerId });
    for (const c of cases) {
        const timer = c.passiveTimers.find(t => t.timerId === timerId);
        if (timer) return timer.resultClueId;
    }
    return null;
}

// ─────────────────────────────────────────────
//  WEATHER ENGINE
// ─────────────────────────────────────────────

/**
 * Derives current weather state for a session.
 * Combines the case's base weather seed with:
 *   - Current real-world time (day/night cycle)
 *   - Any scripted weather events from triggered twists
 *   - Random variation seeded from caseId (deterministic per case)
 */
async function getCurrentWeather(session) {
    const caseFile = await CaseFile.findOne({ caseId: session.caseId });
    const seed = caseFile.weather;
    const now = new Date();
    const hour = now.getHours();

    // Base condition from time of day
    let condition = 'clear';
    if (hour >= 22 || hour < 5) condition = 'night';
    else if (hour >= 18)        condition = 'dusk';
    else if (hour < 7)          condition = 'dawn';

    // Check for scripted weather events active right now
    const recentLog = (session.weatherLog || []).slice(-1)[0];
    if (recentLog && recentLog.timestamp > new Date(Date.now() - 60 * 60 * 1000)) {
        condition = recentLog.condition;
    }

    // Calculate active gameplay effects
    const activeEffects = [];
    if (condition === 'night')         activeEffects.push('low_visibility', 'jump_scare_probability_high');
    if (condition === 'sudden_rain')   activeEffects.push('outdoor_clues_degrading', 'footprint_visibility_low');
    if (condition === 'storm')         activeEffects.push('outdoor_clues_at_risk', 'flashlight_required', 'visibility_very_low');
    if (condition === 'dense_fog')     activeEffects.push('visibility_reduced', 'tension_high');

    return {
        condition,
        temperature: getTemperature(condition, seed.season),
        activeEffects,
    };
}

/**
 * Check if a weather-sensitive clue is degraded or destroyed.
 */
function checkWeatherDegradation(clue, weather) {
    if (clue.degradesInRain && ['sudden_rain', 'storm'].includes(weather.condition)) {
        return {
            isDestroyed: true,
            reason: 'washed_away_by_rain',
            message: 'The rain has washed away this evidence. You should have secured the scene earlier.',
        };
    }
    if (clue.degradesAtNight && weather.condition === 'night') {
        return {
            isDestroyed: false,  // not destroyed, just harder to examine
            reason: 'too_dark',
            message: 'It\'s too dark to examine this properly. You\'ll need a flashlight or to return in daylight.',
        };
    }
    return { isDestroyed: false };
}

async function scheduleWeatherEvent(session, weatherType, durationMins) {
    const weatherEntry = {
        timestamp:   new Date(),
        condition:   weatherType,
        temperature: 12,
        activeEffects: [],
    };
    session.weatherLog.push(weatherEntry);
    // In production: also set a Redis TTL key so weather reverts after durationMins
}

function getTemperature(condition, season) {
    const base = { spring: 14, summer: 22, autumn: 10, winter: 2 }[season] || 12;
    const modifier = { night: -3, storm: -5, dawn: -2, dusk: -1 }[condition] || 0;
    return base + modifier;
}

// ─────────────────────────────────────────────
//  ACCUSATION ENGINE
// ─────────────────────────────────────────────

/**
 * Player (or room) makes a final accusation.
 * Returns whether it's correct and the consequence if wrong.
 */
async function makeAccusation(sessionId, suspectId) {
    const session = await PlayerSession.findById(sessionId);
    const caseFile = await CaseFile.findOne({ caseId: session.caseId });

    const suspect = caseFile.suspects.find(s => s.suspectId === suspectId);
    const isCorrect = suspect?.isRealCulprit === true;

    const accusation = {
        suspectId,
        madeAt: new Date(),
        wasCorrect: isCorrect,
        consequence: null,
    };

    if (isCorrect) {
        // Case solved
        session.status = 'solved';
        session.solvedAt = new Date();
        session.finalAccusation = suspectId;

        // Calculate score
        session.score.final = calculateFinalScore(session);

    } else {
        // Wrong accusation
        session.wrongAccusationCount += 1;
        accusation.consequence = getWrongAccusationConsequence(
            suspectId,
            session.wrongAccusationCount,
            caseFile
        );

        if (session.wrongAccusationCount >= 5) {
            session.status = 'failed';
        }
    }

    session.accusations.push(accusation);
    await session.save();

    return {
        suspectId,
        suspectName: suspect.name,
        isCorrect,
        consequence: accusation.consequence,
        gameOver: session.status === 'solved' || session.status === 'failed',
        status: session.status,
        ...(isCorrect && {
            trueNarrative:  caseFile.trueNarrative,
            conclusionText: caseFile.conclusionText,
            finalScore:     session.score.final,
        }),
    };
}

function getWrongAccusationConsequence(suspectId, count, caseFile) {
    const suspect = caseFile.suspects.find(s => s.suspectId === suspectId);
    const consequences = [
        `${suspect.name} has layered up and will no longer speak with you.`,
        `Your credibility is taking hits. Witnesses are becoming less forthcoming.`,
        `${suspect.name} has filed a harassment complaint. Two scenes are temporarily inaccessible.`,
        `The department is questioning your judgment. You have one accusation remaining.`,
        `Case closed. Insufficient evidence, too many false accusations. The case goes cold.`,
    ];
    return consequences[Math.min(count - 1, consequences.length - 1)];
}

function calculateFinalScore(session) {
    let score = 1000;
    const playtimeHours = session.totalPlaytimeMinutes / 60;

    // Speed bonus (only for cases under 24 hours)
    if (playtimeHours < 4)  score += 300;
    else if (playtimeHours < 8)  score += 150;
    else if (playtimeHours < 24) score += 50;

    // Penalties
    score -= session.wrongAccusationCount * 150;
    score -= session.hintsUsed * 75;

    // Clue discovery bonus
    score += session.clueStates.filter(c => c.status === 'examined').length * 25;

    return Math.max(score, 0);
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

async function updateClueState(session, clueId, status, extra = {}) {
    let clueState = session.clueStates.find(c => c.clueId === clueId);
    if (!clueState) {
        session.clueStates.push({ clueId, status, ...extra });
    } else {
        clueState.status = status;
        Object.assign(clueState, extra);
    }
    if (status === 'found')    clueState.foundAt = new Date();
    if (status === 'examined') clueState.examinedAt = new Date();
    await session.save();
}

// ─────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────

module.exports = {
    examineClue,
    interrogateSuspect,
    checkTwistTriggers,
    startLabTimer,
    processExpiredTimers,
    getCurrentWeather,
    checkWeatherDegradation,
    makeAccusation,
};
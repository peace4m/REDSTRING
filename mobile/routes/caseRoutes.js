/**
 * RedString — Case Routes
 * ==========================
 * GET    /api/cases                    → List available cases
 * GET    /api/cases/:caseId            → Get full case briefing
 * POST   /api/cases/:caseId/start      → Start a new player session
 * POST   /api/sessions/:sessionId/examine-clue
 * POST   /api/sessions/:sessionId/interrogate
 * POST   /api/sessions/:sessionId/submit-lab
 * POST   /api/sessions/:sessionId/accuse
 * GET    /api/sessions/:sessionId/board
 * PATCH  /api/sessions/:sessionId/board
 */

const router  = require('express').Router();
const CaseFile = require('../../backend/schema/caseFile.schema');
const PlayerSession = require('../../backend/schema/playerSession.schema');
const { requireAuth, requireAdultContent } = require('../../backend/middleware/auth.middleware');
const { examineClue, interrogateSuspect, makeAccusation, getCurrentWeather, startLabTimer } = require('../../backend/game-engine/caseEngine');
const { getFromCache, setCache } = require('../../backend/services/redisService');

// ─────────────────────────────────────────────
//  LIST CASES
// ─────────────────────────────────────────────
/**
 * Returns a summarised list of published cases.
 * Filtered by the player's content rating automatically.
 * Supports query params:category=murder&difficulty=medium
 */
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const { category, difficulty } = req.query;
        const filter = {
            isPublished: true,
            // Only show R-rated cases to R-rated accounts
            contentRating: req.user.contentRating === 'R'
                ? { $in: ['PG13', 'R'] }
                : 'PG13',
        };
        if (category)   filter.category   = category;
        if (difficulty) filter.difficulty = difficulty;

        const cases = await CaseFile.find(filter)
            .select('caseId title tagline category contentRating difficulty timelineLabel setting playCount solveRate avgSolveTime')
            .sort({ playCount: -1 })
            .limit(50);

        res.json({ cases });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  GET CASE BRIEFING (before starting)
// ─────────────────────────────────────────────
router.get('/:caseId', requireAuth, async (req, res, next) => {
    try {
        const caseFile = await CaseFile.findOne({ caseId: req.params.caseId, isPublished: true });
        if (!caseFile) return res.status(404).json({ error: 'Case not found' });

        // Block R-rated content for PG13 users
        if (caseFile.contentRating === 'R' && req.user.contentRating !== 'R') {
            return res.status(403).json({ error: 'Adult content rating required for this case.' });
        }

        // Return only what the player should see before starting
        // (no trueNarrative, no isRealCulprit flags, no isRedHerring flags)
        res.json({
            caseId:        caseFile.caseId,
            title:         caseFile.title,
            tagline:       caseFile.tagline,
            caseNumber:    caseFile.caseNumber,
            category:      caseFile.category,
            contentRating: caseFile.contentRating,
            difficulty:    caseFile.difficulty,
            timelineLabel: caseFile.timelineLabel,
            setting:       caseFile.setting,
            briefingText:  caseFile.briefingText,
            victimName:    caseFile.victimName,
            victimAge:     caseFile.victimAge,
            victimProfile: caseFile.victimProfile,
            maxPlayers:    caseFile.maxPlayers,
            roles:         caseFile.roles,
            soundtrackKey: caseFile.soundtrackKey,
            // Sanitised suspect list: no motive, no isRealCulprit
            suspects: caseFile.suspects.map(s => ({
                suspectId:    s.suspectId,
                name:         s.name,
                age:          s.age,
                occupation:   s.occupation,
                relationship: s.relationship,
                avatarKey:    s.avatarKey,
            })),
            // Only root scenes visible at start
            scenes: caseFile.scenes
                .filter(sc => sc.unlocksAt === null)
                .map(sc => ({
                    sceneId:        sc.sceneId,
                    name:           sc.name,
                    description:    sc.description,
                    environmentKey: sc.environmentKey,
                    atmosphere:     sc.atmosphere,
                })),
            stats: {
                playCount:    caseFile.playCount,
                solveRate:    caseFile.solveRate,
                avgSolveTime: caseFile.avgSolveTime,
            },
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  START CASE (create player session)
// ─────────────────────────────────────────────
router.post('/:caseId/start', requireAuth, async (req, res, next) => {
    try {
        const { roomId, roleId } = req.body;
        const caseFile = await CaseFile.findOne({ caseId: req.params.caseId, isPublished: true });
        if (!caseFile) return res.status(404).json({ error: 'Case not found' });

        if (caseFile.contentRating === 'R' && req.user.contentRating !== 'R') {
            return res.status(403).json({ error: 'Adult content rating required.' });
        }

        // Check for existing active session
        const existing = await PlayerSession.findOne({
            userId: req.user._id,
            caseId: req.params.caseId,
            status: 'active',
        });
        if (existing) {
            return res.json({ message: 'Resuming existing session', sessionId: existing._id, session: sanitiseSession(existing) });
        }

        // Create a new session
        const initialScenes = caseFile.scenes
            .filter(sc => sc.unlocksAt === null)
            .map(sc => sc.sceneId);

        const initialClues = caseFile.clues
            .filter(c => c.parentClueId === null)
            .map(c => ({
                clueId: c.clueId,
                status: 'found',
                foundAt: new Date(),
            }));

        const session = await PlayerSession.create({
            userId:           req.user._id,
            caseId:           req.params.caseId,
            roomId:           roomId || null,
            startedAt:        new Date(),
            unlockedSceneIds: initialScenes,
            clueStates:       initialClues,
        });

        // Increment play count on a case
        await CaseFile.findByIdAndUpdate(caseFile._id, { $inc: { playCount: 1 } });

        res.status(201).json({
            sessionId: session._id,
            session:   sanitiseSession(session),
            // Initial weather conditions
            weather:   await getCurrentWeather(session),
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  EXAMINE CLUE
// ─────────────────────────────────────────────
router.post('/sessions/:sessionId/examine-clue', requireAuth, async (req, res, next) => {
    try {
        const { clueId } = req.body;
        if (!clueId) return res.status(400).json({ error: 'clueId is required' });

        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;

        const result = await examineClue(session._id, clueId);

        // If in a room, broadcast the discovery to all members
        if (session.roomId) {
            req.io.of('/war-room')
                .to(`room:${session.roomId}`)
                .emit('clue:discovered', {
                    clueId,
                    discoveredBy: req.user.displayName,
                    unlockedChildren: result.unlockedChildClueIds,
                });
        }

        res.json(result);
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  INTERROGATE SUSPECT
// ─────────────────────────────────────────────
router.post('/sessions/:sessionId/interrogate', requireAuth, async (req, res, next) => {
    try {
        const { suspectId, presentClueId, playerQuestion } = req.body;
        if (!suspectId) return res.status(400).json({ error: 'suspectId is required' });

        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;

        const result = await interrogateSuspect(session._id, suspectId, presentClueId);

        // If alibi broke and this is a room, broadcast to teammates
        if (result.alibiBroke && session.roomId) {
            req.io.of('/war-room')
                .to(`room:${session.roomId}`)
                .emit('alibi:cracked', {
                    suspectId,
                    suspectName:      result.suspectName,
                    revealText:       result.revealText,
                    crackedBy:        req.user.displayName,
                    currentLayer:     result.currentAlibiLayer,
                    totalLayers:      result.totalAlibiLayers,
                });
        }

        // AI dialogue is generated here by the dialogue engine
        const { generateSuspectDialogue } = require('../ai/dialogueEngine');
        result.aiDialogue = await generateSuspectDialogue(result.aiPromptContext, result.currentStatement, playerQuestion || '');

        res.json(result);
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  SUBMIT EVIDENCE TO LAB (start passive timer)
// ─────────────────────────────────────────────
router.post('/sessions/:sessionId/submit-lab', requireAuth, async (req, res, next) => {
    try {
        const { timerId } = req.body;
        if (!timerId) return res.status(400).json({ error: 'timerId is required' });

        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;

        const caseFile = await CaseFile.findOne({ caseId: session.caseId });
        const timerTemplate = caseFile.passiveTimers.find(t => t.timerId === timerId);
        if (!timerTemplate) return res.status(404).json({ error: 'Timer not found in this case' });

        // Check not already running
        const alreadyRunning = session.activeTimers.find(t => t.timerId === timerId && !t.isComplete);
        if (alreadyRunning) {
            return res.json({
                message: 'Already running',
                timer: alreadyRunning,
            });
        }

        const timer = await startLabTimer(session, timerTemplate, caseFile.difficulty);

        // If in a room, let teammates know
        if (session.roomId) {
            req.io.of('/war-room')
                .to(`room:${session.roomId}`)
                .emit('lab:submitted', {
                    timerId:      timer.timerId,
                    label:        timer.label,
                    submittedBy:  req.user.displayName,
                    completesAt:  timer.completesAt,
                });
        }

        res.json({ message: `${timer.label} submitted. Results in ${timer.durationMinutes} minutes.`, timer });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  MAKE ACCUSATION
// ─────────────────────────────────────────────
router.post('/sessions/:sessionId/accuse', requireAuth, async (req, res, next) => {
    try {
        const { suspectId } = req.body;
        if (!suspectId) return res.status(400).json({ error: 'suspectId is required' });

        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;

        const result = await makeAccusation(session._id, suspectId);

        // Broadcast result to room if applicable
        if (session.roomId) {
            req.io.of('/war-room')
                .to(`room:${session.roomId}`)
                .emit('accusation:made', {
                    suspectId,
                    isCorrect:   result.isCorrect,
                    madeBy:      req.user.displayName,
                    consequence: result.consequence,
                });
        }

        // Update case stats if solved
        if (result.isCorrect) {
            const playtimeHrs = session.totalPlaytimeMinutes / 60;
            await CaseFile.findOneAndUpdate(
                { caseId: session.caseId },
                {
                    $inc: { casesSolved: 1 },
                    // Rolling average solve time (simplified)
                    $set: { avgSolveTime: playtimeHrs },
                }
            );
        }

        res.json(result);
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  GET SESSION STATE (for reconnection / resume)
// ─────────────────────────────────────────────
router.get('/sessions/:sessionId', requireAuth, async (req, res, next) => {
    try {
        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;

        const weather = await getCurrentWeather(session);
        res.json({ session: sanitiseSession(session), weather });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  SOLO EVIDENCE BOARD
// ─────────────────────────────────────────────
router.get('/sessions/:sessionId/board', requireAuth, async (req, res, next) => {
    try {
        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;
        res.json({ board: session.evidenceBoard });
    } catch (err) { next(err); }
});

router.patch('/sessions/:sessionId/board', requireAuth, async (req, res, next) => {
    try {
        const { pins, strings } = req.body;
        const session = await validateSessionOwner(req.params.sessionId, req.user._id, res);
        if (!session) return;

        if (pins)    session.evidenceBoard.pins    = pins;
        if (strings) session.evidenceBoard.strings = strings;
        await session.save();

        res.json({ board: session.evidenceBoard });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
async function validateSessionOwner(sessionId, userId, res) {
    const session = await PlayerSession.findById(sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return null; }
    if (session.userId.toString() !== userId.toString()) {
        res.status(403).json({ error: 'Not your session' }); return null;
    }
    if (session.status !== 'active') {
        res.status(400).json({ error: `Session is ${session.status}` }); return null;
    }
    return session;
}

// Strip internal flags before sending to a client
function sanitiseSession(session) {
    return {
        sessionId:       session._id,
        caseId:          session.caseId,
        status:          session.status,
        startedAt:       session.startedAt,
        unlockedSceneIds: session.unlockedSceneIds,
        clueStates:      session.clueStates,
        activeTimers:    session.activeTimers,
        triggeredTwistIds: session.triggeredTwistIds,
        wrongAccusationCount: session.wrongAccusationCount,
        hintsUsed:       session.hintsUsed,
        evidenceBoard:   session.evidenceBoard,
    };
}

// ─────────────────────────────────────────────
//  JUMP SCARE NARRATION (AI-generated flavour text)
// ─────────────────────────────────────────────
/**
 * Called by JumpScareOverlay when a jump:scare event fires.
 * Returns one short cinematic sentence describing the scare,
 * generated by the AI dialogue engine. Falls back gracefully
 * if the AI call fails — the visual/audio scare still plays.
 */
router.post('/jump-scare-narration', requireAuth, async (req, res, next) => {
    try {
        const { scareKey, sceneId, caseId } = req.body;
        if (!scareKey) return res.status(400).json({ error: 'scareKey is required' });

        let caseTitle = 'this investigation';
        if (caseId) {
            const caseFile = await CaseFile.findOne({ caseId }).select('title');
            if (caseFile) caseTitle = caseFile.title;
        }

        const { generateJumpScareText } = require('../ai/dialogueEngine');
        const text = await generateJumpScareText(scareKey, sceneId, caseTitle);

        res.json({ text });
    } catch (err) { next(err); }
});

module.exports = router;
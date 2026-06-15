/**
 * Redstring — Session Routes
 * ============================
 * Session-specific routes not covered by case.routes.js
 *
 * GET /api/sessions/:sessionId → Get session state
 * PATCH /api/sessions/:sessionId/playtime → Update playtime counter
 * POST /api/sessions/:sessionId/hint → Use a hint (-75 score points)
 * GET /api/sessions/:sessionId/weather → Current weather state
 */

const router        = require('express').Router();
const PlayerSession = require('../schema/playerSession.schema');
const { requireAuth } = require('../middleware/auth.middleware');
const { getCurrentWeather } = require('../game-engine/caseEngine');

// ── Get session ───────────────────────────────
router.get('/:sessionId', requireAuth, async (req, res, next) => {
    try {
        const session = await PlayerSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not your session' });
        }
        res.json({ session });
    } catch (err) { next(err); }
});

// ── Update playtime (called periodically from a client) ──
router.patch('/:sessionId/playtime', requireAuth, async (req, res, next) => {
    try {
        const { minutes } = req.body;
        if (!minutes || minutes < 0) return res.status(400).json({ error: 'minutes required' });

        const session = await PlayerSession.findById(req.params.sessionId);
        if (!session || session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not your session' });
        }

        session.totalPlaytimeMinutes += minutes;
        await session.save();
        res.json({ totalPlaytimeMinutes: session.totalPlaytimeMinutes });
    } catch (err) { next(err); }
});

// ── Use a hint ────────────────────────────────
router.post('/:sessionId/hint', requireAuth, async (req, res, next) => {
    try {
        const session = await PlayerSession.findById(req.params.sessionId);
        if (!session || session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not your session' });
        }
        if (session.status !== 'active') {
            return res.status(400).json({ error: 'Session is not active' });
        }

        const CaseFile = require('../schema/caseFile.schema');
        const caseFile = await CaseFile.findOne({ caseId: session.caseId });

        // Find the next unexamined non-red-herring clue
        const examinedIds = session.clueStates.filter(c => c.status === 'examined').map(c => c.clueId);
        const foundIds    = session.clueStates.filter(c => c.status === 'found').map(c => c.clueId);

        const nextClue = caseFile.clues.find(c =>
            foundIds.includes(c.clueId) &&
            !examinedIds.includes(c.clueId) &&
            !c.isRedHerring
        );

        session.hintsUsed += 1;
        await session.save();

        res.json({
            hint: nextClue
                ? `There is an unexamined clue waiting for you: "${nextClue.label}" in ${nextClue.location}.`
                : 'You have examined all available clues. Try interrogating a suspect with the evidence you have.',
            hintsUsed:      session.hintsUsed,
            scorePenalty:   75,
        });
    } catch (err) { next(err); }
});

// ── Current weather ───────────────────────────
router.get('/:sessionId/weather', requireAuth, async (req, res, next) => {
    try {
        const session = await PlayerSession.findById(req.params.sessionId);
        if (!session || session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not your session' });
        }
        const weather = await getCurrentWeather(session);
        res.json({ weather });
    } catch (err) { next(err); }
});

module.exports = router;
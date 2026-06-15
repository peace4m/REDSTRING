/**
 * Redstring — User Routes
 * ==========================
 * GET    /api/users/me                   → My profile + stats
 * PATCH  /api/users/me                   → Update display name, avatar, settings
 * POST   /api/users/me/fcm-token         → Register push notification token
 * GET    /api/users/me/sessions          → My active/past sessions
 * GET    /api/users/search?q=name        → Search players to add as friends
 * POST   /api/users/me/friends/:userId   → Send friend request
 * PATCH  /api/users/me/friends/:userId   → Accept/reject friend request
 * DELETE /api/users/me/friends/:userId   → Remove friend
 */

const router = require('express').Router();
// Change line 13 and 14 to use a single dot-dot loop (../) instead of two:
const User          = require('../schema/user.schema');
const PlayerSession = require('../schema/playerSession.schema');
const { requireAuth } = require('../middleware/auth.middleware');

// ── My profile ────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-passwordHash -refreshTokenHash')
            .populate('friendIds', 'displayName avatarKey badge stats.casesSolved');
        res.json({ user });
    } catch (err) { next(err); }
});

// ── Update profile / settings ─────────────────
router.patch('/me', requireAuth, async (req, res, next) => {
    try {
        const allowed = ['displayName', 'avatarKey', 'settings'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        // Content rating upgrade: can only be done if DoB proves 18+
        if (req.body.contentRating === 'R') {
            const user = await User.findById(req.user._id);
            if (!user.dateOfBirth) {
                return res.status(400).json({ error: 'Date of birth required to unlock adult content.' });
            }
            const age = Math.floor((Date.now() - user.dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
            if (age < 18) {
                return res.status(403).json({ error: 'Must be 18 or older to enable adult content.' });
            }
            updates.contentRating = 'R';
        }

        const updated = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
            .select('-passwordHash -refreshTokenHash');
        res.json({ user: updated });
    } catch (err) { next(err); }
});

// ── Register FCM token for push notifications ─
router.post('/me/fcm-token', requireAuth, async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'token is required' });

        // Add token if not already registered (support multiple devices)
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { fcmTokens: token },
        });
        res.json({ message: 'FCM token registered' });
    } catch (err) { next(err); }
});

// ── My sessions ───────────────────────────────
router.get('/me/sessions', requireAuth, async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = { userId: req.user._id };
        if (status) filter.status = status;

        const sessions = await PlayerSession.find(filter)
            .select('caseId status startedAt solvedAt score wrongAccusationCount totalPlaytimeMinutes')
            .sort({ startedAt: -1 })
            .limit(20);

        res.json({ sessions });
    } catch (err) { next(err); }
});

// ── Search players ────────────────────────────
router.get('/search', requireAuth, async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });

        const users = await User.find({
            displayName: { $regex: q, $options: 'i' },
            _id: { $ne: req.user._id },
            isActive: true,
        }).select('_id displayName avatarKey badge stats.casesSolved').limit(10);

        res.json({ users });
    } catch (err) { next(err); }
});

// ── Send friend request ───────────────────────
router.post('/me/friends/:userId', requireAuth, async (req, res, next) => {
    try {
        const targetId = req.params.userId;
        const target = await User.findById(targetId);
        if (!target) return res.status(404).json({ error: 'User not found' });

        const me = await User.findById(req.user._id);
        if (me.friendIds.map(String).includes(targetId)) {
            return res.status(400).json({ error: 'Already friends' });
        }

        await User.findByIdAndUpdate(targetId, {
            $addToSet: { pendingFriendRequests: req.user._id },
        });

        // TODO: send push notification to target user

        res.json({ message: 'Friend request sent' });
    } catch (err) { next(err); }
});

// ── Accept / reject friend request ───────────
router.patch('/me/friends/:userId', requireAuth, async (req, res, next) => {
    try {
        const { action } = req.body; // 'accept' | 'reject'
        const fromId = req.params.userId;

        const me = await User.findById(req.user._id);
        const hasPending = me.pendingFriendRequests.map(String).includes(fromId);
        if (!hasPending) return res.status(400).json({ error: 'No pending request from this user' });

        // Remove from pending either way
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { pendingFriendRequests: fromId },
        });

        if (action === 'accept') {
            // Mutual friendship
            await User.findByIdAndUpdate(req.user._id, { $addToSet: { friendIds: fromId } });
            await User.findByIdAndUpdate(fromId, { $addToSet: { friendIds: req.user._id } });
            return res.json({ message: 'Friend request accepted' });
        }

        res.json({ message: 'Friend request rejected' });
    } catch (err) { next(err); }
});

// ── Remove friend ─────────────────────────────
router.delete('/me/friends/:userId', requireAuth, async (req, res, next) => {
    try {
        const friendId = req.params.userId;
        await User.findByIdAndUpdate(req.user._id, { $pull: { friendIds: friendId } });
        await User.findByIdAndUpdate(friendId,      { $pull: { friendIds: req.user._id } });
        res.json({ message: 'Friend removed' });
    } catch (err) { next(err); }
});

module.exports = router;
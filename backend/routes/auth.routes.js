/**
 * Redstring — Auth Routes
 * ==========================
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/refresh
 * POST /api/auth/logout
 */

const router = require('express').Router();
const bcrypt = require('bcrypt');
const User   = require('../schema/user.schema');
const { generateTokens, verifyRefreshToken, requireAuth } = require('../middleware/auth.middleware');

// ─────────────────────────────────────────────
//  REGISTER
// ─────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, displayName, dateOfBirth } = req.body;

        if (!email || !password || !displayName) {
            return res.status(400).json({ error: 'email, password, and displayName are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(409).json({ error: 'Email already registered' });

        // Determine content rating from age
        let contentRating = 'PG13';
        if (dateOfBirth) {
            const age = Math.floor((Date.now() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age >= 18) contentRating = 'R';
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({
            email: email.toLowerCase(),
            passwordHash,
            displayName,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            contentRating,
        });

        const { accessToken, refreshToken } = generateTokens(user._id.toString());

        // Store refresh token hash in DB for rotation
        user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        await user.save();

        res.status(201).json({
            user: {
                userId:        user._id,
                displayName:   user.displayName,
                email:         user.email,
                contentRating: user.contentRating,
                avatarKey:     user.avatarKey,
            },
            accessToken,
            refreshToken,
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account deactivated. Contact support.' });
        }

        user.lastLoginAt = new Date();
        const { accessToken, refreshToken } = generateTokens(user._id.toString());
        user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        await user.save();

        res.json({
            user: {
                userId:        user._id,
                displayName:   user.displayName,
                email:         user.email,
                contentRating: user.contentRating,
                avatarKey:     user.avatarKey,
                badge:         user.badge,
                stats:         user.stats,
                settings:      user.settings,
            },
            accessToken,
            refreshToken,
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  REFRESH TOKEN
// ─────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

        const payload = verifyRefreshToken(refreshToken);
        const user = await User.findById(payload.userId);
        if (!user) return res.status(401).json({ error: 'User not found' });

        // Verify token matches stored hash (rotation check)
        const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash || '');
        if (!valid) return res.status(401).json({ error: 'Refresh token invalid or already used' });

        const tokens = generateTokens(user._id.toString());
        user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
        await user.save();

        res.json(tokens);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
        }
        next(err);
    }
});

// ─────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { $unset: { refreshTokenHash: 1 } });
        res.json({ message: 'Logged out successfully' });
    } catch (err) { next(err); }
});

module.exports = router;
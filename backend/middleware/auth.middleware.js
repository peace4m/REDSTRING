/**
 * Redstring — Auth Middleware
 * ==============================
 * Two modes:
 *  1. JWT (for REST API calls from mobile / web)
 *  2. Socket token (for Socket.io handshake)
 *
 * Usage on routes:
 *   router.get('/something', requireAuth, handler)
 *
 * Usage in Socket.io:
 *   nsp.use(socketAuth)
 */

const jwt   = require('jsonwebtoken');
const User = require('../schema/user.schema');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');

// ─────────────────────────────────────────────
//  REST MIDDLEWARE
// ─────────────────────────────────────────────

/**
 * requireAuth — attach req. User or return 401
 */
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);

        // Fetch user (lightweight — only grab what's needed per request)
        const user = await User.findById(payload.userId).select(
            '_id displayName email contentRating settings isActive'
        );
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Account not found or deactivated' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * requireAdultContent — must be attached after requireAuth
 * Blocks R-rated case access for PG13 accounts
 */
function requireAdultContent(req, res, next) {
    if (req.user.contentRating !== 'R') {
        return res.status(403).json({
            error: 'This case requires an adult content rating.',
            hint:  'You can update your content rating in Settings if you are 18+.',
        });
    }
    next();
}

// ─────────────────────────────────────────────
//  SOCKET.IO MIDDLEWARE
// ─────────────────────────────────────────────

/**
 * socketAuth — run as nsp.use(socketAuth)
 * Validates the JWT sent in socket.handshake.auth.token
 * Attaches socket.data.user so all handlers can read it
 */
async function socketAuth(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('AUTH_MISSING'));

        const payload = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(payload.userId).select(
            '_id displayName avatarKey contentRating'
        );
        if (!user) return next(new Error('AUTH_USER_NOT_FOUND'));

        socket.data.user = {
            userId:        user._id.toString(),
            displayName:   user.displayName,
            avatarKey:     user.avatarKey,
            contentRating: user.contentRating,
        };
        next();
    } catch {
        next(new Error('AUTH_INVALID_TOKEN'));
    }
}

// ─────────────────────────────────────────────
//  TOKEN UTILITIES
// ─────────────────────────────────────────────

/**
 * Generate a JWT for a user after login.
 * Access token: short-lived (15 min)
 * Refresh token: long-lived (30 days), stored in DB
 */
function generateTokens(userId) {
    const accessToken = jwt.sign(
        { userId, type: 'access' },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
    return { accessToken, refreshToken };
}

function verifyRefreshToken(token) {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Not a refresh token');
    return payload;
}

module.exports = { requireAuth, requireAdultContent, socketAuth, generateTokens, verifyRefreshToken };
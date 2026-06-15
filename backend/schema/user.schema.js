/**
 * Redstring — User Schema
 * =========================
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({

    // ── Auth ──────────────────────────────────
    email:          { type: String, required: true, unique: true, lowercase: true },
    passwordHash:   { type: String, required: true },
    firebaseUid:    { type: String, sparse: true },  // for Firebase Auth link

    // ── Profile ───────────────────────────────
    displayName:    { type: String, required: true },
    avatarKey:      { type: String, default: 'detective_1' },
    badge:          { type: String, default: 'rookie' },
    // badge progression: rookie → detective → senior → chief → legend

    // ── Age / Content ─────────────────────────
    dateOfBirth:    { type: Date },
    contentRating: {
        type: String,
        enum: ['PG13', 'R'],
        default: 'PG13'
        // R unlocked only if age ≥ 18 (verified server-side)
    },

    // ── Stats ─────────────────────────────────
    stats: {
        casesSolved:      { type: Number, default: 0 },
        casesAttempted:   { type: Number, default: 0 },
        totalPlaytimeMin: { type: Number, default: 0 },
        correctFirstGuess:{ type: Number, default: 0 },
        favoriteCategory: { type: String },
    },

    // ── Preferences ───────────────────────────
    settings: {
        jumpScareIntensity: { type: String, enum: ['off', 'mild', 'full'], default: 'mild' },
        voiceChatEnabled:   { type: Boolean, default: true },
        notificationsEnabled:{ type: Boolean, default: true },
        darkMode:           { type: Boolean, default: true },
        language:           { type: String, default: 'en' },
    },

    // ── Friends ───────────────────────────────
    friendIds:      [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pendingFriendRequests: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // ── FCM Token (push notifications) ────────
    fcmTokens:      [String],   // array to support multiple devices

    // ── Account ───────────────────────────────
    isActive:       { type: Boolean, default: true },
    lastLoginAt:    { type: Date },

}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
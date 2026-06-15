/**
 * Redstring — Player Session Schema
 * ====================================
 * One PlayerSession document per (player × case).
 * This tracks everything about a specific player's journey
 * through a specific case — their discoveries, active timers,
 * accusations, and room membership.
 *
 * Kept separate from CaseFile so the master case data is
 * never mutated. Multiple players can run the same case
 * independently or together in a room.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
//  CLUE STATE TRACKER
// ─────────────────────────────────────────────
// Tracks what this player has done with each clue
const ClueStateSchema = new Schema({
    clueId:         { type: String, required: true },
    status: {
        type: String,
        enum: ['hidden', 'found', 'examined', 'analyzed', 'destroyed'],
        default: 'hidden'
    },
    foundAt:        { type: Date },
    examinedAt:     { type: Date },
    // For weather-sensitive clues: was it degraded?
    degraded:       { type: Boolean, default: false },
    degradedReason: { type: String },  // "washed_away_by_rain", "too_dark_to_examine"
}, { _id: false });

// ─────────────────────────────────────────────
//  SUSPECT INTERROGATION STATE
// ─────────────────────────────────────────────
const InterrogationStateSchema = new Schema({
    suspectId:         { type: String, required: true },
    currentAlibiLayer: { type: Number, default: 0 },  // which layer of alibi is active?
    lastInterrogatedAt: { type: Date },
    evidencePresentedIds: [String],   // clueIds player has shown this suspect
    behavioralNotes:   [String],      // AI-generated notes about suspect's reactions
}, { _id: false });

// ─────────────────────────────────────────────
//  PASSIVE TIMER INSTANCE
// ─────────────────────────────────────────────
// When a player submits evidence for lab work, a live timer
// is created from the PassiveTimerTemplate in CaseFile.
const ActiveTimerSchema = new Schema({
    timerId:        { type: String, required: true },  // from PassiveTimerTemplate
    label:          { type: String, required: true },
    submittedAt:    { type: Date, required: true },
    completesAt:    { type: Date, required: true },    // = submittedAt + duration
    isComplete:     { type: Boolean, default: false },
    resultDeliveredAt: { type: Date },
    notificationSent: { type: Boolean, default: false },
}, { _id: false });

// ─────────────────────────────────────────────
//  ACCUSATION RECORD
// ─────────────────────────────────────────────
// Players can make accusations. Wrong accusations have consequences
// (lose a scene access, suspect lawyers up, etc.)
const AccusationSchema = new Schema({
    suspectId:   { type: String, required: true },
    madeAt:      { type: Date, required: true },
    wasCorrect:  { type: Boolean, required: true },
    consequence: { type: String },   // e.g. "Suspect Marcus has gone into hiding"
}, { _id: false });

// ─────────────────────────────────────────────
//  MAIN PLAYER SESSION SCHEMA
// ─────────────────────────────────────────────
const PlayerSessionSchema = new Schema({

    // ── Identity ──────────────────────────────
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    caseId:         { type: String, required: true },
    roomId:         { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    // null = solo play; set = collaborative room

    // ── Progress ──────────────────────────────
    status: {
        type: String,
        enum: ['active', 'solved', 'failed', 'abandoned'],
        default: 'active'
    },
    startedAt:      { type: Date, required: true, default: Date.now },
    solvedAt:       { type: Date },
    finalAccusation: { type: String },  // suspectId of final answer

    // ── Clue Tracking ─────────────────────────
    clueStates:     { type: [ClueStateSchema], default: [] },

    // ── Scene Tracking ────────────────────────
    unlockedSceneIds: { type: [String], default: [] },
    currentSceneId:   { type: String },
    // Scene visit log: used for jump scare timing (don't fire same scare twice)
    sceneVisitLog: [{
        sceneId:   String,
        visitedAt: Date,
        duration:  Number,  // seconds spent in a scene
    }],

    // ── Suspect Interrogations ────────────────
    interrogations: { type: [InterrogationStateSchema], default: [] },

    // ── Active Lab Timers ─────────────────────
    activeTimers:   { type: [ActiveTimerSchema], default: [] },

    // ── Twist Tracking ────────────────────────
    triggeredTwistIds: { type: [String], default: [] },
    // Twist narrative is shown once then logged here so it doesn't re-fire

    // ── Accusations ───────────────────────────
    accusations:    { type: [AccusationSchema], default: [] },
    wrongAccusationCount: { type: Number, default: 0 },
    // After 3 wrong accusations, case difficulty increases (fewer remaining suspects talk to you)

    // ── Evidence Board (solo) ─────────────────
    // For solo play, this is the player's personal board state.
    // In room play, this lives on the Room document and is shared.
    evidenceBoard: {
        pins: [{
            clueId:   String,
            x:        Number,  // position on corkboard (0–100 %)
            y:        Number,
            note:     String,  // player's own annotation
        }],
        strings: [{
            fromClueId: String,
            toClueId:   String,
            label:      String,
        }]
    },

    // ── Weather State ─────────────────────────
    // The active weather at the moment of each key action.
    // Stored so we can reconstruct the case timeline post-solve.
    weatherLog: [{
        timestamp:   Date,
        condition:   String,    // "clear", "rain", "storm", "fog", "night"
        temperature: Number,    // celsius
        // Gameplay effects active at this moment
        activeEffects: [String],  // e.g. ["footprint_visibility_low", "outdoor_clues_degrading"]
    }],

    // ── Score & Analytics ─────────────────────
    score: {
        clueFindPoints:       { type: Number, default: 0 },
        speedBonus:           { type: Number, default: 0 },
        wrongAccusationPenalty: { type: Number, default: 0 },
        final:                { type: Number, default: 0 },
    },
    hintsUsed:    { type: Number, default: 0 },
    totalPlaytimeMinutes: { type: Number, default: 0 },

}, { timestamps: true });

// Compound index: one active session per user per case
PlayerSessionSchema.index({ userId: 1, caseId: 1 });
PlayerSessionSchema.index({ roomId: 1 });
// For cron jobs that check pending lab timers
PlayerSessionSchema.index({ 'activeTimers.completesAt': 1, 'activeTimers.isComplete': 1 });

module.exports = mongoose.model('PlayerSession', PlayerSessionSchema);
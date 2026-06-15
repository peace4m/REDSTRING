/**
 * Redstring — Room Schema (War Room / Multiplayer)
 * ===================================================
 * A Room is a shared investigation space.
 * Up to 8 players can join a Room and investigate the same
 * case together in real time.
 *
 * The Room owns the shared evidence board, the shared chat log,
 * and the role assignments. Individual clue DISCOVERY can be
 * role-gated (only the Forensics role can run lab tests), but
 * the results are shared with the whole team automatically.
 *
 * Room state is kept in MongoDB AND mirrored in Redis for
 * sub-100ms Socket.io sync.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
//  SHARED EVIDENCE BOARD
// ─────────────────────────────────────────────
const BoardPinSchema = new Schema({
    pinId:      { type: String, required: true },
    clueId:     { type: String, required: true },
    pinnedBy:   { type: String, required: true },   // userId
    x:          { type: Number, required: true },   // % position on corkboard
    y:          { type: Number, required: true },
    note:       { type: String, default: '' },
    color:      { type: String, default: 'yellow' }, // pin color, assigned per player
    pinnedAt:   { type: Date, default: Date.now },
}, { _id: false });

const BoardStringSchema = new Schema({
    stringId:     { type: String, required: true },
    fromPinId:    { type: String, required: true },
    toPinId:      { type: String, required: true },
    label:        { type: String, default: '' },
    color:        { type: String, default: 'red' },
    createdBy:    { type: String, required: true },
}, { _id: false });

// ─────────────────────────────────────────────
//  ROOM MEMBER
// ─────────────────────────────────────────────
const RoomMemberSchema = new Schema({
    userId:       { type: String, required: true },
    displayName:  { type: String, required: true },
    avatarKey:    { type: String },
    roleId:       { type: String },                 // assigned an investigation role
    pinColor:     { type: String },                 // their board pin color
    isHost:       { type: Boolean, default: false },
    isOnline:     { type: Boolean, default: false },
    lastSeenAt:   { type: Date },
    currentSceneId: { type: String },               // where they are right now
    // Voice chat: their proximity position for spatial audio
    voicePosition: {
        x: Number,
        y: Number,
        sceneId: String
    }
}, { _id: false });

// ─────────────────────────────────────────────
//  CHAT MESSAGE
// ─────────────────────────────────────────────
const ChatMessageSchema = new Schema({
    messageId:  { type: String, required: true },
    userId:     { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'system', 'clue_share', 'accusation', 'theory'],
        default: 'text'
    },
    text:       { type: String },
    clueId:     { type: String },   // set if type = 'clue_share'
    sentAt:     { type: Date, default: Date.now },
    // Radio filter voice note (WebRTC audio clip key)
    voiceNoteKey: { type: String },
}, { _id: false });

// ─────────────────────────────────────────────
//  MAIN ROOM SCHEMA
// ─────────────────────────────────────────────
const RoomSchema = new Schema({

    // ── Identity ──────────────────────────────
    roomCode:     { type: String, required: true, unique: true },
    // Short human-readable code: "WOLF-7492" — used for invite links
    caseId:       { type: String, required: true },
    hostUserId:   { type: String, required: true },

    // ── State ─────────────────────────────────
    status: {
        type: String,
        enum: ['waiting', 'active', 'solved', 'abandoned'],
        default: 'waiting'
    },
    startedAt:    { type: Date },
    solvedAt:     { type: Date },
    finalAccusation: {
        suspectId:   String,
        accusedBy:   String,   // userId
        wasCorrect:  Boolean,
    },

    // ── Members ───────────────────────────────
    members:      { type: [RoomMemberSchema], default: [] },
    maxMembers:   { type: Number, default: 4 },
    isPrivate:    { type: Boolean, default: true },
    inviteCode:   { type: String },   // one-time join token

    // ── Shared Evidence Board ─────────────────
    // This is the War Room corkboard — every member can see and edit it.
    // Synced via Socket.io event 'board:update' and persisted here.
    evidenceBoard: {
        pins:    { type: [BoardPinSchema],   default: [] },
        strings: { type: [BoardStringSchema], default: [] },
        // Board "snapshots" so players who reconnect can diff from last state
        version: { type: Number, default: 0 },
    },

    // ── Shared Progress ───────────────────────
    // Discoveries made by ANY member are shared with the whole room.
    discoveredClueIds:     { type: [String], default: [] },
    unlockedSceneIds:      { type: [String], default: [] },
    triggeredTwistIds:     { type: [String], default: [] },
    completedTimerIds:     { type: [String], default: [] },
    activeTimers: [{
        timerId:      String,
        label:        String,
        submittedBy:  String,   // userId
        submittedAt:  Date,
        completesAt:  Date,
        isComplete:   { type: Boolean, default: false },
    }],

    // ── Role Assignments ──────────────────────
    roleAssignments: [{
        roleId:   String,
        userId:   String,
    }],

    // ── Chat & Voice ──────────────────────────
    chatLog:      { type: [ChatMessageSchema], default: [] },
    // Only last 200 messages stored in DB; older messages archived
    voiceChannelId: { type: String },  // WebRTC channel key

    // ── Consensus Accusation ──────────────────
    // Before making a final accusation, the room must vote
    accusationVote: {
        isOpen:      { type: Boolean, default: false },
        suspectId:   String,
        proposedBy:  String,
        votes: [{
            userId: String,
            vote:   { type: String, enum: ['yes', 'no', 'abstain'] },
        }],
        expiresAt:   Date,
    },

    // ── Weather (shared) ──────────────────────
    // All members experience the same weather at the same time
    currentWeather: {
        condition:      String,
        temperature:    Number,
        activeEffects:  [String],
        updatedAt:      Date,
    },

}, { timestamps: true });

// TTL index: abandoned rooms cleaned up after 30 days
RoomSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
RoomSchema.index({ roomCode: 1 }, { unique: true });
RoomSchema.index({ caseId: 1, status: 1 });

module.exports = mongoose.model('Room', RoomSchema);
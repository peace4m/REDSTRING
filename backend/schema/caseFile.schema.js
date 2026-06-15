/**
 * Redstring — Case File Schema (MongoDB / Mongoose)
 * ====================================================
 * This is the heart of the game. Every case — from a 2-day
 * petty theft to a 2-month serial-killer investigation — is
 * represented by a single CaseFile document.
 *
 * Key design decisions:
 *  - Clues form a TREE (parent/child), not a flat list.
 *    Child clues are locked until the parent is examined.
 *  - Every suspect has an alibi chain that can be cracked step-by-step.
 *  - Twist events are injected at specific timeline milestones.
 *  - Passive timers (DNA results, autopsy, etc.) are stored as
 *    real ISO timestamps so server cron can push notifications.
 *  - Weather state is a seed — the weather engine derives
 *    hour-by-hour conditions from it and applies gameplay effects.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─────────────────────────────────────────────
//  SUB-SCHEMAS
// ─────────────────────────────────────────────

/**
 * A single clue node in the evidence tree.
 * Clues are organized as a branching tree:
 *   - Root clues are visible at scene entry
 *   - Child clues unlock only when their parent is EXAMINED (not just found)
 *   - Some clues are RED HERRINGS — they lead nowhere or to the wrong suspect
 */
const ClueSchema = new Schema({
    clueId:        { type: String, required: true },      // e.g. "clue_bloody_knife"
    parentClueId:  { type: String, default: null },       // null = root clue (visible immediately)
    label:         { type: String, required: true },      // "A bloody kitchen knife"
    description:   { type: String, required: true },      // Shown when player examines it
    location:      { type: String, required: true },      // "kitchen", "back_alley", "victim_car"
    type: {
        type: String,
        enum: ['physical', 'digital', 'witness', 'document', 'forensic', 'behavioral'],
        required: true
    },
    isRedHerring:   { type: Boolean, default: false },    // Misleads player intentionally
    pointsToSuspect: { type: String, default: null },     // suspectId this clue implicates
    // Passive unlock: some clues need lab processing
    requiresLabWork: { type: Boolean, default: false },
    labResultDelay:  { type: Number, default: 0 },        // real-world minutes until a result arrives
    labResultText:   { type: String, default: null },     // What the lab report says
    // Weather sensitivity: rain/storm can degrade this clue
    weatherSensitive:   { type: Boolean, default: false },
    degradesInRain:     { type: Boolean, default: false }, // If true + it rains, a clue is destroyed
    degradesAtNight:    { type: Boolean, default: false }, // Visibility drops at night
    // State flags (per-player-session, stored in PlayerSession not here)
    // included here as documentation of what gets tracked
    _stateNote: { type: String, default: 'found/examined/analyzed tracked in PlayerSession.clueStates' }
}, { _id: false });

/**
 * A suspect profile.
 * Every case has 3–8 suspects. One is the real culprit.
 * Suspects have layered alibis — each layer cracks when
 * the player presents the right evidence.
 */
const AlibiLayerSchema = new Schema({
    layerIndex:     { type: Number, required: true },   // 0 = initial story, 1 = cracked first time, etc.
    statement:      { type: String, required: true },   // What they say at this layer
    crackedByClue:  { type: String, required: true },   // clueId that breaks this layer open
    revealText:     { type: String, required: true },   // Narrative shown when alibi cracks
}, { _id: false });

const SuspectSchema = new Schema({
    suspectId:      { type: String, required: true },
    name:           { type: String, required: true },
    age:            { type: Number },
    occupation:     { type: String },
    relationship:   { type: String },                   // relationship to a victim
    avatarKey:      { type: String },                   // asset key for a portrait
    motive:         { type: String, required: true },   // hidden from player initially
    isRealCulprit:  { type: Boolean, default: false },
    // Psychological profile (drives AI dialogue generation)
    personality: {
        trait:        { type: String },                   // "cold", "nervous", "arrogant"
        liesAbout:    [String],                           // topics they deflect on
        giveawayTell: { type: String }                    // behavioral tell when lying
    },
    alibiChain:     [AlibiLayerSchema],                 // ordered from initial to fully crack
    // Haunting mechanics (for R-rated cases)
    canHaunt:       { type: Boolean, default: false },
    hauntTrigger:   { type: String, default: null },    // what player action triggers their haunting?
}, { _id: false });

/**
 * A location / crime scene.
 * Each case has multiple scenes that unlock over time.
 */
const SceneSchema = new Schema({
    sceneId:        { type: String, required: true },
    name:           { type: String, required: true },   // "The Victim's Apartment"
    description:    { type: String, required: true },
    environmentKey: { type: String, required: true },   // 3D scene asset bundle key
    unlocksAt:      { type: String, default: null },    // null = available from start; or clueId that unlocks it
    // Atmospheric settings for this scene
    atmosphere: {
        baseAmbience:  { type: String, enum: ['day', 'night', 'dawn', 'dusk'], default: 'day' },
        hauntingLevel: { type: Number, min: 0, max: 5, default: 0 }, // 0=none, 5=extreme
        jumpScarePool: [String],  // keys of possible jump-scare events in this scene
    },
    clueIds: [String],  // references to ClueSchema.clueId located here
}, { _id: false });

/**
 * A twist event — narrative bombshell injected at a specific point.
 * Twists can: reframe the entire case, reveal a new suspect,
 * make a previous suspect look more guilty, or create a moral dilemma.
 */
const TwistSchema = new Schema({
    twistId:        { type: String, required: true },
    title:          { type: String, required: true },   // "The Victim Was Already Dead."
    narrativeText:  { type: String, required: true },   // Full reveal text
    // When does this twist fire?
    triggerType: {
        type: String,
        enum: ['clue_found', 'suspect_interrogated', 'timeline_milestone', 'lab_result_received'],
        required: true
    },
    triggerId:      { type: String, required: true },   // clueId, suspectId, or milestone key
    // What changes after this twist?
    effects: {
        newSuspectUnlocked:     { type: String, default: null },  // suspectId
        newSceneUnlocked:       { type: String, default: null },  // sceneId
        cluesInvalidated:       [String],                          // clueIds that are now red herrings
        weatherShift:           { type: String, default: null },   // e.g. "sudden_storm"
        jumpScareEvent:         { type: String, default: null },   // event key
    },
}, { _id: false });

/**
 * A passive timer event — the "waiting" mechanic.
 * When a player submits evidence for analysis, a real-world
 * timer starts. The result arrives as a push notification.
 *
 * Duration scales with difficulty:
 *  easy: 15min–1hr | medium: 1–4hrs | hard: 4–12hrs | extreme: 12–48hrs
 */
const PassiveTimerTemplateSchema = new Schema({
    timerId:        { type: String, required: true },
    label:          { type: String, required: true },   // "DNA Analysis", "Autopsy Report"
    description:    { type: String },
    resultClueId:   { type: String, required: true },   // clue unlocked when timer completes
    notificationTitle:   { type: String, required: true },
    notificationBody:    { type: String, required: true },
    durationByDifficulty: {
        easy:    { type: Number, required: true },  // minutes
        medium:  { type: Number, required: true },
        hard:    { type: Number, required: true },
        extreme: { type: Number, required: true },
    }
}, { _id: false });

/**
 * Weather seed for this case.
 * The weather engine uses this seed and real-time clock to
 * generate dynamic conditions. Conditions affect gameplay.
 */
const WeatherSeedSchema = new Schema({
    baseClimate:   { type: String, enum: ['tropical', 'temperate', 'arid', 'arctic', 'urban'] },
    season:        { type: String, enum: ['spring', 'summer', 'autumn', 'winter'] },
    stormProbability: { type: Number, min: 0, max: 1, default: 0.2 }, // 0–1
    // Scripted weather events tied to twist milestones
    scriptedEvents: [{
        atTwistId:     String,   // twistId that triggers this
        weatherType:   String,   // "sudden_storm", "dense_fog", "heatwave"
        durationMins:  Number,
    }]
}, { _id: false });

// ─────────────────────────────────────────────
//  MAIN CASE FILE SCHEMA
// ─────────────────────────────────────────────

const CaseFileSchema = new Schema({

    // ── Identity ──────────────────────────────
    caseId:        { type: String, required: true, unique: true },
    title:         { type: String, required: true },     // "The Midnight Express Murder"
    tagline:       { type: String },                     // Short hook shown on case select screen
    caseNumber:    { type: String },                     // e.g. "CS-2024-047"

    // ── Classification ────────────────────────
    category: {
        type: String,
        enum: ['murder', 'hit_and_run', 'disappearance', 'serial_killer',
            'corporate_crime', 'art_heist', 'kidnapping', 'cold_case'],
        required: true
    },
    contentRating: {
        type: String,
        enum: ['PG13', 'R'],   // PG13 = kids/teens safe; R = adult horror/gore/weapons
        required: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'extreme'],
        required: true
    },

    // ── Timeline ──────────────────────────────
    // The case has a "real world" duration. When a player opens the case,
    // a PlayerSession is created with a real start timestamp.
    // The case unfolds over these many real-world hours.
    durationHours: { type: Number, required: true },
    // Quick reference: easy ~48hrs, medium ~72–168hrs, hard ~336hrs (2 wk), extreme ~720hrs (1 mo)
    timelineLabel: { type: String },  // "2 days", "1 week", "1 month" — shown in UI

    // ── Setting ───────────────────────────────
    setting: {
        city:        String,
        country:     String,
        year:        Number,
        era:         String,   // "modern", "1980s", "victorian"
    },

    // ── Narrative ─────────────────────────────
    briefingText:   { type: String, required: true },   // The opening case briefing
    victimName:     { type: String, required: true },
    victimAge:      { type: Number },
    victimProfile:  { type: String },                   // Background on the victim
    trueNarrative:  { type: String, required: true },   // The REAL story (shown at the end only)
    conclusionText: { type: String, required: true },   // Shown when player names correct culprit

    // ── Core Game Data ────────────────────────
    suspects:      { type: [SuspectSchema],  required: true },
    scenes:        { type: [SceneSchema],    required: true },
    clues:         { type: [ClueSchema],     required: true },
    twists:        { type: [TwistSchema],    default: [] },
    passiveTimers: { type: [PassiveTimerTemplateSchema], default: [] },

    // ── Atmosphere ────────────────────────────
    weather:       { type: WeatherSeedSchema, required: true },
    soundtrackKey: { type: String },   // ambient music asset key
    jumpScarePool: [String],           // global jump scare event keys for this case

    // ── Multiplayer ───────────────────────────
    maxPlayers:    { type: Number, default: 4, min: 1, max: 8 },
    roles: [{
        roleId:   String,   // "lead_detective", "forensics", "interviewer", "surveillance"
        label:    String,
        perks:    [String], // e.g. "can_run_lab_tests", "can_access_cctv"
    }],

    // ── Meta ──────────────────────────────────
    createdBy:     { type: String, default: 'system' },  // "system" or userId for custom cases
    isPublished:   { type: Boolean, default: false },
    playCount:     { type: Number, default: 0 },
    avgSolveTime:  { type: Number, default: 0 },         // hours, rolling average
    solveRate:     { type: Number, default: 0 },          // 0–1, % of players who solve it

}, { timestamps: true });

// Indexes for fast queries
CaseFileSchema.index({ difficulty: 1, contentRating: 1 });
CaseFileSchema.index({ category: 1 });
CaseFileSchema.index({ isPublished: 1, playCount: -1 });

module.exports = mongoose.model('CaseFile', CaseFileSchema);
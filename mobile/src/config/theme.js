/**
 * Redstring — Design System
 * ===========================
 * Visual identity: Forensic Noir
 *
 * Palette: Deep investigation room at 2 AM.
 * Near-black backgrounds, cold blue-grey midtones,
 * a single acid-amber accent (evidence light / crime scene tape).
 * Blood-red reserved only for danger/kill states.
 * No warm tones — this world is cold.
 *
 * Typography:
 *  Display: "Courier Prime" — typewriter feel, case file aesthetic
 *  Body:    "Inter"         — clean readability in low light
 *  Data:    "JetBrains Mono"— clue IDs, timestamps, forensic data
 *
 * Signature element:
 *  The corkboard. All evidence is pinned to a real cork texture.
 *  Red string connections. Handwritten-style annotations.
 *  This is the one-place warmth (cork amber) enters the cold palette.
 */

export const Colors = {
    // ── Backgrounds ────────────────────────────
    bg: {
        void:    '#0A0A0C',   // Deepest black — splash, modals
        deep:    '#0F1014',   // Main app background
        surface: '#161820',   // Cards, panels
        raised:  '#1E2028',   // Elevated cards, inputs
        overlay: '#252830',   // Overlays, drawers
    },

    // ── Text ───────────────────────────────────
    text: {
        primary:   '#E8E9ED',   // Main readable text
        secondary: '#8A8E9B',   // Supporting info, labels
        muted:     '#4A4E5C',   // Disabled, placeholder
        inverse:   '#0F1014',   // Text on light surfaces
    },

    // ── Accent: Evidence Amber ─────────────────
    // Crime scene tape. Evidence box labels. Active states.
    amber: {
        bright:  '#F5C842',
        mid:     '#C49A20',
        dim:     '#6B5510',
        glow:    'rgba(245, 200, 66, 0.15)',
    },

    // ── Danger: Crime Red ─────────────────────
    // Murders. Accusations. Fatal events. Use sparingly.
    red: {
        bright: '#E53535',
        mid:    '#A02020',
        dim:    '#4A1010',
        glow:   'rgba(229, 53, 53, 0.12)',
    },

    // ── Forensic Blue ─────────────────────────
    // Lab results. Digital clues. CCTV. Tech.
    blue: {
        bright: '#4A9EFF',
        mid:    '#2A6BB5',
        dim:    '#112844',
        glow:   'rgba(74, 158, 255, 0.12)',
    },

    // ── Status ────────────────────────────────
    success: '#2ECC71',
    warning: '#F39C12',
    info:    '#3498DB',

    // ── Corkboard (special — warm anomaly in cold palette) ──
    cork: {
        base:    '#8B6914',
        texture: '#7A5C10',
        pin:     '#C0392B',
        string:  '#C0392B',
    },

    // ── Borders ───────────────────────────────
    border: {
        subtle:  'rgba(255,255,255,0.06)',
        regular: 'rgba(255,255,255,0.10)',
        strong:  'rgba(255,255,255,0.18)',
    },

    // ── Transparent ───────────────────────────
    transparent: 'transparent',
};

export const Typography = {
    // Display — case file headings
    display: {
        family: 'CourierPrime_700Bold',
        sizes: {
            xl: { fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
            lg: { fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
            md: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
        },
    },
    // Body — readable in low light
    body: {
        family: 'Inter_400Regular',
        familyMedium: 'Inter_500Medium',
        familySemibold: 'Inter_600SemiBold',
        sizes: {
            lg: { fontSize: 17, lineHeight: 26 },
            md: { fontSize: 15, lineHeight: 22 },
            sm: { fontSize: 13, lineHeight: 19 },
            xs: { fontSize: 11, lineHeight: 16 },
        },
    },
    // Mono — forensic data, IDs, timestamps
    mono: {
        family: 'JetBrainsMono_400Regular',
        familyMedium: 'JetBrainsMono_500Medium',
        sizes: {
            md: { fontSize: 13, lineHeight: 18 },
            sm: { fontSize: 11, lineHeight: 16 },
        },
    },
};

export const Spacing = {
    '2xs': 2, xs: 4, sm: 8, md: 12,
    lg: 16, xl: 20, '2xl': 24, '3xl': 32,
    '4xl': 40, '5xl': 56, '6xl': 72,
};

export const Radii = {
    xs: 4, sm: 6, md: 8, lg: 12, xl: 16, full: 999,
};

export const Shadows = {
    // Glow effects for key elements
    amber: {
        shadowColor:   Colors.amber.bright,
        shadowOffset:  { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius:  12,
        elevation:     8,
    },
    red: {
        shadowColor:   Colors.red.bright,
        shadowOffset:  { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius:  12,
        elevation:     8,
    },
    card: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius:  8,
        elevation:     6,
    },
};

export const Animations = {
    fast:   150,
    normal: 250,
    slow:   400,
    // Jump scare: deliberately jarring
    scare:  80,
};

// Content rating badge colours
export const RatingColors = {
    PG13: { bg: Colors.blue.dim,  text: Colors.blue.bright },
    R:    { bg: Colors.red.dim,   text: Colors.red.bright  },
};

// Difficulty badge colours
export const DifficultyColors = {
    easy:    { bg: '#0F2A1A', text: '#2ECC71' },
    medium:  { bg: '#2A2510', text: '#F39C12' },
    hard:    { bg: '#2A1410', text: '#E67E22' },
    extreme: { bg: Colors.red.dim, text: Colors.red.bright },
};

export default { Colors, Typography, Spacing, Radii, Shadows, Animations };
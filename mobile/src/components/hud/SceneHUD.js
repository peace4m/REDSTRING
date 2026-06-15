/**
 * RedString — WeatherBadge & ConnectionDot (paste into SceneHUD.js)
 * ====================================================================
 * These two components are imported by src/screens/WarRoomScreen.js
 * but are missing from src/components/hud/SceneHUD.js.
 *
 * ─────────────────────────────────────────────────────────
 *  INSTRUCTIONS
 * ─────────────────────────────────────────────────────────
 * 1. Open src/components/hud/SceneHUD.js
 *
 * 2. Update the theme import on line 21 from:
 *
 *      import { Colors, Spacing, Radii, Animations as AnimDurations } from '../../config/theme';
 *
 *    to:
 *
 *      import { Colors, Typography, Spacing, Radii, Animations as AnimDurations } from '../../config/theme';
 *
 *    (just adds `Typography` to the existing import — nothing removed)
 *
 * 3. Paste everything below this comment block anywhere in the file
 *    after the imports (e.g., right after line 21, or at the end
 *    of the file — doesn't matter, JS hoists function declarations).
 * ─────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, Animated, StyleSheet, TouchableOpacity,
    Modal, ScrollView, Vibration, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Colors, Spacing, Radii, Animations as AnimDurations } from '../../config/theme';

const { width: W, height: H } = Dimensions.get('window');


// ─────────────────────────────────────────────
//  WEATHER BADGE
// ─────────────────────────────────────────────
const WEATHER_ICONS = {
    clear: '☀️', rain: '🌧', sudden_rain: '🌧', storm: '⛈',
    dense_fog: '🌫', night: '🌙', dawn: '🌅', dusk: '🌆',
};

export function WeatherBadge({ weather, compact = false }) {
    const condition = weather?.condition || 'clear';
    const icon = WEATHER_ICONS[condition] || '☀️';

    if (compact) {
        return (
            <View style={badgeStyles.compact}>
                <Text style={badgeStyles.compactIcon}>{icon}</Text>
            </View>
        );
    }

    return (
        <View style={badgeStyles.full}>
            <Text style={badgeStyles.icon}>{icon}</Text>
            <Text style={badgeStyles.label}>
                {condition.replace(/_/g, ' ').toUpperCase()}
            </Text>
            {weather?.temperature != null && (
                <Text style={badgeStyles.temp}>{Math.round(weather.temperature)}°</Text>
            )}
        </View>
    );
}

const badgeStyles = StyleSheet.create({
    compact: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: Colors.bg.raised, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: Colors.border.subtle,
    },
    compactIcon: { fontSize: 13 },
    full: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.bg.raised, borderRadius: Radii.full,
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
        borderWidth: 1, borderColor: Colors.border.subtle,
    },
    icon: { fontSize: 12 },
    label: {
        fontFamily: Typography.mono.family, fontSize: 9,
        color: Colors.text.secondary, letterSpacing: 1,
    },
    temp: {
        fontFamily: Typography.mono.familyMedium, fontSize: 9,
        color: Colors.text.muted,
    },
});

// ─────────────────────────────────────────────
//  CONNECTION DOT
// ─────────────────────────────────────────────
export function ConnectionDot({ online }) {
    return (
        <View style={[dotStyles.dot, online ? dotStyles.online : dotStyles.offline]} />
    );
}

const dotStyles = StyleSheet.create({
    dot: {
        position: 'absolute', bottom: -2, right: -2,
        width: 9, height: 9, borderRadius: 5,
        borderWidth: 2, borderColor: Colors.bg.surface,
    },
    online:  { backgroundColor: Colors.success },
    offline: { backgroundColor: Colors.text.muted },
});

// ─────────────────────────────────────────────
//  JUMP SCARE OVERLAY
// ─────────────────────────────────────────────

export function JumpScareOverlay({ scare, onDismiss }) {
    const flashAnim  = useRef(new Animated.Value(0)).current;
    const shakeAnim  = useRef(new Animated.Value(0)).current;
    const [scareText, setScareText] = useState('');
    const [visible, setVisible]     = useState(true);

    useEffect(() => {
        // Immediate flash + vibration
        if (Platform.OS !== 'web') Vibration.vibrate([0, 100, 50, 150]);

        // Flash sequence
        Animated.sequence([
            Animated.timing(flashAnim, { toValue: 1, duration: 80,  useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 0.7, duration: 60,  useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start();

        // Camera shake
        Animated.sequence([
            ...Array.from({ length: 8 }, (_, i) =>
                Animated.timing(shakeAnim, {
                    toValue: i % 2 === 0 ? 12 : -12,
                    duration: 50,
                    useNativeDriver: true,
                })
            ),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();

        // Auto-dismiss after 2.5 seconds
        const timer = setTimeout(() => {
            setVisible(false);
            onDismiss();
        }, 2500);

        return () => clearTimeout(timer);
    }, [scare]);

    // Scare text descriptions
    const scareTexts = {
        scare_mirror_reflection:   'Something moves behind you in the mirror.',
        scare_door_creak:          'The door swings open. Nobody there.',
        scare_shadow_figure:       'A shape crosses the far end of the corridor.',
        scare_instrument_sound:    'A single note. From a silent instrument.',
        scare_victor_whisper:      'You hear your name. In his voice.',
        scare_light_flicker:       'Three seconds of nothing but dark.',
        scare_cabinet_door:        'The cabinet slams itself open.',
    };

    const text = scareTexts[scare?.scareKey] || 'Something is in here with you.';

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                scareStyles.overlay,
                { opacity: flashAnim, transform: [{ translateX: shakeAnim }] },
            ]}
            pointerEvents="none"
        >
            <View style={scareStyles.content}>
                <Text style={scareStyles.text}>{text}</Text>
            </View>
        </Animated.View>
    );
}

// ─────────────────────────────────────────────
//  TWIST MODAL
// ─────────────────────────────────────────────

export function TwistModal({ twist, onDismiss }) {
    const revealAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(revealAnim, {
            toValue:  1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Modal visible transparent animationType="none">
            <Animated.View style={[twistStyles.overlay, { opacity: revealAnim }]}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={twistStyles.content}>
                    {/* Amber line */}
                    <View style={twistStyles.accentLine} />

                    <Text style={twistStyles.eyebrow}>CASE UPDATE</Text>
                    <Text style={twistStyles.title}>{twist.title}</Text>

                    <ScrollView style={twistStyles.scroll} showsVerticalScrollIndicator={false}>
                        <Text style={twistStyles.body}>{twist.narrativeText?.trim()}</Text>
                    </ScrollView>

                    <TouchableOpacity style={twistStyles.continueBtn} onPress={onDismiss}>
                        <Text style={twistStyles.continueBtnText}>Continue Investigation</Text>
                        <Ionicons name="arrow-forward" size={16} color={Colors.bg.deep} />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Modal>
    );
}

// ─────────────────────────────────────────────
//  CLUE DETAIL MODAL
// ─────────────────────────────────────────────

export function ClueDetailModal({ clue, onClose, onSubmitLab, sessionId, roomCode }) {
    const [submittingLab, setSubmittingLab] = useState(false);
    const slideAnim = useRef(new Animated.Value(H)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: H, duration: 250, useNativeDriver: true,
        }).start(onClose);
    };

    const submitToLab = async (timerId) => {
        setSubmittingLab(true);
        try {
            await onSubmitLab(timerId);
        } finally {
            setSubmittingLab(false);
        }
    };

    const clueTypeIcons = {
        physical:    'cube-outline',
        digital:     'desktop-outline',
        witness:     'person-outline',
        document:    'document-text-outline',
        forensic:    'flask-outline',
        behavioral:  'eye-outline',
    };

    return (
        <Modal visible transparent animationType="none">
            <View style={clueStyles.overlay}>
                <TouchableOpacity style={clueStyles.dismiss} onPress={handleClose} />
                <Animated.View style={[clueStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                    {/* Handle */}
                    <View style={clueStyles.handle} />

                    {/* Clue type badge */}
                    <View style={clueStyles.typeBadge}>
                        <Ionicons name={clueTypeIcons[clue.type] || 'search-outline'} size={12} color={Colors.amber.bright} />
                        <Text style={clueStyles.typeText}>{(clue.type || '').toUpperCase()}</Text>
                    </View>

                    <Text style={clueStyles.clueLabel}>{clue.label}</Text>

                    <View style={clueStyles.locationRow}>
                        <Ionicons name="location-outline" size={12} color={Colors.text.muted} />
                        <Text style={clueStyles.locationText}>
                            {clue.location?.replace('scene_', '').replace(/_/g, ' ')}
                        </Text>
                    </View>

                    <Text style={clueStyles.description}>{clue.description}</Text>

                    {/* Lab result (if available) */}
                    {clue.result?.labTimerStarted && (
                        <View style={clueStyles.labSubmitted}>
                            <Ionicons name="flask" size={14} color={Colors.blue.bright} />
                            <View style={{ flex: 1 }}>
                                <Text style={clueStyles.labSubmittedTitle}>Submitted to Lab</Text>
                                <Text style={clueStyles.labSubmittedDesc}>
                                    {clue.result.labTimerStarted.label} — results in ~{clue.result.labTimerStarted.durationMinutes} min
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Lab submit button (if not yet submitted) */}
                    {clue.requiresLabWork && !clue.result?.labTimerStarted && (
                        <TouchableOpacity
                            style={[clueStyles.labBtn, submittingLab && { opacity: 0.6 }]}
                            onPress={() => {
                                // Find timer for this clue
                                const timerId = `timer_${clue.clueId.replace('clue_', '')}`;
                                submitToLab(timerId);
                            }}
                            disabled={submittingLab}
                        >
                            <Ionicons name="flask-outline" size={16} color={Colors.blue.bright} />
                            <Text style={clueStyles.labBtnText}>Submit for Analysis</Text>
                        </TouchableOpacity>
                    )}

                    {/* Weather warning */}
                    {clue.weatherSensitive && (
                        <View style={clueStyles.weatherWarning}>
                            <Ionicons name="warning-outline" size={12} color={Colors.warning} />
                            <Text style={clueStyles.weatherWarningText}>
                                Weather-sensitive — secure this evidence before it degrades
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity style={clueStyles.closeBtn} onPress={handleClose}>
                        <Text style={clueStyles.closeBtnText}>Back to Scene</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

const hudStyles = StyleSheet.create({
    weatherPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
        borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.border.regular,
    },
    weatherPillWarning: { borderColor: Colors.blue.mid },
    weatherText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
    weatherTemp: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: Colors.text.muted },
});

const scareStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject, zIndex: 999,
        backgroundColor: Colors.bg.void,
        justifyContent: 'center', alignItems: 'center',
    },
    content: { padding: Spacing['3xl'], alignItems: 'center' },
    text: {
        fontFamily: 'CourierPrime_700Bold', fontSize: 22,
        color: Colors.text.primary, textAlign: 'center', lineHeight: 32,
        letterSpacing: 0.5,
    },
});

const twistStyles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
    content: {
        width: W - 48, maxHeight: H * 0.75,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radii.xl, padding: Spacing['2xl'],
        borderWidth: 1, borderColor: Colors.amber.mid,
        overflow: 'hidden',
    },
    accentLine: { height: 3, backgroundColor: Colors.amber.bright, marginBottom: Spacing.xl, borderRadius: 2 },
    eyebrow:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: Colors.amber.bright, letterSpacing: 3, marginBottom: Spacing.sm },
    title:      { fontFamily: 'CourierPrime_700Bold', fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.xl, lineHeight: 30 },
    scroll:     { maxHeight: H * 0.35 },
    body:       { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.primary, lineHeight: 25 },
    continueBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.amber.bright, borderRadius: Radii.lg, paddingVertical: Spacing.lg, marginTop: Spacing.xl },
    continueBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.bg.deep },
});

const clueStyles = StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    dismiss:  { flex: 1 },
    sheet: {
        backgroundColor: Colors.bg.surface,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: Spacing['2xl'], paddingBottom: 40,
        borderTopWidth: 1, borderTopColor: Colors.border.regular,
    },
    handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border.regular, alignSelf: 'center', marginBottom: Spacing.xl },
    typeBadge:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.amber.dim, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.xs, alignSelf: 'flex-start', marginBottom: Spacing.md },
    typeText:     { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: Colors.amber.bright, letterSpacing: 1.5 },
    clueLabel:    { fontFamily: 'CourierPrime_700Bold', fontSize: 22, color: Colors.text.primary, marginBottom: Spacing.xs, lineHeight: 28 },
    locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.lg },
    locationText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.muted, textTransform: 'capitalize' },
    description:  { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.primary, lineHeight: 24, marginBottom: Spacing.xl },
    labSubmitted: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.blue.dim, borderRadius: Radii.md, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.blue.mid },
    labSubmittedTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.blue.bright },
    labSubmittedDesc:  { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
    labBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.blue.dim, borderRadius: Radii.lg, paddingVertical: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.blue.mid },
    labBtnText:   { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.blue.bright },
    weatherWarning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(243,156,18,0.1)', borderRadius: Radii.sm, padding: Spacing.sm, marginBottom: Spacing.md },
    weatherWarningText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.warning, flex: 1 },
    closeBtn:     { alignItems: 'center', paddingVertical: Spacing.md },
    closeBtnText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text.muted },
});
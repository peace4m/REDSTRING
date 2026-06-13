/**
 * RedString — HUD & Scene Components
 * =====================================
 * All the overlay/HUD components used on the Crime Scene screen.
 *
 *  WeatherHUD — small pill showing current weather + effects
 *  JumpScareOverlay — full-screen flash + scare text
 *  TwistModal — cinematic reveal for narrative twists
 *  ClueDetailModal — expanded clue view + lab submit option
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
//  WEATHER HUD
// ─────────────────────────────────────────────

const WEATHER_ICONS = {
    clear:        { icon: 'sunny-outline',      color: Colors.amber.bright },
    night:        { icon: 'moon-outline',        color: '#7B8CDE' },
    dawn:         { icon: 'partly-sunny-outline',color: Colors.amber.mid },
    dusk:         { icon: 'partly-sunny-outline',color: '#E87A3A' },
    sudden_rain:  { icon: 'rainy-outline',       color: Colors.blue.bright },
    storm:        { icon: 'thunderstorm-outline',color: Colors.blue.bright },
    dense_fog:    { icon: 'cloud-outline',       color: Colors.text.muted },
};

export function WeatherHUD({ weather }) {
    const wIcon = WEATHER_ICONS[weather.condition] || WEATHER_ICONS.clear;
    const hasEffects = weather.activeEffects?.length > 0;

    return (
        <View style={[hudStyles.weatherPill, hasEffects && hudStyles.weatherPillWarning]}>
            <Ionicons name={wIcon.icon} size={13} color={wIcon.color} />
            <Text style={[hudStyles.weatherText, { color: wIcon.color }]}>
                {weather.condition.replace('_', ' ')}
            </Text>
            {weather.temperature != null && (
                <Text style={hudStyles.weatherTemp}>{weather.temperature}°</Text>
            )}
        </View>
    );
}

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
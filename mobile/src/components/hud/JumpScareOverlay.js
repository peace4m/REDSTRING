/**
 * RedString — Jump Scare Overlay
 * =================================
 * Full-screen overlay triggered by `jump:scare` socket events.
 *
 * Flow:
 *  1. Screen flashes white/red violently (60-120ms)
 *  2. Brief audio sting plays (expo-av)
 *  3. Device vibrates (haptic shock)
 *  4. AI-generated atmospheric text fades in/out
 *  5. Auto-dismisses after ~2.5s, or tap to dismiss early
 *
 * Respects user's jumpScareIntensity setting:
 *  - 'off':  this component is never rendered (checked by parent)
 *  - 'mild': skips the violent flash/vibration, text-only
 *  - 'full': full effect
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import { Colors, Typography, Spacing, Animations } from '../../theme';
import { apiClient } from '../../services/apiClient';

// Map scare keys to local sound assets (place files in assets/audio/scares/)
// Wrapped in try/catch since require() of a missing file throws at bundle time
// in some Metro configs — if files aren't present yet, scares still work
// visually via flash/vibration/narration.
function loadScareSounds() {
    try {
        return {
            scare_mirror_reflection: require('../../../assets/Audio/scares/sting_low.mp3'),
            scare_door_creak:        require('../../../assets/Audio/scares/door_creak.mp3'),
            scare_shadow_figure:     require('../../../assets/Audio/scares/sting_high.mp3'),
            scare_instrument_sound:  require('../../../assets/Audio/scares/discord_note.mp3'),
            scare_victor_whisper:    require('../../../assets/Audio/scares/whisper.mp3'),
            scare_light_flicker:     require('../../../assets/Audio/scares/electric_buzz.mp3'),
            scare_cabinet_door:      require('../../../assets/Audio/scares/cabinet_slam.mp3'),
        };
    } catch {
        return {};
    }
}
const SCARE_SOUNDS = loadScareSounds();

export default function JumpScareOverlay({ scare, intensity = 'full', onDismiss }) {
    const flashAnim = useRef(new Animated.Value(0)).current;
    const textAnim  = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const [narrationText, setNarrationText] = useState('');

    const isFull = intensity === 'full';

    useEffect(() => {
        let dismissTimer;

        // ── 1. Violent flash + shake (full intensity only) ──
        if (isFull) {
            Vibration.vibrate(200);
            Animated.sequence([
                Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
                Animated.timing(flashAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
                Animated.timing(flashAnim, { toValue: 0.5, duration: 40, useNativeDriver: true }),
                Animated.timing(flashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
            ]).start();

            // Screen shake
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
            ]).start();

            // Play sound sting
            playScareSound(scare.scareKey);
        } else {
            Vibration.vibrate(50);
        }

        // ── 2. Fetch AI-generated narration ──
        fetchNarration();

        // ── 3. Auto-dismiss ──
        dismissTimer = setTimeout(() => {
            Animated.timing(textAnim, { toValue: 0, duration: 400, useNativeDriver: true })
                .start(() => onDismiss());
        }, isFull ? 2800 : 1800);

        return () => clearTimeout(dismissTimer);
    }, []);

    async function fetchNarration() {
        try {
            // Lightweight endpoint — could also be pre-generated and cached server-side
            const { text } = await apiClient.post('/cases/jump-scare-narration', {
                scareKey: scare.scareKey,
                sceneId:  scare.sceneId,
            });
            setNarrationText(text || '');
            Animated.timing(textAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        } catch {
            // Narration is optional — scare still works without it
            Animated.timing(textAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    }

    async function playScareSound(scareKey) {
        try {
            const source = SCARE_SOUNDS[scareKey];
            if (!source) return;
            const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 1.0 });
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) sound.unloadAsync();
            });
        } catch (e) {
            console.log('[JumpScare] sound failed', e.message);
        }
    }

    return (
        <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
        >
            {/* Flash layer */}
            {isFull && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: '#fff', opacity: flashAnim },
                    ]}
                />
            )}

            {/* Dark vignette + shake */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    s.darkOverlay,
                    { transform: [{ translateX: shakeAnim }] },
                ]}
            >
                {!!narrationText && (
                    <Animated.View style={[s.textBox, { opacity: textAnim }]}>
                        <Text style={s.narrationText}>{narrationText}</Text>
                    </Animated.View>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    darkOverlay: {
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 120, paddingHorizontal: Spacing.xl,
    },
    textBox: {
        backgroundColor: 'rgba(10,10,12,0.85)',
        borderLeftWidth: 2, borderLeftColor: Colors.red.bright,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: 4, maxWidth: '90%',
    },
    narrationText: {
        fontFamily: Typography.display.family, fontSize: 15,
        color: Colors.text.primary, fontStyle: 'italic', lineHeight: 22,
        textAlign: 'center',
    },
});
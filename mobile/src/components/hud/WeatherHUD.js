/**
 * RedString — Weather HUD Overlay
 * ==================================
 * Renders atmospheric overlays on top of the crime scene
 * based on the current weather condition from the game store.
 *
 *  - rain / sudden_rain → animated falling rain lines + dim
 *  - storm → rain + screen shake + flash
 *  - dense_fog → soft white overlay reducing contrast
 *  - night → blue-black vignette, flashlight cone
 *
 * This is a purely visual layer — gameplay effects (clue degradation)
 * are handled server-side and reflected via clue state.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import Svg, { Line, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Colors, Typography, Spacing, Radii } from '../../theme';

const { width: W, height: H } = Dimensions.get('window');

const RAIN_DROP_COUNT = 40;

export default function WeatherHUD({ weather }) {
    const condition = weather?.condition || 'clear';
    const effects   = weather?.activeEffects || [];

    const isRain  = ['rain', 'sudden_rain', 'storm'].includes(condition);
    const isFog   = condition === 'dense_fog';
    const isNight = condition === 'night' || effects.includes('low_visibility');
    const isStorm = condition === 'storm';

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {isNight && <NightVignette />}
            {isRain  && <RainLayer intense={isStorm} />}
            {isFog   && <FogLayer />}
            {isStorm && <LightningFlash />}
            <ConditionBadge condition={condition} effects={effects} />
        </View>
    );
}

// ─────────────────────────────────────────────
//  NIGHT VIGNETTE
// ─────────────────────────────────────────────
function NightVignette() {
    return (
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            <Defs>
                <RadialGradient id="nightGrad" cx="50%" cy="45%" r="65%">
                    <Stop offset="0%"  stopColor="#000" stopOpacity="0" />
                    <Stop offset="65%" stopColor="#04060f" stopOpacity="0.35" />
                    <Stop offset="100%" stopColor="#04060f" stopOpacity="0.85" />
                </RadialGradient>
            </Defs>
            <Rect width={W} height={H} fill="url(#nightGrad)" />
        </Svg>
    );
}

// ─────────────────────────────────────────────
//  RAIN LAYER
// ─────────────────────────────────────────────
function RainLayer({ intense }) {
    const drops = useRef(
        Array.from({ length: RAIN_DROP_COUNT }, () => ({
            x: Math.random() * W,
            delay: Math.random() * 1000,
            length: 14 + Math.random() * 18,
            speed: 600 + Math.random() * 400,
            anim: new Animated.Value(0),
        }))
    ).current;

    useEffect(() => {
        drops.forEach(d => {
            const loop = () => {
                d.anim.setValue(0);
                Animated.timing(d.anim, {
                    toValue: 1,
                    duration: d.speed,
                    delay: d.delay,
                    useNativeDriver: true,
                }).start(() => loop());
            };
            loop();
        });
    }, []);

    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Dim overlay */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0e18', opacity: intense ? 0.35 : 0.2 }]} />
            {drops.map((d, i) => (
                <Animated.View
                    key={i}
                    style={{
                        position: 'absolute',
                        left: d.x,
                        top: -20,
                        width: 1.5,
                        height: d.length,
                        backgroundColor: 'rgba(180, 200, 230, 0.5)',
                        transform: [
                            { translateY: d.anim.interpolate({ inputRange: [0, 1], outputRange: [0, H + 40] }) },
                            { rotate: '12deg' },
                        ],
                    }}
                />
            ))}
        </View>
    );
}

// ─────────────────────────────────────────────
//  FOG LAYER
// ─────────────────────────────────────────────
function FogLayer() {
    const drift = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(drift, { toValue: 1, duration: 8000, useNativeDriver: true }),
                Animated.timing(drift, { toValue: 0, duration: 8000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                StyleSheet.absoluteFill,
                {
                    backgroundColor: '#cfd6e0',
                    opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] }),
                },
            ]}
        />
    );
}

// ─────────────────────────────────────────────
//  LIGHTNING FLASH (storm)
// ─────────────────────────────────────────────
function LightningFlash() {
    const flash = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const triggerFlash = () => {
            const delay = 4000 + Math.random() * 8000;
            setTimeout(() => {
                Animated.sequence([
                    Animated.timing(flash, { toValue: 0.6, duration: 60, useNativeDriver: true }),
                    Animated.timing(flash, { toValue: 0, duration: 100, useNativeDriver: true }),
                    Animated.timing(flash, { toValue: 0.3, duration: 50, useNativeDriver: true }),
                    Animated.timing(flash, { toValue: 0, duration: 150, useNativeDriver: true }),
                ]).start(() => triggerFlash());
            }, delay);
        };
        triggerFlash();
    }, []);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flash }]}
        />
    );
}

// ─────────────────────────────────────────────
//  CONDITION BADGE (small HUD indicator)
// ─────────────────────────────────────────────
function ConditionBadge({ condition, effects }) {
    if (condition === 'clear') return null;

    const icons = {
        rain: '🌧', sudden_rain: '🌧', storm: '⛈', dense_fog: '🌫', night: '🌙', dawn: '🌅', dusk: '🌆',
    };

    const warningEffect = effects.find(e =>
        ['outdoor_clues_degrading', 'outdoor_clues_at_risk'].includes(e)
    );

    return (
        <View style={s.badgeContainer} pointerEvents="none">
            <View style={s.badge}>
                <Text style={s.badgeIcon}>{icons[condition] || '🌤'}</Text>
                <Text style={s.badgeText}>{condition.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
            {warningEffect && (
                <View style={s.warningBadge}>
                    <Text style={s.warningText}>⚠ Outdoor evidence at risk</Text>
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    badgeContainer: {
        position: 'absolute', top: 110, right: Spacing.lg, alignItems: 'flex-end', gap: Spacing.xs,
    },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(15,16,20,0.7)', borderRadius: Radii.full,
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
        borderWidth: 1, borderColor: Colors.border.subtle,
    },
    badgeIcon: { fontSize: 12 },
    badgeText: {
        fontFamily: Typography.mono.family, fontSize: 9,
        color: Colors.text.secondary, letterSpacing: 1,
    },
    warningBadge: {
        backgroundColor: Colors.red.dim, borderRadius: Radii.full,
        paddingHorizontal: Spacing.sm, paddingVertical: 3,
    },
    warningText: {
        fontFamily: Typography.body.familyMedium, fontSize: 9, color: Colors.red.bright,
    },
});
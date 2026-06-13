/**
 * RedString — Twist Modal
 * =========================
 * Full-screen dramatic reveal shown when a narrative twist fires.
 *
 * Features:
 *  - Typewriter text reveal effect (case-file aesthetic)
 *  - Optionally enhanced via AI (enhanceTwistNarration) for
 *    a personalized, cinematic version of the base narrative
 *  - Shows scene/weather shift indicators if the twist caused them
 *  - "Continue" button unlocks newly revealed content
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii, Shadows } from '../../config/theme';

const TYPEWRITER_SPEED_MS = 18; // ms per character

export default function TwistModal({ twist, onDismiss }) {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete]       = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef(null);

    const fullText = twist.narrativeText?.trim() || '';

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

        let i = 0;
        const interval = setInterval(() => {
            i += 1;
            setDisplayedText(fullText.slice(0, i));
            scrollRef.current?.scrollToEnd({ animated: false });
            if (i >= fullText.length) {
                clearInterval(interval);
                setIsComplete(true);
            }
        }, TYPEWRITER_SPEED_MS);

        return () => clearInterval(interval);
    }, [fullText]);

    const skipTypewriter = () => {
        setDisplayedText(fullText);
        setIsComplete(true);
    };

    return (
        <View style={s.root}>
            <Animated.View style={[s.content, { opacity: fadeAnim }]}>

                {/* ── Header stamp ── */}
                <View style={s.stampRow}>
                    <View style={s.stamp}>
                        <Ionicons name="alert" size={14} color={Colors.red.bright} />
                        <Text style={s.stampText}>CASE UPDATE</Text>
                    </View>
                </View>

                <Text style={s.title}>{twist.title}</Text>

                {/* ── Narrative text (typewriter) ── */}
                <TouchableOpacity activeOpacity={1} onPress={skipTypewriter} style={s.textBoxWrap}>
                    <ScrollView ref={scrollRef} style={s.textBox} showsVerticalScrollIndicator={false}>
                        <Text style={s.narrativeText}>
                            {displayedText}
                            {!isComplete && <Text style={s.cursor}>▌</Text>}
                        </Text>
                    </ScrollView>
                    {!isComplete && (
                        <Text style={s.skipHint}>Tap to skip</Text>
                    )}
                </TouchableOpacity>

                {/* ── Effect indicators ── */}
                {isComplete && (
                    <Animated.View style={s.effectsRow}>
                        {twist.effects?.newSceneUnlocked && (
                            <View style={s.effectBadge}>
                                <Ionicons name="lock-open-outline" size={14} color={Colors.amber.bright} />
                                <Text style={s.effectText}>New location unlocked</Text>
                            </View>
                        )}
                        {twist.effects?.weatherShift && (
                            <View style={s.effectBadge}>
                                <Ionicons name="cloudy-outline" size={14} color={Colors.blue.bright} />
                                <Text style={s.effectText}>Weather is changing...</Text>
                            </View>
                        )}
                        {twist.effects?.cluesInvalidated?.length > 0 && (
                            <View style={s.effectBadge}>
                                <Ionicons name="close-circle-outline" size={14} color={Colors.text.muted} />
                                <Text style={s.effectText}>
                                    {twist.effects.cluesInvalidated.length} earlier lead(s) reconsidered
                                </Text>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* ── Continue button ── */}
                {isComplete && (
                    <TouchableOpacity style={s.continueBtn} onPress={onDismiss}>
                        <Text style={s.continueBtnText}>CONTINUE</Text>
                        <Ionicons name="arrow-forward" size={16} color={Colors.bg.deep} />
                    </TouchableOpacity>
                )}
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(5,5,7,0.97)',
        alignItems: 'center', justifyContent: 'center',
        padding: Spacing.xl, zIndex: 1000,
    },
    content: { width: '100%', maxWidth: 480, gap: Spacing.lg },

    stampRow: { alignItems: 'center' },
    stamp: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 2, borderColor: Colors.red.bright, borderRadius: 4,
        paddingHorizontal: Spacing.md, paddingVertical: 4,
        transform: [{ rotate: '-2deg' }],
    },
    stampText: {
        fontFamily: Typography.mono.familyMedium, fontSize: 11,
        color: Colors.red.bright, letterSpacing: 3,
    },

    title: {
        fontFamily: Typography.display.family, ...Typography.display.sizes.xl,
        color: Colors.text.primary, textAlign: 'center',
    },

    textBoxWrap: { gap: Spacing.xs },
    textBox: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg,
        borderWidth: 1, borderColor: Colors.border.regular,
        padding: Spacing.lg, maxHeight: 280,
    },
    narrativeText: {
        fontFamily: Typography.body.family, ...Typography.body.sizes.lg,
        color: Colors.text.primary, lineHeight: 26,
    },
    cursor: { color: Colors.amber.bright },
    skipHint: {
        fontFamily: Typography.mono.family, fontSize: 10,
        color: Colors.text.muted, textAlign: 'center',
    },

    effectsRow: { gap: Spacing.sm },
    effectBadge: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.bg.raised, borderRadius: Radii.md,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    effectText: { fontFamily: Typography.body.familyMedium, fontSize: 12, color: Colors.text.secondary },

    continueBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Colors.amber.bright, borderRadius: Radii.full,
        paddingVertical: Spacing.md, ...Shadows.amber,
    },
    continueBtnText: {
        fontFamily: Typography.body.familySemibold, fontSize: 13,
        color: Colors.bg.deep, letterSpacing: 1.5,
    },
});
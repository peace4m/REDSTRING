/**
 * RedString — Case Conclusion Screen
 * =====================================
 * Shown after a final accusation is made (correct or wrong-final).
 *
 * Solved: Reveals trueNarrative + conclusionText + score breakdown
 * Failed: Shows "Case Cold" state with a stat and retry option
 */

import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii, Shadows} from '../config/theme';
import { useGameStore } from '../store/gameStore';

export default function CaseConclusionScreen({ route, navigation }) {
    const { result, caseFile } = route.params;
    const { clearGame, session } = useGameStore();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const isSolved = result.isCorrect;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    const handleFinish = () => {
        clearGame();
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    };

    if (!isSolved) {
        return <FailedView result={result} onFinish={handleFinish} fadeAnim={fadeAnim} />;
    }

    return (
        <SafeAreaView style={s.root} edges={['top','bottom']}>
            <Animated.ScrollView
                style={{ opacity: fadeAnim }}
                contentContainerStyle={s.content}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Solved badge ── */}
                <View style={s.solvedBadge}>
                    <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
                    <Text style={s.solvedTitle}>CASE CLOSED</Text>
                    <Text style={s.solvedSubtitle}>You correctly identified {result.suspectName}</Text>
                </View>

                {/* ── Score ── */}
                <View style={s.scoreCard}>
                    <Text style={s.scoreLabel}>FINAL SCORE</Text>
                    <Text style={s.scoreValue}>{result.finalScore?.toLocaleString()}</Text>
                    <View style={s.scoreBadgeRow}>
                        <ScoreBadge label="Detective Rank" value={getRank(result.finalScore)} />
                    </View>
                </View>

                {/* ── True Narrative ── */}
                <View style={s.narrativeSection}>
                    <Text style={s.sectionLabel}>WHAT REALLY HAPPENED</Text>
                    <Text style={s.narrativeText}>{result.trueNarrative}</Text>
                </View>

                {/* ── Conclusion ── */}
                <View style={s.narrativeSection}>
                    <Text style={s.sectionLabel}>EPILOGUE</Text>
                    <Text style={s.narrativeText}>{result.conclusionText}</Text>
                </View>

                {/* ── Stats ── */}
                <View style={s.statsGrid}>
                    <StatBox icon="time-outline" label="Time Spent"
                             value={`${Math.round((session?.totalPlaytimeMinutes || 0) / 60)}h ${(session?.totalPlaytimeMinutes || 0) % 60}m`} />
                    <StatBox icon="alert-circle-outline" label="Wrong Accusations"
                             value={session?.wrongAccusationCount || 0} />
                    <StatBox icon="bulb-outline" label="Hints Used"
                             value={session?.hintsUsed || 0} />
                    <StatBox icon="search-outline" label="Clues Examined"
                             value={session?.clueStates?.filter(c => c.status === 'examined').length || 0} />
                </View>

                {/* ── Next case unlock ── */}
                <View style={s.unlockBanner}>
                    <Ionicons name="lock-open-outline" size={18} color={Colors.amber.bright} />
                    <Text style={s.unlockText}>A new case file has appeared on your board.</Text>
                </View>

                <TouchableOpacity style={s.finishBtn} onPress={handleFinish}>
                    <Text style={s.finishBtnText}>RETURN TO CASE FILES</Text>
                </TouchableOpacity>
            </Animated.ScrollView>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
//  FAILED VIEW
// ─────────────────────────────────────────────
function FailedView({ result, onFinish, fadeAnim }) {
    return (
        <SafeAreaView style={[s.root, s.rootFailed]} edges={['top','bottom']}>
            <Animated.View style={[s.failedContent, { opacity: fadeAnim }]}>
                <Ionicons name="close-circle" size={56} color={Colors.red.bright} />
                <Text style={s.failedTitle}>CASE GONE COLD</Text>
                <Text style={s.failedSubtitle}>
                    {result.consequence || 'Too many false accusations. The investigation has been closed without resolution.'}
                </Text>

                <View style={s.failedHint}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.text.muted} />
                    <Text style={s.failedHintText}>
                        Review the evidence board more carefully next time. Every red herring has a tell.
                    </Text>
                </View>

                <TouchableOpacity style={s.retryBtn} onPress={onFinish}>
                    <Text style={s.retryBtnText}>BACK TO CASE FILES</Text>
                </TouchableOpacity>
            </Animated.View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
//  SUBCOMPONENTS
// ─────────────────────────────────────────────
function ScoreBadge({ label, value }) {
    return (
        <View style={s.scoreBadge}>
            <Text style={s.scoreBadgeLabel}>{label}</Text>
            <Text style={s.scoreBadgeValue}>{value}</Text>
        </View>
    );
}

function StatBox({ icon, label, value }) {
    return (
        <View style={s.statBox}>
            <Ionicons name={icon} size={18} color={Colors.amber.mid} />
            <Text style={s.statValue}>{value}</Text>
            <Text style={s.statLabel}>{label}</Text>
        </View>
    );
}

function getRank(score) {
    if (score >= 1200) return 'Legend';
    if (score >= 900)  return 'Chief Inspector';
    if (score >= 600)  return 'Senior Detective';
    if (score >= 300)  return 'Detective';
    return 'Rookie';
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },
    rootFailed: { backgroundColor: Colors.bg.void },
    content: { padding: Spacing.xl, paddingBottom: Spacing['5xl'], gap: Spacing.lg },

    solvedBadge: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    solvedTitle: {
        fontFamily: Typography.display.family, color: Colors.text.primary,
        ...Typography.display.sizes.xl, letterSpacing: 2,
    },
    solvedSubtitle: { fontFamily: Typography.body.family, ...Typography.body.sizes.md, color: Colors.text.secondary, textAlign: 'center' },

    scoreCard: {
        alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radii.lg,
        padding: Spacing.xl, borderWidth: 1, borderColor: Colors.amber.dim, gap: Spacing.sm,
    },
    scoreLabel: { fontFamily: Typography.mono.family, fontSize: 11, color: Colors.text.muted, letterSpacing: 3 },
    scoreValue: { fontFamily: Typography.display.family, fontSize: 48, color: Colors.amber.bright },
    scoreBadgeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    scoreBadge: {
        backgroundColor: Colors.amber.glow, borderRadius: Radii.full,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
        flexDirection: 'row', gap: 6, alignItems: 'center',
    },
    scoreBadgeLabel: { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.muted },
    scoreBadgeValue: { fontFamily: Typography.body.familySemibold, fontSize: 11, color: Colors.amber.bright },

    narrativeSection: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg,
        padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border.subtle,
    },
    sectionLabel: {
        fontFamily: Typography.mono.family, fontSize: 10, color: Colors.amber.mid,
        letterSpacing: 2, marginBottom: Spacing.sm,
    },
    narrativeText: {
        fontFamily: Typography.body.family, ...Typography.body.sizes.md,
        color: Colors.text.primary, lineHeight: 24,
    },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    statBox: {
        flex: 1, minWidth: '45%', backgroundColor: Colors.bg.surface, borderRadius: Radii.md,
        padding: Spacing.md, alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: Colors.border.subtle,
    },
    statValue: { fontFamily: Typography.display.family, fontSize: 20, color: Colors.text.primary },
    statLabel: { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.muted },

    unlockBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.amber.glow, borderRadius: Radii.md, padding: Spacing.md,
    },
    unlockText: { flex: 1, fontFamily: Typography.body.familyMedium, fontSize: 12, color: Colors.amber.bright },

    finishBtn: {
        backgroundColor: Colors.amber.bright, borderRadius: Radii.full,
        paddingVertical: Spacing.md, alignItems: 'center', ...Shadows.amber,
    },
    finishBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.bg.deep, letterSpacing: 1 },

    // Failed
    failedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
    failedTitle: {
        fontFamily: Typography.display.family, color: Colors.red.bright,
        ...Typography.display.sizes.xl, letterSpacing: 2,
    },
    failedSubtitle: {
        fontFamily: Typography.body.family, ...Typography.body.sizes.md,
        color: Colors.text.secondary, textAlign: 'center',
    },
    failedHint: {
        flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.bg.surface,
        borderRadius: Radii.md, padding: Spacing.md, alignItems: 'flex-start',
    },
    failedHintText: { flex: 1, fontFamily: Typography.body.family, fontSize: 12, color: Colors.text.muted, lineHeight: 18 },
    retryBtn: {
        borderWidth: 1, borderColor: Colors.red.bright, borderRadius: Radii.full,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing['2xl'],
    },
    retryBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.red.bright, letterSpacing: 1 },
});
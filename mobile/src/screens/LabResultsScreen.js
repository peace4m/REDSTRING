/**
 * Redstring — Lab Results Screen (Modal)
 * ==========================================
 * Shown when a passive timer (DNA, fingerprint, financial trace)
 * completes — either via push notification tap or in-app socket event.
 *
 * Presents the result with a "report being processed" reveal animation
 * to maintain the forensic-realism feel.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii, Shadows } from '../config/theme';
import { useGameStore } from '../store/gameStore';

export default function LabResultsScreen({ route, navigation }) {
    const { result } = route.params;
    const { dismissLabResult, updateClueState } = useGameStore();

    const [revealed, setRevealed] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scanAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Scanning animation before reveal
        Animated.timing(scanAnim, {
            toValue: 1, duration: 1400, useNativeDriver: false,
        }).start(() => {
            setRevealed(true);
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        });

        // Mark the result clue as found
        if (result.resultClueId) {
            updateClueState(result.resultClueId, 'found');
        }
    }, []);

    const handleClose = () => {
        dismissLabResult(result.timerId);
        navigation.goBack();
    };

    return (
        <View style={s.root}>
            <SafeAreaView style={s.content} edges={['top','bottom']}>

                {/* ── Header stamp ── */}
                <View style={s.header}>
                    <View style={s.stamp}>
                        <Text style={s.stampText}>FORENSIC LAB</Text>
                    </View>
                    <Text style={s.timestamp}>{new Date().toLocaleString()}</Text>
                </View>

                {!revealed ? (
                    // ── Scanning state ──
                    <View style={s.scanningContainer}>
                        <Ionicons name="flask-outline" size={56} color={Colors.blue.bright} />
                        <Text style={s.scanningTitle}>Processing Report...</Text>
                        <View style={s.progressTrack}>
                            <Animated.View
                                style={[
                                    s.progressFill,
                                    {
                                        width: scanAnim.interpolate({
                                            inputRange: [0, 1], outputRange: ['0%', '100%'],
                                        }),
                                    },
                                ]}
                            />
                        </View>
                        <Text style={s.scanningSub}>{result.label}</Text>
                    </View>
                ) : (
                    // ── Result revealed ──
                    <Animated.View style={[s.resultContainer, { opacity: fadeAnim }]}>
                        <View style={s.resultIconWrap}>
                            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                        </View>

                        <Text style={s.resultLabel}>{result.label}</Text>
                        <Text style={s.resultTitle}>{result.notificationTitle?.replace(/^\W+/, '')}</Text>

                        <ScrollView style={s.reportBox} showsVerticalScrollIndicator={false}>
                            <Text style={s.reportText}>{result.notificationBody}</Text>
                            {result.labResultText && (
                                <>
                                    <View style={s.divider} />
                                    <Text style={s.reportSectionLabel}>FULL ANALYSIS</Text>
                                    <Text style={s.reportDetailText}>{result.labResultText}</Text>
                                </>
                            )}
                        </ScrollView>

                        {/* Twist warning if this result triggers a twist */}
                        {result.triggeredTwists?.length > 0 && (
                            <View style={s.twistWarning}>
                                <Ionicons name="warning" size={16} color={Colors.red.bright} />
                                <Text style={s.twistWarningText}>
                                    This result has changed the direction of your investigation.
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity style={s.continueBtn} onPress={handleClose}>
                            <Text style={s.continueBtnText}>CONTINUE INVESTIGATION</Text>
                            <Ionicons name="arrow-forward" size={16} color={Colors.bg.deep} />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: 'rgba(10,10,12,0.96)' },
    content: { flex: 1, padding: Spacing.xl, justifyContent: 'center' },

    header: { position: 'absolute', top: Spacing.xl, left: Spacing.xl, right: Spacing.xl,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    stamp: {
        borderWidth: 2, borderColor: Colors.blue.bright, borderRadius: Radii.xs,
        paddingHorizontal: Spacing.sm, paddingVertical: 4, transform: [{ rotate: '-3deg' }],
    },
    stampText: {
        fontFamily: Typography.mono.familyMedium, fontSize: 11,
        color: Colors.blue.bright, letterSpacing: 2,
    },
    timestamp: { fontFamily: Typography.mono.family, fontSize: 10, color: Colors.text.muted },

    // Scanning
    scanningContainer: { alignItems: 'center', gap: Spacing.lg },
    scanningTitle: {
        fontFamily: Typography.display.family, color: Colors.text.primary,
        ...Typography.display.sizes.md,
    },
    progressTrack: {
        width: '80%', height: 4, backgroundColor: Colors.bg.raised,
        borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: Colors.blue.bright },
    scanningSub: { fontFamily: Typography.mono.family, fontSize: 12, color: Colors.text.muted },

    // Result
    resultContainer: { alignItems: 'center', gap: Spacing.md },
    resultIconWrap: { marginBottom: Spacing.sm },
    resultLabel: {
        fontFamily: Typography.mono.family, fontSize: 11,
        color: Colors.amber.bright, letterSpacing: 2, textTransform: 'uppercase',
    },
    resultTitle: {
        fontFamily: Typography.display.family, color: Colors.text.primary,
        ...Typography.display.sizes.lg, textAlign: 'center', marginBottom: Spacing.md,
    },
    reportBox: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg,
        borderWidth: 1, borderColor: Colors.border.regular,
        padding: Spacing.lg, maxHeight: 280, width: '100%',
    },
    reportText: {
        fontFamily: Typography.body.family, ...Typography.body.sizes.md,
        color: Colors.text.primary, lineHeight: 22,
    },
    divider: { height: 1, backgroundColor: Colors.border.subtle, marginVertical: Spacing.md },
    reportSectionLabel: {
        fontFamily: Typography.mono.family, fontSize: 10,
        color: Colors.text.muted, letterSpacing: 2, marginBottom: Spacing.sm,
    },
    reportDetailText: {
        fontFamily: Typography.mono.family, fontSize: 12,
        color: Colors.text.secondary, lineHeight: 20,
    },

    twistWarning: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.red.dim, borderRadius: Radii.md,
        padding: Spacing.md, width: '100%',
    },
    twistWarningText: {
        flex: 1, fontFamily: Typography.body.familyMedium, fontSize: 12,
        color: Colors.red.bright,
    },

    continueBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Colors.amber.bright, borderRadius: Radii.full,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing['2xl'],
        width: '100%', marginTop: Spacing.lg,
        ...Shadows.amber,
    },
    continueBtnText: {
        fontFamily: Typography.body.familySemibold, fontSize: 13,
        color: Colors.bg.deep, letterSpacing: 1,
    },
});
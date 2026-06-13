/**
 * Redstring — Profile Screen
 * =============================
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii, Shadows, RatingColors } from '../config/theme';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';

export default function ProfileScreen({ navigation }) {
    const { user: authUser } = useAuthStore();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/users/me')
            .then(({ user }) => setProfile(user))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <SafeAreaView style={s.root} edges={['top']}>
                <View style={s.loader}><ActivityIndicator color={Colors.amber.bright} size="large" /></View>
            </SafeAreaView>
        );
    }

    const stats = profile?.stats || {};
    const rating = RatingColors[profile?.contentRating] || RatingColors.PG13;

    return (
        <SafeAreaView style={s.root} edges={['top']}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

                {/* ── Header ── */}
                <View style={s.profileHeader}>
                    <View style={s.avatarLarge}>
                        <Text style={s.avatarInitial}>{profile?.displayName?.[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={s.displayName}>{profile?.displayName}</Text>
                    <View style={s.badgeRow}>
                        <View style={s.rankBadge}>
                            <Ionicons name="star" size={11} color={Colors.amber.bright} />
                            <Text style={s.rankBadgeText}>{(profile?.badge || 'rookie').toUpperCase()}</Text>
                        </View>
                        <View style={[s.ratingBadge, { backgroundColor: rating.bg }]}>
                            <Text style={[s.ratingBadgeText, { color: rating.text }]}>{profile?.contentRating}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Stats Grid ── */}
                <View style={s.statsGrid}>
                    <StatCard icon="checkmark-done-circle" label="Cases Solved" value={stats.casesSolved || 0} color={Colors.success} />
                    <StatCard icon="briefcase" label="Cases Attempted" value={stats.casesAttempted || 0} color={Colors.blue.bright} />
                    <StatCard icon="flash" label="First-Try Solves" value={stats.correctFirstGuess || 0} color={Colors.amber.bright} />
                    <StatCard icon="time" label="Hours Played" value={Math.round((stats.totalPlaytimeMin || 0) / 60)} color={Colors.text.secondary} />
                </View>

                {/* ── Solve Rate ── */}
                <View style={s.solveRateCard}>
                    <Text style={s.sectionLabel}>SOLVE RATE</Text>
                    <Text style={s.solveRateValue}>
                        {stats.casesAttempted > 0 ? Math.round((stats.casesSolved / stats.casesAttempted) * 100) : 0}%
                    </Text>
                    <View style={s.progressTrack}>
                        <View style={[s.progressFill, {
                            width: `${stats.casesAttempted > 0 ? (stats.casesSolved / stats.casesAttempted) * 100 : 0}%`,
                        }]} />
                    </View>
                </View>

                {/* ── Friends ── */}
                <View style={s.section}>
                    <Text style={s.sectionLabel}>FELLOW DETECTIVES ({profile?.friendIds?.length || 0})</Text>
                    {profile?.friendIds?.length > 0 ? (
                        profile.friendIds.map(f => (
                            <View key={f._id} style={s.friendRow}>
                                <View style={s.friendAvatar}><Text style={s.friendInitial}>{f.displayName?.[0]?.toUpperCase()}</Text></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.friendName}>{f.displayName}</Text>
                                    <Text style={s.friendStat}>{f.stats?.casesSolved || 0} cases solved</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={s.emptyText}>No fellow detectives added yet.</Text>
                    )}
                </View>

                {/* ── Settings link ── */}
                <TouchableOpacity style={s.settingsBtn} onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="settings-outline" size={18} color={Colors.text.secondary} />
                    <Text style={s.settingsBtnText}>Settings & Preferences</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <View style={s.statCard}>
            <Ionicons name={icon} size={20} color={color} />
            <Text style={s.statValue}>{value}</Text>
            <Text style={s.statLabel}>{label}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['5xl'] },

    profileHeader: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
    avatarLarge: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.bg.raised,
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.amber.bright,
    },
    avatarInitial: { fontFamily: Typography.display.family, fontSize: 32, color: Colors.amber.bright },
    displayName: { fontFamily: Typography.display.family, ...Typography.display.sizes.lg, color: Colors.text.primary },
    badgeRow: { flexDirection: 'row', gap: Spacing.sm },
    rankBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.amber.glow, borderRadius: Radii.full,
        paddingHorizontal: Spacing.sm, paddingVertical: 4,
    },
    rankBadgeText: { fontFamily: Typography.mono.familyMedium, fontSize: 10, color: Colors.amber.bright, letterSpacing: 1 },
    ratingBadge: { borderRadius: Radii.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    ratingBadgeText: { fontFamily: Typography.mono.familyMedium, fontSize: 10, letterSpacing: 1 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    statCard: {
        flex: 1, minWidth: '45%', backgroundColor: Colors.bg.surface, borderRadius: Radii.lg,
        padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs,
        borderWidth: 1, borderColor: Colors.border.subtle, ...Shadows.card,
    },
    statValue: { fontFamily: Typography.display.family, fontSize: 24, color: Colors.text.primary },
    statLabel: { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.muted, textAlign: 'center' },

    solveRateCard: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border.subtle, gap: Spacing.sm,
    },
    sectionLabel: { fontFamily: Typography.mono.family, fontSize: 10, color: Colors.amber.mid, letterSpacing: 2 },
    solveRateValue: { fontFamily: Typography.display.family, fontSize: 32, color: Colors.text.primary },
    progressTrack: { height: 6, backgroundColor: Colors.bg.raised, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: Colors.amber.bright },

    section: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border.subtle, gap: Spacing.md,
    },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    friendAvatar: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.raised,
        alignItems: 'center', justifyContent: 'center',
    },
    friendInitial: { fontFamily: Typography.body.familySemibold, color: Colors.text.primary },
    friendName: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.text.primary },
    friendStat: { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.muted },
    emptyText: { fontFamily: Typography.body.family, fontSize: 12, color: Colors.text.muted },

    settingsBtn: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border.subtle,
    },
    settingsBtnText: { flex: 1, fontFamily: Typography.body.familyMedium, fontSize: 14, color: Colors.text.primary },
});
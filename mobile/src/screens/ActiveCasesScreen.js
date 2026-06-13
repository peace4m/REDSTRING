/**
 * Redstring — Active Cases Screen
 * ==================================
 * Lists the player's in-progress investigations.
 * Tapping resumes the session at the right place.
 * Shows active lab timers with countdown.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radii, Shadows } from '../config/theme';
import { apiClient } from '../services/apiClient';
import { useGameStore } from '../store/gameStore';

export default function ActiveCasesScreen({ navigation }) {
    const [sessions, setSessions]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { setSession } = useGameStore();

    const fetchSessions = useCallback(async () => {
        try {
            const { sessions } = await apiClient.get('/users/me/sessions?status=active');
            setSessions(sessions);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useFocusEffect(useCallback(() => { fetchSessions(); }, [fetchSessions]));

    const handleResume = async (item) => {
        try {
            const { session } = await apiClient.get(`/sessions/${item._id}`);
            setSession(session);
            navigation.navigate('CrimeScene', { sceneId: session.currentSceneId || session.unlockedSceneIds?.[0], sessionId: session._id });
        } catch (e) { console.error(e); }
    };

    return (
        <SafeAreaView style={s.root} edges={['top']}>
            <View style={s.header}>
                <Text style={s.headerEyebrow}>ONGOING WORK</Text>
                <Text style={s.headerTitle}>My Investigations</Text>
            </View>

            {loading ? (
                <View style={s.loader}><ActivityIndicator color={Colors.amber.bright} size="large" /></View>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={item => item._id}
                    contentContainerStyle={s.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} tintColor={Colors.amber.bright} />
                    }
                    renderItem={({ item }) => <ActiveCaseCard item={item} onPress={() => handleResume(item)} />}
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <Ionicons name="briefcase-outline" size={48} color={Colors.text.muted} />
                            <Text style={s.emptyTitle}>No active investigations</Text>
                            <Text style={s.emptyText}>Open a case from the Cases tab to begin.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

function ActiveCaseCard({ item, onPress }) {
    const activeTimers = (item.activeTimers || []).filter(t => !t.isComplete);
    const elapsed = Math.round((Date.now() - new Date(item.startedAt).getTime()) / (1000 * 60 * 60 * 10)) / 100;

    return (
        <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
            <View style={s.cardHeader}>
                <Text style={s.cardCaseId}>{item.caseId.replace('case_', '').replace(/_/g, ' ').toUpperCase()}</Text>
                <View style={s.statusDot} />
            </View>

            <View style={s.cardMetaRow}>
                <View style={s.metaItem}>
                    <Ionicons name="time-outline" size={12} color={Colors.text.muted} />
                    <Text style={s.metaText}>{elapsed}h elapsed</Text>
                </View>
                <View style={s.metaItem}>
                    <Ionicons name="search-outline" size={12} color={Colors.text.muted} />
                    <Text style={s.metaText}>{item.clueStates?.filter(c => c.status === 'examined').length || 0} clues examined</Text>
                </View>
            </View>

            {activeTimers.length > 0 && (
                <View style={s.timerSection}>
                    {activeTimers.map((t, i) => <TimerRow key={i} timer={t} />)}
                </View>
            )}

            <View style={s.cardFooter}>
                <Text style={s.resumeText}>RESUME INVESTIGATION</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.amber.bright} />
            </View>
        </TouchableOpacity>
    );
}

function TimerRow({ timer }) {
    const [remaining, setRemaining] = useState(getRemaining(timer.completesAt));

    useEffect(() => {
        const interval = setInterval(() => setRemaining(getRemaining(timer.completesAt)), 30000);
        return () => clearInterval(interval);
    }, [timer.completesAt]);

    function getRemaining(completesAt) {
        const ms = new Date(completesAt).getTime() - Date.now();
        if (ms <= 0) return 'Ready';
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }

    const isReady = remaining === 'Ready';

    return (
        <View style={s.timerRow}>
            <Ionicons name={isReady ? 'checkmark-circle' : 'flask-outline'} size={14} color={isReady ? Colors.success : Colors.blue.bright} />
            <Text style={s.timerLabel} numberOfLines={1}>{timer.label}</Text>
            <Text style={[s.timerValue, isReady && { color: Colors.success }]}>{remaining}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },
    header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
    headerEyebrow: { fontFamily: Typography.mono.family, fontSize: 9, color: Colors.amber.mid, letterSpacing: 2 },
    headerTitle: { fontFamily: Typography.display.family, color: Colors.text.primary, ...Typography.display.sizes.lg },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['5xl'], gap: Spacing.md },

    empty: { alignItems: 'center', paddingTop: Spacing['5xl'], gap: Spacing.sm },
    emptyTitle: { fontFamily: Typography.body.familySemibold, fontSize: 15, color: Colors.text.secondary, marginTop: Spacing.sm },
    emptyText: { fontFamily: Typography.body.family, fontSize: 12, color: Colors.text.muted },

    card: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border.subtle, ...Shadows.card, gap: Spacing.sm,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardCaseId: { fontFamily: Typography.display.family, ...Typography.display.sizes.md, color: Colors.text.primary },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },

    cardMetaRow: { flexDirection: 'row', gap: Spacing.lg },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontFamily: Typography.mono.family, fontSize: 11, color: Colors.text.muted },

    timerSection: {
        backgroundColor: Colors.bg.raised, borderRadius: Radii.md, padding: Spacing.sm, gap: Spacing.xs,
    },
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    timerLabel: { flex: 1, fontFamily: Typography.body.family, fontSize: 12, color: Colors.text.secondary },
    timerValue: { fontFamily: Typography.mono.familyMedium, fontSize: 11, color: Colors.blue.bright },

    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: Spacing.xs },
    resumeText: { fontFamily: Typography.mono.familyMedium, fontSize: 10, color: Colors.amber.bright, letterSpacing: 1 },
});
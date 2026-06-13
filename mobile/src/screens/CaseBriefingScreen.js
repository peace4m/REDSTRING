/**
 * Redstring — Case Briefing Screen
 * ====================================
 * Shown before the player starts a case.
 * Contains: victim profile, case briefing, suspect roster,
 * multiplayer room options (create / join), and the START button.
 *
 * Design: Reads like an actual police case briefing folder.
 * Typewriter font. Stamp overlays. Redacted text hints.
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../services/apiClient';
import { useGameStore } from '../store/gameStore';
import { connectCaseEvents } from '../services/socketService';
import { useAuthStore } from '../store/authStore';
import {
    Colors, Typography, Spacing, Radii, DifficultyColors, RatingColors,
} from '../config/theme';

export default function CaseBriefingScreen({ route, navigation }) {
    const { caseId } = route.params;
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading]   = useState(true);
    const [starting, setStarting] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const { setCaseFile, setSession, setRoom } = useGameStore();
    const { user } = useAuthStore();

    useEffect(() => {
        apiClient.get(`/cases/${caseId}`)
            .then(data => { setCaseData(data); setCaseFile(data); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [caseId]);

    // ── Start solo ────────────────────────────────
    const startSolo = async () => {
        setStarting(true);
        try {
            const token = await (await import('expo-secure-store')).getItemAsync('accessToken');
            const { sessionId, session, weather } = await apiClient.post(`/cases/${caseId}/start`, {});
            setSession(session);
            connectCaseEvents(token);
            navigation.replace('CrimeScene', {
                sessionId,
                sceneId: session.unlockedSceneIds[0],
                caseId,
            });
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setStarting(false);
        }
    };

    // ── Create multiplayer room ───────────────────
    const createRoom = async () => {
        setStarting(true);
        try {
            const { roomCode, inviteCode, room } = await apiClient.post('/rooms', { caseId });
            setRoom(room);
            setShowRoomModal(false);
            navigation.navigate('WarRoom', { roomCode, isHost: true, caseId });
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setStarting(false);
        }
    };

    // ── Join existing room ────────────────────────
    const joinRoom = async () => {
        if (!joinCode.trim()) return;
        setStarting(true);
        try {
            // The join code is the roomCode itself for public rooms
            // or the inviteCode for private rooms
            const roomCode = joinCode.toUpperCase().trim();
            const { room } = await apiClient.post(`/rooms/${roomCode}/join`, {});
            setRoom(room);
            setShowRoomModal(false);
            navigation.navigate('WarRoom', { roomCode, isHost: false, caseId });
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setStarting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingScreen}>
                <ActivityIndicator color={Colors.amber.bright} size="large" />
                <Text style={styles.loadingText}>Opening case file…</Text>
            </View>
        );
    }

    if (!caseData) return null;

    const diffColors   = DifficultyColors[caseData.difficulty];
    const ratingColors = RatingColors[caseData.contentRating];

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Back button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={Colors.amber.bright} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* ── Case File Header ── */}
                <View style={styles.fileHeader}>
                    <View style={styles.fileHeaderTop}>
                        <Text style={styles.caseNumber}>{caseData.caseNumber}</Text>
                        <View style={styles.headerBadges}>
                            <View style={[styles.badge, { backgroundColor: ratingColors.bg }]}>
                                <Text style={[styles.badgeText, { color: ratingColors.text }]}>{caseData.contentRating}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: diffColors.bg }]}>
                                <Text style={[styles.badgeText, { color: diffColors.text }]}>{caseData.difficulty.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.caseTitle}>{caseData.title}</Text>
                    <Text style={styles.caseTagline}>{caseData.tagline}</Text>

                    {/* Stats strip */}
                    <View style={styles.statsStrip}>
                        <View style={styles.statCell}>
                            <Text style={styles.statLabel}>LOCATION</Text>
                            <Text style={styles.statValue}>{caseData.setting?.city}, {caseData.setting?.country}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCell}>
                            <Text style={styles.statLabel}>DURATION</Text>
                            <Text style={styles.statValue}>{caseData.timelineLabel}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCell}>
                            <Text style={styles.statLabel}>MAX PLAYERS</Text>
                            <Text style={styles.statValue}>{caseData.maxPlayers}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Briefing ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="document-text-outline" size={14} color={Colors.amber.bright} />
                        <Text style={styles.sectionTitle}>CASE BRIEFING</Text>
                    </View>
                    <Text style={styles.briefingText}>{caseData.briefingText?.trim()}</Text>
                </View>

                {/* ── Victim ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person-outline" size={14} color={Colors.amber.bright} />
                        <Text style={styles.sectionTitle}>VICTIM PROFILE</Text>
                    </View>
                    <View style={styles.victimCard}>
                        <View style={styles.victimAvatar}>
                            <Ionicons name="person" size={28} color={Colors.text.muted} />
                        </View>
                        <View style={styles.victimInfo}>
                            <Text style={styles.victimName}>{caseData.victimName}</Text>
                            <Text style={styles.victimAge}>Age {caseData.victimAge} · {caseData.setting?.year}</Text>
                            <Text style={styles.victimProfile}>{caseData.victimProfile?.trim()}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Suspects ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people-outline" size={14} color={Colors.amber.bright} />
                        <Text style={styles.sectionTitle}>PERSONS OF INTEREST ({caseData.suspects?.length})</Text>
                    </View>
                    <View style={styles.suspectsGrid}>
                        {caseData.suspects?.map(s => (
                            <View key={s.suspectId} style={styles.suspectCard}>
                                <View style={styles.suspectAvatar}>
                                    <Ionicons name="person" size={20} color={Colors.text.secondary} />
                                </View>
                                <Text style={styles.suspectName} numberOfLines={1}>{s.name}</Text>
                                <Text style={styles.suspectRole} numberOfLines={1}>{s.occupation}</Text>
                                <Text style={styles.suspectRelation} numberOfLines={1}>{s.relationship}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Case stats ── */}
                {caseData.stats?.playCount > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="stats-chart-outline" size={14} color={Colors.amber.bright} />
                            <Text style={styles.sectionTitle}>CASE STATISTICS</Text>
                        </View>
                        <View style={styles.statsRow}>
                            <View style={styles.statBlock}>
                                <Text style={styles.statBlockValue}>{caseData.stats.playCount}</Text>
                                <Text style={styles.statBlockLabel}>Investigators</Text>
                            </View>
                            <View style={styles.statBlock}>
                                <Text style={styles.statBlockValue}>
                                    {Math.round((caseData.stats.solveRate || 0) * 100)}%
                                </Text>
                                <Text style={styles.statBlockLabel}>Solve Rate</Text>
                            </View>
                            <View style={styles.statBlock}>
                                <Text style={styles.statBlockValue}>
                                    {caseData.stats.avgSolveTime ? `${Math.round(caseData.stats.avgSolveTime)}h` : '—'}
                                </Text>
                                <Text style={styles.statBlockLabel}>Avg. Solve Time</Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* ── Bottom CTA ── */}
            <LinearGradient
                colors={['transparent', Colors.bg.deep]}
                style={styles.bottomGradient}
            >
                <View style={styles.bottomActions}>
                    <TouchableOpacity
                        style={styles.multiBtn}
                        onPress={() => setShowRoomModal(true)}
                    >
                        <Ionicons name="people" size={18} color={Colors.blue.bright} />
                        <Text style={styles.multiBtnText}>Multiplayer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.startBtn, starting && styles.startBtnDisabled]}
                        onPress={startSolo}
                        disabled={starting}
                    >
                        {starting ? (
                            <ActivityIndicator color={Colors.text.inverse} size="small" />
                        ) : (
                            <>
                                <Text style={styles.startBtnText}>Begin Investigation</Text>
                                <Ionicons name="arrow-forward" size={18} color={Colors.text.inverse} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* ── Room Modal ── */}
            <Modal visible={showRoomModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>War Room</Text>
                        <Text style={styles.modalSubtitle}>Investigate together — up to {caseData.maxPlayers} detectives</Text>

                        <TouchableOpacity style={styles.modalOption} onPress={createRoom} disabled={starting}>
                            <Ionicons name="add-circle-outline" size={22} color={Colors.amber.bright} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalOptionTitle}>Create Room</Text>
                                <Text style={styles.modalOptionDesc}>Get an invite code to share with your team</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <Text style={styles.joinLabel}>JOIN EXISTING ROOM</Text>
                        <View style={styles.joinRow}>
                            <TextInput
                                style={styles.joinInput}
                                placeholder="Room code (e.g. WOLF-7492)"
                                placeholderTextColor={Colors.text.muted}
                                value={joinCode}
                                onChangeText={setJoinCode}
                                autoCapitalize="characters"
                            />
                            <TouchableOpacity
                                style={[styles.joinBtn, !joinCode && styles.joinBtnDisabled]}
                                onPress={joinRoom}
                                disabled={!joinCode || starting}
                            >
                                <Text style={styles.joinBtnText}>Join</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRoomModal(false)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container:     { flex: 1, backgroundColor: Colors.bg.deep },
    loadingScreen: { flex: 1, backgroundColor: Colors.bg.deep, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
    loadingText:   { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text.muted },
    backBtn:       { position: 'absolute', top: 52, left: Spacing.xl, zIndex: 10, padding: Spacing.sm },
    scrollContent: { padding: Spacing.xl, paddingTop: 60 },

    fileHeader: {
        backgroundColor: Colors.bg.surface,
        borderRadius:    Radii.lg,
        padding:         Spacing['2xl'],
        marginBottom:    Spacing.xl,
        borderWidth:     1,
        borderColor:     Colors.border.subtle,
    },
    fileHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    caseNumber:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: Colors.amber.mid, letterSpacing: 2 },
    headerBadges:  { flexDirection: 'row', gap: Spacing.xs },
    badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radii.xs },
    badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.5 },

    caseTitle:   { fontFamily: 'CourierPrime_700Bold', fontSize: 26, color: Colors.text.primary, marginBottom: Spacing.xs, lineHeight: 32 },
    caseTagline: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.secondary, lineHeight: 22, marginBottom: Spacing.xl, fontStyle: 'italic' },

    statsStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border.subtle, paddingTop: Spacing.lg },
    statCell:    { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: Colors.border.subtle },
    statLabel:   { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: Colors.text.muted, letterSpacing: 1.5, marginBottom: 4 },
    statValue:   { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text.primary, textAlign: 'center' },

    section:      { marginBottom: Spacing['2xl'] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    sectionTitle:  { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, color: Colors.amber.bright, letterSpacing: 2 },

    briefingText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.primary, lineHeight: 24, backgroundColor: Colors.bg.surface, padding: Spacing.lg, borderRadius: Radii.md, borderLeftWidth: 3, borderLeftColor: Colors.amber.bright },

    victimCard:   { flexDirection: 'row', gap: Spacing.lg, backgroundColor: Colors.bg.surface, borderRadius: Radii.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border.subtle },
    victimAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.bg.raised, justifyContent: 'center', alignItems: 'center' },
    victimInfo:   { flex: 1 },
    victimName:   { fontFamily: 'CourierPrime_700Bold', fontSize: 18, color: Colors.text.primary, marginBottom: 2 },
    victimAge:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: Colors.text.muted, marginBottom: Spacing.sm },
    victimProfile:{ fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },

    suspectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    suspectCard:  { width: '47%', backgroundColor: Colors.bg.surface, borderRadius: Radii.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.subtle, alignItems: 'center' },
    suspectAvatar:{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg.raised, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
    suspectName:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text.primary, textAlign: 'center' },
    suspectRole:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.secondary, textAlign: 'center' },
    suspectRelation: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.text.muted, textAlign: 'center', marginTop: 2, fontStyle: 'italic' },

    statsRow:       { flexDirection: 'row', backgroundColor: Colors.bg.surface, borderRadius: Radii.md, overflow: 'hidden' },
    statBlock:      { flex: 1, padding: Spacing.lg, alignItems: 'center' },
    statBlockValue: { fontFamily: 'CourierPrime_700Bold', fontSize: 22, color: Colors.amber.bright },
    statBlockLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted, marginTop: 2 },

    bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 40, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
    bottomActions:  { flexDirection: 'row', gap: Spacing.md },
    multiBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.blue.dim, borderRadius: Radii.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, borderWidth: 1, borderColor: Colors.blue.mid },
    multiBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.blue.bright },
    startBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.amber.bright, borderRadius: Radii.lg, paddingVertical: Spacing.lg },
    startBtnDisabled: { opacity: 0.6 },
    startBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text.inverse },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalSheet:   { backgroundColor: Colors.bg.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing['2xl'], paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border.regular },
    modalTitle:   { fontFamily: 'CourierPrime_700Bold', fontSize: 22, color: Colors.text.primary, marginBottom: Spacing.xs },
    modalSubtitle:{ fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text.secondary, marginBottom: Spacing['2xl'] },
    modalOption:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.bg.raised, borderRadius: Radii.lg, padding: Spacing.lg, marginBottom: Spacing.md },
    modalOptionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text.primary },
    modalOptionDesc:  { fontFamily: 'Inter_400Regular',  fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
    divider:      { height: 1, backgroundColor: Colors.border.subtle, marginVertical: Spacing.lg },
    joinLabel:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: Colors.text.muted, letterSpacing: 1.5, marginBottom: Spacing.sm },
    joinRow:      { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    joinInput:    { flex: 1, height: 48, backgroundColor: Colors.bg.overlay, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, fontFamily: 'JetBrainsMono_400Regular', fontSize: 16, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border.regular, letterSpacing: 2 },
    joinBtn:      { height: 48, paddingHorizontal: Spacing.xl, backgroundColor: Colors.amber.bright, borderRadius: Radii.md, justifyContent: 'center', alignItems: 'center' },
    joinBtnDisabled: { opacity: 0.4 },
    joinBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text.inverse },
    modalCancel:  { alignItems: 'center', paddingVertical: Spacing.md },
    modalCancelText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text.muted },
});
/**
 * Redstring — Crime Scene Screen
 * =================================
 * The primary investigation environment.
 *
 * On mobile: A scrollable/zoomable 2D illustrated scene with
 * interactive hotspot overlays on clue locations.
 * (On web: Three.js first-person 3D scene — see web/ folder)
 *
 * Features:
 *  - Clue hotspots pulse amber when unexamined
 *  - Weather HUD overlay (rain effect, fog dimming, night flashlight)
 *  - Jump scare overlay with full-screen flash + audio
 *  - Scene navigation drawer (switch scenes)
 *  - Quick-access toolbar: Evidence Board, Interrogation, Lab
 *  - Teammates positions shown as colored dots (multiplayer)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, Vibration,
    Dimensions, Modal, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { apiClient } from '../services/apiClient';
import { useGameStore } from '../store/gameStore';
import { warRoom, notifySceneEnter } from '../services/socketService';
import WeatherHUD from '../components/hud/WeatherHUD';
import JumpScareOverlay from '../components/hud/JumpScareOverlay';
import TwistModal from '../components/hud/TwistModal';
import ClueDetailModal from '../components/scene/ClueDetailModal';
import Scene3DContainer from '../components/scene3d/Scene3DContainer';
import { Colors, Spacing, Radii, Animations } from '../config/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SCENE_HOTSPOTS = {
    scene_dressing_room: [
        { clueId: 'clue_whiskey_flask',  x: 0.62, y: 0.38, label: 'Flask',        icon: 'flask-outline' },
        { clueId: 'clue_vanity_note',    x: 0.55, y: 0.28, label: 'Note',          icon: 'document-text-outline' },
        { clueId: 'clue_medical_bag',    x: 0.20, y: 0.72, label: 'Medical Bag',   icon: 'medkit-outline' },
    ],
    scene_green_room: [
        { clueId: 'clue_cctv_gap',       x: 0.85, y: 0.15, label: 'CCTV',         icon: 'videocam-outline' },
        { clueId: 'clue_elena_coat',     x: 0.35, y: 0.60, label: "Elena's Coat",  icon: 'shirt-outline' },
    ],
    scene_concert_hall: [
        { clueId: 'clue_rig_log',        x: 0.70, y: 0.20, label: 'Rig Log',       icon: 'construct-outline' },
        { clueId: 'clue_backstage_pass', x: 0.45, y: 0.80, label: 'Backstage Pass',icon: 'card-outline' },
        { clueId: 'clue_cigarette_stub', x: 0.10, y: 0.88, label: 'Stub',          icon: 'trash-outline' },
    ],
};

export default function CrimeSceneScreen({ route, navigation }) {
    const { sessionId, sceneId: initialSceneId, caseId, roomCode } = route.params;

    const [currentSceneId, setCurrentSceneId] = useState(initialSceneId);
    const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);
    const [selectedClue, setSelectedClue]       = useState(null);
    const [examiningClue, setExaminingClue]     = useState(false);
    const [viewMode, setViewMode]               = useState('3d');

    const {
        session, caseFile, weather,
        pendingJumpScares, dismissJumpScare,
        pendingTwists, dismissTwist,
        updateClueState, roomMembers,
    } = useGameStore();

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const nightAnim = useRef(new Animated.Value(0)).current;
    const sceneEnterAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        const isNight = weather.activeEffects?.includes('low_visibility');
        Animated.timing(nightAnim, {
            toValue:  isNight ? 0.7 : 0,
            duration: 1500,
            useNativeDriver: true,
        }).start();
    }, [weather]);

    useEffect(() => {
        sceneEnterAnim.setValue(0);
        Animated.timing(sceneEnterAnim, {
            toValue:  1,
            duration: 600,
            useNativeDriver: true,
        }).start();

        notifySceneEnter(currentSceneId);
        if (roomCode) warRoom.sceneEnter(roomCode, currentSceneId);
    }, [currentSceneId]);

    const examineClue = useCallback(async (clueId) => {
        if (examiningClue) return;
        const state = session?.clueStates?.find(c => c.clueId === clueId);
        if (!state || state.status === 'hidden') return;

        setExaminingClue(true);
        try {
            const result = await apiClient.post(`/cases/sessions/${sessionId}/examine-clue`, { clueId });
            updateClueState(clueId, 'examined');
            result.unlockedChildClueIds?.forEach(id => updateClueState(id, 'found'));
            const clue = caseFile?.clues?.find(c => c.clueId === clueId);
            if (clue) setSelectedClue({ ...clue, result });
        } catch (err) {
            Alert.alert('Cannot examine', err.message);
        } finally {
            setExaminingClue(false);
        }
    }, [sessionId, session, caseFile, examiningClue]);

    const getClueState = (clueId) => session?.clueStates?.find(c => c.clueId === clueId)?.status || 'hidden';
    const hotspots = SCENE_HOTSPOTS[currentSceneId] || [];
    const unlockedScenes = session?.unlockedSceneIds || [];

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.sceneArea, { opacity: sceneEnterAnim }]}>
                {viewMode === '3d' ? (
                    <Scene3DContainer
                        scene={caseFile?.scenes?.find(sc => sc.sceneId === currentSceneId)}
                        hotspots={hotspots.map(h => ({ ...h, type: caseFile?.clues?.find(c => c.clueId === h.clueId)?.type }))}
                        clueStates={session?.clueStates || []}
                        weather={weather}
                        onHotspotPress={examineClue}
                        teammates={(roomMembers || []).filter(m => m.currentSceneId === currentSceneId && m.userId !== session?.userId).map(m => ({
                            userId: m.userId, displayName: m.displayName, colorHex: m.pinColor,
                            x: (m.voicePosition?.x || 0.5) * 100, y: (m.voicePosition?.y || 0.5) * 100,
                        }))}
                    />
                ) : (
                    <View style={styles.sceneBg}>
                        <Text style={styles.scenePlaceholder}>[{currentSceneId.replace('scene_', '').replace(/_/g, ' ').toUpperCase()}]</Text>
                        <Text style={styles.scenePlaceholderSub}>2D illustrated view</Text>
                    </View>
                )}
                <Animated.View style={[styles.nightOverlay, { opacity: nightAnim }]} pointerEvents="none" />
                {weather.activeEffects?.includes('outdoor_clues_degrading') && (
                    <View style={styles.rainOverlay} pointerEvents="none">
                        <Text style={styles.rainWarning}>⚠ Rain — Outdoor clues degrading</Text>
                    </View>
                )}
            </Animated.View>

            <SafeAreaView style={styles.topHud} edges={['top']} pointerEvents="box-none">
                <View style={styles.topHudRow}>
                    <View style={styles.sceneNamePill}>
                        <Ionicons name="location" size={12} color={Colors.amber.bright} />
                        <Text style={styles.sceneNameText}>{currentSceneId.replace('scene_', '').replace(/_/g, ' ')}</Text>
                    </View>
                    <WeatherHUD weather={weather} />
                    <TouchableOpacity style={styles.hudBtn} onPress={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}>
                        <Ionicons name={viewMode === '3d' ? 'cube' : 'square-outline'} size={20} color={Colors.amber.bright} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.hudBtn} onPress={() => navigation.navigate('EvidenceBoard', { sessionId, caseId, roomCode })}>
                        <Ionicons name="albums-outline" size={20} color={Colors.amber.bright} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <SafeAreaView style={styles.bottomBar} edges={['bottom']} pointerEvents="box-none">
                <BlurView intensity={60} tint="dark" style={styles.toolbar}>
                    <TouchableOpacity style={styles.toolbarBtn} onPress={() => setSceneDrawerOpen(true)}>
                        <Ionicons name="map-outline" size={22} color={Colors.text.secondary} />
                        <Text style={styles.toolbarLabel}>Scenes</Text>
                        {unlockedScenes.length > 1 && <View style={styles.toolbarBadge}><Text style={styles.toolbarBadgeText}>{unlockedScenes.length}</Text></View>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolbarBtn} onPress={() => navigation.navigate('EvidenceBoard', { sessionId, caseId, roomCode })}>
                        <Ionicons name="git-network-outline" size={22} color={Colors.text.secondary} />
                        <Text style={styles.toolbarLabel}>Board</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolbarBtnCenter} onPress={() => navigation.navigate('Interrogation', { sessionId, caseId, roomCode })}>
                        <View style={styles.toolbarCenterInner}><Ionicons name="mic" size={24} color={Colors.bg.deep} /></View>
                        <Text style={[styles.toolbarLabel, { color: Colors.amber.bright }]}>Interrogate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolbarBtn}>
                        <Ionicons name="flask-outline" size={22} color={Colors.text.secondary} />
                        <Text style={styles.toolbarLabel}>Lab</Text>
                        {session?.activeTimers?.filter(t => !t.isComplete).length > 0 && <View style={styles.toolbarBadge}><Text style={styles.toolbarBadgeText}>{session.activeTimers.filter(t => !t.isComplete).length}</Text></View>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolbarBtn} onPress={() => Alert.alert('Make Accusation', 'Proceed?', [{text: 'Not yet'}, {text: 'Proceed'}])}>
                        <Ionicons name="hand-left-outline" size={22} color={Colors.red.bright} />
                        <Text style={[styles.toolbarLabel, { color: Colors.red.bright }]}>Accuse</Text>
                    </TouchableOpacity>
                </BlurView>
            </SafeAreaView>

            <Modal visible={sceneDrawerOpen} transparent animationType="slide">
                <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={() => setSceneDrawerOpen(false)} />
                <View style={styles.drawer}>
                    <Text style={styles.drawerTitle}>SCENES</Text>
                    <ScrollView>
                        {unlockedScenes.map(scId => (
                            <TouchableOpacity key={scId} style={styles.drawerItem} onPress={() => { setCurrentSceneId(scId); setSceneDrawerOpen(false); }}>
                                <View style={styles.drawerItemLeft}>
                                    <Ionicons name="location-outline" size={18} color={Colors.amber.bright} />
                                    <Text style={styles.drawerItemName}>{caseFile?.scenes?.find(s => s.sceneId === scId)?.name || scId}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Modal>

            {selectedClue && <ClueDetailModal clue={selectedClue} onClose={() => setSelectedClue(null)} sessionId={sessionId} roomCode={roomCode} />}
            {pendingTwists.length > 0 && <TwistModal twist={pendingTwists[0]} onDismiss={() => dismissTwist(pendingTwists[0].twistId)} />}
            {pendingJumpScares.length > 0 && <JumpScareOverlay scare={pendingJumpScares[0]} intensity={session?.settings?.jumpScareIntensity || 'full'} onDismiss={dismissJumpScare} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.void },
    sceneArea: { flex: 1, position: 'relative' },
    sceneBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0D1520', justifyContent: 'center', alignItems: 'center' },
    scenePlaceholder: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 18, color: Colors.text.muted, letterSpacing: 2 },
    scenePlaceholderSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.muted, marginTop: Spacing.sm },
    nightOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    rainOverlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
    rainWarning: { backgroundColor: 'rgba(74,158,255,0.25)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radii.full, fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.blue.bright },
    topHud: { position: 'absolute', top: 0, left: 0, right: 0 },
    topHudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
    sceneNamePill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.border.regular },
    sceneNameText: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: Colors.text.secondary, letterSpacing: 1, textTransform: 'capitalize' },
    hudBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.regular },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    toolbar: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border.subtle },
    toolbarBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, position: 'relative' },
    toolbarBtnCenter: { flex: 1, alignItems: 'center', paddingBottom: Spacing.xs },
    toolbarCenterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.amber.bright, justifyContent: 'center', alignItems: 'center', marginBottom: 2, shadowColor: Colors.amber.bright, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 10 },
    toolbarLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, color: Colors.text.muted, marginTop: 2, letterSpacing: 0.3 },
    toolbarBadge: { position: 'absolute', top: 4, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.amber.bright, justifyContent: 'center', alignItems: 'center' },
    toolbarBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: Colors.bg.deep },
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '75%', backgroundColor: Colors.bg.surface, borderRightWidth: 1, borderRightColor: Colors.border.regular, paddingTop: 60, paddingHorizontal: Spacing.xl },
    drawerTitle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: Colors.amber.bright, letterSpacing: 3, marginBottom: Spacing.xl },
    drawerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
    drawerItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    drawerItemName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text.primary },
});
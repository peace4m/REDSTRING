/**
 * Redstring — Evidence Board Screen
 * =====================================
 * The corkboard. The visual heart of the game.
 *
 * Players can:
 *  - Pin examined clues to the cork surface (drag to position)
 *  - Connect pins with red string (tap pin → tap pin)
 *  - Add their own annotations to each pin
 *  - In multiplayer: changes sync in real time via Socket.io
 *
 * Design: warm cork texture is the deliberate warm anomaly in an
 * otherwise cold noir palette. It signals "human investigation".
 * Pins are coloured per player in multiplayer.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, PanResponder,
    Dimensions, ScrollView, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/apiClient';
import { useGameStore } from '../store/gameStore';
import { warRoom } from '../services/socketService';
import { Colors, Spacing, Radii } from '../config/theme';

const { width: W, height: H } = Dimensions.get('window');
const BOARD_W = W * 2.2;   // board is wider than screen — scrollable
const BOARD_H = H * 1.5;

// Cork board texture colour
const CORK_COLOR = '#7A5C10';

export default function EvidenceBoardScreen({ route, navigation }) {
    const { sessionId, caseId, roomCode } = route.params;
    const { session, caseFile, room, updateBoard } = useGameStore();

    // Use room board for multiplayer, session board for solo
    const board     = roomCode ? room?.evidenceBoard : session?.evidenceBoard;
    const pins      = board?.pins    || [];
    const strings   = board?.strings || [];

    const [connectMode,   setConnectMode]   = useState(false);
    const [connectSource, setConnectSource] = useState(null);
    const [editingPin,    setEditingPin]    = useState(null);  // { pin, note }
    const [showClueSheet, setShowClueSheet] = useState(false);

    const myColor = roomCode
        ? room?.members?.find(m => m.userId === session?.userId)?.pinColor || 'yellow'
        : 'yellow';

    // ── Examined clues not yet pinned ─────────────
    const unpinnedClues = (session?.clueStates || [])
        .filter(cs => (cs.status === 'examined' || cs.status === 'analyzed'))
        .map(cs => caseFile?.clues?.find(c => c.clueId === cs.clueId))
        .filter(Boolean)
        .filter(clue => !pins.find(p => p.clueId === clue.clueId));

    // ── Add a pin ──────────────────────────────────
    const addPin = useCallback(async (clue) => {
        const pin = {
            pinId:    `pin_${Date.now()}`,
            clueId:   clue.clueId,
            pinnedBy: session?.userId || 'solo',
            x:        30 + Math.random() * 50,  // % position on board
            y:        20 + Math.random() * 60,
            note:     '',
            color:    myColor,
        };

        if (roomCode) {
            warRoom.pinAdd(roomCode, pin);
        } else {
            // Solo: optimistic update then persist
            const newPins = [...pins, pin];
            try {
                await apiClient.patch(`/cases/sessions/${sessionId}/board`, { pins: newPins });
            } catch {}
        }
        setShowClueSheet(false);
    }, [pins, sessionId, roomCode, session, myColor]);

    // ── Remove a pin ───────────────────────────────
    const removePin = useCallback(async (pinId) => {
        if (roomCode) {
            warRoom.pinRemove(roomCode, pinId);
        } else {
            const newPins = pins.filter(p => p.pinId !== pinId);
            const newStrings = strings.filter(s => s.fromPinId !== pinId && s.toPinId !== pinId);
            try {
                await apiClient.patch(`/cases/sessions/${sessionId}/board`, { pins: newPins, strings: newStrings });
            } catch {}
        }
    }, [pins, strings, sessionId, roomCode]);

    // ── Connect two pins with string ───────────────
    const handlePinPress = useCallback((pin) => {
        if (!connectMode) return;

        if (!connectSource) {
            setConnectSource(pin);
            return;
        }

        if (connectSource.pinId === pin.pinId) {
            setConnectSource(null);
            return;
        }

        // Already connected?
        const exists = strings.find(
            s => (s.fromPinId === connectSource.pinId && s.toPinId === pin.pinId) ||
                (s.fromPinId === pin.pinId && s.toPinId === connectSource.pinId)
        );

        if (exists) {
            // Remove string
            if (roomCode) {
                warRoom.stringRemove(roomCode, exists.stringId);
            }
        } else {
            // Add string
            const string = {
                stringId:  `str_${Date.now()}`,
                fromPinId: connectSource.pinId,
                toPinId:   pin.pinId,
                label:     '',
                color:     'red',
                createdBy: session?.userId || 'solo',
            };
            if (roomCode) {
                warRoom.stringAdd(roomCode, string);
            } else {
                // Solo persist
                const newStrings = [...strings, string];
                apiClient.patch(`/cases/sessions/${sessionId}/board`, { strings: newStrings }).catch(() => {});
            }
        }

        setConnectSource(null);
    }, [connectMode, connectSource, strings, sessionId, roomCode, session]);

    // ── Save pin note ──────────────────────────────
    const savePinNote = useCallback(async (pinId, note) => {
        if (roomCode) {
            warRoom.updateNote(roomCode, pinId, note);
        } else {
            const newPins = pins.map(p => p.pinId === pinId ? { ...p, note } : p);
            await apiClient.patch(`/cases/sessions/${sessionId}/board`, { pins: newPins }).catch(() => {});
        }
        setEditingPin(null);
    }, [pins, sessionId, roomCode]);

    // ── Draw SVG-style strings ─────────────────────
    const renderStrings = () => {
        return strings.map(s => {
            const fromPin = pins.find(p => p.pinId === s.fromPinId);
            const toPin   = pins.find(p => p.pinId === s.toPinId);
            if (!fromPin || !toPin) return null;

            const x1 = (fromPin.x / 100) * BOARD_W;
            const y1 = (fromPin.y / 100) * BOARD_H;
            const x2 = (toPin.x  / 100) * BOARD_W;
            const y2 = (toPin.y  / 100) * BOARD_H;
            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle  = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

            return (
                <View
                    key={s.stringId}
                    style={{
                        position:   'absolute',
                        left:        x1,
                        top:         y1 - 1,
                        width:       length,
                        height:      2,
                        backgroundColor: Colors.cork.string,
                        opacity:     0.8,
                        transformOrigin: '0 50%',
                        transform:   [{ rotate: `${angle}deg` }],
                    }}
                />
            );
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={22} color={Colors.amber.bright} />
                </TouchableOpacity>
                <Text style={styles.title}>Evidence Board</Text>
                <View style={styles.headerActions}>
                    {/* Connect mode toggle */}
                    <TouchableOpacity
                        style={[styles.headerBtn, connectMode && styles.headerBtnActive]}
                        onPress={() => { setConnectMode(v => !v); setConnectSource(null); }}
                    >
                        <Ionicons
                            name="git-network-outline"
                            size={18}
                            color={connectMode ? Colors.bg.deep : Colors.text.secondary}
                        />
                    </TouchableOpacity>
                    {/* Add clue */}
                    <TouchableOpacity
                        style={[styles.headerBtn, { backgroundColor: Colors.amber.dim }]}
                        onPress={() => setShowClueSheet(true)}
                    >
                        <Ionicons name="add" size={18} color={Colors.amber.bright} />
                    </TouchableOpacity>
                </View>
            </View>

            {connectMode && (
                <View style={styles.connectBanner}>
                    <Ionicons name="git-network" size={12} color={Colors.red.bright} />
                    <Text style={styles.connectBannerText}>
                        {connectSource
                            ? `Connecting from "${caseFile?.clues?.find(c => c.clueId === connectSource.clueId)?.label}" — tap another pin`
                            : 'String mode — tap a pin to start a connection'}
                    </Text>
                </View>
            )}

            {/* Cork board */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                style={styles.boardScroll}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.board}>
                        {/* Cork texture background */}
                        <View style={styles.corkTexture} />

                        {/* Strings (drawn behind pins) */}
                        {renderStrings()}

                        {/* Pins */}
                        {pins.map(pin => {
                            const clue = caseFile?.clues?.find(c => c.clueId === pin.clueId);
                            const isSource = connectSource?.pinId === pin.pinId;
                            const pinLeft = (pin.x / 100) * BOARD_W - 50;
                            const pinTop  = (pin.y / 100) * BOARD_H - 60;

                            return (
                                <TouchableOpacity
                                    key={pin.pinId}
                                    style={[
                                        styles.pin,
                                        { left: pinLeft, top: pinTop },
                                        isSource && styles.pinSelected,
                                    ]}
                                    onPress={() => handlePinPress(pin)}
                                    onLongPress={() => setEditingPin({ pin, note: pin.note || '' })}
                                    activeOpacity={0.8}
                                >
                                    {/* Pin head */}
                                    <View style={[styles.pinHead, { backgroundColor: pin.color || 'yellow' }]} />

                                    {/* Note card */}
                                    <View style={[styles.noteCard, isSource && styles.noteCardSelected]}>
                                        <Text style={styles.noteCardClue} numberOfLines={2}>
                                            {clue?.label || pin.clueId}
                                        </Text>
                                        {pin.note ? (
                                            <Text style={styles.noteCardNote} numberOfLines={2}>{pin.note}</Text>
                                        ) : (
                                            <Text style={styles.noteCardEmpty}>Hold to add note…</Text>
                                        )}
                                        <View style={styles.noteCardFooter}>
                                            <Text style={styles.noteCardType}>
                                                {clue?.type?.toUpperCase() || 'CLUE'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Remove button */}
                                    <TouchableOpacity
                                        style={styles.pinRemove}
                                        onPress={() => Alert.alert('Remove Pin', `Remove "${clue?.label}" from board?`, [
                                            { text: 'Cancel', style: 'cancel' },
                                            { text: 'Remove', style: 'destructive', onPress: () => removePin(pin.pinId) },
                                        ])}
                                    >
                                        <Ionicons name="close" size={10} color={Colors.text.muted} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}

                        {pins.length === 0 && (
                            <View style={styles.emptyBoard}>
                                <Text style={styles.emptyBoardText}>
                                    Examine clues in the scene,{'\n'}then pin them here.
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </ScrollView>

            {/* ── Add clue sheet ── */}
            <Modal visible={showClueSheet} transparent animationType="slide">
                <TouchableOpacity style={styles.sheetOverlay} onPress={() => setShowClueSheet(false)} />
                <View style={styles.sheet}>
                    <Text style={styles.sheetTitle}>Pin a Clue</Text>
                    {unpinnedClues.length === 0 ? (
                        <Text style={styles.sheetEmpty}>
                            All examined clues are already pinned, or you haven't examined any yet.
                        </Text>
                    ) : (
                        unpinnedClues.map(clue => (
                            <TouchableOpacity key={clue.clueId} style={styles.sheetItem} onPress={() => addPin(clue)}>
                                <View style={styles.sheetItemIcon}>
                                    <Ionicons name="folder-open-outline" size={18} color={Colors.amber.bright} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sheetItemTitle}>{clue.label}</Text>
                                    <Text style={styles.sheetItemType}>{clue.type?.toUpperCase()}</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={20} color={Colors.amber.bright} />
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </Modal>

            {/* ── Edit pin note ── */}
            <Modal visible={!!editingPin} transparent animationType="fade">
                <View style={styles.noteOverlay}>
                    <View style={styles.noteEditor}>
                        <Text style={styles.noteEditorTitle}>
                            {caseFile?.clues?.find(c => c.clueId === editingPin?.pin?.clueId)?.label}
                        </Text>
                        <TextInput
                            style={styles.noteInput}
                            placeholder="Your annotation…"
                            placeholderTextColor={Colors.text.muted}
                            value={editingPin?.note}
                            onChangeText={(t) => setEditingPin(prev => ({ ...prev, note: t }))}
                            multiline
                            autoFocus
                        />
                        <View style={styles.noteEditorActions}>
                            <TouchableOpacity onPress={() => setEditingPin(null)}>
                                <Text style={styles.noteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.noteSaveBtn}
                                onPress={() => savePinNote(editingPin.pin.pinId, editingPin.note)}
                            >
                                <Text style={styles.noteSaveText}>Save Note</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.deep },
    header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
    backBtn:   { padding: Spacing.xs, marginRight: Spacing.sm },
    title:     { flex: 1, fontFamily: 'CourierPrime_700Bold', fontSize: 20, color: Colors.text.primary },
    headerActions: { flexDirection: 'row', gap: Spacing.sm },
    headerBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.regular },
    headerBtnActive: { backgroundColor: Colors.red.bright },

    connectBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.red.dim, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.red.mid },
    connectBannerText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.red.bright, flex: 1 },

    boardScroll: { flex: 1 },
    board: {
        width: BOARD_W, height: BOARD_H, position: 'relative',
        backgroundColor: CORK_COLOR,
    },
    corkTexture: { ...StyleSheet.absoluteFillObject, opacity: 0.15 },

    // Pin card
    pin: {
        position: 'absolute', width: 100, alignItems: 'center',
    },
    pinSelected: { opacity: 0.8 },
    pinHead: {
        width: 10, height: 10, borderRadius: 5,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.3)',
        zIndex: 2, marginBottom: -2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 2, elevation: 4,
    },
    noteCard: {
        width: 100, backgroundColor: '#FFF9C4', borderRadius: 2,
        padding: Spacing.sm, paddingBottom: Spacing.xs,
        shadowColor: '#000', shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 5,
    },
    noteCardSelected: { borderWidth: 2, borderColor: Colors.red.bright },
    noteCardClue:     { fontFamily: 'CourierPrime_700Bold', fontSize: 10, color: '#2C1810', lineHeight: 14, marginBottom: 4 },
    noteCardNote:     { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#4A3520', lineHeight: 13, fontStyle: 'italic' },
    noteCardEmpty:    { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#A09080', fontStyle: 'italic' },
    noteCardFooter:   { marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#D4C890', paddingTop: 3 },
    noteCardType:     { fontFamily: 'JetBrainsMono_400Regular', fontSize: 7, color: '#8A7060', letterSpacing: 1 },
    pinRemove: {
        position: 'absolute', top: 8, right: -6, width: 16, height: 16, borderRadius: 8,
        backgroundColor: Colors.bg.overlay, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: Colors.border.regular,
    },

    emptyBoard: { position: 'absolute', top: '40%', left: '50%', transform: [{ translateX: -120 }], width: 240, alignItems: 'center' },
    emptyBoardText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 24 },

    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: { backgroundColor: Colors.bg.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing['2xl'], paddingBottom: 40, maxHeight: H * 0.6 },
    sheetTitle: { fontFamily: 'CourierPrime_700Bold', fontSize: 20, color: Colors.text.primary, marginBottom: Spacing.xl },
    sheetEmpty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text.muted, textAlign: 'center', paddingVertical: Spacing.xl },
    sheetItem:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
    sheetItemIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.amber.dim, justifyContent: 'center', alignItems: 'center' },
    sheetItemTitle:{ fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text.primary },
    sheetItemType: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 10, color: Colors.text.muted, letterSpacing: 1 },

    noteOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing['2xl'] },
    noteEditor:   { backgroundColor: Colors.bg.surface, borderRadius: Radii.xl, padding: Spacing['2xl'], borderWidth: 1, borderColor: Colors.border.regular },
    noteEditorTitle: { fontFamily: 'CourierPrime_700Bold', fontSize: 16, color: Colors.amber.bright, marginBottom: Spacing.lg },
    noteInput:    { backgroundColor: Colors.bg.raised, borderRadius: Radii.md, padding: Spacing.lg, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.primary, minHeight: 100, borderWidth: 1, borderColor: Colors.border.regular, textAlignVertical: 'top' },
    noteEditorActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
    noteCancelText:    { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text.muted },
    noteSaveBtn:       { backgroundColor: Colors.amber.bright, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.full },
    noteSaveText:      { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.bg.deep },
});
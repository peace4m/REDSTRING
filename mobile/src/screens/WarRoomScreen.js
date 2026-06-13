/**
 * Redstring — War Room Screen
 * ==============================
 * The shared multiplayer investigation space.
 * A pannable/zoomable corkboard where teammates pin clues,
 * connect them with red string, and chat in real time.
 *
 * Layout:
 *  - Top bar: room code, member avatars (online status), weather indicator
 *  - Main: corkboard canvas (pinch-zoom + pan)
 *  - Bottom sheet: chat / clue tray (swipe up)
 *  - FAB: open scene list to continue investigating
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
    Image, Dimensions, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
    GestureDetector, Gesture,
} from 'react-native-gesture-handler';
import Svg, { Line, Circle } from 'react-native-svg';

import { Colors, Typography, Spacing, Radii, Shadows } from '../config/theme';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { connectWarRoom, disconnectWarRoom, warRoom } from '../services/socketService';
import { WeatherBadge, ConnectionDot } from '../components/hud/HUDComponents';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOARD_W = SCREEN_W * 2;
const BOARD_H = SCREEN_H * 1.6;

export default function WarRoomScreen({ route, navigation }) {
    const { roomCode } = route.params;
    const { user } = useAuthStore();
    const { room, roomMembers, weather, setRoom } = useGameStore();

    const [activeTab, setActiveTab] = useState('board'); // 'board' | 'chat'
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [linkMode, setLinkMode] = useState(null); // pinId waiting for second pin to connect
    const [selectedClue, setSelectedClue] = useState(null);

    // Pan/zoom state
    const translateX = useRef(new Animated.Value(-(BOARD_W - SCREEN_W) / 2)).current;
    const translateY = useRef(new Animated.Value(-(BOARD_H - SCREEN_H) / 2)).current;
    const scale = useRef(new Animated.Value(1)).current;

    // ── Connect to room on mount ──────────────────
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const token = apiClient.token;
                const { room: roomData } = await apiClient.get(`/rooms/${roomCode}`);
                if (!mounted) return;
                setRoom(roomData);

                connectWarRoom(token, roomCode, (resp) => {
                    if (resp?.room) setRoom(resp.room);
                });

                const { messages } = await apiClient.get(`/rooms/${roomCode}/chat?limit=50`);
                setChatMessages(messages || []);
            } catch (e) {
                console.error('[WarRoom] init failed', e);
            }
        })();

        return () => {
            mounted = false;
            disconnectWarRoom();
        };
    }, [roomCode]);

    // ── Pan gesture for board ──────────────────────
    const panGesture = Gesture.Pan()
        .onChange((e) => {
            translateX.setValue(translateX._value + e.changeX);
            translateY.setValue(translateY._value + e.changeY);
        });

    const pinchGesture = Gesture.Pinch()
        .onChange((e) => {
            const newScale = Math.max(0.5, Math.min(2, scale._value * e.scaleChange));
            scale.setValue(newScale);
        });

    const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

    // ── Tap board to drop a pin (from a selected clue tray) ──
    const handleBoardTap = useCallback((evt) => {
        if (!selectedClue) return;
        const { locationX, locationY } = evt.nativeEvent;
        const xPercent = (locationX / BOARD_W) * 100;
        const yPercent = (locationY / BOARD_H) * 100;

        warRoom.pinAdd(roomCode, {
            clueId: selectedClue.clueId,
            x: xPercent,
            y: yPercent,
            color: getMyPinColor(),
        });
        setSelectedClue(null);
    }, [selectedClue, roomCode, roomMembers, user]);

    function getMyPinColor() {
        const me = roomMembers.find(m => m.userId === user?.userId);
        return me?.pinColor || 'yellow';
    }

    // ── Pin tap: select for linking or open detail ──
    const handlePinTap = (pin) => {
        if (linkMode) {
            if (linkMode === pin.pinId) { setLinkMode(null); return; }
            warRoom.stringAdd(roomCode, { fromPinId: linkMode, toPinId: pin.pinId, label: '' });
            setLinkMode(null);
            return;
        }
        // Show pin detail / long-press to start linking
    };

    const handlePinLongPress = (pin) => setLinkMode(pin.pinId);

    // ── Send chat message ──────────────────────────
    const sendChat = async () => {
        if (!chatInput.trim()) return;
        try {
            await apiClient.post(`/rooms/${roomCode}/chat`, { text: chatInput, type: 'text' });
            setChatInput('');
        } catch (e) { console.error(e); }
    };

    if (!room) return <View style={s.root} />;

    const pins    = room.evidenceBoard?.pins    || [];
    const strings = room.evidenceBoard?.strings || [];

    return (
        <SafeAreaView style={s.root} edges={['top','bottom']}>
            {/* ── Top Bar ── */}
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
                    <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
                </TouchableOpacity>

                <View style={s.roomInfo}>
                    <Text style={s.roomCode}>{roomCode}</Text>
                    <Text style={s.roomSubtitle}>War Room — {pins.length} pinned</Text>
                </View>

                <WeatherBadge weather={weather} compact />

                {/* Member avatars */}
                <View style={s.avatarStack}>
                    {roomMembers.slice(0, 4).map((m, i) => (
                        <View key={m.userId} style={[s.avatarWrap, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}>
                            <View style={[s.avatar, { borderColor: pinColorHex(m.pinColor) }]}>
                                <Text style={s.avatarInitial}>{m.displayName?.[0]?.toUpperCase()}</Text>
                            </View>
                            <ConnectionDot online={m.isOnline} />
                        </View>
                    ))}
                </View>
            </View>

            {/* ── Link mode banner ── */}
            {linkMode && (
                <View style={s.linkBanner}>
                    <Ionicons name="git-network-outline" size={14} color={Colors.cork.string} />
                    <Text style={s.linkBannerText}>Tap another pin to connect with red string</Text>
                    <TouchableOpacity onPress={() => setLinkMode(null)}>
                        <Text style={s.linkBannerCancel}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Corkboard ── */}
            {activeTab === 'board' && (
                <GestureDetector gesture={composedGesture}>
                    <Animated.View
                        style={[
                            s.board,
                            {
                                width: BOARD_W, height: BOARD_H,
                                transform: [{ translateX }, { translateY }, { scale }],
                            },
                        ]}
                    >
                        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={handleBoardTap}>
                            {/* Cork texture overlay */}
                            <View style={s.corkTexture} />

                            {/* Red strings (SVG layer) */}
                            <Svg width={BOARD_W} height={BOARD_H} style={StyleSheet.absoluteFill}>
                                {strings.map(str => {
                                    const from = pins.find(p => p.pinId === str.fromPinId);
                                    const to   = pins.find(p => p.pinId === str.toPinId);
                                    if (!from || !to) return null;
                                    return (
                                        <Line
                                            key={str.stringId}
                                            x1={`${from.x}%`} y1={`${from.y}%`}
                                            x2={`${to.x}%`}   y2={`${to.y}%`}
                                            stroke={Colors.cork.string}
                                            strokeWidth={2}
                                            strokeDasharray="0"
                                        />
                                    );
                                })}
                                {/* Active link preview dot */}
                                {linkMode && pins.find(p => p.pinId === linkMode) && (
                                    <Circle
                                        cx={`${pins.find(p => p.pinId === linkMode).x}%`}
                                        cy={`${pins.find(p => p.pinId === linkMode).y}%`}
                                        r={14}
                                        fill="none"
                                        stroke={Colors.cork.string}
                                        strokeWidth={2}
                                        strokeDasharray="4,4"
                                    />
                                )}
                            </Svg>

                            {/* Pins */}
                            {pins.map(pin => (
                                <EvidencePin
                                    key={pin.pinId}
                                    pin={pin}
                                    isLinkSource={linkMode === pin.pinId}
                                    onPress={() => handlePinTap(pin)}
                                    onLongPress={() => handlePinLongPress(pin)}
                                />
                            ))}
                        </TouchableOpacity>
                    </Animated.View>
                </GestureDetector>
            )}

            {/* ── Chat ── */}
            {activeTab === 'chat' && (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={90}
                >
                    <FlatList
                        data={chatMessages}
                        keyExtractor={m => m.messageId}
                        renderItem={({ item }) => <ChatBubble message={item} isMe={item.userId === user?.userId} />}
                        contentContainerStyle={s.chatList}
                        inverted={false}
                    />
                    <View style={s.chatInputRow}>
                        <TextInput
                            style={s.chatInput}
                            placeholder="Share a theory..."
                            placeholderTextColor={Colors.text.muted}
                            value={chatInput}
                            onChangeText={setChatInput}
                            onSubmitEditing={sendChat}
                        />
                        <TouchableOpacity style={s.sendBtn} onPress={sendChat}>
                            <Ionicons name="send" size={16} color={Colors.bg.deep} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}

            {/* ── Bottom Tab Switcher ── */}
            <View style={s.bottomBar}>
                <TouchableOpacity
                    style={[s.bottomTab, activeTab === 'board' && s.bottomTabActive]}
                    onPress={() => setActiveTab('board')}
                >
                    <Ionicons name="grid-outline" size={18} color={activeTab === 'board' ? Colors.amber.bright : Colors.text.muted} />
                    <Text style={[s.bottomTabText, activeTab === 'board' && s.bottomTabTextActive]}>Corkboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.fabCenter}
                    onPress={() => navigation.navigate('CrimeScene', { sceneId: room.unlockedSceneIds?.[0], roomCode })}
                >
                    <Ionicons name="flashlight" size={22} color={Colors.bg.deep} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.bottomTab, activeTab === 'chat' && s.bottomTabActive]}
                    onPress={() => setActiveTab('chat')}
                >
                    <Ionicons name="chatbubbles-outline" size={18} color={activeTab === 'chat' ? Colors.amber.bright : Colors.text.muted} />
                    <Text style={[s.bottomTabText, activeTab === 'chat' && s.bottomTabTextActive]}>Discussion</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
//  EVIDENCE PIN
// ─────────────────────────────────────────────
function EvidencePin({ pin, isLinkSource, onPress, onLongPress }) {
    return (
        <TouchableOpacity
            style={[
                s.pin,
                { left: `${pin.x}%`, top: `${pin.y}%`, borderColor: pinColorHex(pin.color) },
                isLinkSource && s.pinActive,
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={300}
        >
            <View style={[s.pinHead, { backgroundColor: pinColorHex(pin.color) }]} />
            <View style={s.pinCard}>
                <Text style={s.pinClueId} numberOfLines={2}>{formatClueLabel(pin.clueId)}</Text>
                {!!pin.note && <Text style={s.pinNote} numberOfLines={2}>{pin.note}</Text>}
            </View>
        </TouchableOpacity>
    );
}

function formatClueLabel(clueId) {
    return clueId.replace('clue_', '').replace(/_/g, ' ');
}

function pinColorHex(name) {
    const map = {
        red: '#E53535', blue: '#4A9EFF', green: '#2ECC71', yellow: '#F5C842',
        purple: '#9B59B6', orange: '#E67E22', pink: '#FF6B9D', teal: '#1ABC9C', white: '#E8E9ED',
    };
    return map[name] || '#F5C842';
}

// ─────────────────────────────────────────────
//  CHAT BUBBLE
// ─────────────────────────────────────────────
function ChatBubble({ message, isMe }) {
    if (message.type === 'system') {
        return <Text style={s.systemMsg}>{message.text}</Text>;
    }
    return (
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
            {!isMe && <Text style={s.bubbleAuthor}>{message.displayName}</Text>}
            {message.type === 'theory' && (
                <View style={s.theoryTag}><Ionicons name="bulb-outline" size={11} color={Colors.amber.bright} /></View>
            )}
            {message.type === 'clue_share' && (
                <View style={s.clueShareTag}>
                    <Ionicons name="bookmark" size={11} color={Colors.blue.bright} />
                    <Text style={s.clueShareText}>{formatClueLabel(message.clueId || '')}</Text>
                </View>
            )}
            <Text style={s.bubbleText}>{message.text}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },

    topBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface, gap: Spacing.sm, zIndex: 20,
    },
    iconBtn: { padding: 4 },
    roomInfo: { flex: 1 },
    roomCode: {
        fontFamily: Typography.mono.familyMedium, fontSize: 14,
        color: Colors.amber.bright, letterSpacing: 1,
    },
    roomSubtitle: { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.muted },

    avatarStack: { flexDirection: 'row', alignItems: 'center', marginLeft: Spacing.sm },
    avatarWrap: { position: 'relative' },
    avatar: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 2,
        backgroundColor: Colors.bg.raised, alignItems: 'center', justifyContent: 'center',
    },
    avatarInitial: { fontFamily: Typography.body.familySemibold, fontSize: 11, color: Colors.text.primary },

    // Link banner
    linkBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.cork.base + '22', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
    },
    linkBannerText: { flex: 1, fontFamily: Typography.body.family, fontSize: 12, color: Colors.text.secondary },
    linkBannerCancel: { fontFamily: Typography.body.familySemibold, fontSize: 12, color: Colors.amber.bright },

    // Board
    board: { backgroundColor: Colors.cork.base },
    corkTexture: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.cork.texture,
        opacity: 0.3,
    },

    // Pins
    pin: {
        position: 'absolute', width: 110, marginLeft: -55,
        alignItems: 'center',
    },
    pinActive: { opacity: 0.6 },
    pinHead: {
        width: 14, height: 14, borderRadius: 7, marginBottom: -7, zIndex: 2,
        borderWidth: 2, borderColor: '#fff', ...Shadows.card,
    },
    pinCard: {
        backgroundColor: '#FFF8E7', borderRadius: 2, padding: Spacing.xs,
        width: 110, paddingTop: Spacing.sm,
        borderWidth: 1, borderColor: '#00000022',
        transform: [{ rotate: '-1deg' }],
        ...Shadows.card,
    },
    pinClueId: {
        fontFamily: Typography.mono.familyMedium, fontSize: 9,
        color: '#2A2510', textTransform: 'capitalize',
    },
    pinNote: {
        fontFamily: Typography.body.family, fontSize: 9,
        color: '#5A4A20', marginTop: 2, fontStyle: 'italic',
    },

    // Bottom bar
    bottomBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
        paddingVertical: Spacing.sm, backgroundColor: Colors.bg.surface,
        borderTopWidth: 1, borderTopColor: Colors.border.subtle,
    },
    bottomTab: { alignItems: 'center', gap: 2, flex: 1, paddingVertical: Spacing.xs },
    bottomTabActive: {},
    bottomTabText: { fontFamily: Typography.body.family, fontSize: 10, color: Colors.text.muted },
    bottomTabTextActive: { color: Colors.amber.bright },
    fabCenter: {
        width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.amber.bright,
        alignItems: 'center', justifyContent: 'center', marginTop: -24,
        ...Shadows.amber,
    },

    // Chat
    chatList: { padding: Spacing.lg, gap: Spacing.sm },
    bubble: { maxWidth: '80%', borderRadius: Radii.md, padding: Spacing.sm, marginBottom: Spacing.xs },
    bubbleMe:    { alignSelf: 'flex-end', backgroundColor: Colors.amber.dim },
    bubbleOther: { alignSelf: 'flex-start', backgroundColor: Colors.bg.raised },
    bubbleAuthor: { fontFamily: Typography.body.familySemibold, fontSize: 10, color: Colors.amber.mid, marginBottom: 2 },
    bubbleText: { fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.primary },
    systemMsg: {
        fontFamily: Typography.mono.family, fontSize: 10, color: Colors.text.muted,
        textAlign: 'center', marginVertical: Spacing.xs,
    },
    theoryTag: { marginBottom: 2 },
    clueShareTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.blue.dim, borderRadius: Radii.xs,
        paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4, alignSelf: 'flex-start',
    },
    clueShareText: { fontFamily: Typography.mono.family, fontSize: 9, color: Colors.blue.bright, textTransform: 'capitalize' },

    chatInputRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border.subtle,
        backgroundColor: Colors.bg.surface,
    },
    chatInput: {
        flex: 1, backgroundColor: Colors.bg.raised, borderRadius: Radii.full,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.primary,
        borderWidth: 1, borderColor: Colors.border.subtle,
    },
    sendBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.amber.bright,
        alignItems: 'center', justifyContent: 'center',
    },
});
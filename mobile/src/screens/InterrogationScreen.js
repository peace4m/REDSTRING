/**
 * Redstring — Interrogation Screen
 * ====================================
 * The suspect interview room.
 *
 * Layout:
 *  - Suspect portrait (top half) — large, dramatic, dark
 *  - Dialogue box showing suspect's current statement
 *  - Evidence presentation: tap a clue from inventory to present it
 *  - Free-text question input (AI generates suspect's response)
 *  - Alibi crack indicator (shows current layer / total)
 *  - Behavioural notes panel (player's own annotations)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Animated, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../services/apiClient';
import { useGameStore } from '../store/gameStore';
import { Colors, Spacing, Radii, Typography, Animations as AnimDurations } from '../config/theme';

export default function InterrogationScreen({ route, navigation }) {
    const { sessionId, caseId, roomCode } = route.params;
    const { session, caseFile } = useGameStore();

    const [selectedSuspect, setSelectedSuspect] = useState(null);
    const [question,        setQuestion]         = useState('');
    const [dialogue,        setDialogue]          = useState(null);
    const [loading,         setLoading]           = useState(false);
    const [showEvidence,    setShowEvidence]       = useState(false);
    const [alibiBrokeAnim]  = useState(new Animated.Value(0));

    const scrollRef = useRef(null);
    const suspects  = caseFile?.suspects || [];

    // Get interrogation state for current suspect
    const getInterrogationState = (suspectId) => {
        return session?.interrogations?.find(i => i.suspectId === suspectId);
    };

    // Examined clues (available to present as evidence)
    const examinedClues = (session?.clueStates || [])
        .filter(c => c.status === 'examined' || c.status === 'analyzed')
        .map(cs => caseFile?.clues?.find(c => c.clueId === cs.clueId))
        .filter(Boolean);

    // ── Interrogate / present evidence ────────────
    const interrogate = useCallback(async (presentClueId = null) => {
        if (!selectedSuspect || loading) return;
        setLoading(true);
        setShowEvidence(false);

        try {
            const body = {
                suspectId: selectedSuspect.suspectId,
                ...(presentClueId ? { presentClueId } : {}),
                ...(question.trim() ? { playerQuestion: question.trim() } : {}),
            };

            const result = await apiClient.post(`/cases/sessions/${sessionId}/interrogate`, body);
            setQuestion('');

            // Alibi crack animation
            if (result.alibiBroke) {
                Animated.sequence([
                    Animated.timing(alibiBrokeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                    Animated.timing(alibiBrokeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                ]).start();
            }

            setDialogue(prev => {
                const entry = {
                    id:          Date.now().toString(),
                    type:        presentClueId ? 'evidence' : 'question',
                    clueId:      presentClueId,
                    clueName:    presentClueId
                        ? caseFile?.clues?.find(c => c.clueId === presentClueId)?.label
                        : null,
                    question:    question.trim() || null,
                    response:    result.aiDialogue || result.currentStatement,
                    alibiBroke:  result.alibiBroke,
                    revealText:  result.revealText,
                    layer:       result.currentAlibiLayer,
                    totalLayers: result.totalAlibiLayers,
                };
                return [...(prev || []), entry];
            });

            // Scroll to bottom
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        } catch (err) {
            Alert.alert('Cannot interrogate', err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedSuspect, question, sessionId, caseFile, loading]);

    // Alibi progress bar colour
    const alibiBrokeColor = alibiBrokeAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: [Colors.bg.surface, Colors.red.dim],
    });

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

            {/* ── Back ── */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={Colors.amber.bright} />
                <Text style={styles.backText}>Scene</Text>
            </TouchableOpacity>

            {/* ── Suspect Roster ── */}
            <View style={styles.rosterSection}>
                <Text style={styles.rosterLabel}>PERSONS OF INTEREST</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.rosterRow}>
                        {suspects.map(s => {
                            const iState = getInterrogationState(s.suspectId);
                            const isSelected = selectedSuspect?.suspectId === s.suspectId;
                            const layersCracked = iState?.currentAlibiLayer || 0;
                            const hasBeenInterrogated = !!iState?.lastInterrogatedAt;

                            return (
                                <TouchableOpacity
                                    key={s.suspectId}
                                    style={[styles.suspectChip, isSelected && styles.suspectChipSelected]}
                                    onPress={() => {
                                        setSelectedSuspect(s);
                                        setDialogue(null);
                                    }}
                                >
                                    <View style={[styles.suspectIcon, isSelected && styles.suspectIconSelected]}>
                                        <Ionicons name="person" size={18} color={isSelected ? Colors.bg.deep : Colors.text.secondary} />
                                        {layersCracked > 0 && (
                                            <View style={styles.crackBadge}>
                                                <Text style={styles.crackBadgeText}>{layersCracked}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.suspectChipName, isSelected && styles.suspectChipNameSelected]} numberOfLines={1}>
                                        {s.name.split(' ')[0]}
                                    </Text>
                                    {hasBeenInterrogated && <View style={styles.interrogatedDot} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>

            {!selectedSuspect ? (
                /* No suspect selected */
                <View style={styles.noSuspect}>
                    <Ionicons name="mic-off-outline" size={48} color={Colors.text.muted} />
                    <Text style={styles.noSuspectText}>Select a suspect to interrogate</Text>
                </View>
            ) : (
                <>
                    {/* ── Suspect Portrait ── */}
                    <Animated.View style={[styles.portraitArea, { backgroundColor: alibiBrokeColor }]}>
                        <LinearGradient
                            colors={[Colors.bg.void, 'transparent', Colors.bg.void]}
                            locations={[0, 0.4, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                        {/* Portrait placeholder */}
                        <View style={styles.portrait}>
                            <Ionicons name="person" size={72} color={Colors.text.muted} />
                        </View>
                        <View style={styles.suspectInfo}>
                            <Text style={styles.suspectName}>{selectedSuspect.name}</Text>
                            <Text style={styles.suspectOccupation}>{selectedSuspect.occupation}</Text>
                            <Text style={styles.suspectRelation}>{selectedSuspect.relationship}</Text>
                        </View>

                        {/* Alibi layer indicator */}
                        {(() => {
                            const iState = getInterrogationState(selectedSuspect.suspectId);
                            const current = iState?.currentAlibiLayer || 0;
                            const total   = selectedSuspect.alibiChain?.length || 1;
                            return (
                                <View style={styles.alibiBar}>
                                    <Text style={styles.alibiLabel}>ALIBI INTEGRITY</Text>
                                    <View style={styles.alibiTrack}>
                                        {Array.from({ length: total }).map((_, i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.alibiSegment,
                                                    i < current
                                                        ? styles.alibiCracked
                                                        : styles.alibiIntact,
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    {current >= total && (
                                        <Text style={styles.alibiExhausted}>Suspect has shut down</Text>
                                    )}
                                </View>
                            );
                        })()}
                    </Animated.View>

                    {/* ── Dialogue log ── */}
                    <ScrollView
                        ref={scrollRef}
                        style={styles.dialogueLog}
                        contentContainerStyle={styles.dialogueContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {!dialogue || dialogue.length === 0 ? (
                            <View style={styles.dialogueEmpty}>
                                <Text style={styles.dialogueEmptyText}>
                                    Present evidence or ask a question to begin.
                                </Text>
                            </View>
                        ) : (
                            dialogue.map(entry => (
                                <View key={entry.id} style={styles.dialogueEntry}>
                                    {/* Player action */}
                                    {entry.clueId && (
                                        <View style={styles.playerAction}>
                                            <Ionicons name="folder-open-outline" size={12} color={Colors.amber.bright} />
                                            <Text style={styles.playerActionText}>
                                                Presented: {entry.clueName}
                                            </Text>
                                        </View>
                                    )}
                                    {entry.question && (
                                        <View style={[styles.playerAction, styles.playerQuestion]}>
                                            <Ionicons name="chatbubble-outline" size={12} color={Colors.blue.bright} />
                                            <Text style={[styles.playerActionText, { color: Colors.blue.bright }]}>
                                                "{entry.question}"
                                            </Text>
                                        </View>
                                    )}

                                    {/* Suspect response */}
                                    <View style={[styles.suspectResponse, entry.alibiBroke && styles.suspectResponseCracked]}>
                                        <Text style={styles.suspectResponseText}>{entry.response}</Text>
                                    </View>

                                    {/* Alibi crack reveal */}
                                    {entry.alibiBroke && entry.revealText && (
                                        <View style={styles.revealBox}>
                                            <View style={styles.revealHeader}>
                                                <Ionicons name="flash" size={12} color={Colors.red.bright} />
                                                <Text style={styles.revealLabel}>ALIBI BROKEN</Text>
                                            </View>
                                            <Text style={styles.revealText}>{entry.revealText}</Text>
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                        {loading && (
                            <View style={styles.typingIndicator}>
                                <ActivityIndicator size="small" color={Colors.text.muted} />
                                <Text style={styles.typingText}>{selectedSuspect.name.split(' ')[0]} is responding…</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* ── Input area ── */}
                    <View style={styles.inputArea}>
                        {/* Evidence picker */}
                        {showEvidence && (
                            <View style={styles.evidencePicker}>
                                <Text style={styles.evidencePickerLabel}>PRESENT EVIDENCE</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.evidenceRow}>
                                        {examinedClues.length === 0 ? (
                                            <Text style={styles.noEvidenceText}>Examine clues at the scene first</Text>
                                        ) : (
                                            examinedClues.map(clue => (
                                                <TouchableOpacity
                                                    key={clue.clueId}
                                                    style={styles.evidenceChip}
                                                    onPress={() => interrogate(clue.clueId)}
                                                >
                                                    <Ionicons name="folder-open-outline" size={12} color={Colors.amber.bright} />
                                                    <Text style={styles.evidenceChipText} numberOfLines={1}>
                                                        {clue.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.inputRow}>
                            {/* Present evidence button */}
                            <TouchableOpacity
                                style={[styles.evidenceBtn, showEvidence && styles.evidenceBtnActive]}
                                onPress={() => setShowEvidence(v => !v)}
                            >
                                <Ionicons name="folder-open-outline" size={20} color={showEvidence ? Colors.bg.deep : Colors.amber.bright} />
                            </TouchableOpacity>

                            {/* Question input */}
                            <TextInput
                                style={styles.questionInput}
                                placeholder={`Ask ${selectedSuspect.name.split(' ')[0]} a question…`}
                                placeholderTextColor={Colors.text.muted}
                                value={question}
                                onChangeText={setQuestion}
                                multiline={false}
                                returnKeyType="send"
                                onSubmitEditing={() => question.trim() && interrogate()}
                            />

                            {/* Send */}
                            <TouchableOpacity
                                style={[styles.sendBtn, (!question.trim() || loading) && styles.sendBtnDisabled]}
                                onPress={() => interrogate()}
                                disabled={!question.trim() || loading}
                            >
                                <Ionicons name="send" size={18} color={Colors.bg.deep} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.void },
    backBtn:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 4 },
    backText:  { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.amber.bright },

    rosterSection: { paddingBottom: Spacing.md },
    rosterLabel:   { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: Colors.text.muted, letterSpacing: 2, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
    rosterRow:     { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
    suspectChip:   { alignItems: 'center', padding: Spacing.sm, borderRadius: Radii.md, backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border.subtle, minWidth: 64 },
    suspectChipSelected: { backgroundColor: Colors.amber.dim, borderColor: Colors.amber.bright },
    suspectIcon:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.raised, justifyContent: 'center', alignItems: 'center', marginBottom: 4, position: 'relative' },
    suspectIconSelected: { backgroundColor: Colors.amber.bright },
    crackBadge:    { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.red.bright, justifyContent: 'center', alignItems: 'center' },
    crackBadgeText:{ fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#fff' },
    suspectChipName:        { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.text.secondary },
    suspectChipNameSelected:{ color: Colors.amber.bright },
    interrogatedDot:{ width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.amber.mid, marginTop: 3 },

    noSuspect:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
    noSuspectText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.muted },

    portraitArea: { height: 220, position: 'relative', justifyContent: 'flex-end', alignItems: 'center' },
    portrait:     { position: 'absolute', top: 0, alignSelf: 'center', width: 140, height: 140, borderRadius: 70, backgroundColor: Colors.bg.raised, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border.regular },
    suspectInfo:  { alignItems: 'center', paddingBottom: 36 },
    suspectName:  { fontFamily: 'CourierPrime_700Bold', fontSize: 20, color: Colors.text.primary },
    suspectOccupation: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.secondary },
    suspectRelation:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted, fontStyle: 'italic' },

    alibiBar:    { position: 'absolute', bottom: 8, left: Spacing.xl, right: Spacing.xl },
    alibiLabel:  { fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: Colors.text.muted, letterSpacing: 1.5, marginBottom: 4 },
    alibiTrack:  { flexDirection: 'row', gap: 3 },
    alibiSegment:{ flex: 1, height: 4, borderRadius: 2 },
    alibiIntact: { backgroundColor: Colors.amber.bright },
    alibiCracked:{ backgroundColor: Colors.red.mid },
    alibiExhausted: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.red.bright, marginTop: 4, textAlign: 'center' },

    dialogueLog:     { flex: 1 },
    dialogueContent: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 20 },
    dialogueEmpty:   { alignItems: 'center', paddingTop: Spacing['2xl'] },
    dialogueEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text.muted, textAlign: 'center', lineHeight: 22 },

    dialogueEntry:   { gap: Spacing.sm },
    playerAction:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-end', backgroundColor: Colors.amber.dim, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radii.full },
    playerQuestion:  { backgroundColor: Colors.blue.dim },
    playerActionText:{ fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.amber.bright },

    suspectResponse:       { backgroundColor: Colors.bg.surface, borderRadius: Radii.md, padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: Colors.border.regular },
    suspectResponseCracked:{ borderLeftColor: Colors.red.bright, backgroundColor: Colors.red.dim },
    suspectResponseText:   { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.primary, lineHeight: 23, fontStyle: 'italic' },

    revealBox: { backgroundColor: Colors.red.dim, borderRadius: Radii.md, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.red.mid },
    revealHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
    revealLabel:  { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: Colors.red.bright, letterSpacing: 2 },
    revealText:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.primary, lineHeight: 20 },

    typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
    typingText:      { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.muted, fontStyle: 'italic' },

    inputArea: { borderTopWidth: 1, borderTopColor: Colors.border.subtle, backgroundColor: Colors.bg.surface },
    evidencePicker: { borderBottomWidth: 1, borderBottomColor: Colors.border.subtle, padding: Spacing.md },
    evidencePickerLabel: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: Colors.text.muted, letterSpacing: 1.5, marginBottom: Spacing.sm },
    evidenceRow: { flexDirection: 'row', gap: Spacing.sm },
    evidenceChip:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.amber.dim, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.amber.mid },
    evidenceChipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.amber.bright, maxWidth: 140 },
    noEvidenceText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.muted, fontStyle: 'italic' },

    inputRow:     { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
    evidenceBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.amber.dim, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.amber.mid },
    evidenceBtnActive: { backgroundColor: Colors.amber.bright },
    questionInput:{ flex: 1, height: 44, backgroundColor: Colors.bg.raised, borderRadius: 22, paddingHorizontal: Spacing.lg, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border.regular },
    sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.amber.bright, justifyContent: 'center', alignItems: 'center' },
    sendBtnDisabled: { opacity: 0.4 },
});
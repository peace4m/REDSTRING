/**
 * RedString — Clue Detail Modal
 * ================================
 * Shown when a player taps a hotspot in the crime scene.
 *
 * States:
 *  - 'found' (unexamined): shows label only + "Examine" button
 *  - 'examined': shows full description, may unlock children
 *  - 'destroyed' (weather): shows degradation message, no data gained
 *  - requiresLabWork: shows "Send to Lab" button → starts passive timer
 *
 * On examining, calls parent's onExamine, which hits the API,
 * updates game store, and may trigger twists.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii, Shadows } from '../../config/theme';

const TYPE_ICONS = {
    physical:   'cube-outline',
    digital:    'desktop-outline',
    witness:    'person-outline',
    document:   'document-text-outline',
    forensic:   'flask-outline',
    behavioral: 'eye-outline',
};

const TYPE_COLORS = {
    physical:   Colors.amber.bright,
    digital:    Colors.blue.bright,
    witness:    Colors.text.secondary,
    document:   Colors.amber.mid,
    forensic:   Colors.blue.bright,
    behavioral: Colors.red.bright,
};

export default function ClueDetailModal({ clue, clueState, onExamine, onSubmitLab, onShare, onClose }) {
    const [examining, setExamining] = useState(false);
    const [submittingLab, setSubmittingLab] = useState(false);

    const status = clueState?.status || 'found';
    const isExamined  = status === 'examined' || status === 'analyzed';
    const isDestroyed = status === 'destroyed';
    const typeColor = TYPE_COLORS[clue.type] || Colors.amber.bright;
    const typeIcon  = TYPE_ICONS[clue.type] || 'help-circle-outline';

    const handleExamine = async () => {
        setExamining(true);
        await onExamine(clue.clueId);
        setExamining(false);
    };

    const handleLabSubmit = async () => {
        setSubmittingLab(true);
        await onSubmitLab(clue.clueId);
        setSubmittingLab(false);
    };

    return (
        <View style={s.root}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

            <View style={s.sheet}>
                {/* Drag a handle */}
                <View style={s.handle} />

                {/* ── Header ── */}
                <View style={s.header}>
                    <View style={[s.typeIcon, { backgroundColor: typeColor + '22' }]}>
                        <Ionicons name={typeIcon} size={20} color={typeColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.typeLabel}>{clue.type?.toUpperCase()} EVIDENCE</Text>
                        <Text style={s.title}>{clue.label}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                        <Ionicons name="close" size={20} color={Colors.text.muted} />
                    </TouchableOpacity>
                </View>

                {/* ── Body ── */}
                {isDestroyed ? (
                    <DestroyedState reason={clueState?.degradedReason} />
                ) : !isExamined ? (
                    <UnexaminedState
                        location={clue.location}
                        onExamine={handleExamine}
                        examining={examining}
                    />
                ) : (
                    <ExaminedState
                        clue={clue}
                        requiresLab={clue.requiresLabWork && status !== 'analyzed'}
                        onSubmitLab={handleLabSubmit}
                        submittingLab={submittingLab}
                        onShare={() => onShare?.(clue.clueId)}
                    />
                )}
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────
//  STATES
// ─────────────────────────────────────────────

function UnexaminedState({ location, onExamine, examining }) {
    return (
        <View style={s.body}>
            <Text style={s.locationText}>📍 {formatLocation(location)}</Text>
            <Text style={s.unexaminedText}>
                You've spotted something here. Examine it closely to learn more.
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={onExamine} disabled={examining}>
                {examining
                    ? <ActivityIndicator color={Colors.bg.deep} />
                    : (
                        <>
                            <Ionicons name="search" size={16} color={Colors.bg.deep} />
                            <Text style={s.primaryBtnText}>EXAMINE</Text>
                        </>
                    )}
            </TouchableOpacity>
        </View>
    );
}

function ExaminedState({ clue, requiresLab, onSubmitLab, submittingLab, onShare }) {
    return (
        <View style={s.body}>
            <ScrollView style={s.descScroll} showsVerticalScrollIndicator={false}>
                <Text style={s.descText}>{clue.description}</Text>

                {clue.labResultText && (
                    <View style={s.labResultBox}>
                        <View style={s.labResultHeader}>
                            <Ionicons name="document-text" size={14} color={Colors.blue.bright} />
                            <Text style={s.labResultLabel}>LAB ANALYSIS</Text>
                        </View>
                        <Text style={s.labResultText}>{clue.labResultText}</Text>
                    </View>
                )}
            </ScrollView>

            <View style={s.actionRow}>
                {requiresLab && (
                    <TouchableOpacity style={s.labBtn} onPress={onSubmitLab} disabled={submittingLab}>
                        {submittingLab
                            ? <ActivityIndicator color={Colors.blue.bright} size="small" />
                            : (
                                <>
                                    <Ionicons name="flask-outline" size={16} color={Colors.blue.bright} />
                                    <Text style={s.labBtnText}>SEND TO LAB</Text>
                                </>
                            )}
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={s.shareBtn} onPress={onShare}>
                    <Ionicons name="share-social-outline" size={16} color={Colors.amber.bright} />
                    <Text style={s.shareBtnText}>SHARE WITH TEAM</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function DestroyedState({ reason }) {
    const messages = {
        washed_away_by_rain: {
            icon: 'rainy-outline',
            title: 'Evidence Lost',
            text: 'The rain washed this away before you could secure it. You should have prioritized outdoor evidence before the storm hit.',
        },
        too_dark: {
            icon: 'moon-outline',
            title: 'Too Dark to Examine',
            text: 'You can\'t make out any detail in this darkness. Return during daylight, or find a light source.',
        },
    };
    const msg = messages[reason] || {
        icon: 'alert-circle-outline',
        title: 'Evidence Compromised',
        text: 'This evidence has been compromised and can no longer be analyzed.',
    };

    return (
        <View style={s.body}>
            <View style={s.destroyedIcon}>
                <Ionicons name={msg.icon} size={40} color={Colors.red.bright} />
            </View>
            <Text style={s.destroyedTitle}>{msg.title}</Text>
            <Text style={s.unexaminedText}>{msg.text}</Text>
        </View>
    );
}

function formatLocation(loc) {
    return loc?.replace('scene_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const s = StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 500 },
    sheet: {
        backgroundColor: Colors.bg.surface, borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl,
        borderWidth: 1, borderColor: Colors.border.regular, borderBottomWidth: 0,
        padding: Spacing.lg, paddingBottom: Spacing['2xl'], maxHeight: '70%',
        ...Shadows.card,
    },
    handle: {
        width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border.strong,
        alignSelf: 'center', marginBottom: Spacing.md,
    },

    header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
    typeIcon: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    typeLabel: { fontFamily: Typography.mono.family, fontSize: 9, color: Colors.text.muted, letterSpacing: 2, marginBottom: 2 },
    title: { fontFamily: Typography.display.family, ...Typography.display.sizes.md, color: Colors.text.primary },
    closeBtn: { padding: 4 },

    body: { gap: Spacing.md },
    locationText: { fontFamily: Typography.mono.family, fontSize: 12, color: Colors.text.muted },
    unexaminedText: { fontFamily: Typography.body.family, ...Typography.body.sizes.md, color: Colors.text.secondary, lineHeight: 22 },

    descScroll: { maxHeight: 220 },
    descText: { fontFamily: Typography.body.family, ...Typography.body.sizes.md, color: Colors.text.primary, lineHeight: 24 },

    labResultBox: {
        backgroundColor: Colors.blue.dim, borderRadius: Radii.md, padding: Spacing.md, marginTop: Spacing.md,
    },
    labResultHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
    labResultLabel: { fontFamily: Typography.mono.familyMedium, fontSize: 10, color: Colors.blue.bright, letterSpacing: 1.5 },
    labResultText: { fontFamily: Typography.mono.family, fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },

    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Colors.amber.bright, borderRadius: Radii.full, paddingVertical: Spacing.md,
        ...Shadows.amber,
    },
    primaryBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.bg.deep, letterSpacing: 1.5 },

    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    labBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderWidth: 1, borderColor: Colors.blue.bright, borderRadius: Radii.full, paddingVertical: Spacing.sm,
    },
    labBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 11, color: Colors.blue.bright, letterSpacing: 1 },
    shareBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderWidth: 1, borderColor: Colors.amber.mid, borderRadius: Radii.full, paddingVertical: Spacing.sm,
    },
    shareBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 11, color: Colors.amber.bright, letterSpacing: 1 },

    destroyedIcon: { alignItems: 'center', marginBottom: Spacing.sm },
    destroyedTitle: { fontFamily: Typography.display.family, ...Typography.display.sizes.md, color: Colors.red.bright, textAlign: 'center' },
});
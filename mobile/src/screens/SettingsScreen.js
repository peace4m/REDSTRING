/**
 * Redstring — Settings Screen
 * ==============================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii } from '../config/theme';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';

const SCARE_LEVELS = [
    { key: 'off',  label: 'Off',  desc: 'No jump scares or sudden audio' },
    { key: 'mild', label: 'Mild', desc: 'Subtle atmospheric tension only' },
    { key: 'full', label: 'Full', desc: 'Full intensity — designed to startle' },
];

export default function SettingsScreen({ navigation }) {
    const { user, updateUser, logout } = useAuthStore();
    const [settings, setSettings] = useState(user?.settings || {
        jumpScareIntensity: 'mild',
        voiceChatEnabled: true,
        notificationsEnabled: true,
        darkMode: true,
    });

    const save = async (newSettings) => {
        setSettings(newSettings);
        try {
            const { user: updated } = await apiClient.patch('/users/me', { settings: newSettings });
            updateUser({ settings: updated.settings });
        } catch (e) { console.error(e); }
    };

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
        ]);
    };

    return (
        <SafeAreaView style={s.root} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Settings</Text>
                <View style={{ width: 30 }} />
            </View>

            <ScrollView contentContainerStyle={s.content}>

                {/* ── Jump Scare Intensity ── */}
                <View style={s.section}>
                    <Text style={s.sectionLabel}>JUMP SCARE INTENSITY</Text>
                    {SCARE_LEVELS.map(level => (
                        <TouchableOpacity
                            key={level.key}
                            style={[s.optionRow, settings.jumpScareIntensity === level.key && s.optionRowActive]}
                            onPress={() => save({ ...settings, jumpScareIntensity: level.key })}
                        >
                            <View style={s.radioOuter}>
                                {settings.jumpScareIntensity === level.key && <View style={s.radioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.optionLabel}>{level.label}</Text>
                                <Text style={s.optionDesc}>{level.desc}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Toggles ── */}
                <View style={s.section}>
                    <Text style={s.sectionLabel}>PREFERENCES</Text>

                    <View style={s.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.optionLabel}>Voice Chat</Text>
                            <Text style={s.optionDesc}>Enable proximity voice chat in War Rooms</Text>
                        </View>
                        <Switch
                            value={settings.voiceChatEnabled}
                            onValueChange={(v) => save({ ...settings, voiceChatEnabled: v })}
                            trackColor={{ false: Colors.bg.raised, true: Colors.amber.dim }}
                            thumbColor={settings.voiceChatEnabled ? Colors.amber.bright : Colors.text.muted}
                        />
                    </View>

                    <View style={s.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.optionLabel}>Push Notifications</Text>
                            <Text style={s.optionDesc}>Lab results, twists, and friend invites</Text>
                        </View>
                        <Switch
                            value={settings.notificationsEnabled}
                            onValueChange={(v) => save({ ...settings, notificationsEnabled: v })}
                            trackColor={{ false: Colors.bg.raised, true: Colors.amber.dim }}
                            thumbColor={settings.notificationsEnabled ? Colors.amber.bright : Colors.text.muted}
                        />
                    </View>
                </View>

                {/* ── Account ── */}
                <View style={s.section}>
                    <Text style={s.sectionLabel}>ACCOUNT</Text>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Email</Text>
                        <Text style={s.infoValue}>{user?.email}</Text>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Content Rating</Text>
                        <Text style={s.infoValue}>{user?.contentRating}</Text>
                    </View>
                </View>

                <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={18} color={Colors.red.bright} />
                    <Text style={s.logoutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontFamily: Typography.display.family, ...Typography.display.sizes.md, color: Colors.text.primary },

    content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['5xl'] },

    section: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border.subtle, gap: Spacing.sm,
    },
    sectionLabel: { fontFamily: Typography.mono.family, fontSize: 10, color: Colors.amber.mid, letterSpacing: 2, marginBottom: Spacing.xs },

    optionRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.sm, borderRadius: Radii.md,
    },
    optionRowActive: {},
    radioOuter: {
        width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.amber.mid,
        alignItems: 'center', justifyContent: 'center',
    },
    radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: Colors.amber.bright },
    optionLabel: { fontFamily: Typography.body.familySemibold, fontSize: 14, color: Colors.text.primary },
    optionDesc: { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.muted, marginTop: 2 },

    toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },

    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
    infoLabel: { fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.muted },
    infoValue: { fontFamily: Typography.mono.family, fontSize: 12, color: Colors.text.primary },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        borderWidth: 1, borderColor: Colors.red.dim, borderRadius: Radii.full, paddingVertical: Spacing.md,
    },
    logoutText: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.red.bright, letterSpacing: 1 },
});
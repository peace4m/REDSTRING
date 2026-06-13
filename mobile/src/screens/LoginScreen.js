/**
 * Redstring — Login Screen
 * ===========================
 */

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radii, Shadows } from '../config/theme';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen({ navigation }) {
    const { login, isLoading, error, clearError } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);

    const handleLogin = async () => {
        clearError();
        try { await login(email, password); }
        catch {}
    };

    return (
        <KeyboardAvoidingView
            style={s.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
                <View style={s.header}>
                    <View style={s.badge}><Text style={s.badgeText}>CASE FILE</Text></View>
                    <Text style={s.title}>Welcome back, Detective</Text>
                    <Text style={s.subtitle}>Sign in to continue your investigations</Text>
                </View>

                {error && (
                    <View style={s.errorBox}>
                        <Ionicons name="alert-circle" size={16} color={Colors.red.bright} />
                        <Text style={s.errorText}>{error}</Text>
                    </View>
                )}

                <View style={s.field}>
                    <Text style={s.label}>EMAIL</Text>
                    <TextInput
                        style={s.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="detective@example.com"
                        placeholderTextColor={Colors.text.muted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <View style={s.field}>
                    <Text style={s.label}>PASSWORD</Text>
                    <View style={s.pwRow}>
                        <TextInput
                            style={[s.input, { flex: 1 }]}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor={Colors.text.muted}
                            secureTextEntry={!showPw}
                        />
                        <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
                            <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={Colors.text.muted} />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={[s.submitBtn, (!email || !password) && s.submitBtnDisabled]}
                    onPress={handleLogin}
                    disabled={!email || !password || isLoading}
                >
                    {isLoading
                        ? <ActivityIndicator color={Colors.bg.deep} />
                        : <Text style={s.submitBtnText}>OPEN CASE FILES</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.registerLink}>
                    <Text style={s.registerLinkText}>
                        New investigator? <Text style={s.registerLinkAccent}>Create an account</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },
    content: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.lg },

    header: { alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.xs },
    badge: {
        borderWidth: 2, borderColor: Colors.amber.bright, borderRadius: 4,
        paddingHorizontal: Spacing.sm, paddingVertical: 3, marginBottom: Spacing.md,
        transform: [{ rotate: '-3deg' }],
    },
    badgeText: { fontFamily: Typography.mono.familyMedium, fontSize: 10, color: Colors.amber.bright, letterSpacing: 2 },
    title: { fontFamily: Typography.display.family, ...Typography.display.sizes.lg, color: Colors.text.primary, textAlign: 'center' },
    subtitle: { fontFamily: Typography.body.family, ...Typography.body.sizes.sm, color: Colors.text.muted, textAlign: 'center' },

    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.red.dim, borderRadius: Radii.md, padding: Spacing.md,
    },
    errorText: { flex: 1, fontFamily: Typography.body.family, fontSize: 12, color: Colors.red.bright },

    field: { gap: Spacing.xs },
    label: { fontFamily: Typography.mono.family, fontSize: 10, color: Colors.text.muted, letterSpacing: 2 },
    input: {
        backgroundColor: Colors.bg.surface, borderRadius: Radii.md,
        borderWidth: 1, borderColor: Colors.border.regular,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
        fontFamily: Typography.body.family, fontSize: 15, color: Colors.text.primary,
    },
    pwRow: { flexDirection: 'row', alignItems: 'center' },
    eyeBtn: { position: 'absolute', right: Spacing.md },

    submitBtn: {
        backgroundColor: Colors.amber.bright, borderRadius: Radii.full,
        paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
        ...Shadows.amber,
    },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.bg.deep, letterSpacing: 1.5 },

    registerLink: { alignItems: 'center', marginTop: Spacing.md },
    registerLinkText: { fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.muted },
    registerLinkAccent: { color: Colors.amber.bright, fontFamily: Typography.body.familySemibold },
});
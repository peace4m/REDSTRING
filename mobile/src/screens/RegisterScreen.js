/**
 * Redstring — Register Screen
 * ==============================
 * Collects email, password, display name, and date of birth.
 * Date of birth determines content rating (PG13 vs R) automatically.
 */

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, Radii, Shadows } from '../config/theme';
import { useAuthStore } from '../store/authStore';

export default function RegisterScreen({ navigation }) {
    const { register, isLoading, error, clearError } = useAuthStore();

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail]             = useState('');
    const [password, setPassword]       = useState('');
    const [showPw, setShowPw]           = useState(false);
    const [dob, setDob]                 = useState(null);
    const [showPicker, setShowPicker]   = useState(false);

    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const willBeAdultRated = age !== null && age >= 18;

    const handleRegister = async () => {
        clearError();
        try {
            await register({
                displayName,
                email,
                password,
                dateOfBirth: dob ? dob.toISOString() : undefined,
            });
        } catch {}
    };

    const isValid = displayName.length >= 2 && email.includes('@') && password.length >= 8 && dob;

    return (
        <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
                <View style={s.header}>
                    <View style={s.badge}><Text style={s.badgeText}>NEW RECRUIT</Text></View>
                    <Text style={s.title}>Join the Bureau</Text>
                    <Text style={s.subtitle}>Create your detective profile</Text>
                </View>

                {error && (
                    <View style={s.errorBox}>
                        <Ionicons name="alert-circle" size={16} color={Colors.red.bright} />
                        <Text style={s.errorText}>{error}</Text>
                    </View>
                )}

                <View style={s.field}>
                    <Text style={s.label}>DISPLAY NAME</Text>
                    <TextInput
                        style={s.input} value={displayName} onChangeText={setDisplayName}
                        placeholder="Detective Jane Doe" placeholderTextColor={Colors.text.muted}
                    />
                </View>

                <View style={s.field}>
                    <Text style={s.label}>EMAIL</Text>
                    <TextInput
                        style={s.input} value={email} onChangeText={setEmail}
                        placeholder="detective@example.com" placeholderTextColor={Colors.text.muted}
                        autoCapitalize="none" keyboardType="email-address"
                    />
                </View>

                <View style={s.field}>
                    <Text style={s.label}>PASSWORD</Text>
                    <View style={s.pwRow}>
                        <TextInput
                            style={[s.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                            placeholder="At least 8 characters" placeholderTextColor={Colors.text.muted}
                            secureTextEntry={!showPw}
                        />
                        <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
                            <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={Colors.text.muted} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={s.field}>
                    <Text style={s.label}>DATE OF BIRTH</Text>
                    <TouchableOpacity style={s.input} onPress={() => setShowPicker(true)}>
                        <Text style={{ color: dob ? Colors.text.primary : Colors.text.muted, fontFamily: Typography.body.family }}>
                            {dob ? dob.toLocaleDateString() : 'Select your date of birth'}
                        </Text>
                    </TouchableOpacity>
                    {showPicker && (
                        <DateTimePicker
                            value={dob || new Date(2000, 0, 1)}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            maximumDate={new Date()}
                            onChange={(_, date) => { setShowPicker(Platform.OS === 'ios'); if (date) setDob(date); }}
                        />
                    )}
                </View>

                {/* Content rating preview */}
                {dob && (
                    <View style={[s.ratingPreview, willBeAdultRated ? s.ratingR : s.ratingPG]}>
                        <Ionicons
                            name={willBeAdultRated ? 'skull-outline' : 'happy-outline'}
                            size={18}
                            color={willBeAdultRated ? Colors.red.bright : Colors.blue.bright}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.ratingTitle, { color: willBeAdultRated ? Colors.red.bright : Colors.blue.bright }]}>
                                {willBeAdultRated ? 'Adult Content (R) Unlocked' : 'PG-13 Content Only'}
                            </Text>
                            <Text style={s.ratingDesc}>
                                {willBeAdultRated
                                    ? 'You\'ll have access to intense cases with graphic content, jump scares, and mature themes.'
                                    : 'You\'ll see lighter mystery cases without graphic content. This can change later if eligible.'}
                            </Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={[s.submitBtn, !isValid && s.submitBtnDisabled]}
                    onPress={handleRegister}
                    disabled={!isValid || isLoading}
                >
                    {isLoading
                        ? <ActivityIndicator color={Colors.bg.deep} />
                        : <Text style={s.submitBtnText}>CREATE ACCOUNT</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
                    <Text style={s.loginLinkText}>
                        Already have an account? <Text style={s.loginLinkAccent}>Sign in</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.deep },
    content: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing['3xl'] },

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
        justifyContent: 'center',
    },
    pwRow: { flexDirection: 'row', alignItems: 'center' },
    eyeBtn: { position: 'absolute', right: Spacing.md },

    ratingPreview: {
        flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md,
        borderRadius: Radii.md, alignItems: 'flex-start',
    },
    ratingPG: { backgroundColor: Colors.blue.dim },
    ratingR:  { backgroundColor: Colors.red.dim },
    ratingTitle: { fontFamily: Typography.body.familySemibold, fontSize: 13, marginBottom: 2 },
    ratingDesc:  { fontFamily: Typography.body.family, fontSize: 11, color: Colors.text.secondary, lineHeight: 16 },

    submitBtn: {
        backgroundColor: Colors.amber.bright, borderRadius: Radii.full,
        paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
        ...Shadows.amber,
    },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: { fontFamily: Typography.body.familySemibold, fontSize: 13, color: Colors.bg.deep, letterSpacing: 1.5 },

    loginLink: { alignItems: 'center', marginTop: Spacing.md },
    loginLinkText: { fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.muted },
    loginLinkAccent: { color: Colors.amber.bright, fontFamily: Typography.body.familySemibold },
});
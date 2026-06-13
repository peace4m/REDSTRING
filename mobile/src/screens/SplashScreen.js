/**
 * Redstring — Splash Screen
 * ============================
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing } from '../config/theme';

export default function SplashScreen({ navigation }) {
    const fade = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        const timer = setTimeout(() => navigation.replace('Login'), 1600);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={s.root}>
            <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
                <View style={s.badge}>
                    <Text style={s.badgeText}>CASE FILE</Text>
                </View>
                <Text style={s.title}>CrimeSolve</Text>
                <Text style={s.subtitle}>Every detail matters.</Text>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.void, alignItems: 'center', justifyContent: 'center' },
    badge: {
        borderWidth: 2, borderColor: Colors.amber.bright, borderRadius: 4,
        paddingHorizontal: Spacing.md, paddingVertical: 4, marginBottom: Spacing.lg,
        transform: [{ rotate: '-4deg' }],
    },
    badgeText: { fontFamily: Typography.mono.familyMedium, fontSize: 11, color: Colors.amber.bright, letterSpacing: 3 },
    title: { fontFamily: Typography.display.family, fontSize: 40, color: Colors.text.primary, letterSpacing: -1 },
    subtitle: { fontFamily: Typography.body.family, fontSize: 14, color: Colors.text.muted, marginTop: Spacing.sm, fontStyle: 'italic' },
});
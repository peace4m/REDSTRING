/**
 * RedString — Scene3D Platform Wrapper
 * =======================================
 * @react-three/fiber's <Canvas> works differently per platform:
 *
 *  - Web:    renders to a standard HTML <canvas> — works out of the box.
 *  - Native: react-three-fiber's native renderer (since v8) handles
 *            expo-gl internally when running inside Expo — no extra
 *            wiring needed beyond having `expo-gl` and `three` installed.
 *
 * This wrapper exists, so screens import ONE component regardless of
 * platform, and so we can show a lightweight 2D fallback if the 3D
 * renderer fails to initialize (older devices, GL context errors).
 */

import React, { useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import CrimeScene3D from './CrimeScene3D';
import { Colors, Typography, Spacing } from '../../config/theme';

export default function Scene3DContainer(props) {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return <Scene3DFallback />;
    }

    return (
        <View style={StyleSheet.absoluteFill}>
            <ErrorBoundary onError={() => setHasError(true)}>
                <CrimeScene3D {...props} />
            </ErrorBoundary>
        </View>
    );
}

// ─────────────────────────────────────────────
//  ERROR BOUNDARY
// ─────────────────────────────────────────────
// Class component required — error boundaries don't work as hooks.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error('[Scene3D] render error:', error.message);
        this.props.onError?.();
    }
    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}

// ─────────────────────────────────────────────
//  FALLBACK — shown if 3D fails to init
// ─────────────────────────────────────────────
function Scene3DFallback() {
    return (
        <View style={s.fallback}>
            <Text style={s.fallbackIcon}>🔦</Text>
            <Text style={s.fallbackTitle}>3D view unavailable</Text>
            <Text style={s.fallbackText}>
                Switch to the 2D scene view using the toggle below to continue investigating.
            </Text>
        </View>
    );
}

const s = StyleSheet.create({
    fallback: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.bg.deep,
        alignItems: 'center', justifyContent: 'center',
        padding: Spacing.xl, gap: Spacing.sm,
    },
    fallbackIcon: { fontSize: 32, marginBottom: Spacing.sm },
    fallbackTitle: {
        fontFamily: Typography.display.family, ...Typography.display.sizes.md,
        color: Colors.text.primary,
    },
    fallbackText: {
        fontFamily: Typography.body.family, ...Typography.body.sizes.sm,
        color: Colors.text.muted, textAlign: 'center', maxWidth: 280,
    },
});
/**
 * RedString — 3D Crime Scene Renderer
 * ======================================
 * First-person 3D room exploration using react-three-fiber + drei.
 *
 * Works on:
 *  - Web: full @react-three/fiber + @react-three/drei (mouse drag to look, scroll to zoom)
 *  - Mobile: expo-gl + expo-three via the same component (touch drag to look)
 *
 * Design approach (per frontend-design skill):
 *  Rather than photorealistic 3D assets (out of scope for code generation),
 *  this renders a stylised "evidence diorama" — a low-poly room built from
 *  primitives, lit dramatically, with glowing amber markers floating above
 *  each piece of evidence. This matches the noir/forensic aesthetic and is
 *  fully proceduralised from the case's scene + clue data, so NO external
 *  3D model files are required to ship a working build.
 *
 * Signature element: "Evidence Beacons" — vertical light columns rising
 * from each clue's floor position, color-coded by clue type, pulsing
 * gently. Tapping a beacon opens the ClueDetailModal (handled by parent).
 *
 * Replacing with real assets:
 *  Each scene's `environmentKey` (e.g. "env_dressing_room_01") maps to
 *  a .glb file path in ENVIRONMENT_MODELS below. If a real model exists,
 *  it's loaded via useGLTF and the procedural room is skipped. This lets
 *  you incrementally add real art without changing any game logic.
 */

import React, { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
    OrbitControls, Environment, ContactShadows, Float,
    Html, useGLTF, Sky,
} from '@react-three/drei';
import * as THREE from 'three';
import { Colors } from '../../config/theme';

// ─────────────────────────────────────────────
//  ENVIRONMENT MODEL REGISTRY
// ─────────────────────────────────────────────
// Map environmentKey → .glb path. Add entries as real art is produced.
// If a key is absent, the procedural room (below) is used instead.
const ENVIRONMENT_MODELS = {
    // env_dressing_room_01: '/assets/models/dressing_room.glb',
};

// Clue type → beacon colour (matches theme.Colors)
const TYPE_BEACON_COLOR = {
    physical:   '#F5C842', // amber
    digital:    '#4A9EFF', // blue
    witness:    '#8A8E9B', // grey
    document:   '#C49A20', // dim amber
    forensic:   '#4A9EFF', // blue
    behavioral: '#E53535', // red
};

const STATUS_OPACITY = {
    hidden:    0,
    found:     1,
    examined:  0.45,
    analyzed:  0.45,
    destroyed: 0.15,
};

// ─────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────

/**
 * @param {object} props
 * @param {object} props.scene        - scene object from case file (sceneId, environmentKey, atmosphere)
 * @param {Array}  props.hotspots      - [{clueId, x, y, label, icon}] — x,y are 0-1 floor-plan coords
 * @param {Array}  props.clueStates    - session.clueStates [{clueId, status}]
 * @param {object} props.weather       - { condition, activeEffects }
 * @param {function} props.onHotspotPress - (clueId) => void
 * @param {Array}  props.teammates     - [{userId, displayName, pinColor, x, y}] for multiplayer position dots
 */
export default function CrimeScene3D({
                                         scene, hotspots = [], clueStates = [], weather = {}, onHotspotPress, teammates = [],
                                     }) {
    const condition = weather?.condition || 'clear';
    const hauntingLevel = scene?.atmosphere?.hauntingLevel || 0;

    // Ambient lighting derived from weather + time-of-day
    const { ambientIntensity, fogColor, fogDensity, keyLightColor } = useMemo(
        () => getLightingForCondition(condition, hauntingLevel),
        [condition, hauntingLevel]
    );

    const modelPath = ENVIRONMENT_MODELS[scene?.environmentKey];

    return (
        <Canvas
            camera={{ position: [0, 1.6, 4.5], fov: 55 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            style={{ background: 'transparent' }}
        >
            {/* ── Atmosphere ── */}
            <fog attach="fog" args={[fogColor, 3, fogDensity]} />
            <ambientLight intensity={ambientIntensity} color={keyLightColor} />
            <directionalLight
                position={[3, 5, 2]}
                intensity={hauntingLevel >= 3 ? 0.3 : 0.7}
                color={keyLightColor}
                castShadow
            />
            {/* Flickering accent light for high-haunting scenes */}
            {hauntingLevel >= 2 && <FlickerLight hauntingLevel={hauntingLevel} />}

            <Suspense fallback={<LoadingFallback />}>
                {modelPath ? (
                    <RealEnvironment path={modelPath} />
                ) : (
                    <ProceduralRoom hauntingLevel={hauntingLevel} condition={condition} />
                )}

                {/* ── Evidence Beacons ── */}
                {hotspots.map(hotspot => {
                    const clueState = clueStates.find(c => c.clueId === hotspot.clueId);
                    const status = clueState?.status || 'hidden';
                    if (status === 'hidden') return null;

                    return (
                        <EvidenceBeacon
                            key={hotspot.clueId}
                            hotspot={hotspot}
                            status={status}
                            onPress={() => onHotspotPress?.(hotspot.clueId)}
                        />
                    );
                })}

                {/* ── Teammate position dots ── */}
                {teammates.map(t => (
                    <TeammateMarker key={t.userId} teammate={t} />
                ))}

                <ContactShadows position={[0, -0.001, 0]} opacity={0.5} scale={12} blur={2} far={4} />
            </Suspense>

            {/* ── Camera controls ── */}
            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={2}
                maxDistance={8}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI / 1.8}
                target={[0, 1, 0]}
            />
        </Canvas>
    );
}

// ─────────────────────────────────────────────
//  LIGHTING PRESETS
// ─────────────────────────────────────────────
function getLightingForCondition(condition, hauntingLevel) {
    const presets = {
        clear: { ambientIntensity: 0.6, fogColor: '#1a1c24', fogDensity: 14, keyLightColor: '#fff4e0' },
        night: { ambientIntensity: 0.15, fogColor: '#04060f', fogDensity: 8, keyLightColor: '#4a5a8a' },
        dusk:  { ambientIntensity: 0.35, fogColor: '#2a1f2e', fogDensity: 10, keyLightColor: '#cc8855' },
        dawn:  { ambientIntensity: 0.4, fogColor: '#26282f', fogDensity: 11, keyLightColor: '#a0b0cc' },
        sudden_rain: { ambientIntensity: 0.25, fogColor: '#0a0e18', fogDensity: 7, keyLightColor: '#5a6a8a' },
        storm: { ambientIntensity: 0.15, fogColor: '#06070d', fogDensity: 6, keyLightColor: '#4a4a6a' },
        dense_fog: { ambientIntensity: 0.45, fogColor: '#cfd6e0', fogDensity: 5, keyLightColor: '#d8dce4' },
    };
    const base = presets[condition] || presets.clear;

    // High haunting levels darken everything further
    if (hauntingLevel >= 4) {
        return { ...base, ambientIntensity: base.ambientIntensity * 0.5, fogDensity: base.fogDensity * 0.7 };
    }
    return base;
}

// ─────────────────────────────────────────────
//  PROCEDURAL ROOM
// ─────────────────────────────────────────────
/**
 * A stylised low-poly room: floor, back wall, two side walls, ceiling hints.
 * Built entirely from primitives — no external assets needed.
 * Color palette is desaturated noir with the cork/amber accent reserved
 * for evidence beacons only.
 */
function ProceduralRoom({ hauntingLevel, condition }) {
    const wallColor  = '#1c1e26';
    const floorColor = '#15161c';
    const trimColor  = '#2a2d38';

    return (
        <group>
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[10, 10]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} metalness={0.05} />
            </mesh>

            {/* Floor grid lines (subtle, forensic-diagram feel) */}
            <gridHelper args={[10, 10, '#2a2d38', '#1f2128']} position={[0, 0.001, 0]} />

            {/* Back wall */}
            <mesh position={[0, 2, -3]}>
                <boxGeometry args={[10, 4, 0.15]} />
                <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>

            {/* Left wall */}
            <mesh position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[6, 4, 0.15]} />
                <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>

            {/* Right wall */}
            <mesh position={[5, 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <boxGeometry args={[6, 4, 0.15]} />
                <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>

            {/* Ceiling trim strip (suggests room bounds without enclosing fully) */}
            <mesh position={[0, 3.95, 0]}>
                <boxGeometry args={[10, 0.1, 6]} />
                <meshStandardMaterial color={trimColor} roughness={0.7} />
            </mesh>

            {/* Furniture silhouettes — generic blocks suggesting furniture,
          positioned to feel like a room without being a specific scene */}
            <FurnitureBlock position={[-2.5, 0.4, -2]} size={[1.4, 0.8, 0.6]} />   {/* dresser/table */}
            <FurnitureBlock position={[2.8, 0.6, -1.5]} size={[0.8, 1.2, 0.8]} />  {/* cabinet */}
            <FurnitureBlock position={[0, 0.25, 1.5]} size={[2, 0.5, 1]} />        {/* central table */}

            {/* Decorative ambient particles for haunted scenes */}
            {hauntingLevel >= 3 && <DustParticles />}
        </group>
    );
}

function FurnitureBlock({ position, size }) {
    return (
        <mesh position={position} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#23252e" roughness={0.8} />
        </mesh>
    );
}

// Floating dust/ash particles for atmosphere
function DustParticles() {
    const count = 60;
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3]     = (Math.random() - 0.5) * 8;
            arr[i * 3 + 1] = Math.random() * 3.5;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 5;
        }
        return arr;
    }, []);

    const ref = useRef();
    useFrame((_, delta) => {
        if (!ref.current) return;
        ref.current.rotation.y += delta * 0.02;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial color="#8A8E9B" size={0.015} transparent opacity={0.4} />
        </points>
    );
}

// ─────────────────────────────────────────────
//  REAL ENVIRONMENT (when .glb assets exist)
// ─────────────────────────────────────────────
function RealEnvironment({ path }) {
    const { scene } = useGLTF(path);
    return <primitive object={scene} />;
}

// ─────────────────────────────────────────────
//  EVIDENCE BEACON
// ─────────────────────────────────────────────
/**
 * A glowing vertical light column marking a clue's location on the floor.
 * Color reflects a clue type. Opacity reflects examination status.
 * Gentle float animation. Tap/click opens the clue detail modal.
 */
function EvidenceBeacon({ hotspot, status, onPress }) {
    const color = TYPE_BEACON_COLOR[hotspot.type] || '#F5C842';
    const opacity = STATUS_OPACITY[status] ?? 1;
    const isExamined = status === 'examined' || status === 'analyzed';

    // Convert 0-1 floor coords to world space (-4..4 on x, -2.5..2.5 on z)
    const worldX = (hotspot.x - 0.5) * 8;
    const worldZ = (hotspot.y - 0.5) * 5;

    const beaconRef = useRef();
    useFrame(({ clock }) => {
        if (!beaconRef.current) return;
        const pulse = 0.85 + Math.sin(clock.elapsedTime * 2 + worldX) * 0.15;
        beaconRef.current.scale.set(pulse, 1, pulse);
    });

    return (
        <group position={[worldX, 0, worldZ]}>
            {/* Light column */}
            <mesh
                ref={beaconRef}
                position={[0, 1, 0]}
                onClick={onPress}
                onPointerOver={(e) => { e.stopPropagation(); document.body && (document.body.style.cursor = 'pointer'); }}
                onPointerOut={() => { document.body && (document.body.style.cursor = 'auto'); }}
            >
                <cylinderGeometry args={[0.06, 0.02, 2, 8]} />
                <meshBasicMaterial color={color} transparent opacity={opacity * 0.7} />
            </mesh>

            {/* Floor glow disc */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <circleGeometry args={[0.4, 24]} />
                <meshBasicMaterial color={color} transparent opacity={opacity * 0.25} />
            </mesh>

            {/* Point light for actual scene illumination */}
            <pointLight color={color} intensity={opacity * 0.8} distance={2.5} position={[0, 0.8, 0]} />

            {/* Floating label */}
            <Float speed={2} rotationIntensity={0} floatIntensity={0.3}>
                <Html position={[0, 2.2, 0]} center distanceFactor={8} occlude>
                    <div
                        onClick={onPress}
                        style={{
                            ...beaconLabelStyle,
                            borderColor: color,
                            opacity,
                            textDecoration: isExamined ? 'line-through' : 'none',
                        }}
                    >
                        {hotspot.label}
                    </div>
                </Html>
            </Float>
        </group>
    );
}

const beaconLabelStyle = {
    background: 'rgba(15,16,20,0.85)',
    border: '1px solid',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#E8E9ED',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    pointerEvents: 'auto',
};

// ─────────────────────────────────────────────
//  TEAMMATE MARKER
// ─────────────────────────────────────────────
function TeammateMarker({ teammate }) {
    const worldX = ((teammate.x ?? 50) / 100 - 0.5) * 8;
    const worldZ = ((teammate.y ?? 50) / 100 - 0.5) * 5;
    const color = teammate.colorHex || '#F5C842';

    return (
        <group position={[worldX, 0.05, worldZ]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.18, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.6} />
            </mesh>
            <Html position={[0, 0.5, 0]} center distanceFactor={10}>
                <div style={teammateLabelStyle}>{teammate.displayName}</div>
            </Html>
        </group>
    );
}

const teammateLabelStyle = {
    background: 'rgba(15,16,20,0.7)',
    borderRadius: '999px',
    padding: '2px 8px',
    fontSize: '9px',
    fontFamily: 'monospace',
    color: '#E8E9ED',
    whiteSpace: 'nowrap',
};

// ─────────────────────────────────────────────
//  FLICKER LIGHT (for haunted scenes)
// ─────────────────────────────────────────────
function FlickerLight({ hauntingLevel }) {
    const lightRef = useRef();
    useFrame(({ clock }) => {
        if (!lightRef.current) return;
        const t = clock.elapsedTime;
        // Irregular flicker via layered sine waves + occasional dropout
        const base = 0.4 + Math.sin(t * 8) * 0.1 + Math.sin(t * 23) * 0.05;
        const dropout = Math.random() > 0.97 ? 0 : 1; // rare full dropout
        lightRef.current.intensity = Math.max(0, base * dropout) * (hauntingLevel / 5);
    });

    return <pointLight ref={lightRef} position={[0, 3.5, 0]} color="#aab4ff" distance={6} />;
}

// ─────────────────────────────────────────────
//  LOADING FALLBACK
// ─────────────────────────────────────────────
function LoadingFallback() {
    return (
        <Html center>
            <div style={{
                color: Colors.text.muted, fontFamily: 'monospace', fontSize: 11,
                letterSpacing: '2px',
            }}>
                LOADING SCENE...
            </div>
        </Html>
    );
}
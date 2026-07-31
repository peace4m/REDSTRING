/**
 * RedString — Case Select Screen
 * =================================
 * Main lobby. Players browse published cases filtered by:
 *  - Content rating (auto-filtered by account)
 *  - Category (murder, heist, disappearance…)
 *  - Difficulty (easy → extreme)
 *
 * Design: Dark grid of case file "folders".
 * Each card shows the case photo, title, difficulty badge,
 * content rating, and key stats (solve rate, avg time).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../services/apiClient';
import { Colors, Typography, Spacing, Radii, DifficultyColors, RatingColors } from '../config/theme';

const CATEGORIES = [
    { id: null,            label: 'All' },
    { id: 'murder',        label: 'Murder' },
    { id: 'serial_killer', label: 'Serial Killer' },
    { id: 'disappearance', label: 'Disappearance' },
    { id: 'hit_and_run',   label: 'Hit & Run' },
    { id: 'art_heist',     label: 'Heist' },
    { id: 'cold_case',     label: 'Cold Case' },
];

const DIFFICULTIES = [
    { id: null,      label: 'Any' },
    { id: 'easy',    label: 'Easy' },
    { id: 'medium',  label: 'Medium' },
    { id: 'hard',    label: 'Hard' },
    { id: 'extreme', label: 'Extreme' },
];

export default function CaseSelectScreen({ navigation }) {
    const [cases,      setCases]      = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search,     setSearch]     = useState('');
    const [category,   setCategory]   = useState(null);
    const [difficulty, setDifficulty] = useState(null);

    const fetchCases = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (category)   params.set('category',   category);
            if (difficulty) params.set('difficulty',  difficulty);
            const { cases: data } = await apiClient.get(`/cases?${params}`);
            setCases(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [category, difficulty]);

    useEffect(() => { fetchCases(); }, [fetchCases]);

    const filtered = cases.filter(c =>
        !search || c.title.toLowerCase().includes(search.toLowerCase())
    );

    // ── Render case card ──────────────────────────
    const renderCase = ({ item: c }) => {
        const diffColors = DifficultyColors[c.difficulty];
        const ratingColors = RatingColors[c.contentRating];
        const solveRate = c.solveRate ? `${Math.round(c.solveRate * 100)}% solved` : 'New case';

        return (
            <TouchableOpacity
                style={styles.caseCard}
                onPress={() => navigation.navigate('CaseBriefing', { caseId: c.caseId })}
                activeOpacity={0.85}
            >
                {/* Amber left border — active accent */}
                <View style={styles.cardAccentBar} />

                <View style={styles.cardBody}>
                    {/* Header row */}
                    <View style={styles.cardHeader}>
                        <Text style={styles.caseNumber} numberOfLines={1}>
                            {c.caseNumber || 'CS-XXXX'}
                        </Text>
                        <View style={styles.badges}>
                            <View style={[styles.badge, { backgroundColor: ratingColors.bg }]}>
                                <Text style={[styles.badgeText, { color: ratingColors.text }]}>
                                    {c.contentRating}
                                </Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: diffColors.bg }]}>
                                <Text style={[styles.badgeText, { color: diffColors.text }]}>
                                    {c.difficulty.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.caseTitle} numberOfLines={2}>{c.title}</Text>
                    <Text style={styles.caseTagline} numberOfLines={2}>{c.tagline}</Text>

                    {/* Footer stats */}
                    <View style={styles.cardFooter}>
                        <View style={styles.statItem}>
                            <Ionicons name="time-outline" size={12} color={Colors.text.muted} />
                            <Text style={styles.statText}>{c.timelineLabel}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="location-outline" size={12} color={Colors.text.muted} />
                            <Text style={styles.statText}>{c.setting?.city || '—'}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="people-outline" size={12} color={Colors.text.muted} />
                            <Text style={styles.statText}>{solveRate}</Text>
                        </View>
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} style={styles.cardArrow} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerEyebrow}>REDSTRING</Text>
                    <Text style={styles.headerTitle}>Case Files</Text>
                </View>
                <TouchableOpacity style={styles.filterBtn}>
                    <Ionicons name="options-outline" size={22} color={Colors.amber.bright} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={Colors.text.muted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search cases…"
                    placeholderTextColor={Colors.text.muted}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Category filter chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterScrollContent}
            >
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat.id || 'all'}
                        style={[styles.chip, category === cat.id && styles.chipActive]}
                        onPress={() => setCategory(cat.id)}
                    >
                        <Text style={[styles.chipText, category === cat.id && styles.chipTextActive]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Difficulty filter chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterScrollContent}
            >
                {DIFFICULTIES.map(diff => (
                    <TouchableOpacity
                        key={diff.id || 'any'}
                        style={[
                            styles.chip,
                            styles.chipSmall,
                            difficulty === diff.id && styles.chipActive,
                            diff.id && { borderColor: DifficultyColors[diff.id]?.text || Colors.border.regular },
                        ]}
                        onPress={() => setDifficulty(diff.id)}
                    >
                        <Text style={[
                            styles.chipText,
                            styles.chipTextSmall,
                            difficulty === diff.id && styles.chipTextActive,
                            diff.id && { color: DifficultyColors[diff.id]?.text || Colors.text.secondary },
                        ]}>
                            {diff.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Case list */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.amber.bright} />
                    <Text style={styles.loadingText}>Pulling case files…</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderCase}
                    keyExtractor={c => c.caseId}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchCases(); }}
                            tintColor={Colors.amber.bright}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Ionicons name="folder-open-outline" size={48} color={Colors.text.muted} />
                            <Text style={styles.emptyText}>No cases match your filters.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container:   { flex: 1, backgroundColor: Colors.bg.deep },
    header: {
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems:     'flex-end',
        paddingHorizontal: Spacing.xl,
        paddingTop:    Spacing.lg,
        paddingBottom: Spacing.md,
    },
    headerEyebrow: {
        fontFamily:    'JetBrainsMono_400Regular',
        fontSize:      10,
        letterSpacing: 3,
        color:         Colors.amber.mid,
        marginBottom:  Spacing.xs,
    },
    headerTitle: {
        fontFamily: 'CourierPrime_700Bold',
        fontSize:   28,
        color:      Colors.text.primary,
    },
    filterBtn: {
        width:           40,
        height:          40,
        backgroundColor: Colors.bg.raised,
        borderRadius:    Radii.md,
        justifyContent:  'center',
        alignItems:      'center',
    },
    searchRow: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: Colors.bg.surface,
        marginHorizontal: Spacing.xl,
        marginBottom:    Spacing.sm,
        borderRadius:    Radii.md,
        borderWidth:     1,
        borderColor:     Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        height:          44,
    },
    searchIcon:  { marginRight: Spacing.sm },
    searchInput: {
        flex:        1,
        fontFamily:  'Inter_400Regular',
        fontSize:    15,
        color:       Colors.text.primary,
        height:      '100%',
    },
    filterScroll:        { maxHeight: 40 },
    filterScrollContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.md,
        paddingVertical:   Spacing.xs,
        borderRadius:      Radii.full,
        borderWidth:       1,
        borderColor:       Colors.border.regular,
        backgroundColor:   Colors.bg.surface,
    },
    chipSmall:      { paddingHorizontal: Spacing.sm },
    chipActive:     { backgroundColor: Colors.amber.dim, borderColor: Colors.amber.bright },
    chipText:       { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text.secondary },
    chipTextSmall:  { fontSize: 11 },
    chipTextActive: { color: Colors.amber.bright },

    listContent: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 100 },

    caseCard: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: Colors.bg.surface,
        borderRadius:    Radii.lg,
        borderWidth:     1,
        borderColor:     Colors.border.subtle,
        overflow:        'hidden',
    },
    cardAccentBar: { width: 3, alignSelf: 'stretch', backgroundColor: Colors.amber.bright },
    cardBody:      { flex: 1, padding: Spacing.lg },
    cardArrow:     { marginRight: Spacing.md },

    cardHeader: {
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   Spacing.xs,
    },
    caseNumber: {
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize:   10,
        color:      Colors.text.muted,
        letterSpacing: 1,
    },
    badges: { flexDirection: 'row', gap: Spacing.xs },
    badge:  {
        paddingHorizontal: Spacing.sm,
        paddingVertical:   2,
        borderRadius:      Radii.xs,
    },
    badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.5 },

    caseTitle: {
        fontFamily:   'CourierPrime_700Bold',
        fontSize:     17,
        color:        Colors.text.primary,
        marginBottom: Spacing.xs,
        lineHeight:   22,
    },
    caseTagline: {
        fontFamily:   'Inter_400Regular',
        fontSize:     13,
        color:        Colors.text.secondary,
        lineHeight:   18,
        marginBottom: Spacing.md,
    },
    cardFooter: { flexDirection: 'row', gap: Spacing.lg },
    statItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted },

    centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    loadingText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.muted },
    emptyText:   { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text.muted, textAlign: 'center' },
});
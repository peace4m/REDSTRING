import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/apiClient';
import { Colors, Typography, Spacing, Radii } from '../config/theme';
import { useAuthStore } from '../store/authStore';
export default function CaseSelectScreen({ navigation }) {
  const { user } = useAuthStore();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    apiClient.get('/cases')
      .then(data => setCases(Array.isArray(data) ? data : data.cases || []))
      .catch(e => setError(e.message || 'Failed to load cases'))
      .finally(() => setLoading(false));
  }, []);
  const filtered = cases.filter(c => !search || c.title?.toLowerCase().includes(search.toLowerCase()));
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Colors.amber.bright} />
      <Text style={s.loadingText}>Loading case files...</Text>
    </View>
  );
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Case Files</Text>
        <Text style={s.headerSub}>Welcome, Detective {user?.displayName || ''}</Text>
      </View>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.text.muted} />
        <TextInput style={s.searchInput} placeholder="Search cases..." placeholderTextColor={Colors.text.muted} value={search} onChangeText={setSearch} />
      </View>
      {!!error && <Text style={s.errorText}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={item => item.caseId}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.text.muted} />
            <Text style={s.emptyTitle}>No cases available</Text>
            <Text style={s.emptyText}>Check back soon � new cases are added regularly.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('CaseBriefing', { caseId: item.caseId })} activeOpacity={0.85}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardTagline} numberOfLines={2}>{item.tagline || item.description}</Text>
            <View style={s.cardArrow}>
              <Text style={s.cardArrowText}>Open File</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.amber.bright} />
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.deep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.deep },
  loadingText: { fontFamily: Typography.mono.family, fontSize: 12, color: Colors.text.muted, marginTop: 12 },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: Typography.display.family, fontSize: 24, color: Colors.text.primary },
  headerSub: { fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.muted, marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.bg.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.regular, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, height: 42, fontFamily: Typography.body.family, fontSize: 14, color: Colors.text.primary },
  errorText: { color: Colors.red.bright, textAlign: 'center', padding: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontFamily: Typography.display.family, fontSize: 18, color: Colors.text.secondary },
  emptyText: { fontFamily: Typography.body.family, fontSize: 14, color: Colors.text.muted, textAlign: 'center', maxWidth: 280 },
  card: { backgroundColor: Colors.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.regular, padding: 20, marginBottom: 12 },
  cardTitle: { fontFamily: Typography.display.family, fontSize: 18, color: Colors.text.primary, marginBottom: 4 },
  cardTagline: { fontFamily: Typography.body.family, fontSize: 13, color: Colors.text.secondary, lineHeight: 19, marginBottom: 16 },
  cardArrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  cardArrowText: { fontFamily: Typography.body.familySemibold, fontSize: 12, color: Colors.amber.bright },
});

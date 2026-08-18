import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { theme } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getListingVisuals } from '@/lib/listing-visuals';
import { supabase } from '@/lib/supabase';
import { SaveButton } from '@/components/save-button';
import { SaveSearchButton } from '@/components/save-search-button';

type ProduceItem = {
  id: string;
  name: string;
  category: string;
  default_sold_by: string;
};

export default function SeasonalProduceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ query?: string; category?: string }>();
  const [items, setItems] = useState<ProduceItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date());

  useEffect(() => {
    if (typeof params.query === 'string') setQuery(params.query);
    if (typeof params.category === 'string') setCategory(params.category);
  }, [params.category, params.query]);

  useEffect(() => {
    let cancelled = false;

    async function loadProduce() {
      setLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from('produce_item_season_months')
        .select(`
          produce_items!inner (
            id, name, category, default_sold_by, is_available
          )
        `)
        .eq('month', new Date().getMonth() + 1)
        .eq('produce_items.is_available', true);

      if (cancelled) return;
      if (loadError) {
        console.log('Seasonal produce load error:', loadError);
        setError('We could not load seasonal produce right now.');
        setLoading(false);
        return;
      }

      const uniqueItems = new Map<string, ProduceItem>();
      (data ?? []).forEach((row: any) => {
        const item = Array.isArray(row.produce_items) ? row.produce_items[0] : row.produce_items;
        if (item) uniqueItems.set(item.id, item as ProduceItem);
      });

      setItems([...uniqueItems.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }

    loadProduce();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(items.map((item) => item.category))).sort()],
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, items, query]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}> 
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.card }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>

          <ThemedText style={[styles.eyebrow, { color: theme.brand.tertiary }]}>Fresh this month</ThemedText>
          <ThemedText style={[styles.title, { color: colors.text.primary }]}>Seasonal produce</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.text.secondary }]}> 
            Explore everything typically in season during {monthName}, then find a local farm offering it.
          </ThemedText>

          <View style={[styles.search, { backgroundColor: colors.input.background, borderColor: colors.border.light }]}> 
            <Ionicons name="search" size={18} color={colors.text.tertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search seasonal produce"
              placeholderTextColor={colors.input.placeholder}
              style={[styles.searchInput, { color: colors.input.text }]}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.saveSearchRow}><SaveSearchButton context="produce" query={query} filters={{ category }} visible={Boolean(query.trim()) || category !== 'All'} /></View>
        </View>

        {!loading && !error && categories.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {categories.map((itemCategory) => {
              const active = itemCategory === category;
              return (
                <TouchableOpacity
                  key={itemCategory}
                  style={[
                    styles.filter,
                    active
                      ? { backgroundColor: theme.brand.tertiary, borderColor: theme.brand.tertiary }
                      : { backgroundColor: colors.background, borderColor: colors.border.light },
                  ]}
                  onPress={() => setCategory(itemCategory)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.filterText, { color: active ? '#FFFFFF' : colors.text.secondary }]}> 
                    {itemCategory}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.results}>
          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={theme.brand.tertiary} />
              <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>Gathering this month&apos;s harvest…</ThemedText>
            </View>
          ) : error ? (
            <View style={[styles.state, styles.stateCard, { borderColor: colors.border.light }]}> 
              <Ionicons name="cloud-offline-outline" size={26} color={colors.text.secondary} />
              <ThemedText style={[styles.stateTitle, { color: colors.text.primary }]}>Couldn&apos;t load produce</ThemedText>
              <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>{error}</ThemedText>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={[styles.state, styles.stateCard, { borderColor: colors.border.light }]}> 
              <Ionicons name="basket-outline" size={26} color={theme.brand.tertiary} />
              <ThemedText style={[styles.stateTitle, { color: colors.text.primary }]}>No matches found</ThemedText>
              <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>Try another search or category.</ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.resultHeader}>
                <ThemedText style={[styles.resultTitle, { color: colors.text.primary }]}>Available in {monthName}</ThemedText>
                <ThemedText style={[styles.resultCount, { color: colors.text.secondary }]}> 
                  {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                </ThemedText>
              </View>
              <View style={styles.grid}>
                {filteredItems.map((item) => {
                  const visuals = getListingVisuals(item.category);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.card, { backgroundColor: visuals.color }]}
                      onPress={() => router.push(`/produce/${item.id}`)}
                      activeOpacity={0.86}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${item.name}`}
                    >
                      <View style={styles.cardSave}><SaveButton type="produce" itemId={item.id} size={18} /></View>
                      <View style={[styles.cardIcon, { backgroundColor: visuals.badgeColor }]}> 
                        <Ionicons name={visuals.icon} size={28} color={visuals.badgeTextColor} />
                      </View>
                      <ThemedText style={styles.cardTitle} numberOfLines={2}>{item.name}</ThemedText>
                      <ThemedText style={[styles.cardCategory, { color: visuals.badgeTextColor }]} numberOfLines={1}>
                        {item.category}
                      </ThemedText>
                      <View style={styles.cardFooter}>
                        <ThemedText style={styles.cardUnit}>per {item.default_sold_by}</ThemedText>
                        <View style={styles.cardArrow}>
                          <Ionicons name="arrow-forward" size={14} color="#2E2A1F" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: theme.spacing.xl },
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.lg },
  eyebrow: { fontSize: 11, lineHeight: 15, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '700', marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 5, maxWidth: 560 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: theme.borderRadius.full, paddingHorizontal: 14, marginTop: theme.spacing.lg },
  searchInput: { flex: 1, minHeight: 46, fontSize: 14 },
  saveSearchRow: { alignItems: 'flex-end', marginTop: 8 },
  filters: { gap: 8, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  filter: { borderWidth: 1, borderRadius: theme.borderRadius.full, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  results: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: theme.spacing.md },
  resultTitle: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  resultCount: { fontSize: 12, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', flexGrow: 1, minWidth: 145, maxWidth: 280, minHeight: 190, borderRadius: 20, padding: theme.spacing.md },
  cardSave: { position: 'absolute', right: 8, top: 8, zIndex: 2 },
  cardIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#2E2A1F', fontSize: 17, lineHeight: 22, fontWeight: '700', marginTop: theme.spacing.md },
  cardCategory: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 'auto', paddingTop: 10 },
  cardUnit: { flex: 1, color: '#5A564B', fontSize: 11, lineHeight: 15 },
  cardArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)' },
  state: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing.xl },
  stateCard: { borderWidth: 1, borderRadius: 20, paddingHorizontal: theme.spacing.lg },
  stateTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  stateBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});

import React, { useDeferredValue, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import FarmCard from '@/components/ui/farmcard';
import { ThemedText } from '@/components/themed-text';
import { theme } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useFarms } from '@/hooks/useFarms';
import { addDistanceAndSort } from '@/lib/location';
import { formatAddress } from '@/lib/address';
import { openDirections } from '@/lib/directions';
import { shareFarm } from '@/lib/share-farm';

export default function AllFarmsScreen() {
  const { colors } = useTheme();
  const { coords: userCoords, locationText } = useCurrentLocation();
  const { data: farms = [], isLoading, error, isRefetching, refetch } = useFarms();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const farmsWithDistance = useMemo(() => addDistanceAndSort(farms, userCoords), [farms, userCoords]);
  const filteredFarms = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return farmsWithDistance;
    return farmsWithDistance.filter((farm) =>
      [farm.name, farm.products, farm.description, farm.city, farm.state, farm.country]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [deferredSearchQuery, farmsWithDistance]);

  const handleDirections = async (farmId: string) => {
    const farm = farms.find((item) => item.id === farmId);
    if (!farm) return;
    const hasAddress = !!farm.street?.trim() && (!!farm.city?.trim() || !!farm.postal_code?.trim());
    try {
      await openDirections(hasAddress ? formatAddress(farm) : `${farm.latitude},${farm.longitude}`);
    } catch (error) {
      console.log('Could not open directions', error);
    }
  };

  const handleShare = async (farmId: string) => {
    const farm = farms.find((item) => item.id === farmId);
    if (!farm) return;
    try {
      await shareFarm(farm);
    } catch (error) {
      console.log('Could not share farm', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.background, borderColor: colors.border.light }]} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapButton, { backgroundColor: theme.brand.primary }]} onPress={() => router.push('/(tabs)/map')} activeOpacity={0.85}>
            <Ionicons name="map-outline" size={18} color={theme.neutral.white} />
            <ThemedText style={styles.mapButtonText}>Map</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText style={[styles.eyebrow, { color: theme.brand.tertiary }]}>Farm directory</ThemedText>
          <ThemedText style={[styles.heroTitle, { color: colors.text.primary }]}>Find a farm near you.</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.text.secondary }]}>Browse local farms, see what they grow, and plan your next pickup.</ThemedText>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.input.background, borderColor: colors.border.light }]}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search farms, produce, or location" placeholderTextColor={colors.input.placeholder} style={[styles.searchInput, { color: colors.input.text }]} autoCorrect={false} autoCapitalize="none" />
          {searchQuery.trim().length > 0 ? <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.text.secondary} /></TouchableOpacity> : null}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
            <ThemedText style={[styles.statValue, { color: colors.text.primary }]}>{filteredFarms.length}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>farms showing</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
            <Ionicons name="location-outline" size={20} color={theme.brand.primary} />
            <ThemedText style={[styles.locationLabel, { color: colors.text.secondary }]} numberOfLines={1}>📍 {locationText}</ThemedText>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Browse all farms</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>Sorted by distance from you.</ThemedText>
        </View>

        {isLoading ? <StateCard colors={colors} icon="refresh-outline" title="Loading farms…" /> : error ? <StateCard colors={colors} icon="warning-outline" title="Could not load farms" body="Pull down to try again." /> : farms.length === 0 ? <StateCard colors={colors} icon="leaf-outline" title="No farms listed yet" body="Check back soon as local farms join Villam." /> : filteredFarms.length === 0 ? <StateCard colors={colors} icon="search-outline" title="No farms found" body="Try a farm name, produce item, or location." actionLabel="Clear search" onAction={() => setSearchQuery('')} /> : (
          <View style={styles.farmList}>
            {filteredFarms.map((farm) => <FarmCard key={farm.id} id={farm.id} name={farm.name} rating={farm.rating} reviews={farm.reviews} distance={farm.distanceMi != null ? `${farm.distanceMi.toFixed(1)} mi` : 'Distance unavailable'} products={farm.products} imageUrl={farm.imageUrl ?? undefined} onPress={() => router.push(`/farm/${farm.id}`)} onDirectionPress={() => void handleDirections(farm.id)} onSharePress={() => void handleShare(farm.id)} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StateCard({ colors, icon, title, body, actionLabel, onAction }: { colors: ReturnType<typeof useTheme>['colors']; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border.light }]}><Ionicons name={icon} size={28} color={theme.brand.primary} /><ThemedText style={[styles.stateTitle, { color: colors.text.primary }]}>{title}</ThemedText>{body ? <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>{body}</ThemedText> : null}{actionLabel && onAction ? <TouchableOpacity style={[styles.stateAction, { backgroundColor: theme.brand.primary }]} onPress={onAction}><ThemedText style={styles.stateActionText}>{actionLabel}</ThemedText></TouchableOpacity> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing['4xl'] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.md },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mapButton: { height: 42, borderRadius: theme.borderRadius.full, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 }, mapButtonText: { color: theme.neutral.white, fontSize: 14, fontWeight: '700' },
  heroCopy: { marginTop: theme.spacing.xl, gap: theme.spacing.xs }, eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.1 }, heroTitle: { fontSize: 30, lineHeight: 37, fontWeight: '700', maxWidth: '88%' }, heroSubtitle: { fontSize: 15, lineHeight: 22, maxWidth: '92%' },
  searchBar: { marginTop: theme.spacing.xl, borderRadius: theme.borderRadius.full, borderWidth: 1, paddingHorizontal: 14, height: 50, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg }, statCard: { flex: 1, minHeight: 76, borderWidth: 1, borderRadius: 18, padding: theme.spacing.md, justifyContent: 'center' }, statValue: { fontSize: 24, lineHeight: 28, fontWeight: '700' }, statLabel: { marginTop: 3, fontSize: 12 }, locationLabel: { marginTop: 5, fontSize: 12 },
  sectionHeader: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.md }, sectionTitle: { fontSize: 21, fontWeight: '700' }, sectionSubtitle: { marginTop: 3, fontSize: 13 }, farmList: { gap: theme.spacing.lg },
  stateCard: { borderWidth: 1, borderRadius: 22, padding: theme.spacing.xl, alignItems: 'center', marginTop: theme.spacing.sm }, stateTitle: { marginTop: theme.spacing.sm, fontSize: 17, fontWeight: '700', textAlign: 'center' }, stateBody: { marginTop: 5, fontSize: 14, lineHeight: 20, textAlign: 'center' }, stateAction: { marginTop: theme.spacing.md, borderRadius: theme.borderRadius.full, paddingHorizontal: 16, paddingVertical: 10 }, stateActionText: { color: theme.neutral.white, fontSize: 13, fontWeight: '700' },
});

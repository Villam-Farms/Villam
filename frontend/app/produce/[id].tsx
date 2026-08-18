import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { theme } from '@/constants/theme';
import { SaveButton } from '@/components/save-button';
import { useTheme } from '@/hooks/useTheme';
import { formatAddress } from '@/lib/address';
import { openDirections } from '@/lib/directions';
import { getListingVisuals } from '@/lib/listing-visuals';
import { supabase } from '@/lib/supabase';

type ProduceItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  default_sold_by: string;
};

type Farm = {
  id: string;
  name: string;
  rating: number | null;
  reviews: number | null;
  latitude: number;
  longitude: number;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

type ListingRow = {
  id: string;
  price: number;
  currency: string;
  sold_by: string;
  image_url: string | null;
  farms: Farm;
  produce_varieties: { id: string; name: string } | null;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(Number(price));
  } catch {
    return `${currency || '$'} ${Number(price).toFixed(2)}`;
  }
}

export default function ProduceDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const produceId = typeof id === 'string' ? id : '';
  const [item, setItem] = useState<ProduceItem | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [seasonMonths, setSeasonMonths] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!produceId) {
        setError('This produce item is missing a valid id.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data: itemData, error: itemError } = await supabase
        .from('produce_items')
        .select('id,name,category,description,default_sold_by')
        .eq('id', produceId)
        .single();

      if (cancelled) return;
      if (itemError || !itemData) {
        console.log('Item load error:', itemError);
        setError('We could not load this produce item.');
        setLoading(false);
        return;
      }

      setItem(itemData as ProduceItem);

      const [{ data: monthData, error: monthError }, { data: listingData, error: listingError }] =
        await Promise.all([
          supabase.from('produce_item_season_months').select('month').eq('produce_item_id', produceId),
          supabase
            .from('farm_listings')
            .select(`
              id, price, currency, sold_by, image_url,
              farms:farms!farm_listings_farm_id_fkey (
                id, name, rating, reviews, latitude, longitude,
                street, city, state, postal_code, country
              ),
              produce_varieties:produce_varieties!inner (id, name, produce_item_id)
            `)
            .eq('available', true)
            .eq('produce_varieties.produce_item_id', produceId)
            .order('price', { ascending: true }),
        ]);

      if (cancelled) return;
      if (monthError) console.log('Season months error:', monthError);
      setSeasonMonths(
        (monthData ?? []).map((row: { month: number }) => row.month).sort((a, b) => a - b)
      );

      if (listingError) {
        console.log('Listing error:', listingError);
        setError('We could not load nearby farm listings.');
        setListings([]);
        setLoading(false);
        return;
      }

      const cleaned = (listingData ?? []).flatMap((row: any): ListingRow[] => {
        const farm = Array.isArray(row.farms) ? row.farms[0] : row.farms;
        const variety = Array.isArray(row.produce_varieties)
          ? row.produce_varieties[0]
          : row.produce_varieties;
        if (!farm || !variety) return [];
        return [{
          id: row.id,
          price: row.price,
          currency: row.currency,
          sold_by: row.sold_by,
          image_url: row.image_url ?? null,
          farms: farm,
          produce_varieties: { id: variety.id, name: variety.name },
        }];
      });

      setListings(cleaned);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [produceId]);

  const seasonText = useMemo(
    () => seasonMonths.length ? seasonMonths.map((month) => MONTH_NAMES[month - 1]).join(' · ') : 'Season varies',
    [seasonMonths]
  );
  const visuals = getListingVisuals(item?.category);

  async function handleDirections(farm: Farm) {
    const address = formatAddress(farm).trim();
    try {
      await openDirections(address || `${farm.latitude},${farm.longitude}`);
    } catch (directionError) {
      console.log('Could not open directions', directionError);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { paddingTop: insets.top + theme.spacing.sm }]}>
          <View style={styles.blobLarge} />
          <View style={styles.blobSmall} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={20} color="#2E2A1F" />
          </TouchableOpacity>
          {item ? <View style={[styles.heroSave, { top: insets.top + theme.spacing.sm }]}><SaveButton type="produce" itemId={item.id} /></View> : null}

          {loading ? (
            <View style={styles.heroLoading}>
              <ActivityIndicator color={theme.brand.tertiary} />
              <ThemedText style={styles.loadingText}>Gathering produce details…</ThemedText>
            </View>
          ) : item ? (
            <View style={styles.heroBody}>
              <View style={[styles.produceIcon, { backgroundColor: visuals.badgeColor }]}>
                <Ionicons name={visuals.icon} size={30} color={visuals.badgeTextColor} />
              </View>
              <ThemedText style={styles.eyebrow}>{item.category}</ThemedText>
              <ThemedText style={styles.heroTitle}>{item.name}</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                {item.description?.trim() || 'Fresh, locally listed produce from farms near you.'}
              </ThemedText>
              <View style={styles.pillRow}>
                <View style={styles.infoPill}>
                  <Ionicons name="calendar-outline" size={14} color="#6E7B37" />
                  <ThemedText style={styles.infoPillText}>{seasonText}</ThemedText>
                </View>
                <View style={styles.infoPill}>
                  <Ionicons name="basket-outline" size={14} color="#6E7B37" />
                  <ThemedText style={styles.infoPillText}>Sold by {item.default_sold_by}</ThemedText>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {loading ? null : error ? (
          <View style={[styles.stateCard, { borderColor: colors.border.light, backgroundColor: colors.surface }]}>
            <View style={[styles.stateIcon, { backgroundColor: colors.card }]}>
              <Ionicons name="cloud-offline-outline" size={25} color={colors.text.secondary} />
            </View>
            <ThemedText style={[styles.stateTitle, { color: colors.text.primary }]}>Something went wrong</ThemedText>
            <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>{error}</ThemedText>
          </View>
        ) : item ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Available nearby</ThemedText>
                <ThemedText style={[styles.sectionCaption, { color: colors.text.secondary }]}>
                  {listings.length} {listings.length === 1 ? 'farm listing' : 'farm listings'} · lowest price first
                </ThemedText>
              </View>
              <View style={[styles.countBadge, { backgroundColor: colors.card }]}>
                <ThemedText style={[styles.countText, { color: colors.text.primary }]}>{listings.length}</ThemedText>
              </View>
            </View>

            {listings.length === 0 ? (
              <View style={[styles.stateCard, { borderColor: colors.border.light, backgroundColor: colors.surface }]}>
                <View style={[styles.stateIcon, { backgroundColor: visuals.color }]}>
                  <Ionicons name={visuals.icon} size={25} color={visuals.badgeTextColor} />
                </View>
                <ThemedText style={[styles.stateTitle, { color: colors.text.primary }]}>Nothing listed today</ThemedText>
                <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>
                  Check back soon as local farms update their availability.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.listingStack}>
                {listings.map((listing) => {
                  const address = formatAddress(listing.farms).trim();
                  return (
                    <TouchableOpacity
                      key={listing.id}
                      style={[styles.card, { borderColor: colors.border.light, backgroundColor: colors.surface }]}
                      onPress={() => router.push(`/farm/${listing.farms.id}`)}
                      activeOpacity={0.88}
                    >
                      <View style={styles.listingSave}><SaveButton type="listing" itemId={listing.id} size={18} /></View>
                      <View style={[styles.thumbnail, { backgroundColor: visuals.color }]}>
                        {listing.image_url ? (
                          <Image source={{ uri: listing.image_url }} style={styles.thumbnailImage} contentFit="cover" />
                        ) : (
                          <Ionicons name={visuals.icon} size={32} color={visuals.badgeTextColor} />
                        )}
                        <View style={[styles.varietyBadge, { backgroundColor: visuals.badgeColor }]}>
                          <ThemedText style={[styles.varietyText, { color: visuals.badgeTextColor }]} numberOfLines={1}>
                            {listing.produce_varieties?.name || item.name}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                          <View style={styles.farmCopy}>
                            <ThemedText style={[styles.farmName, { color: colors.text.primary }]} numberOfLines={1}>
                              {listing.farms.name}
                            </ThemedText>
                            <ThemedText style={[styles.unitText, { color: colors.text.secondary }]}>
                              per {listing.sold_by}
                            </ThemedText>
                          </View>
                          <View style={[styles.pricePill, { backgroundColor: colors.card }]}>
                            <ThemedText style={[styles.priceText, { color: colors.text.primary }]}>
                              {formatPrice(listing.price, listing.currency)}
                            </ThemedText>
                          </View>
                        </View>

                        {listing.farms.rating != null ? (
                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={13} color={theme.brand.red} />
                            <ThemedText style={[styles.metaText, { color: colors.text.secondary }]}>
                              {Number(listing.farms.rating).toFixed(1)} · {listing.farms.reviews ?? 0} reviews
                            </ThemedText>
                          </View>
                        ) : null}

                        <View style={styles.addressRow}>
                          <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
                          <ThemedText style={[styles.addressText, { color: colors.text.secondary }]} numberOfLines={1}>
                            {address || 'Location available on farm page'}
                          </ThemedText>
                        </View>

                        <View style={styles.cardActions}>
                          <View style={styles.viewFarmLink}>
                            <ThemedText style={styles.viewFarmText}>View farm</ThemedText>
                            <Ionicons name="arrow-forward" size={14} color={theme.brand.tertiary} />
                          </View>
                          <TouchableOpacity
                            style={[styles.directionsButton, { backgroundColor: colors.card }]}
                            onPress={(event) => {
                              event.stopPropagation();
                              handleDirections(listing.farms);
                            }}
                            activeOpacity={0.82}
                          >
                            <Ionicons name="navigate-outline" size={13} color={colors.text.primary} />
                            <ThemedText style={[styles.directionsText, { color: colors.text.primary }]}>Directions</ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: theme.spacing.xl },
  hero: {
    minHeight: 270,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    backgroundColor: '#F7E5BF',
    overflow: 'hidden',
  },
  blobLarge: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    right: -55, top: 10, backgroundColor: '#F0C26A', opacity: 0.48,
  },
  blobSmall: {
    position: 'absolute', width: 125, height: 125, borderRadius: 63,
    left: -30, bottom: -40, backgroundColor: '#DCC16C', opacity: 0.38,
  },
  backButton: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', marginBottom: theme.spacing.md,
  },
  heroSave: { position: 'absolute', right: theme.spacing.lg },
  listingSave: { position: 'absolute', left: 8, top: 8, zIndex: 2 },
  heroLoading: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#5A564B', fontSize: 14 },
  heroBody: { position: 'relative', alignItems: 'flex-start' },
  produceIcon: {
    width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6E7B37', fontWeight: '700' },
  heroTitle: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: '#2E2A1F' },
  heroSubtitle: { fontSize: 14, lineHeight: 21, color: '#5A564B', marginTop: 4, maxWidth: 540 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.72)', paddingHorizontal: 12, paddingVertical: 7,
  },
  infoPillText: { fontSize: 12, lineHeight: 17, color: '#5A564B', fontWeight: '600' },
  section: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '700' },
  sectionCaption: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  countBadge: { minWidth: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  listingStack: { gap: 12 },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, overflow: 'hidden', minHeight: 176 },
  thumbnail: { width: 108, alignItems: 'center', justifyContent: 'center', padding: 8, overflow: 'hidden' },
  thumbnailImage: { ...StyleSheet.absoluteFillObject },
  varietyBadge: { maxWidth: 92, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, zIndex: 1 },
  varietyText: { fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  cardBody: { flex: 1, padding: theme.spacing.md, gap: 7 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  farmCopy: { flex: 1 },
  farmName: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  unitText: { fontSize: 12, lineHeight: 17 },
  pricePill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  priceText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, lineHeight: 17 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressText: { flex: 1, fontSize: 12, lineHeight: 17 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' },
  viewFarmLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewFarmText: { color: theme.brand.tertiary, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  directionsButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: theme.borderRadius.full, paddingHorizontal: 10, paddingVertical: 7 },
  directionsText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  stateCard: { margin: theme.spacing.lg, borderWidth: 1, borderRadius: 20, alignItems: 'center', padding: theme.spacing.xl },
  stateIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stateTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  stateBody: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 },
});

// (tabs)/grocerylist.tsx
import {
  StyleSheet,
  TextInput,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/useTheme';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getLocalGroceryLists, deleteLocalGroceryList } from '@/lib/local-grocery-lists';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';

type DisplayGroceryListItem = {
  id?: string;
  name?: string;
  checked?: boolean;
  is_checked?: boolean;
};

type DisplayGroceryList = {
  id: string;
  title: string;
  date: string;
  isPinned: boolean;
  itemCount: number;
  checkedCount: number;
  items: DisplayGroceryListItem[];
  updatedAt: number;
  source: 'db' | 'local';
};

type DBGroceryList = {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
  is_pinned?: boolean | null;
};

type DBGroceryListItem = {
  id: string;
  list_id: string;
  name: string;
  is_checked: boolean;
};

const formatGroceryListDate = (value?: string | null) => {
  if (!value) return 'Today';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
};

const getPreviewItems = (items: DisplayGroceryListItem[]) => {
  return items.slice(0, 3);
};

export default function GroceryListScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [lists, setLists] = useState<DisplayGroceryList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const localLists = await getLocalGroceryLists();

      const normalizedLocalLists: DisplayGroceryList[] = localLists.map((list) => ({
        id: list.id,
        title: list.title,
        date: list.date ?? 'Today',
        isPinned: Boolean(list.isPinned),
        itemCount: list.itemCount ?? list.items.length,
        checkedCount: list.checkedCount ?? list.items.filter((item) => item.checked).length,
        items: list.items ?? [],
        updatedAt: list.updatedAt ?? 0,
        source: 'local',
      }));

      const userId = session?.user?.id ?? null;

      if (!userId) {
        setLists(
          [...normalizedLocalLists].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.updatedAt - a.updatedAt;
          })
        );
        return;
      }

      const { data: dbLists, error: dbListsError } = await supabase
        .from('grocery_lists')
        .select('id, title, created_at, user_id, is_pinned')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dbListsError) throw dbListsError;

      const typedDbLists = (dbLists ?? []) as DBGroceryList[];
      const dbListIds = typedDbLists.map((list) => list.id);

      let itemMap: Record<string, DBGroceryListItem[]> = {};

      if (dbListIds.length > 0) {
        const { data: dbItems, error: dbItemsError } = await supabase
          .from('grocery_list_items')
          .select('id, list_id, name, is_checked')
          .in('list_id', dbListIds);

        if (dbItemsError) throw dbItemsError;

        itemMap = ((dbItems ?? []) as DBGroceryListItem[]).reduce<Record<string, DBGroceryListItem[]>>(
          (acc, item) => {
            if (!acc[item.list_id]) acc[item.list_id] = [];
            acc[item.list_id].push(item);
            return acc;
          },
          {}
        );
      }

      const normalizedDbLists: DisplayGroceryList[] = typedDbLists.map((list) => {
        const items = itemMap[list.id] ?? [];
        const createdAtMs = list.created_at ? new Date(list.created_at).getTime() : 0;

        return {
          id: list.id,
          title: list.title,
          date: formatGroceryListDate(list.created_at),
          isPinned: Boolean(list.is_pinned),
          itemCount: items.length,
          checkedCount: items.filter((item) => item.is_checked).length,
          items,
          updatedAt: createdAtMs,
          source: 'db',
        };
      });

      const mergedLists = [...normalizedDbLists, ...normalizedLocalLists].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.updatedAt - a.updatedAt;
      });

      setLists(mergedLists);
    } catch (error: any) {
      console.error('Grocery lists load failed:', error);
      setLoadError(error?.message ?? 'Could not load grocery lists.');
      setLists([]);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists])
  );

  const filteredLists = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return lists;

    return lists.filter((list) => {
      const haystack = [list.title, list.date].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [lists, searchQuery]);

  const handleListPress = (listId: string) => {
    router.push(`/grocery-list/${listId}`);
  };

  const handleDeleteList = (list: DisplayGroceryList) => {
    const sourceLabel = list.source === 'db' ? 'account' : 'local';

    Alert.alert(
      'Delete list?',
      `This will permanently delete the ${sourceLabel} grocery list "${list.title}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (list.source === 'db') {
                const userId = session?.user?.id ?? null;

                if (!userId) {
                  Alert.alert('Not signed in', 'Please sign in to delete this grocery list.');
                  return;
                }

                const { error } = await supabase
                  .from('grocery_lists')
                  .delete()
                  .eq('id', list.id)
                  .eq('user_id', userId);

                if (error) throw error;
              } else {
                await deleteLocalGroceryList(list.id);
              }

              setLists((prev) => prev.filter((item) => !(item.id === list.id && item.source === list.source)));
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message ?? 'Could not delete the grocery list.');
            }
          },
        },
      ]
    );
  };

  const renderListCard = ({ item }: { item: DisplayGroceryList }) => {
    const previewItems = getPreviewItems(item.items);
    const progress = item.itemCount > 0 ? item.checkedCount / item.itemCount : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleListPress(item.id)}
        style={[
          styles.listCard,
          {
            backgroundColor: colors.input.background,
            borderColor: colors.border.light,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardTitleRow}>
              <ThemedText
                style={[styles.cardTitle, { color: colors.text.primary }]}
                numberOfLines={1}
              >
                {item.title}
              </ThemedText>

              {item.isPinned && (
                <View style={styles.pinBadge}>
                  <Ionicons name="pin" size={10} color={theme.neutral.white} />
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              <View
                style={[
                  styles.metaChip,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border.light,
                  },
                ]}
              >
                <ThemedText style={[styles.metaChipText, { color: colors.text.secondary }]}>
                  {item.source === 'db' ? 'Account' : 'Local'}
                </ThemedText>
              </View>

              <ThemedText style={[styles.cardDate, { color: colors.text.tertiary }]}>
                {item.date}
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              {
                backgroundColor: colors.background,
                borderColor: colors.border.light,
              },
            ]}
            onPress={() => handleDeleteList(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statPill,
              {
                backgroundColor: colors.background,
                borderColor: colors.border.light,
              },
            ]}
          >
            <Ionicons name="list-outline" size={14} color={theme.brand.primary} />
            <ThemedText style={[styles.statText, { color: colors.text.primary }]}>
              {item.itemCount} items
            </ThemedText>
          </View>

          <View
            style={[
              styles.statPill,
              {
                backgroundColor: colors.background,
                borderColor: colors.border.light,
              },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color={theme.brand.primary} />
            <ThemedText style={[styles.statText, { color: colors.text.primary }]}>
              {item.checkedCount} done
            </ThemedText>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.previewList}>
          {previewItems.length === 0 ? (
            <ThemedText style={[styles.emptyPreviewText, { color: colors.text.tertiary }]}>
              No items yet
            </ThemedText>
          ) : (
            previewItems.map((previewItem, index) => {
              const checked = Boolean(previewItem?.checked || previewItem?.is_checked);

              return (
                <View key={`${item.source}-${item.id}-${previewItem?.id ?? index}`} style={styles.previewRow}>
                  <View
                    style={[
                      styles.previewDot,
                      checked
                        ? { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border.light },
                    ]}
                  >
                    {checked && <Ionicons name="checkmark" size={10} color={theme.neutral.white} />}
                  </View>

                  <ThemedText
                    style={[
                      styles.previewText,
                      { color: checked ? colors.text.tertiary : colors.text.primary },
                      checked && styles.previewTextChecked,
                    ]}
                    numberOfLines={1}
                  >
                    {previewItem?.name || `Item ${index + 1}`}
                  </ThemedText>
                </View>
              );
            })
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.topHeader}>
          <View>
            <ThemedText style={[styles.screenTitle, { color: colors.text.primary }]}>
              Grocery Lists
            </ThemedText>
            <ThemedText style={[styles.screenSubtitle, { color: colors.text.secondary }]}>
              Keep track of your shopping in one place
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/grocery-list/new')}
            activeOpacity={0.86}
          >
            <Ionicons name="add" size={18} color={theme.neutral.white} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.input.background,
              borderColor: colors.border.light,
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons name="search" size={22} color={colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.input.text }]}
            placeholder="Search your grocery lists"
            placeholderTextColor={colors.input.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isLoading ? (
          <View style={styles.stateWrap}>
            <ThemedText style={{ color: colors.text.tertiary }}>Loading grocery lists…</ThemedText>
          </View>
        ) : loadError ? (
          <View style={styles.stateWrap}>
            <ThemedText style={{ color: colors.text.tertiary }}>{loadError}</ThemedText>
          </View>
        ) : filteredLists.length === 0 ? (
          <View style={styles.stateWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.input.background }]}>
              <Ionicons name="cart-outline" size={30} color={theme.brand.primary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text.primary }]}>
              No grocery lists yet
            </ThemedText>
            <ThemedText style={[styles.emptyBody, { color: colors.text.secondary }]}>
              Start a list for your next market run, recipe plan, or weekly essentials.
            </ThemedText>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => router.push('/grocery-list/new')}
              activeOpacity={0.86}
            >
              <Ionicons name="add" size={20} color={theme.neutral.white} />
              <ThemedText style={styles.emptyActionText}>New grocery list</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredLists}
            keyExtractor={(item) => `${item.source}-${item.id}`}
            renderItem={renderListCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  screenSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
  },
  createButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brand.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  pinBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeights.medium,
    fontFamily: theme.typography.fontFamily,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.medium,
    fontFamily: theme.typography.fontFamily,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.brand.primary,
    borderRadius: 999,
  },
  previewList: {
    marginTop: theme.spacing.md,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
  },
  previewTextChecked: {
    textDecorationLine: 'line-through',
  },
  emptyPreviewText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: theme.typography.fontWeights.bold,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
  },
  emptyBody: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.h4,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
  },
  emptyActionButton: {
    marginTop: theme.spacing.lg,
    minHeight: 48,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.brand.primary,
  },
  emptyActionText: {
    color: theme.neutral.white,
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
});
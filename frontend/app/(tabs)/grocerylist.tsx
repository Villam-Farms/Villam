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
import { GroceryListCard } from '@/components/ui/grocerylist/GroceryListCard';
import { useFocusEffect } from '@react-navigation/native';
import { getLocalGroceryLists, deleteLocalGroceryList } from '@/lib/local-grocery-lists';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';

type DisplayGroceryList = {
  id: string;
  title: string;
  date: string;
  isPinned: boolean;
  itemCount: number;
  checkedCount: number;
  items: any[];
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

              setLists((prev) => prev.filter((item) => item.id !== list.id));
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message ?? 'Could not delete the grocery list.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Ionicons name="search" size={30} color={colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.input.text }]}
            placeholder="Search through your grocery lists"
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
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.card }]}>
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
            renderItem={({ item }) => (
              <View style={styles.listRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleListPress(item.id)}
                  style={styles.cardWrap}
                >
                  <GroceryListCard list={item} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    {
                      backgroundColor: colors.input.background,
                      borderColor: colors.border.light,
                    },
                  ]}
                  onPress={() => handleDeleteList(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            )}
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
    padding: 20,
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
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
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
  },
  emptyBody: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.h4,
    lineHeight: 22,
    textAlign: 'center',
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
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cardWrap: {
    flex: 1,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// app/grocery-list/[id].tsx
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/useTheme';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocalGroceryListById, saveLocalGroceryList } from '@/lib/local-grocery-lists';
import { supabase } from '@/lib/supabase';

/* =========================
   TYPES
========================= */

type TextStyle = {
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
};

type ExtendedGroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  category?: string | null;
  isPinned?: boolean;
  quantity?: string | null;
  unit?: string | null;
  textStyle?: TextStyle;
};

type Category = {
  id: string;
  name: string | null;
  isCollapsed: boolean;
  items: ExtendedGroceryItem[];
};

type DBGroceryList = {
  id: string;
  title: string;
  created_at: string;
  source_recipe_id: string | null;
};

type DBGroceryListItem = {
  id: string;
  list_id: string;
  user_id: string;
  position: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  is_checked: boolean;
  created_at: string;
};

const UNCATEGORIZED_KEY = '__uncategorized__';
const DEFAULT_SUBCATEGORY_NAME = 'Ingredients';
const NEW_CATEGORY_PREFIX = '__newcat_';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatDisplayDate = (value?: string | null) => {
  if (!value) return 'Today';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/* =========================
   SCREEN
========================= */

export default function GroceryListDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();

  const listId = Array.isArray(id) ? id[0] : id;
  const isNewList = listId === 'new';
  const isDbList = typeof listId === 'string' && isUuid(listId);

  const [isLoadingList, setIsLoadingList] = useState(!isNewList);
  const [listNotFound, setListNotFound] = useState(false);
  const [displayDate, setDisplayDate] = useState(isNewList ? 'Today' : '');
  const [items, setItems] = useState<ExtendedGroceryItem[]>([
    {
      id: uid(),
      name: '',
      checked: false,
      category: DEFAULT_SUBCATEGORY_NAME,
      isPinned: false,
      quantity: null,
      unit: null,
      textStyle: {},
    },
  ]);

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [categoryNameDrafts, setCategoryNameDrafts] = useState<Record<string, string>>({});
  const [isPinned, setIsPinned] = useState(false);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const itemRefs = useRef<Record<string, TextInput | null>>({});
  const categoryInputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollRef = useRef<ScrollView | null>(null);

  const createEmptyItem = (category: string | null = DEFAULT_SUBCATEGORY_NAME): ExtendedGroceryItem => ({
    id: uid(),
    name: '',
    checked: false,
    category,
    isPinned: false,
    quantity: null,
    unit: null,
    textStyle: {},
  });

  const scrollToBottom = (delay = 120) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  };

  useEffect(() => {
    const loadList = async () => {
      if (isNewList) {
        setIsLoadingList(false);
        return;
      }

      if (!listId || typeof listId !== 'string') {
        setListNotFound(true);
        setIsLoadingList(false);
        return;
      }

      try {
        if (isDbList) {
          const { data: listData, error: listError } = await supabase
            .from('grocery_lists')
            .select('id, title, created_at, source_recipe_id')
            .eq('id', listId)
            .single();

          if (listError || !listData) {
            console.log('Grocery list load error:', listError);
            setListNotFound(true);
            return;
          }

          const { data: itemData, error: itemError } = await supabase
            .from('grocery_list_items')
            .select('id, list_id, user_id, position, quantity, unit, name, is_checked, created_at')
            .eq('list_id', listId)
            .order('position', { ascending: true });

          if (itemError) {
            console.log('Grocery list items load error:', itemError);
            setListNotFound(true);
            return;
          }

          const mappedItems: ExtendedGroceryItem[] =
            (itemData as DBGroceryListItem[] | null)?.map((item) => ({
              id: item.id,
              name: item.name,
              checked: item.is_checked,
              category: DEFAULT_SUBCATEGORY_NAME,
              isPinned: false,
              quantity: item.quantity,
              unit: item.unit,
              textStyle: {},
            })) ?? [];

          setItems(mappedItems.length > 0 ? mappedItems : [createEmptyItem(DEFAULT_SUBCATEGORY_NAME)]);
          setTitle((listData as DBGroceryList).title ?? '');
          setIsPinned(false);
          setDisplayDate(formatDisplayDate((listData as DBGroceryList).created_at));
          return;
        }

        const localList = await getLocalGroceryListById(listId);

        if (!localList) {
          setListNotFound(true);
          return;
        }

        setItems(
          localList.items.length > 0
            ? localList.items.map((item: any) => ({
                id: item.id ?? uid(),
                name: item.name ?? '',
                checked: Boolean(item.checked),
                category: item.category ?? null,
                isPinned: Boolean(item.isPinned),
                quantity: item.quantity ?? null,
                unit: item.unit ?? null,
                textStyle: item.textStyle ?? {},
              }))
            : [createEmptyItem()]
        );

        setTitle(localList.title ?? '');
        setIsPinned(Boolean(localList.isPinned));
        setDisplayDate(localList.date || '');
      } finally {
        setIsLoadingList(false);
      }
    };

    loadList();
  }, [isNewList, isDbList, listId]);

  /* =========================
     DERIVED CATEGORIES
  ========================= */

  const categories = useMemo<Category[]>(() => {
    const uncategorized: ExtendedGroceryItem[] = [];
    const map: Record<string, ExtendedGroceryItem[]> = {};
    const categoryOrder: string[] = [];

    items.forEach((item) => {
      if (!item.category) {
        uncategorized.push(item);
      } else {
        const key = item.category.trim();
        if (!map[key]) {
          map[key] = [];
          categoryOrder.push(key);
        }
        map[key].push(item);
      }
    });

    const result: Category[] = [];

    if (uncategorized.length > 0) {
      result.push({
        id: UNCATEGORIZED_KEY,
        name: null,
        isCollapsed: false,
        items: uncategorized,
      });
    }

    categoryOrder.forEach((name) => {
      result.push({
        id: name,
        name,
        isCollapsed: Boolean(collapsedCategories[name]),
        items: map[name],
      });
    });

    return result;
  }, [items, collapsedCategories]);

  /* =========================
     ACTIONS
  ========================= */

  const updateItem = (itemId: string, updates: Partial<ExtendedGroceryItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  };

  const toggleItem = (itemId: string) => {
    updateItem(itemId, { checked: !items.find((i) => i.id === itemId)?.checked });
  };

  const toggleItemPin = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isPinned: !item.isPinned } : item
      )
    );
  };

  const toggleCategory = (id: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addNewItem = (categoryName: string | null) => {
    const newItem = createEmptyItem(categoryName);
    setItems((prev) => [...prev, newItem]);

    setTimeout(() => {
      itemRefs.current[newItem.id]?.focus();
      scrollToBottom(0);
    }, 100);
  };

  const removeItem = (itemId: string) => {
    let focusTargetId: string | null = null;

    setItems((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      const removeIndex = prev.findIndex((item) => item.id === itemId);
      if (removeIndex === -1) {
        return prev;
      }

      const next = prev.filter((item) => item.id !== itemId);
      const fallbackIndex = Math.max(0, removeIndex - 1);
      focusTargetId = next[fallbackIndex]?.id ?? next[0]?.id ?? null;
      return next;
    });

    setTimeout(() => {
      if (focusTargetId) {
        itemRefs.current[focusTargetId]?.focus();
      }
    }, 50);
  };

  const addNewCategory = () => {
    const newCategoryKey = `${NEW_CATEGORY_PREFIX}${Date.now()}`;
    const newItem: ExtendedGroceryItem = createEmptyItem(newCategoryKey);
    newItem.id = uid();

    setItems((prev) => [...prev, newItem]);

    setTimeout(() => {
      setCategoryNameDrafts((prev) => ({ ...prev, [newCategoryKey]: '' }));
      categoryInputRefs.current[newCategoryKey]?.focus();
      scrollToBottom(0);
    }, 150);
  };

  const renameCategory = (oldName: string, newName: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.category === oldName ? { ...item, category: newName } : item
      )
    );

    if (categoryInputRefs.current[oldName]) {
      categoryInputRefs.current[newName] = categoryInputRefs.current[oldName];
      delete categoryInputRefs.current[oldName];
    }
  };

  const deleteCategory = (categoryName: string) => {
    const namedCategories = categories.filter((category) => category.name !== null);
    if (namedCategories.length <= 1) {
      Alert.alert('Cannot delete', 'Keep at least one subcategory in this list.');
      return;
    }

    Alert.alert(
      'Delete subcategory?',
      `Delete "${categoryName}" and all its items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setItems((prev) => prev.filter((item) => item.category !== categoryName));
            setCategoryNameDrafts((prev) => {
              const next = { ...prev };
              delete next[categoryName];
              return next;
            });
            setCollapsedCategories((prev) => {
              const next = { ...prev };
              delete next[categoryName];
              return next;
            });
          },
        },
      ]
    );
  };

  const toggleListPin = () => setIsPinned(!isPinned);

  const deleteList = async () => {
    if (isDbList && listId) {
      Alert.alert('Delete list?', 'This will permanently delete the grocery list.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('grocery_lists')
                .delete()
                .eq('id', listId);

              if (error) throw error;
              router.replace('/(tabs)/grocerylist');
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message ?? 'Could not delete the list.');
            }
          },
        },
      ]);
      return;
    }

    router.back();
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Title required', 'Please add a title before saving.');
      return;
    }

    setIsSaving(true);

    try {
      if (isDbList && listId) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          Alert.alert('Not signed in', 'Please sign in to save this grocery list.');
          return;
        }

        const cleanDbItems = items
          .map((item, index) => ({
            list_id: listId,
            user_id: user.id,
            position: index,
            quantity: item.quantity ?? null,
            unit: item.unit ?? null,
            name: item.name.trim(),
            is_checked: Boolean(item.checked),
          }))
          .filter((item) => item.name.length > 0);

        const { error: updateListError } = await supabase
          .from('grocery_lists')
          .update({ title: trimmedTitle })
          .eq('id', listId);

        if (updateListError) throw updateListError;

        const { error: deleteItemsError } = await supabase
          .from('grocery_list_items')
          .delete()
          .eq('list_id', listId);

        if (deleteItemsError) throw deleteItemsError;

        if (cleanDbItems.length > 0) {
          const { error: insertItemsError } = await supabase
            .from('grocery_list_items')
            .insert(cleanDbItems);

          if (insertItemsError) throw insertItemsError;
        }

        Alert.alert('Saved', 'Your grocery list was updated.');
        return;
      }

      const cleanItems = items
        .map((item, index) => ({
          id: item.id || `${Date.now()}-${index}`,
          name: item.name.trim(),
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          checked: Boolean(item.checked),
          category:
            item.category && !item.category.startsWith(NEW_CATEGORY_PREFIX)
              ? item.category.trim()
              : null,
          isPinned: Boolean(item.isPinned),
          sortOrder: index,
          textStyle: item.textStyle ?? {},
        }))
        .filter((item) => item.name.length > 0);

      await saveLocalGroceryList({
        id: isNewList ? undefined : listId,
        title: trimmedTitle,
        date: displayDate || undefined,
        isPinned,
        items: cleanItems as any,
      });

      router.replace('/(tabs)/grocerylist');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save grocery list.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayCategoryName = (key: string) =>
    key.startsWith(NEW_CATEGORY_PREFIX) ? '' : key;

  /* =========================
     EMPTY STATE
  ========================= */

  if (isLoadingList) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brand.primary} />
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!isNewList && listNotFound) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>List not found</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              {!isNewList && !isDbList && (
                <TouchableOpacity onPress={toggleListPin}>
                  <Ionicons
                    name={isPinned ? 'pin' : 'pin-outline'}
                    size={24}
                    color={isPinned ? theme.brand.red : colors.text.primary}
                  />
                </TouchableOpacity>
              )}

              {!isNewList && (
                <TouchableOpacity onPress={deleteList}>
                  <Ionicons name="trash-outline" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                <ThemedText
                  style={[
                    styles.saveButton,
                    { color: isSaving ? colors.text.tertiary : theme.brand.primary },
                  ]}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ThemedView style={styles.container}>
            <ThemedText style={[styles.date, { color: colors.text.secondary }]}>
              {isNewList ? 'Today' : displayDate}
            </ThemedText>

            <TextInput
              style={[styles.title, { color: colors.text.primary }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title..."
              placeholderTextColor={colors.text.tertiary}
            />

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {categories.map((category) => (
                <View key={category.id} style={styles.categorySection}>
                  {category.name !== null &&
                    (isDbList ? (
                      <View style={styles.categoryHeaderStatic}>
                        <ThemedText style={[styles.categoryStaticTitle, { color: colors.text.primary }]}>
                          {displayCategoryName(category.name)}
                        </ThemedText>
                      </View>
                    ) : (
                      <View style={styles.categoryHeader}>
                        <TextInput
                          ref={(ref) => {
                            if (category.name) {
                              categoryInputRefs.current[category.name] = ref;
                            }
                          }}
                          value={
                            categoryNameDrafts[category.name] ??
                            displayCategoryName(category.name)
                          }
                          onChangeText={(text) =>
                            setCategoryNameDrafts((prev) => ({
                              ...prev,
                              [category.name!]: text,
                            }))
                          }
                          onEndEditing={() => {
                            const draft = categoryNameDrafts[category.name!];
                            const trimmed = draft?.trim();
                            const fallback = `Category ${
                              categories.filter((c) => c.name !== null).length
                            }`;
                            const finalName = trimmed || fallback;

                            if (finalName !== category.name) {
                              renameCategory(category.name!, finalName);
                            }

                            setCategoryNameDrafts((prev) => {
                              const next = { ...prev };
                              delete next[category.name!];
                              return next;
                            });

                            const firstItem = category.items[0];
                            if (firstItem) {
                              setTimeout(() => itemRefs.current[firstItem.id]?.focus(), 100);
                            }
                          }}
                          style={[styles.categoryTitle, { color: colors.text.primary }]}
                          placeholder="Category name..."
                          placeholderTextColor={colors.text.tertiary}
                          returnKeyType="done"
                        />
                        <View style={styles.categoryHeaderActions}>
                          <TouchableOpacity
                            onPress={() => deleteCategory(category.name!)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.text.tertiary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => toggleCategory(category.id)}>
                            <Ionicons
                              name={category.isCollapsed ? 'chevron-forward' : 'chevron-down'}
                              size={20}
                              color={colors.text.secondary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                  {!category.isCollapsed &&
                    category.items.map((item) => {
                      const inCategory = category.name !== null;
                      const amount = [item.quantity, item.unit].filter(Boolean).join(' ');

                      return (
                        <View key={item.id} style={styles.itemRow}>
                          {inCategory ? (
                            <TouchableOpacity
                              onPress={() => toggleItem(item.id)}
                              style={[
                                styles.checkbox,
                                { borderColor: colors.border.default },
                                item.checked && {
                                  backgroundColor: theme.brand.primary,
                                  borderColor: theme.brand.primary,
                                },
                              ]}
                            >
                              {item.checked && (
                                <Ionicons name="checkmark" size={18} color={colors.background} />
                              )}
                            </TouchableOpacity>
                          ) : (
                            <View style={[styles.bulletDot, { backgroundColor: colors.text.tertiary }]} />
                          )}

                          <View style={styles.itemCopy}>
                            {!!amount && (
                              <ThemedText style={[styles.itemAmount, { color: theme.brand.tertiary }]}>
                                {amount}
                              </ThemedText>
                            )}

                            <TextInput
                              ref={(ref) => {
                                itemRefs.current[item.id] = ref;
                              }}
                              value={item.name}
                              onChangeText={(text) => updateItem(item.id, { name: text })}
                              placeholder="Item name"
                              placeholderTextColor={colors.text.tertiary}
                              multiline={false}
                              style={[
                                styles.itemText,
                                item.checked && styles.itemTextChecked,
                                { color: colors.text.primary },
                                item.textStyle?.bold && { fontWeight: '700' },
                                item.textStyle?.italic && { fontStyle: 'italic' },
                                item.textStyle?.underline && { textDecorationLine: 'underline' },
                                item.checked && item.textStyle?.underline && {
                                  textDecorationLine: 'underline line-through',
                                },
                              ]}
                              onSubmitEditing={() => addNewItem(item.category ?? null)}
                              onKeyPress={(e) => {
                                if (
                                  e.nativeEvent.key === 'Backspace' &&
                                  item.name.length === 0
                                ) {
                                  removeItem(item.id);
                                }
                              }}
                              returnKeyType="next"
                              blurOnSubmit={false}
                            />
                          </View>

                          <TouchableOpacity onPress={() => toggleItemPin(item.id)}>
                            {item.isPinned && (
                              <Ionicons name="pin" size={18} color={colors.text.primary} />
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}

                  {category.name !== null && !category.isCollapsed && !isDbList && (
                    <View>
                      <View style={[styles.itemRow, { opacity: 0.3 }]}>
                        <View style={[styles.subcatGhostIcon, { borderColor: colors.border.default }]}>
                          <Ionicons name="list-outline" size={13} color={colors.text.tertiary} />
                        </View>
                        <TextInput
                          placeholder="Add subcategory..."
                          placeholderTextColor={colors.text.tertiary}
                          style={[
                            styles.itemText,
                            { color: colors.text.primary, fontSize: theme.typography.fontSizes.h4 - 1 },
                          ]}
                          onFocus={() => addNewCategory()}
                          blurOnSubmit={false}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  saveButton: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: '700',
  },
  date: {
    fontSize: theme.typography.fontSizes.h4,
    textAlign: 'center',
    marginVertical: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
  },
  categorySection: {
    marginBottom: theme.spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  categoryHeaderStatic: {
    marginBottom: theme.spacing.sm,
  },
  categoryStaticTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: '600',
  },
  categoryTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: '600',
    flex: 1,
  },
  categoryHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginLeft: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: theme.spacing.md,
    marginLeft: 9,
    opacity: 0.4,
  },
  subcatGhostIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  itemCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  listContent: {
    paddingBottom: theme.spacing.xl * 3,
  },
});
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
import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/useTheme';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type ExtendedGroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  quantity?: string | null;
  unit?: string | null;
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

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function GroceryListDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();

  const listId = Array.isArray(id) ? id[0] : id;
  const isNewList = listId === 'new';

  const [isLoadingList, setIsLoadingList] = useState(!isNewList);
  const [listNotFound, setListNotFound] = useState(false);
  const [displayDate, setDisplayDate] = useState('Today');
  const [items, setItems] = useState<ExtendedGroceryItem[]>([]);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const itemRefs = useRef<Record<string, TextInput | null>>({});
  const scrollRef = useRef<ScrollView | null>(null);

  const createEmptyItem = (): ExtendedGroceryItem => ({
    id: uid(),
    name: '',
    checked: false,
    quantity: null,
    unit: null,
  });

  const scrollToBottom = (delay = 120) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  };

  useEffect(() => {
    const loadList = async () => {
      if (isNewList) {
        setDisplayDate('Today');
        setTitle('');
        setItems([]);
        setIsLoadingList(false);
        return;
      }

      if (!listId || typeof listId !== 'string') {
        setListNotFound(true);
        setIsLoadingList(false);
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          Alert.alert('Not signed in', 'Please sign in to view this grocery list.');
          setListNotFound(true);
          return;
        }

        const { data: listData, error: listError } = await supabase
          .from('grocery_lists')
          .select('id, title, created_at, source_recipe_id')
          .eq('id', listId)
          .eq('user_id', user.id)
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
          .eq('user_id', user.id)
          .order('position', { ascending: true });

        if (itemError) {
          console.log('Grocery list items load error:', itemError);
          setListNotFound(true);
          return;
        }

        const mappedItems: ExtendedGroceryItem[] =
          ((itemData ?? []) as DBGroceryListItem[]).map((item) => ({
            id: item.id,
            name: item.name,
            checked: item.is_checked,
            quantity: item.quantity,
            unit: item.unit,
          })) ?? [];

        setItems(mappedItems);
        setTitle((listData as DBGroceryList).title ?? '');
        setDisplayDate(formatDisplayDate((listData as DBGroceryList).created_at));
      } catch (error) {
        console.log('Load grocery list failed:', error);
        setListNotFound(true);
      } finally {
        setIsLoadingList(false);
      }
    };

    loadList();
  }, [listId, isNewList]);

  const updateItem = (itemId: string, updates: Partial<ExtendedGroceryItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  };

  const toggleItem = (itemId: string) => {
    updateItem(itemId, { checked: !items.find((i) => i.id === itemId)?.checked });
  };

  const addNewItem = () => {
    const newItem = createEmptyItem();
    setItems((prev) => [...prev, newItem]);

    setTimeout(() => {
      itemRefs.current[newItem.id]?.focus();
      scrollToBottom(0);
    }, 100);
  };

  const removeItem = (itemId: string) => {
    let focusTargetId: string | null = null;

    setItems((prev) => {
      const removeIndex = prev.findIndex((item) => item.id === itemId);
      if (removeIndex === -1) return prev;

      const next = prev.filter((item) => item.id !== itemId);

      if (next.length === 0) {
        focusTargetId = null;
        return [];
      }

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

  const deleteList = async () => {
    if (isNewList) {
      router.back();
      return;
    }

    if (!listId || typeof listId !== 'string') return;

    Alert.alert('Delete list?', 'This will permanently delete the grocery list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const {
              data: { user },
              error: userError,
            } = await supabase.auth.getUser();

            if (userError) throw userError;
            if (!user) {
              Alert.alert('Not signed in', 'Please sign in to delete this grocery list.');
              return;
            }

            const { error } = await supabase
              .from('grocery_lists')
              .delete()
              .eq('id', listId)
              .eq('user_id', user.id);

            if (error) throw error;

            router.replace('/(tabs)/grocerylist');
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete the list.');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Title required', 'Please add a title before saving.');
      return;
    }

    setIsSaving(true);

    try {
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
          position: index,
          quantity: item.quantity?.trim() || null,
          unit: item.unit?.trim() || null,
          name: item.name.trim(),
          is_checked: Boolean(item.checked),
        }))
        .filter((item) => item.name.length > 0);

      if (isNewList) {
        const { data: newList, error: createListError } = await supabase
          .from('grocery_lists')
          .insert({
            user_id: user.id,
            title: trimmedTitle,
            source_recipe_id: null,
          })
          .select('id, created_at')
          .single();

        if (createListError) throw createListError;

        if (cleanDbItems.length > 0) {
          const itemsPayload = cleanDbItems.map((item) => ({
            list_id: newList.id,
            user_id: user.id,
            position: item.position,
            quantity: item.quantity,
            unit: item.unit,
            name: item.name,
            is_checked: item.is_checked,
          }));

          const { error: insertItemsError } = await supabase
            .from('grocery_list_items')
            .insert(itemsPayload);

          if (insertItemsError) throw insertItemsError;
        }

        Alert.alert('Saved', 'Your grocery list was created.');
        router.replace(`/grocery-list/${newList.id}`);
        return;
      }

      if (!listId || typeof listId !== 'string') {
        Alert.alert('Invalid list', 'This grocery list could not be saved.');
        return;
      }

      const { error: updateListError } = await supabase
        .from('grocery_lists')
        .update({ title: trimmedTitle })
        .eq('id', listId)
        .eq('user_id', user.id);

      if (updateListError) throw updateListError;

      const { error: deleteItemsError } = await supabase
        .from('grocery_list_items')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', user.id);

      if (deleteItemsError) throw deleteItemsError;

      if (cleanDbItems.length > 0) {
        const itemsPayload = cleanDbItems.map((item) => ({
          list_id: listId,
          user_id: user.id,
          position: item.position,
          quantity: item.quantity,
          unit: item.unit,
          name: item.name,
          is_checked: item.is_checked,
        }));

        const { error: insertItemsError } = await supabase
          .from('grocery_list_items')
          .insert(itemsPayload);

        if (insertItemsError) throw insertItemsError;
      }

      Alert.alert('Saved', 'Your grocery list was updated.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save grocery list.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingList) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brand.primary} />
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (listNotFound) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>List not found</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

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
              <TouchableOpacity onPress={deleteList}>
                <Ionicons name="trash-outline" size={24} color={colors.text.primary} />
              </TouchableOpacity>

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
              {displayDate}
            </ThemedText>

            <TextInput
              style={[styles.title, { color: colors.text.primary }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title..."
              placeholderTextColor={colors.text.tertiary}
            />

            <TouchableOpacity
              style={[styles.addItemButton, { borderColor: theme.brand.primary }]}
              onPress={addNewItem}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={theme.brand.primary} />
              <ThemedText style={[styles.addItemButtonText, { color: theme.brand.primary }]}>
                Add item
              </ThemedText>
            </TouchableOpacity>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {items.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={{ color: colors.text.tertiary }}>
                    No items yet. Tap “Add item” to start your list.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.categorySection}>
                  <View style={styles.categoryHeaderStatic}>
                    <ThemedText style={[styles.categoryStaticTitle, { color: colors.text.primary }]}>
                      Ingredients
                    </ThemedText>
                  </View>

                  {items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
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

                      <TextInput
                        value={item.quantity ?? ''}
                        onChangeText={(text) => updateItem(item.id, { quantity: text })}
                        placeholder="1"
                        placeholderTextColor={colors.text.tertiary}
                        style={[
                          styles.qtyInput,
                          {
                            backgroundColor: colors.input.background,
                            borderColor: colors.border.default,
                            color: colors.text.primary,
                          },
                        ]}
                      />

                      <TextInput
                        value={item.unit ?? ''}
                        onChangeText={(text) => updateItem(item.id, { unit: text })}
                        placeholder="unit"
                        placeholderTextColor={colors.text.tertiary}
                        style={[
                          styles.unitInput,
                          {
                            backgroundColor: colors.input.background,
                            borderColor: colors.border.default,
                            color: colors.text.primary,
                          },
                        ]}
                      />

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
                        ]}
                        onSubmitEditing={addNewItem}
                        returnKeyType="next"
                        blurOnSubmit={false}
                      />

                      <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.rowIconButton}>
                        <Ionicons name="remove-circle-outline" size={20} color={colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

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
    marginBottom: theme.spacing.md,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: theme.spacing.md,
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: theme.spacing.lg,
  },
  categorySection: {
    marginBottom: theme.spacing.lg,
  },
  categoryHeaderStatic: {
    marginBottom: theme.spacing.sm,
  },
  categoryStaticTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  qtyInput: {
    width: 48,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  unitInput: {
    width: 64,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  itemText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
    minHeight: 36,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  rowIconButton: {
    padding: 2,
  },
  listContent: {
    paddingBottom: theme.spacing.xl * 3,
  },
});
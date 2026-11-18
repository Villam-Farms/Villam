import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@farm_app/grocery_lists_v1';
// Legacy lists have no owner: retain them for guest use, never assign them to an account.
const storageKey = (userId?: string | null) => userId
  ? `${STORAGE_KEY}:user:${userId}`
  : STORAGE_KEY;

type TextStyle = {
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
};

export type LocalGroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  quantity?: string | null;
  unit?: string | null;
  category?: string | null;
  isPinned?: boolean;
  sortOrder?: number;
  textStyle?: TextStyle;
};

export type LocalGroceryList = {
  id: string;
  title: string;
  date?: string;
  isPinned?: boolean;
  itemCount: number;
  checkedCount: number;
  items: LocalGroceryItem[];
  updatedAt: number;
};

export type SaveLocalGroceryListInput = {
  id?: string;
  title: string;
  date?: string;
  isPinned?: boolean;
  items: LocalGroceryItem[];
};

const formatDateLabel = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

const sortLists = (lists: LocalGroceryList[]) =>
  [...lists].sort((a: LocalGroceryList, b: LocalGroceryList) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

const normalizeItem = (item: unknown, index: number): LocalGroceryItem => {
  const safeItem = (item ?? {}) as Partial<LocalGroceryItem>;

  return {
    id: String(safeItem.id ?? `${Date.now()}-${index}`),
    name: String(safeItem.name ?? '').trim(),
    checked: Boolean(safeItem.checked),
    quantity: safeItem.quantity ?? null,
    unit: safeItem.unit ?? null,
    category: safeItem.category ?? null,
    isPinned: Boolean(safeItem.isPinned),
    sortOrder: typeof safeItem.sortOrder === 'number' ? safeItem.sortOrder : index,
    textStyle: safeItem.textStyle ?? {},
  };
};

const normalizeList = (list: unknown): LocalGroceryList => {
  const safeList = (list ?? {}) as Partial<LocalGroceryList> & {
    items?: unknown[];
  };

  const rawItems: unknown[] = Array.isArray(safeList.items) ? safeList.items : [];
  const items: LocalGroceryItem[] = rawItems.map(
    (item: unknown, index: number) => normalizeItem(item, index)
  );

  return {
    id: String(safeList.id ?? `${Date.now()}`),
    title: String(safeList.title ?? '').trim(),
    date: safeList.date ?? formatDateLabel(),
    isPinned: Boolean(safeList.isPinned),
    itemCount: items.length,
    checkedCount: items.filter((item: LocalGroceryItem) => item.checked).length,
    items,
    updatedAt:
      typeof safeList.updatedAt === 'number' && Number.isFinite(safeList.updatedAt)
        ? safeList.updatedAt
        : Date.now(),
  };
};

const readAll = async (userId?: string | null): Promise<LocalGroceryList[]> => {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((list: unknown) => normalizeList(list));
  } catch {
    return [];
  }
};

const writeAll = async (lists: LocalGroceryList[], userId?: string | null) => {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(lists));
};

export async function getLocalGroceryLists(userId?: string | null): Promise<LocalGroceryList[]> {
  const lists = await readAll(userId);
  return sortLists(lists);
}

export async function getLocalGroceryListById(id: string, userId?: string | null): Promise<LocalGroceryList | null> {
  const lists = await readAll(userId);
  return lists.find((list: LocalGroceryList) => list.id === id) ?? null;
}

export async function saveLocalGroceryList(
  input: SaveLocalGroceryListInput,
  userId?: string | null
): Promise<LocalGroceryList> {
  const lists = await readAll(userId);
  const existing = input.id
    ? lists.find((list: LocalGroceryList) => list.id === input.id)
    : undefined;

  const id = input.id ?? `${Date.now()}`;
  const now = Date.now();

  const sourceItems: LocalGroceryItem[] = Array.isArray(input.items) ? input.items : [];

  const items: LocalGroceryItem[] = sourceItems
    .map((item: LocalGroceryItem, index: number) => normalizeItem(item, index))
    .filter((item: LocalGroceryItem) => item.name.length > 0);

  const saved: LocalGroceryList = {
    id,
    title: input.title.trim(),
    date: input.date ?? existing?.date ?? formatDateLabel(),
    isPinned: input.isPinned ?? existing?.isPinned ?? false,
    items,
    itemCount: items.length,
    checkedCount: items.filter((item: LocalGroceryItem) => item.checked).length,
    updatedAt: now,
  };

  const nextLists = existing
    ? lists.map((list: LocalGroceryList) => (list.id === id ? saved : list))
    : [...lists, saved];

  await writeAll(nextLists, userId);
  return saved;
}

export async function deleteLocalGroceryList(id: string, userId?: string | null): Promise<void> {
  const lists = await readAll(userId);
  const nextLists = lists.filter((list: LocalGroceryList) => list.id !== id);
  await writeAll(nextLists, userId);
}
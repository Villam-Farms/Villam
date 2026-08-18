import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteLocalGroceryList, getLocalGroceryListById, getLocalGroceryLists, saveLocalGroceryList } from "@/lib/local-grocery-lists";

describe("local grocery lists", () => {
  beforeEach(async () => AsyncStorage.clear());
  test("creates and normalizes a list", async () => {
    const saved = await saveLocalGroceryList({ title: " Market ", items: [{ id: "1", name: " Apples ", checked: true }] });
    expect(saved).toMatchObject({ title: "Market", itemCount: 1, checkedCount: 1 });
    expect(saved.items[0].name).toBe("Apples");
  });
  test("drops blank items", async () => expect((await saveLocalGroceryList({ title: "List", items: [{ id: "1", name: "  ", checked: false }] })).items).toEqual([]));
  test("updates an existing list instead of duplicating it", async () => {
    const first = await saveLocalGroceryList({ title: "One", items: [] });
    await saveLocalGroceryList({ id: first.id, title: "Two", items: [] });
    expect(await getLocalGroceryLists()).toHaveLength(1);
    expect((await getLocalGroceryLists())[0].title).toBe("Two");
  });
  test("returns a list by id", async () => { const saved = await saveLocalGroceryList({ title: "One", items: [] }); expect((await getLocalGroceryListById(saved.id))?.title).toBe("One"); });
  test("deletes a list", async () => { const saved = await saveLocalGroceryList({ title: "One", items: [] }); await deleteLocalGroceryList(saved.id); expect(await getLocalGroceryLists()).toEqual([]); });
  test("handles malformed storage", async () => { await AsyncStorage.setItem("@farm_app/grocery_lists_v1", "not-json"); expect(await getLocalGroceryLists()).toEqual([]); });
  test("handles non-array storage", async () => { await AsyncStorage.setItem("@farm_app/grocery_lists_v1", JSON.stringify({})); expect(await getLocalGroceryLists()).toEqual([]); });
  test("normalizes legacy and incomplete stored data", async () => {
    await AsyncStorage.setItem("@farm_app/grocery_lists_v1", JSON.stringify([
      { id: "old", title: null, isPinned: true, updatedAt: Infinity, items: [null, { name: " Pear ", checked: 1, sortOrder: 4, quantity: "2", textStyle: { bold: true } }] },
      { id: "newer", title: "Recent", isPinned: false, updatedAt: 20, items: "bad" },
    ]));
    const lists = await getLocalGroceryLists();
    expect(lists[0].id).toBe("old");
    expect(lists[0].items[0]).toMatchObject({ name: "", checked: false, quantity: null, unit: null, category: null, isPinned: false, sortOrder: 0, textStyle: {} });
    expect(lists[0].items[1]).toMatchObject({ name: "Pear", sortOrder: 4 });
  });
  test("sorts unpinned lists by update time and returns null for unknown ids", async () => {
    await AsyncStorage.setItem("@farm_app/grocery_lists_v1", JSON.stringify([{ id: "a", title: "A", updatedAt: 1, items: [] }, { id: "b", title: "B", updatedAt: 2, items: [] }]));
    expect((await getLocalGroceryLists()).map((x) => x.id)).toEqual(["b", "a"]);
    await expect(getLocalGroceryListById("missing")).resolves.toBeNull();
  });
  test("preserves existing date and pin state while accepting invalid items", async () => {
    const first = await saveLocalGroceryList({ id: "same", title: "One", date: "Yesterday", isPinned: true, items: [] });
    const updated = await saveLocalGroceryList({ id: first.id, title: "Two", items: null as any });
    expect(updated).toMatchObject({ date: "Yesterday", isPinned: true, items: [] });
  });
});

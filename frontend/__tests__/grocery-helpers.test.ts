import { buildCategories, createDraftCategoryKey, createEmptyItem, displayCategoryName, isPersistedCategory } from "@/lib/grocery-list-detail/helpers";

describe("grocery helpers", () => {
  const items: any[] = [
    { id: "1", name: "Apple", category: "Fruit" },
    { id: "2", name: "Milk", category: null },
    { id: "3", name: "Pear", category: "Fruit" },
  ];
  test("groups categorized and uncategorized items", () => { const groups = buildCategories(items, {}); expect(groups.map((x) => x.name)).toEqual([null, "Fruit"]); expect(groups[1].items).toHaveLength(2); });
  test("applies collapsed state", () => expect(buildCategories(items, { Fruit: true })[1].isCollapsed).toBe(true));
  test("hides draft category names", () => expect(displayCategoryName("__newcat_123")).toBe(""));
  test("recognizes persisted categories", () => { expect(isPersistedCategory("Fruit")).toBe(true); expect(isPersistedCategory(null)).toBe(false); });
  test("creates empty items and draft category keys", () => {
    expect(createEmptyItem()).toMatchObject({ name: "", checked: false, category: "Category 1", isPinned: false, textStyle: {} });
    expect(createEmptyItem(null).category).toBeUndefined();
    expect(createDraftCategoryKey()).toMatch(/^__newcat_/);
  });
  test("shows normal category names and rejects draft or blank categories", () => {
    expect(displayCategoryName("Fruit")).toBe("Fruit");
    expect(isPersistedCategory("")).toBe(false);
    expect(isPersistedCategory("__newcat_2")).toBe(false);
  });
});

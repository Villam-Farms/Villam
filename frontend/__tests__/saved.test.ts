const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));

import { deleteSavedSearch, fetchSavedItems, fetchSavedSearches, renameSavedSearch, saveSearch, savedSearchName, setItemSaved } from "@/lib/saved";

describe("saved data", () => {
  beforeEach(() => mockFrom.mockReset());

  test("fetches newest saved items first", async () => {
    const rows = [{ id: "1" }];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const select = jest.fn(() => ({ order }));
    mockFrom.mockReturnValue({ select });
    await expect(fetchSavedItems()).resolves.toEqual(rows);
    expect(mockFrom).toHaveBeenCalledWith("saved_items");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  test("upserts a favorite using its composite identity", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert });
    await setItemSaved("user", "farm", "farm-1", true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user", item_type: "farm", item_id: "farm-1" }), { onConflict: "user_id,item_type,item_id" });
  });

  test("deletes only the requested user's favorite", async () => {
    const finalEq = jest.fn().mockResolvedValue({ error: null });
    const secondEq = jest.fn(() => ({ eq: finalEq }));
    const firstEq = jest.fn(() => ({ eq: secondEq }));
    mockFrom.mockReturnValue({ delete: () => ({ eq: firstEq }) });
    await setItemSaved("user", "recipe", "recipe-1", false);
    expect(firstEq).toHaveBeenCalledWith("user_id", "user");
    expect(secondEq).toHaveBeenCalledWith("item_type", "recipe");
    expect(finalEq).toHaveBeenCalledWith("item_id", "recipe-1");
  });

  test("returns an existing identical saved search", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: "existing" }, error: null });
    const chain: any = { eq: jest.fn(() => chain), maybeSingle };
    mockFrom.mockReturnValue({ select: () => chain });
    await expect(saveSearch("user", "produce", " apple ", { category: "All" })).resolves.toEqual({ id: "existing" });
  });

  test("builds readable default names", () => expect(savedSearchName("home", "berries")).toBe("Home: berries"));

  test("fetches searches and normalizes missing data", async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ select: () => ({ order }) });
    await expect(fetchSavedSearches()).resolves.toEqual([]);
  });

  test("creates a normalized marketplace search", async () => {
    const findChain: any = { eq: jest.fn(() => findChain), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
    const single = jest.fn().mockResolvedValue({ data: { id: "new" }, error: null });
    mockFrom.mockReturnValue({ select: () => findChain, insert: jest.fn(() => ({ select: () => ({ single }) })) });
    await expect(saveSearch("u", "marketplace", " carrots ", { category: " Roots " })).resolves.toEqual({ id: "new" });
    expect(savedSearchName("marketplace", "carrots", { category: "Roots" })).toBe("Marketplace: carrots · Roots");
    expect(savedSearchName("produce", "", {})).toBe("Produce");
  });

  test.each([
    ["fetch items", () => fetchSavedItems(), { select: () => ({ order: async () => ({ data: null, error: new Error("items") }) }) }],
    ["fetch searches", () => fetchSavedSearches(), { select: () => ({ order: async () => ({ data: null, error: new Error("searches") }) }) }],
    ["save item", () => setItemSaved("u", "farm", "f", true), { upsert: async () => ({ error: new Error("upsert") }) }],
  ])("propagates %s errors", async (_name, run, query) => {
    mockFrom.mockReturnValue(query);
    await expect(run()).rejects.toThrow();
  });

  test("propagates search lookup and insertion errors", async () => {
    const badFind: any = { eq: jest.fn(() => badFind), maybeSingle: async () => ({ data: null, error: new Error("find") }) };
    mockFrom.mockReturnValueOnce({ select: () => badFind });
    await expect(saveSearch("u", "home", "x")).rejects.toThrow("find");
    const find: any = { eq: jest.fn(() => find), maybeSingle: async () => ({ data: null, error: null }) };
    mockFrom.mockReturnValue({ select: () => find, insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("insert") }) }) }) });
    await expect(saveSearch("u", "home", "x")).rejects.toThrow("insert");
  });

  test("renames and deletes searches", async () => {
    const renameEq = jest.fn().mockResolvedValue({ error: null });
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ update: jest.fn(() => ({ eq: renameEq })) }).mockReturnValueOnce({ delete: jest.fn(() => ({ eq: deleteEq })) });
    await renameSavedSearch("s1", " New name ");
    await deleteSavedSearch("s1");
    expect(renameEq).toHaveBeenCalledWith("id", "s1");
    expect(deleteEq).toHaveBeenCalledWith("id", "s1");
  });

  test("propagates rename and delete errors", async () => {
    mockFrom.mockReturnValueOnce({ update: () => ({ eq: async () => ({ error: new Error("rename") }) }) });
    await expect(renameSavedSearch("s", "name")).rejects.toThrow("rename");
    mockFrom.mockReturnValueOnce({ delete: () => ({ eq: async () => ({ error: new Error("delete") }) }) });
    await expect(deleteSavedSearch("s")).rejects.toThrow("delete");
  });
});

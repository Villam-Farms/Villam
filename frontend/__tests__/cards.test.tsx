import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockRouterPush = jest.fn();
const mockSaveButton = jest.fn((_props: unknown) => null);

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: "IconSymbol" }));
jest.mock("@/components/save-button", () => ({ SaveButton: (props: unknown) => mockSaveButton(props) }));
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockRouterPush(...args) } }));
jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      surface: "#fff", background: "#fff", card: "#eee",
      text: { primary: "#111", secondary: "#555", tertiary: "#777" },
      border: { light: "#ddd", default: "#ccc", strong: "#aaa" },
      icon: { default: "#666" }, input: { background: "#eee" },
    },
  }),
}));

import FarmCard from "@/components/ui/farmcard";
import { GroceryListCard } from "@/components/ui/grocerylist/GroceryListCard";
import { RecipeCard } from "@/components/ui/recipes/recipecard";

describe("FarmCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders farm data, image, saved control, and actions", async () => {
    const onPress = jest.fn();
    const onDirectionPress = jest.fn();
    const onSharePress = jest.fn();
    const screen = await render(<FarmCard
      id="f1" name="Ada Farm" rating={4.26} reviews={12} distance="2 mi"
      products="Kale, apples" imageUrl="https://img.test/farm.jpg"
      onPress={onPress} onDirectionPress={onDirectionPress} onSharePress={onSharePress}
    />);
    expect(screen.getByText("4.3 (12)")).toBeTruthy();
    expect(screen.getByText("📍 2 mi")).toBeTruthy();
    expect(screen.getByText("Kale, apples")).toBeTruthy();
    expect(mockSaveButton).toHaveBeenCalledWith({ type: "farm", itemId: "f1", size: 18 });
    await fireEvent.press(screen.getByLabelText("Open Ada Farm"));
    await fireEvent.press(screen.getByLabelText("Directions to Ada Farm"));
    await fireEvent.press(screen.getByLabelText("Share Ada Farm"));
    expect(onPress).toHaveBeenCalled();
    expect(onDirectionPress).toHaveBeenCalled();
    expect(onSharePress).toHaveBeenCalled();
  });

  it.each([false, true])("supports legacy favorite state %s without an id", async (isFavorite) => {
    const onFavoritePress = jest.fn();
    const screen = await render(<FarmCard
      name="Legacy Farm" rating={0} reviews={0} distance="Far" products=""
      isFavorite={isFavorite} onFavoritePress={onFavoritePress}
    />);
    await fireEvent.press(screen.getByLabelText(isFavorite ? "Remove favorite farm" : "Favorite farm"));
    expect(onFavoritePress).toHaveBeenCalled();
    expect(mockSaveButton).not.toHaveBeenCalled();
  });
});

describe("GroceryListCard", () => {
  beforeEach(() => jest.clearAllMocks());
  const items = [
    { id: "1", name: "Milk", quantity: "2", checked: true, isPinned: true },
    { id: "2", name: "Eggs", checked: false },
    { id: "3", name: "Bread", checked: false },
    { id: "4", name: "Kale", checked: false },
    { id: "5", name: "Apples", checked: false },
  ];

  it("previews four items, statuses, pins, and remaining count", async () => {
    const screen = await render(<GroceryListCard list={{ id: "g1", title: "Weekly", date: "Today", isPinned: true, items } as any} />);
    expect(screen.getByText("2 Milk")).toBeTruthy();
    expect(screen.getByText("Eggs")).toBeTruthy();
    expect(screen.queryByText("Apples")).toBeNull();
    expect(screen.getByText("... and 1 more")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Open Weekly"));
    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: "/grocery-list/[id]", params: { id: "g1" } });
    await fireEvent.press(screen.getByLabelText("Options for Weekly"));
  });

  it("renders an empty unpinned list without a remaining count", async () => {
    const screen = await render(<GroceryListCard list={{ id: "g2", title: "Empty", date: "Tomorrow", isPinned: false, items: [] } as any} />);
    expect(screen.getByText("Empty")).toBeTruthy();
    expect(screen.queryByText(/and .* more/)).toBeNull();
  });
});

describe("RecipeCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders an image, plural overall rating, user rating, difficulty, and edit action", async () => {
    const onPress = jest.fn();
    const onEdit = jest.fn();
    const screen = await render(<RecipeCard
      id="r1" title="Watermelon Salad" averageRating={4.75} ratingsCount={1200}
      currentUserRating={5} duration="35 min" difficulty=" Easy " imageUrl="https://img.test/r.jpg"
      isOwner onPress={onPress} onEdit={onEdit}
    />);
    expect(screen.getByText("4.8 overall (1,200 ratings)")).toBeTruthy();
    expect(screen.getByText("Your rating: 5/5")).toBeTruthy();
    expect(screen.getByText("35 min •  Easy ")).toBeTruthy();
    expect(mockSaveButton).toHaveBeenCalledWith({ type: "recipe", itemId: "r1", light: true });
    await fireEvent.press(screen.getByTestId("recipe-card-r1"));
    await fireEvent.press(screen.getByText("Edit"));
    expect(onPress).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
  });

  it("uses singular rating and legacy rating fallback", async () => {
    const screen = await render(<RecipeCard id="r2" title="Soup" rating={3} ratingsCount={1} duration="20 min" />);
    expect(screen.getByText("3.0 overall (1 rating)")).toBeTruthy();
    expect(screen.getByText("You haven't rated this yet")).toBeTruthy();
    expect(screen.getByText("20 min")).toBeTruthy();
  });

  it("shows unrated placeholders without optional edit and image", async () => {
    const screen = await render(<RecipeCard id="r3" title="Toast" duration="5 min" difficulty="   " isOwner />);
    expect(screen.getByText("No ratings yet")).toBeTruthy();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(mockSaveButton).toHaveBeenCalledWith({ type: "recipe", itemId: "r3", light: false });
  });

  it("falls back to the placeholder after image failure", async () => {
    const screen = await render(<RecipeCard id="r4" title="Pie" duration="1 hr" imageUrl="bad.jpg" />);
    await fireEvent(screen.getByTestId("recipe-image-r4"), "error");
    await waitFor(() => expect(screen.queryByTestId("recipe-image-r4")).toBeNull());
    expect(mockSaveButton).toHaveBeenLastCalledWith({ type: "recipe", itemId: "r4", light: false });
  });
});

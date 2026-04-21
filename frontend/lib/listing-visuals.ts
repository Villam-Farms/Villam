export type ListingVisualIcon =
  | "leaf-outline"
  | "nutrition-outline"
  | "flower-outline"
  | "sunny-outline";

export type ListingVisuals = {
  color: string;
  badgeColor: string;
  badgeTextColor: string;
  farmDotColor: string;
  icon: ListingVisualIcon;
};

const DEFAULT_LISTING_VISUALS: ListingVisuals = {
  color: "#E9F0D8",
  badgeColor: "#D2E1A7",
  badgeTextColor: "#35511A",
  farmDotColor: "#6A8F2A",
  icon: "leaf-outline",
};

export function getListingVisuals(category: string | null | undefined): ListingVisuals {
  const normalizedCategory = category?.trim().toLowerCase() ?? "";

  if (
    normalizedCategory.includes("leaf") ||
    normalizedCategory.includes("green") ||
    normalizedCategory.includes("lettuce") ||
    normalizedCategory.includes("spinach") ||
    normalizedCategory.includes("kale") ||
    normalizedCategory.includes("chard") ||
    normalizedCategory.includes("arugula") ||
    normalizedCategory.includes("microgreen")
  ) {
    return {
      color: "#DDF2D7",
      badgeColor: "#B9DF9E",
      badgeTextColor: "#204D20",
      farmDotColor: "#4D8A37",
      icon: "leaf-outline",
    };
  }

  if (
    normalizedCategory.includes("fruit") ||
    normalizedCategory.includes("berry") ||
    normalizedCategory.includes("citrus") ||
    normalizedCategory.includes("melon") ||
    normalizedCategory.includes("stone fruit")
  ) {
    return {
      color: "#FFE5C4",
      badgeColor: "#F6C98B",
      badgeTextColor: "#6A3A00",
      farmDotColor: "#B86A13",
      icon: "sunny-outline",
    };
  }

  if (normalizedCategory.includes("herb")) {
    return {
      color: "#E3F5E8",
      badgeColor: "#BDE3BE",
      badgeTextColor: "#21533A",
      farmDotColor: "#4E936B",
      icon: "flower-outline",
    };
  }

  if (
    normalizedCategory.includes("root") ||
    normalizedCategory.includes("carrot") ||
    normalizedCategory.includes("beet") ||
    normalizedCategory.includes("radish") ||
    normalizedCategory.includes("turnip")
  ) {
    return {
      color: "#F5E2CC",
      badgeColor: "#EAC79D",
      badgeTextColor: "#6E421C",
      farmDotColor: "#A2672B",
      icon: "nutrition-outline",
    };
  }

  if (
    normalizedCategory.includes("egg") ||
    normalizedCategory.includes("dairy") ||
    normalizedCategory.includes("milk") ||
    normalizedCategory.includes("cheese")
  ) {
    return {
      color: "#FFF1CC",
      badgeColor: "#F3E0A0",
      badgeTextColor: "#6A5610",
      farmDotColor: "#B5962D",
      icon: "sunny-outline",
    };
  }

  return DEFAULT_LISTING_VISUALS;
}

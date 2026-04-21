import { addDistanceAndSort, type Coords } from "@/lib/location";
import { getListingVisuals, type ListingVisualIcon } from "@/lib/listing-visuals";
import type { MarketplaceListing } from "@/lib/marketplace";

export type ListingCategory = "All" | string;

export type ListingRow = {
  id: string;
  name: string;
  unit: string;
  price: string;
  note: string;
  color: string;
  badgeColor: string;
  badgeTextColor: string;
  farmDotColor: string;
  category: ListingCategory;
  icon: ListingVisualIcon;
  farmId: number;
  farmName: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

export function addDistanceToListings(
  listings: MarketplaceListing[],
  userCoords: Coords | null
) {
  const farmsWithDistance = addDistanceAndSort(
    listings.map((listing) => ({
      id: listing.farmId,
      name: listing.farmName,
      rating: 0,
      reviews: 0,
      products: "",
      latitude: listing.latitude,
      longitude: listing.longitude,
      city: listing.city,
      state: listing.state,
      postal_code: listing.postal_code,
      country: listing.country,
      street: null,
    })),
    userCoords
  );

  const distanceMap = new Map<number, number | null>(
    farmsWithDistance.map((farm) => [farm.id, farm.distanceMi])
  );

  return [...listings].sort(
    (left, right) =>
      (distanceMap.get(left.farmId) ?? Number.POSITIVE_INFINITY) -
      (distanceMap.get(right.farmId) ?? Number.POSITIVE_INFINITY)
  );
}

export function buildListingRows(
  marketplaceListings: MarketplaceListing[],
  userCoords: Coords | null
): ListingRow[] {
  return addDistanceToListings(marketplaceListings, userCoords).map((listing) => {
    const visuals = getListingVisuals(listing.category);

    return {
      id: listing.id,
      name: listing.produceItemName,
      price: `${listing.currency} ${listing.price.toFixed(2)}`,
      unit: `Sold by ${listing.soldBy}`,
      note: listing.varietyDescription?.trim() || `Variety: ${listing.varietyName}`,
      color: visuals.color,
      icon: visuals.icon,
      badgeColor: visuals.badgeColor,
      badgeTextColor: visuals.badgeTextColor,
      farmDotColor: visuals.farmDotColor,
      category: listing.category,
      farmId: listing.farmId,
      farmName: listing.farmName,
      latitude: listing.latitude,
      longitude: listing.longitude,
      city: listing.city,
      state: listing.state,
      postal_code: listing.postal_code,
      country: listing.country,
    };
  });
}

export function filterListingRows(
  listings: ListingRow[],
  activeFilter: ListingCategory,
  searchQuery: string
) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const categoryFiltered =
    activeFilter === "All"
      ? listings
      : listings.filter((listing) => listing.category === activeFilter);

  if (!normalizedSearchQuery) return categoryFiltered;

  return categoryFiltered.filter((listing) =>
    [
      listing.name,
      listing.category,
      listing.note,
      listing.farmName,
      listing.city,
      listing.state,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .some((value) => value.toLowerCase().includes(normalizedSearchQuery))
  );
}

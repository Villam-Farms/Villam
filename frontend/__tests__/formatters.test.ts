import { formatAddress } from "@/lib/address";
import { getProfileDisplay } from "@/lib/profile-display";
import { savedSearchName } from "@/lib/saved";

describe("formatters", () => {
  test("formats complete addresses", () => expect(formatAddress({ street: "1 Main", city: "Davis", state: "CA", postal_code: "95616", country: "USA" })).toBe("1 Main Davis, CA, 95616 USA"));
  test("omits empty address fields", () => expect(formatAddress({ city: "Davis", state: null })).toBe("Davis"));
  test("prefers profile full name and creates initials", () => expect(getProfileDisplay({ full_name: "Ada Lovelace", username: "ada" } as any, undefined, "x@y.com")).toMatchObject({ displayName: "Ada Lovelace", initials: "AL" }));
  test("falls back to email name", () => expect(getProfileDisplay(null, undefined, "grower@example.com").displayName).toBe("grower"));
  test("names marketplace searches with query and category", () => expect(savedSearchName("marketplace", "tomato", { category: "Vegetables" })).toBe("Marketplace: tomato · Vegetables"));
  test("omits the All category", () => expect(savedSearchName("produce", "apple", { category: "All" })).toBe("Produce: apple"));
});

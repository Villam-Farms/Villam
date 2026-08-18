import { Linking, Platform, Share } from "react-native";

const mockCreateURL = jest.fn();
jest.mock("expo-linking", () => ({ createURL: (...args: unknown[]) => mockCreateURL(...args) }));

import { openDirections } from "@/lib/directions";
import { shareFarm, shareFarmLink } from "@/lib/share-farm";

describe("navigation and farm sharing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
    mockCreateURL.mockReturnValue("villam://farm/f1");
  });

  it.each([
    ["ios", "http://maps.apple.com/?daddr=12%20Main%2C%20CA"],
    ["android", "https://www.google.com/maps/dir/?api=1&destination=12%20Main%2C%20CA"],
  ])("opens platform directions on %s", async (os, expected) => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: os });
    await openDirections("12 Main, CA");
    expect(Linking.openURL).toHaveBeenCalledWith(expected);
  });

  it("shares a deep link with a trimmed location", async () => {
    await shareFarmLink({ id: "f1", name: "Ada Farm", location: " Oakland " });
    expect(mockCreateURL).toHaveBeenCalledWith("/farm/f1", { scheme: "villam" });
    expect(Share.share).toHaveBeenCalledWith({
      title: "Ada Farm",
      message: "Check out Ada Farm on Villam.\nLocation: Oakland\nvillam://farm/f1",
      url: "villam://farm/f1",
    });
  });

  it.each([undefined, null, "   "])("omits an empty location", async (location) => {
    await shareFarmLink({ id: "f1", name: "Farm", location });
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      message: "Check out Farm on Villam.\nvillam://farm/f1",
    }));
  });

  it("shares a farm's formatted address", async () => {
    await shareFarm({
      id: "f1", name: "Farm", street: "1 Main", city: "Oakland", state: "CA",
      postal_code: "94601", country: "US", latitude: 1, longitude: 2,
    } as any);
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Location: 1 Main Oakland, CA, 94601 US"),
    }));
  });

  it("falls back to coordinates when a farm has no address", async () => {
    await shareFarm({ id: "f2", name: "Farm", latitude: 12.3, longitude: -45.6 } as any);
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Location: 12.3, -45.6"),
    }));
  });
});

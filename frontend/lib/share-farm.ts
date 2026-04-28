import { Share } from "react-native";
import * as Linking from "expo-linking";

import { formatAddress } from "@/lib/address";
import type { FarmWithCoords } from "@/lib/location";

type ShareFarmLinkInput = {
  id: number;
  name: string;
  location?: string | null;
};

export async function shareFarmLink(input: ShareFarmLinkInput): Promise<void> {
  const farmUrl = Linking.createURL(`/farm/${input.id}`, { scheme: "villam" });
  const location = input.location?.trim() ?? "";
  const locationLine = location ? `\nLocation: ${location}` : "";

  await Share.share({
    title: input.name,
    message: `Check out ${input.name} on Villam.${locationLine}\n${farmUrl}`,
    url: farmUrl,
  });
}

export async function shareFarm(farm: FarmWithCoords): Promise<void> {
  const address = formatAddress(farm).trim();
  const location = address.length > 0 ? address : `${farm.latitude}, ${farm.longitude}`;

  await shareFarmLink({
    id: farm.id,
    name: farm.name,
    location,
  });
}

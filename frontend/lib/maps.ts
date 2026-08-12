export const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

export const hasGoogleMapsApiKey = googleMapsApiKey.length > 0;

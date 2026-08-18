const appJson = require("./app.json");

const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  undefined;

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: googleMapsApiKey
        ? {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          }
        : undefined,
    },
  },
};

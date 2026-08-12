import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { useOnboarding } from "@/context/onboarding-context";

export default function LocationStep() {
  "use no memo";
  const { draft, update } = useOnboarding(); const [error, setError] = useState("");

  const locate = async () => { const permission = await Location.requestForegroundPermissionsAsync(); if (permission.status !== "granted") return Alert.alert("Location permission needed", "Allow location access while using the app to auto-fill your city and region."); try { const pos = await Location.getCurrentPositionAsync({}); const place = (await Location.reverseGeocodeAsync(pos.coords))[0]; if (!place?.city || !place.region) throw new Error(); update({ city: place.city, region: place.region }); } catch { Alert.alert("Location unavailable", "Add your city and region manually."); } };
  const next = () => { if (!draft.city.trim() || !draft.region.trim()) return setError("Enter both your city and region."); setError(""); router.replace("/(onboarding)/goals" as never); };
  return <OnboardingScreen step={2} title="What’s local to you?" subtitle="We save only your city and region—not precise coordinates." back="/(onboarding)/profile" next={next} nextHref={draft.city.trim() && draft.region.trim() ? "/(onboarding)/goals" : undefined} error={error}>
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: "#6B7280", fontSize: 14, lineHeight: 20 }}>
        {Platform.OS === "ios" || Platform.OS === "android"
          ? "Allow location access while using the app to auto-fill your city and region. Only city and region are saved."
          : "Share your location to auto-fill city and region."
        }
      </Text>
    </View>
    <Button variant="outline" onPress={locate}>Use my current location</Button>
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: "#6B7280", fontSize: 14, lineHeight: 20 }}>
        {Platform.OS === "ios" || Platform.OS === "android"
          ? "When prompted, choose ‘While Using the App’ so Villam can read your city and region."
          : "When prompted, allow location access to fill in your city and region."
        }
      </Text>
    </View>
    <React.Fragment><Input label="City" value={draft.city} onChangeText={(city) => update({ city })} /><Input label="State or region" value={draft.region} onChangeText={(region) => update({ region })} /></React.Fragment>
  </OnboardingScreen>;
}

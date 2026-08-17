import { Stack } from "expo-router";
import React from "react";
import { OnboardingProvider } from "@/context/onboarding-context";

export default function OnboardingLayout() {
  return <OnboardingProvider><Stack screenOptions={{ headerShown: false, gestureEnabled: false }} /></OnboardingProvider>;
}

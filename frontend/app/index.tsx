import { Redirect } from "expo-router";
import React from "react";

import { useAuth } from "@/context/auth-context";

export default function Index() {
  const { session, initialized } = useAuth();

  // Wait for Supabase to restore a persisted session before choosing a route.
  // The AuthGate in _layout handles the profile/onboarding decision afterwards.
  if (!initialized) return null;

  return <Redirect href={session ? "/(tabs)" : "/(auth)/login"} />;
}

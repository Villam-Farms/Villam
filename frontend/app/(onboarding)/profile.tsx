import { router } from "expo-router";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { useOnboarding } from "@/context/onboarding-context";

export default function ProfileStep() {
  "use no memo";
  const { draft, update } = useOnboarding();
  const [error, setError] = useState("");
  const next = () => {
    const username = draft.username.trim().toLowerCase();
    if (!draft.fullName.trim()) return setError("Enter your display name.");
    if (!/^[a-z0-9_]{3,30}$/.test(username)) return setError("Username must use 3–30 lowercase letters, numbers, or underscores.");
    update({ username }); setError(""); router.replace("/(onboarding)/location" as never);
  };
  return <OnboardingScreen step={1} title="Make Villam yours" subtitle="Choose how neighbors will recognize you." next={next} error={error}>
    <Input label="Display name" value={draft.fullName} onChangeText={(fullName) => update({ fullName })} />
    <Input label="Username" value={draft.username} autoCapitalize="none" onChangeText={(username) => { update({ username: username.toLowerCase().replace(/[^a-z0-9_]/g, "") }); setError(""); }} />
  </OnboardingScreen>;
}

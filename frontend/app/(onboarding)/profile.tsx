import { router } from "expo-router";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { useOnboarding } from "@/context/onboarding-context";
import { debugLog } from "@/lib/debug-log";

export default function ProfileStep() {
  "use no memo";
  const { draft, update } = useOnboarding();
  const [error, setError] = useState("");
  const next = () => {
    const username = draft.username.trim().toLowerCase();
    debugLog({
      runId: "pre-fix",
      hypothesisId: "B,D",
      location: "profile.tsx:next:entry",
      message: "profile next invoked",
      data: {
        fullName: draft.fullName,
        username: draft.username,
        usernameValid: /^[a-z0-9_]{3,30}$/.test(username),
      },
    });
    if (!draft.fullName.trim()) {
      debugLog({
        runId: "pre-fix",
        hypothesisId: "B,D",
        location: "profile.tsx:next:validationFail",
        message: "profile validation failed: missing fullName",
        data: {},
      });
      return setError("Enter your display name.");
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      debugLog({
        runId: "pre-fix",
        hypothesisId: "B,D",
        location: "profile.tsx:next:validationFail",
        message: "profile validation failed: invalid username",
        data: { username },
      });
      return setError("Username must use 3–30 lowercase letters, numbers, or underscores.");
    }
    update({ username });
    setError("");
    debugLog({
      runId: "pre-fix",
      hypothesisId: "C",
      location: "profile.tsx:next:navigate",
      message: "profile calling router.replace to location",
      data: {},
    });
    router.replace("/(onboarding)/location" as never);
  };
  return <OnboardingScreen step={1} title="Make Villam yours" subtitle="Choose how neighbors will recognize you." next={next} error={error}>
    <Input label="Display name" value={draft.fullName} onChangeText={(fullName) => update({ fullName })} />
    <Input label="Username" value={draft.username} autoCapitalize="none" onChangeText={(username) => { update({ username: username.toLowerCase().replace(/[^a-z0-9_]/g, "") }); setError(""); }} />
  </OnboardingScreen>;
}

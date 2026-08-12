import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/auth-context";
import { useMyProfile } from "@/hooks/useMyProfile";

export type OnboardingDraft = {
  fullName: string; username: string; city: string; region: string;
  goals: string[]; produce: string[]; photoUri: string; photoRemoteUrl: string;
};

const emptyDraft: OnboardingDraft = { fullName: "", username: "", city: "", region: "", goals: [], produce: [], photoUri: "", photoRemoteUrl: "" };

type Value = {
  draft: OnboardingDraft;
  ready: boolean;
  storageKey: string;
  update: (values: Partial<OnboardingDraft>) => void;
  clear: () => Promise<void>;
};

const Context = createContext<Value | null>(null);

function metadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  "use no memo";
  const { session } = useAuth();
  const { data: profile } = useMyProfile();
  const [draft, setDraft] = useState(emptyDraft);
  const [ready, setReady] = useState(false);
  const userId = session?.user.id ?? "";
  const storageKey = `onboarding-draft:${userId}`;
  const metadata = session?.user.user_metadata as Record<string, unknown> | undefined;
  const googleName = metadataValue(metadata, ["full_name", "name"]);
  const googlePhoto = metadataValue(metadata, ["avatar_url", "picture"]);

  useEffect(() => {
    setReady(false);
  }, [userId]);

  useEffect(() => {
    if (!userId || ready) return;
    if (profile === undefined && !googleName && !googlePhoto) return;

    AsyncStorage.getItem(storageKey).then((stored) => {
      const saved = stored ? JSON.parse(stored) as Partial<OnboardingDraft> : {};
      setDraft({
        ...emptyDraft,
        ...saved,
        fullName: saved.fullName || profile?.full_name || googleName,
        username: saved.username || profile?.username || "",
        city: saved.city || profile?.location_city || "",
        region: saved.region || profile?.location_region || "",
        goals: saved.goals?.length ? saved.goals : profile?.app_goals || [],
        produce: saved.produce?.length ? saved.produce : profile?.produce_interests || [],
        photoRemoteUrl: saved.photoRemoteUrl || profile?.avatar_url || googlePhoto,
      });
    }).finally(() => setReady(true));
  }, [googleName, googlePhoto, profile, ready, storageKey, userId]);

  useEffect(() => {
    if (ready && userId) void AsyncStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, ready, storageKey, userId]);

  const value = useMemo<Value>(() => ({
    draft, ready, storageKey,
    update: (values) => setDraft((current) => ({ ...current, ...values })),
    clear: async () => { await AsyncStorage.removeItem(storageKey); },
  }), [draft, ready, storageKey]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error("useOnboarding must be used within OnboardingProvider");
  return value;
}

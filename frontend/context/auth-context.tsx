import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Linking, Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { clearLocalAuthSession, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type SignUpMetadata = {
  name?: string;
  username?: string;
};

type AuthContextValue = {
  session: Session | null;
  initialized: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (
    email: string,
    password: string,
    metadata?: SignUpMetadata
  ) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isInvalidRefreshTokenError(message?: string | null) {
  if (!message) return false;
  return message.toLowerCase().includes("invalid refresh token");
}

function getAuthRedirectUrl() {
  return AuthSession.makeRedirectUri(
    Platform.OS === "web" ? undefined : { scheme: "villam" }
  );
}

const callbackPromises = new Map<string, Promise<string | null>>();
const completedCallbacks = new Set<string>();

function readCallbackParam(url: URL, name: string) {
  const queryValue = url.searchParams.get(name);
  if (queryValue) return queryValue;

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  return fragment.get(name);
}

async function createSessionFromCallbackUrl(url: string): Promise<string | null> {
  if (completedCallbacks.has(url)) return null;

  const existingPromise = callbackPromises.get(url);
  if (existingPromise) return existingPromise;

  const callbackPromise = (async () => {
    const callbackUrl = new URL(url);
    const callbackError =
      readCallbackParam(callbackUrl, "error_description") ??
      readCallbackParam(callbackUrl, "error");

    if (callbackError) return callbackError;

    const code = readCallbackParam(callbackUrl, "code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) completedCallbacks.add(url);
      return error?.message ?? null;
    }

    const accessToken = readCallbackParam(callbackUrl, "access_token");
    const refreshToken = readCallbackParam(callbackUrl, "refresh_token");
    if (!accessToken || !refreshToken) return null;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!error) completedCallbacks.add(url);
    return error?.message ?? null;
  })();

  callbackPromises.set(url, callbackPromise);
  try {
    return await callbackPromise;
  } finally {
    callbackPromises.delete(url);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!isMounted) return;
      if (error && isInvalidRefreshTokenError(error.message)) {
        await clearLocalAuthSession();
        setSession(null);
        setInitialized(true);
        return;
      }
      if (!error) {
        setSession(data.session ?? null);
      }
      setInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const error = await createSessionFromCallbackUrl(url);
      if (error) console.warn("Unable to complete authentication callback:", error);
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initialized,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signUpWithPassword: async (email, password, metadata) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        return error?.message ?? null;
      },
      signInWithGoogle: async () => {
        const redirectTo = getAuthRedirectUrl();

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: Platform.OS !== "web",
          },
        });

        if (error) return error.message;
        if (!data?.url) return "Unable to start Google sign-in";

        if (Platform.OS === "web") {
          globalThis.location?.assign(data.url);
          return null;
        }

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== "success" || !("url" in result) || !result.url) {
          return "Google sign-in cancelled";
        }

        return createSessionFromCallbackUrl(result.url);
      },
      signOut: async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (!error) {
            setSession(null);
            return null;
          }
        } catch {
          // A device can still log out locally when the Auth server is unreachable.
        }

        try {
          await clearLocalAuthSession();
        } catch {
          return "Unable to clear the saved login from this device";
        }

        setSession(null);
        return null;
      },
    }),
    [initialized, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

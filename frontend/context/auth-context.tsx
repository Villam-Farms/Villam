import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
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
          },
        });
        return error?.message ?? null;
      },
      signInWithGoogle: async () => {
        const redirectTo = AuthSession.makeRedirectUri(
          Platform.OS === "web" ? undefined : { scheme: "villam" }
        );

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

        const callbackUrl = new URL(result.url);
        const callbackError =
          callbackUrl.searchParams.get("error_description") ??
          callbackUrl.searchParams.get("error");

        if (callbackError) return callbackError;

        const code = callbackUrl.searchParams.get("code");
        if (!code) return "Google sign-in did not return an authorization code";

        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

        return sessionError?.message ?? null;
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

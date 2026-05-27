import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const AUTH_CALLBACK_PATH = "login-callback";

function getAuthRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: "villam",
    path: AUTH_CALLBACK_PATH,
  });
}

function getHashParams(url: string) {
  const hash = url.split("#")[1];
  if (!hash) return new URLSearchParams();
  return new URLSearchParams(hash);
}

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
        await supabase.auth.signOut({ scope: "local" });
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

    let active = true;

    const completeAuthFromUrl = async (url: string | null) => {
      if (!url || !active) return;

      try {
        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;

        let error: { message: string } | null = null;

        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          error = result.error;
        } else {
          const hashParams = getHashParams(url);
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (!accessToken || !refreshToken) {
            return;
          }

          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          error = result.error;
        }

        if (error) {
          console.log("Could not create auth session from deep link", error.message);
        }
      } catch (error) {
        console.log("Could not process auth deep link", error);
      }
    };

    Linking.getInitialURL().then(completeAuthFromUrl);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeAuthFromUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
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
            emailRedirectTo: getAuthRedirectUri(),
          },
        });
        return error?.message ?? null;
      },
      signInWithGoogle: async () => {
        const redirectTo =
          Platform.OS === "web" ? AuthSession.makeRedirectUri() : getAuthRedirectUri();

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
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

        const parsed = Linking.parse(result.url);
        const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;

        if (!code) {
          return "Unable to complete Google sign-in";
        }

        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

        return sessionError?.message ?? null;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error && isInvalidRefreshTokenError(error.message)) {
          await supabase.auth.signOut({ scope: "local" });
          return null;
        }
        return error?.message ?? null;
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

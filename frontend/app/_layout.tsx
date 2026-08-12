import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { useMyProfile } from '@/hooks/useMyProfile';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent splash from auto-hiding
SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { session, initialized } = useAuth();
  const { data: profile, isFetching } = useMyProfile();
  const segments = useSegments();
  const router = useRouter();

  const isProfileComplete = Boolean(
    profile?.onboarding_completed_at &&
    profile?.username &&
    profile?.full_name &&
    profile?.avatar_url &&
    profile?.location_city &&
    profile?.location_region &&
    profile?.app_goals?.length &&
    profile?.produce_interests?.length
  );

  useEffect(() => {
    if (!initialized || isFetching) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (session && inAuthGroup) {
      if (isProfileComplete) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)/profile');
      }
      return;
    }

    if (session && !inAuthGroup && !inOnboardingGroup && !isProfileComplete) {
      router.replace('/(onboarding)/profile');
      return;
    }
  }, [initialized, isFetching, isProfileComplete, router, segments, session]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthGate />
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
              <Stack.Screen name="(profile)" options={{ headerShown: false }} />
              <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </GestureHandlerRootView>
      </AuthProvider>
    </QueryClientProvider>
  );
}

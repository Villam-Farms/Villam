// screens/LoginScreen.tsx
import ArtLogin from "@/assets/images/art_login.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AntDesign } from '@expo/vector-icons';
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth-context";

import { authErrorMessage, validAuthEmail } from "@/lib/auth-errors";

export default function Login() {
  const requestPending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { signInWithPassword, signInWithGoogle } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (requestPending.current) return;
    Keyboard.dismiss();
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAuthError("Please fill in all fields");
      return;
    }
    if (!validAuthEmail(cleanEmail)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    requestPending.current = true;
    setSubmitting(true);
    try {
      const error = await signInWithPassword(cleanEmail, password);
      if (error) {
        setAuthError(authErrorMessage(error, "Unable to log in. Please try again."));
        return;
      }
      router.replace("/");
    } catch (error) {
      setAuthError(authErrorMessage(error, "Unable to log in. Please try again."));
    } finally {
      requestPending.current = false;
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    Keyboard.dismiss();
    setAuthError(null);
    setSubmitting(true);
    try {
      const error = await signInWithGoogle();
      if (error) {
        setAuthError(error);
        return;
      }
      router.replace("/(onboarding)/profile");
    } catch (error) {
      setAuthError(authErrorMessage(error, "Unable to sign in with Google. Please try again."));
    } finally {
      requestPending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoidingView}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                isKeyboardVisible && styles.scrollContentWithKeyboard,
              ]}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
            {!isKeyboardVisible && (
              <View style={styles.illustrationWrapper}>
                <ArtLogin width={320} height={240} />
              </View>
            )}

            <Animated.View entering={FadeInUp.delay(300)}>
              <Typography.H2 style={[styles.title, { color: colors.text.primary }]}>
                Let&apos;s sign you in
              </Typography.H2>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(500)}>
              <Typography.H5 style={styles.subtitle} color={colors.text.secondary}>
                Easily find farms near you with built in grocery lists, recipes, and awesome food!
              </Typography.H5>
            </Animated.View>

            {authError && (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.semantic.error, marginTop: 12, marginBottom: 12 }}>
                {authError}
              </Text>
            )}

            <View style={styles.form}>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Button
              variant="primary"
              onPress={handleLogin}
              disabled={submitting}
              style={styles.loginButton}
            >
              {submitting ? "Please wait…" : "Log in"}
            </Button>

            <Typography.H5 style={[styles.divider, { color: colors.text.tertiary }]}>
              Or
            </Typography.H5>

            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: submitting }}
              style={[
                styles.googleButton,
                {
                  borderColor: colors.border.default,
                  backgroundColor: colors.card,
                }
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.googleButtonContent}>
                <AntDesign
                  name="google"
                  size={20}
                  color={colors.text.primary}
                  style={styles.googleIcon}
                />
                <Text style={[styles.googleButtonText, { color: colors.text.primary }]}>
                  {submitting ? "Signing in…" : "Sign in with Google"}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Typography.H5 color={colors.text.secondary}>
                Don&apos;t have an account?{' '}
              </Typography.H5>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
                <Typography.H5 color={theme.brand.primary} style={styles.link}>
                  Create an account
                </Typography.H5>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  scrollContentWithKeyboard: {
    justifyContent: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.h5,
  },
  form: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  loginButton: {
    marginBottom: theme.spacing.sm,
  },
  divider: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: theme.typography.fontSizes.h5,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  link: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  googleButton: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  googleIcon: {
    marginRight: theme.spacing.sm,
  },
  illustrationWrapper: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
});

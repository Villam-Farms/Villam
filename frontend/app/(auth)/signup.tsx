// screens/SignUpScreen.tsx
import ArtSignup from "@/assets/images/art_signup.svg";
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

export default function SignUp() {
  const requestPending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { signUpWithPassword, signInWithGoogle } = useAuth();
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

  const handleSignUp = async () => {
    if (requestPending.current) return;
    Keyboard.dismiss();
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || !name.trim() || !username.trim()) {
      setAuthError("Please fill in all fields");
      return;
    }
    if (!validAuthEmail(cleanEmail)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Use a password with at least 6 characters.");
      return;
    }
    requestPending.current = true;
    setSubmitting(true);
    try {
      const error = await signUpWithPassword(cleanEmail, password, { name: name.trim(), username: username.trim() });
      if (error) {
        setAuthError(authErrorMessage(error, "Unable to create your account. Please try again."));
        return;
      }
      alert("Check your email to confirm your account.");
      router.replace("/(auth)/login");
    } catch (error) {
      setAuthError(authErrorMessage(error, "Unable to create your account. Please try again."));
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
                <ArtSignup width={320} height={180}/>
              </View>
            )}

            {/* Title */}
            <Animated.View entering={FadeInUp.delay(300)}>
              <Typography.H2 style={[styles.title, { color: colors.text.primary }]}>
                Create An Account
              </Typography.H2>
            </Animated.View>
            
            <Animated.View entering={FadeInUp.delay(500)}>
              <Typography.H5 style={styles.subtitle} color={colors.text.secondary}>
                Easily find farms near you with built in grocery lists, recipes, and awesome food!
              </Typography.H5>
            </Animated.View>

            {/* Form */}
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
                returnKeyType="next"
              />

              <Input 
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                returnKeyType="next"
              />
              
              <Input
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>

            {/* Sign Up Button */}
            <Button
              variant="primary"
              onPress={handleSignUp}
              disabled={submitting}
              style={styles.signUpButton}
            >
              {submitting ? "Please wait…" : "Sign Up"}
            </Button>

            {/* Divider */}
            <Typography.H5 style={[styles.divider, { color: colors.text.tertiary }]}>
              Or
            </Typography.H5>

            {/* Google Sign In */}
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
                  {submitting ? "Signing in…" : "Sign up with Google"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Login Link */}

            <View style={styles.footer}>
              <Typography.H5 color={colors.text.secondary}>
                Already have an account?{' '}
              </Typography.H5>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                <Typography.H5 color={theme.brand.primary} style={styles.link}>
                  {submitting ? "Please wait…" : "Log in"}
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  scrollContentWithKeyboard: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.h5,
  },
  form: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  signUpButton: {
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
    marginBottom: theme.spacing.sm,
  },
});

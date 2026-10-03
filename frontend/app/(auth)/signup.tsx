import ArtSignup from "@/assets/images/art_signup.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AntDesign } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignUp() {
  const requestPending = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

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
    if (authError) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [authError]);

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
    const cleanName = name.trim();
    const cleanUsername = username.trim();

    if (!cleanEmail || !password || !cleanName || !cleanUsername) {
      setAuthError("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
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
      const error = await signUpWithPassword(cleanEmail, password, {
        name: cleanName,
        username: cleanUsername,
      });

      if (error) {
        setAuthError(error);
        return;
      }

      alert("Check your email to confirm your account.");
      router.replace("/(auth)/login");
    } catch (error) {
      setAuthError(
        getErrorMessage(error, "Unable to create your account. Please try again.")
      );
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

      router.replace("/");
    } catch (error) {
      setAuthError(
        getErrorMessage(error, "Unable to sign in with Google. Please try again.")
      );
    } finally {
      requestPending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoidingView}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              ref={scrollRef}
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
                  <ArtSignup width={320} height={180} />
                </View>
              )}

              <Animated.View entering={FadeInUp.delay(300)}>
                <Typography.H2 style={[styles.title, { color: colors.text.primary }]}>
                  Create an account
                </Typography.H2>
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(500)}>
                <Typography.H5
                  style={styles.subtitle}
                  color={colors.text.secondary}
                >
                  Easily find farms near you with built in grocery lists, recipes,
                  and awesome food!
                </Typography.H5>
              </Animated.View>

              {authError && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={[styles.errorText, { color: theme.semantic.error }]}
                >
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

              <Button
                variant="primary"
                onPress={handleSignUp}
                disabled={submitting}
                style={styles.signUpButton}
              >
                {submitting ? "Please wait…" : "Sign up"}
              </Button>

              <Typography.H5
                style={[styles.divider, { color: colors.text.tertiary }]}
              >
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
                    opacity: submitting ? 0.65 : 1,
                  },
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
                  <Text
                    style={[
                      styles.googleButtonText,
                      { color: colors.text.primary },
                    ]}
                  >
                    {submitting ? "Signing in…" : "Sign up with Google"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Typography.H5 color={colors.text.secondary}>
                  Already have an account?{" "}
                </Typography.H5>

                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => router.push("/(auth)/login")}
                >
                  <Typography.H5
                    color={theme.brand.primary}
                    style={styles.link}
                  >
                    Log in
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
  illustrationWrapper: {
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  title: {
    textAlign: "center",
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.h5,
  },
  errorText: {
    marginTop: 12,
    marginBottom: 12,
    textAlign: "center",
  },
  form: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  signUpButton: {
    marginBottom: theme.spacing.sm,
  },
  divider: {
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  googleButton: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  googleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: theme.typography.fontSizes.h5,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  googleIcon: {
    marginRight: theme.spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: theme.spacing.xs,
  },
  link: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
});
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/hooks/useTheme";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendPasswordResetEmail } = useAuth();
  const { colors } = useTheme();

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      alert("Enter the email address for your account.");
      return;
    }

    setIsSubmitting(true);
    const error = await sendPasswordResetEmail(email.trim());
    setIsSubmitting(false);

    if (error) {
      alert(error);
      return;
    }

    alert("Password reset email sent. Open the link in that email to set a new password.");
    router.replace("/(auth)/login");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <Typography.H2 style={[styles.title, { color: colors.text.primary }]}>
                Reset your password
              </Typography.H2>

              <Typography.H5 style={styles.subtitle} color={colors.text.secondary}>
                Enter your account email and we&apos;ll send you a reset link.
              </Typography.H5>

              <View style={styles.form}>
                <Input
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>

              <Button
                variant="primary"
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={styles.button}
              >
                {isSubmitting ? "Sending..." : "Send reset email"}
              </Button>

              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Typography.H5 style={styles.link} color={theme.brand.primary}>
                  Back to login
                </Typography.H5>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  form: {
    marginBottom: theme.spacing.md,
  },
  button: {
    marginBottom: theme.spacing.md,
  },
  link: {
    textAlign: "center",
    fontWeight: theme.typography.fontWeights.semibold,
  },
});

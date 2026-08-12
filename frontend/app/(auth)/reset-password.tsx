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
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session, updatePassword } = useAuth();
  const { colors } = useTheme();

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!password || !confirmPassword) {
      alert("Enter and confirm your new password.");
      return;
    }

    if (password.length < 6) {
      alert("Use a password with at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const error = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      alert(error);
      return;
    }

    alert("Password updated. You can now log in with your new password.");
    router.replace("/(tabs)");
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
                Choose a new password
              </Typography.H2>

              <Typography.H5 style={styles.subtitle} color={colors.text.secondary}>
                {session
                  ? "Set a new password for your account."
                  : "Open this screen from the reset link in your email so we can verify your account."}
              </Typography.H5>

              <View style={styles.form}>
                <Input
                  placeholder="New password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="next"
                />

                <Input
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>

              <Button
                variant="primary"
                onPress={handleSubmit}
                disabled={!session || isSubmitting}
                style={styles.button}
              >
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
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
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  button: {
    marginBottom: theme.spacing.md,
  },
});

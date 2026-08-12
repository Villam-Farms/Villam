import { useRouter } from "expo-router";
import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { theme } from "@/constants/theme";

export function OnboardingScreen({ step, title, subtitle, children, next, back, nextHref, nextLabel = "Continue", disabled = false, error }: {
  step: number; title: string; subtitle: string; children: React.ReactNode; next: () => void;
  back?: string; nextHref?: string; nextLabel?: string; disabled?: boolean; error?: string;
}) {
  "use no memo";
  const router = useRouter();

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}><Text style={styles.brand}>villam</Text><Text style={styles.step}>Step {step} of 5</Text><View style={styles.track}><View style={[styles.fill, { width: `${step * 20}%` }]} /></View></View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
        <Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>{children}
        <View style={styles.actionSpacer} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          {back && <Pressable style={[styles.routeButton, styles.back]} onPress={() => router.replace(back as never)}><Text style={styles.backText}>Back</Text></Pressable>}
          <Button style={styles.next} onPress={next} disabled={disabled}>{nextLabel}</Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export const onboardingStyles = StyleSheet.create({ gap: { height: 14 }, choices: { gap: 12 }, choice: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#D1D5DB", backgroundColor: "#FFF" }, choiceActive: { borderColor: theme.brand.primary, backgroundColor: "#FFF4E5" }, choiceText: { fontSize: 16, fontWeight: "600", color: "#374151" }, photo: { width: 150, height: 150, borderRadius: 75, alignSelf: "center", backgroundColor: "#E5E7EB", overflow: "hidden", alignItems: "center", justifyContent: "center", marginVertical: 16 }, image: { width: 150, height: 150 } });

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#FFF" }, flex: { flex: 1 }, header: { padding: 24 }, brand: { color: theme.brand.primary, fontSize: 25, fontWeight: "800" }, step: { color: "#6B7280", marginTop: 14 }, track: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 6, marginTop: 8, overflow: "hidden" }, fill: { height: 6, backgroundColor: theme.brand.primary }, content: { flexGrow: 1, padding: 24, gap: 16 }, title: { fontSize: 28, fontWeight: "700", color: "#111827" }, subtitle: { fontSize: 16, lineHeight: 23, color: "#6B7280", marginBottom: 8 }, actionSpacer: { flexGrow: 1, minHeight: 24 }, error: { color: theme.brand.red, fontWeight: "600" }, actions: { flexDirection: "row", gap: 12, paddingTop: 12 }, routeButton: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, back: { flex: 1, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D1D5DB" }, next: { flex: 2, backgroundColor: theme.brand.primary }, backText: { fontSize: 16, fontWeight: "700", color: "#374151" }, nextText: { fontSize: 16, fontWeight: "700", color: "#FFF" } });

import React, { useEffect, useRef } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { debugLog } from "@/lib/debug-log";

export function OnboardingScreen({ step, title, subtitle, children, next, back, nextLabel = "Continue", disabled = false, error }: {
  step: number; title: string; subtitle: string; children: React.ReactNode; next: () => void;
  back?: () => void; nextLabel?: string; disabled?: boolean; error?: string;
}) {
  "use no memo";
  const insets = useSafeAreaInsets();
  const layoutRef = useRef({ scrollBottom: 0, footerTop: 0, footerHeight: 0 });

  useEffect(() => {
    debugLog({
      runId: "pre-fix",
      hypothesisId: "A",
      location: "screen.tsx:mount",
      message: "OnboardingScreen mounted",
      data: { step },
    });
  }, [step]);

  const logOverlap = (source: string) => {
    const { scrollBottom, footerTop, footerHeight } = layoutRef.current;
    if (!scrollBottom || !footerTop) return;
    debugLog({
      runId: "pre-fix",
      hypothesisId: "A,F",
      location: "screen.tsx:layout",
      message: "layout overlap check",
      data: { step, source, scrollBottom, footerTop, footerHeight, overlap: scrollBottom > footerTop },
    });
  };

  const goNext = () => {
    Keyboard.dismiss();
    try {
      debugLog({
        runId: "pre-fix",
        hypothesisId: "A,B,E",
        location: "screen.tsx:goNext:entry",
        message: "goNext called",
        data: { step, disabled, error: error ?? null },
      });
      next();
      debugLog({
        runId: "pre-fix",
        hypothesisId: "B,E",
        location: "screen.tsx:goNext:afterNext",
        message: "next() returned without sync throw",
        data: { step },
      });
    } catch (e) {
      debugLog({
        runId: "pre-fix",
        hypothesisId: "E",
        location: "screen.tsx:goNext:catch",
        message: "next() threw synchronously",
        data: { step, error: String(e) },
      });
      Alert.alert("Unable to continue", "Please try again.");
    }
  };
  const goBack = () => {
    Keyboard.dismiss();
    back?.();
  };

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={styles.header}><Text style={styles.brand}>villam</Text><Text style={styles.step}>Step {step} of 5</Text><View style={styles.track}><View style={[styles.fill, { width: `${step * 20}%` }]} /></View></View>
      <ScrollView
        testID="onboarding-scroll"
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          layoutRef.current.scrollBottom = y + height;
          logOverlap("scroll");
        }}
      >
        <Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>{children}
        <View style={styles.actionSpacer} />
      </ScrollView>
      <View
        testID="onboarding-footer"
        pointerEvents="box-none"
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          layoutRef.current.footerTop = y;
          layoutRef.current.footerHeight = height;
          logOverlap("footer");
        }}
      >
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View pointerEvents="auto" style={styles.actions}>
          {back && <Pressable accessibilityRole="button" hitSlop={16} style={[styles.routeButton, styles.back]} onPress={goBack}><Text style={styles.backText}>Back</Text></Pressable>}
          <Pressable
            accessibilityRole="button"
            hitSlop={16}
            disabled={disabled}
            onPressIn={() => {
              debugLog({
                runId: "pre-fix",
                hypothesisId: "A",
                location: "screen.tsx:continue:pressIn",
                message: "Continue pressIn fired",
                data: { step, disabled },
              });
            }}
            onPress={goNext}
            style={({ pressed }) => [styles.routeButton, styles.next, pressed && styles.pressed, disabled && styles.disabled]}
          >
            <Text style={styles.nextText}>{nextLabel}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export const onboardingStyles = StyleSheet.create({ gap: { height: 14 }, choices: { gap: 12 }, choice: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#D1D5DB", backgroundColor: "#FFF" }, choiceActive: { borderColor: theme.brand.primary, backgroundColor: "#FFF4E5" }, choiceText: { fontSize: 16, fontWeight: "600", color: "#374151" }, photo: { width: 150, height: 150, borderRadius: 75, alignSelf: "center", backgroundColor: "#E5E7EB", overflow: "hidden", alignItems: "center", justifyContent: "center", marginVertical: 16 }, image: { width: 150, height: 150 } });

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#FFF" }, flex: { flex: 1 }, header: { padding: 24 }, brand: { color: theme.brand.primary, fontSize: 25, fontWeight: "800" }, step: { color: "#6B7280", marginTop: 14 }, track: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 6, marginTop: 8, overflow: "hidden" }, fill: { height: 6, backgroundColor: theme.brand.primary }, content: { flexGrow: 1, padding: 24, paddingBottom: 140, gap: 16 }, title: { fontSize: 28, fontWeight: "700", color: "#111827" }, subtitle: { fontSize: 16, lineHeight: 23, color: "#6B7280", marginBottom: 8 }, actionSpacer: { flexGrow: 1, minHeight: 24 }, footer: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 20, paddingHorizontal: 24, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", backgroundColor: "#FFF" }, error: { color: theme.brand.red, fontWeight: "600", marginBottom: 8 }, actions: { flexDirection: "row", gap: 12 }, routeButton: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, back: { flex: 1, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D1D5DB" }, next: { flex: 2, backgroundColor: theme.brand.primary }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 }, backText: { fontSize: 16, fontWeight: "700", color: "#374151" }, nextText: { fontSize: 16, fontWeight: "700", color: "#FFF" } });

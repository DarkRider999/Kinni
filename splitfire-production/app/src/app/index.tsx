import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenBackground } from "@/components/ScreenBackground";
import { PulsingLogo } from "@/components/PulsingLogo";
import { colors } from "@/theme/colors";
import { spacing, typography } from "@/theme/typography";
import { brandTagline, brandName, studioName } from "@/data/brandKit";

const AUTO_ADVANCE_MS = 2600;

export default function SplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.timing(taglineFade, {
      toValue: 1,
      duration: 700,
      delay: 450,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      router.replace("/home");
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [fade, taglineFade]);

  return (
    <ScreenBackground
      glows={[
        { color: "rgba(255,27,75,0.28)", top: -100, left: -80, size: 320 },
        { color: "rgba(176,27,255,0.26)", bottom: -120, right: -80, size: 340 },
      ]}
    >
      <View style={styles.center}>
        <Animated.View style={{ opacity: fade }}>
          <PulsingLogo size={150} />
        </Animated.View>

        <Animated.View style={{ opacity: fade, marginTop: spacing.xl, alignItems: "center" }}>
          <Text style={styles.brandName}>{brandName}</Text>
          <Text style={styles.studioName}>{studioName}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: taglineFade, marginTop: spacing.lg }}>
          <Text style={styles.tagline}>{brandTagline}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: taglineFade }]}>
        <View style={styles.dotRow}>
          <View style={[styles.dot, { backgroundColor: colors.neonRed }]} />
          <View style={[styles.dot, { backgroundColor: colors.neonPurple }]} />
          <View style={[styles.dot, { backgroundColor: colors.neonBlue }]} />
        </View>
      </Animated.View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  brandName: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  studioName: { ...typography.caption, color: colors.textSecondary, marginTop: 4, letterSpacing: 1 },
  tagline: { ...typography.tagline, color: colors.neonRedSoft, textAlign: "center" },
  footer: { alignItems: "center", paddingBottom: spacing.xxl },
  dotRow: { flexDirection: "row", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.85 },
});

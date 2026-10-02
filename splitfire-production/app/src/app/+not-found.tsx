import React from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { ScreenBackground } from "@/components/ScreenBackground";
import { NeonButton } from "@/components/NeonButton";
import { colors } from "@/theme/colors";
import { spacing, typography } from "@/theme/typography";

export default function NotFoundScreen() {
  return (
    <ScreenBackground>
      <Text style={styles.title}>Signal lost</Text>
      <Text style={styles.body}>That screen doesn't exist in SplitFire Production.</Text>
      <NeonButton label="Back to Home" icon="home" onPress={() => router.replace("/home")} style={styles.button} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center", marginTop: 160 },
  body: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.xl },
  button: { marginTop: spacing.xl, alignSelf: "center" },
});

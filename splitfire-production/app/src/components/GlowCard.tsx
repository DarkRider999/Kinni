import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/typography";

interface GlowCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accentColor?: string;
  padded?: boolean;
}

/** A dark glass panel with a faint neon border glow. Base building block for cards/sheets. */
export function GlowCard({ children, onPress, style, accentColor = colors.neonPurple, padded = true }: GlowCardProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: any) => [
        styles.base,
        padded && styles.padded,
        { borderColor: hexToRgba(accentColor, 0.28), shadowColor: accentColor },
        onPress && pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      <LinearGradient colors={colors.gradientCard} style={StyleSheet.absoluteFill} />
      {children}
    </Wrapper>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  padded: { padding: 16 },
});

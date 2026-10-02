import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";

interface GlowSpot {
  color: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size?: number;
}

interface ScreenBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  glows?: GlowSpot[];
}

const defaultGlows: GlowSpot[] = [
  { color: "rgba(255,27,75,0.22)", top: -80, left: -60, size: 260 },
  { color: "rgba(176,27,255,0.2)", top: 160, right: -90, size: 300 },
  { color: "rgba(27,231,255,0.16)", bottom: -60, left: -40, size: 260 },
];

/** Full-bleed dark stage gradient with soft neon glow spots, used behind every screen. */
export function ScreenBackground({ children, style, glows = defaultGlows }: ScreenBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient colors={colors.gradientStage} style={StyleSheet.absoluteFill} />
      {glows.map((glow, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.glow,
            {
              backgroundColor: glow.color,
              width: glow.size ?? 240,
              height: glow.size ?? 240,
              borderRadius: (glow.size ?? 240) / 2,
              top: glow.top,
              bottom: glow.bottom,
              left: glow.left,
              right: glow.right,
            },
          ]}
        />
      ))}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  glow: { position: "absolute", opacity: 0.9 },
  content: { flex: 1 },
});

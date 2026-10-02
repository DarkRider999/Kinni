import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "@/theme/colors";
import { spacing, typography } from "@/theme/typography";
import type { IconName } from "@/types";

interface SliderRowProps {
  label: string;
  icon?: IconName;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  valueSuffix?: string;
  accentColor?: string;
}

export function SliderRow({
  label,
  icon,
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  valueSuffix = "%",
  accentColor = colors.neonPurple,
}: SliderRowProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          {icon ? <MaterialCommunityIcons name={icon} size={16} color={accentColor} /> : null}
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={[styles.value, { color: accentColor }]}>
          {Math.round(value)}
          {valueSuffix}
        </Text>
      </View>
      <Slider
        value={value}
        onValueChange={onValueChange}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        minimumTrackTintColor={accentColor}
        maximumTrackTintColor="rgba(255,255,255,0.12)"
        thumbTintColor={accentColor}
        style={styles.slider}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  labelLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { ...typography.bodyStrong, color: colors.textPrimary, marginLeft: 6 },
  value: { ...typography.bodyStrong, fontVariant: ["tabular-nums"] },
  slider: { width: "100%", height: 32 },
});

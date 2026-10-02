import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  caption?: string;
}

interface ChipSelectorProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accentColor?: string;
}

export function ChipSelector<T extends string>({
  options,
  value,
  onChange,
  accentColor = colors.neonRed,
}: ChipSelectorProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              active && { backgroundColor: accentColor, borderColor: accentColor },
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
            {option.caption ? (
              <Text style={[styles.caption, active && styles.captionActive]}>{option.caption}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
  },
  label: { ...typography.bodyStrong, fontSize: 13, color: colors.textPrimary },
  labelActive: { color: colors.textOnNeon },
  caption: { ...typography.caption, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  captionActive: { color: colors.textOnNeon, opacity: 0.75 },
});

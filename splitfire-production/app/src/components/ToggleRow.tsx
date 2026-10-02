import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "@/theme/colors";
import { spacing, typography } from "@/theme/typography";
import type { IconName } from "@/types";

interface ToggleRowProps {
  label: string;
  description?: string;
  icon?: IconName;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accentColor?: string;
}

export function ToggleRow({
  label,
  description,
  icon,
  value,
  onValueChange,
  accentColor = colors.neonRed,
}: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon ? (
          <View style={[styles.iconWrap, { borderColor: accentColor }]}>
            <MaterialCommunityIcons name={icon} size={16} color={accentColor} />
          </View>
        ) : null}
        <View style={styles.textCol}>
          <Text style={styles.label}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "rgba(255,255,255,0.12)", true: accentColor }}
        thumbColor={colors.textPrimary}
        ios_backgroundColor="rgba(255,255,255,0.12)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: spacing.sm },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  textCol: { flex: 1 },
  label: { ...typography.bodyStrong, color: colors.textPrimary },
  description: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});

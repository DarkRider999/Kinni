import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme/colors";
import { radius, spacing, typography } from "@/theme/typography";
import type { IconName } from "@/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

interface NeonButtonProps {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  iconPosition?: "left" | "right";
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  gradient?: readonly [string, string];
}

const gradientByVariant: Record<Variant, readonly [string, string]> = {
  primary: colors.gradientRedPurple,
  secondary: colors.gradientPurpleBlue,
  ghost: ["transparent", "transparent"],
  danger: ["#FF3B5C", "#7A0F23"],
};

const sizeStyles: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 9, paddingHorizontal: 16, fontSize: 13 },
  md: { paddingVertical: 14, paddingHorizontal: 22, fontSize: 15 },
  lg: { paddingVertical: 17, paddingHorizontal: 26, fontSize: 16 },
};

export function NeonButton({
  label,
  onPress,
  icon,
  iconPosition = "left",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  gradient,
}: NeonButtonProps) {
  const isGhost = variant === "ghost";
  const dims = sizeStyles[size];

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const content = (
    <View style={styles.inner}>
      {icon && iconPosition === "left" ? (
        <MaterialCommunityIcons
          name={icon}
          size={dims.fontSize + 4}
          color={isGhost ? colors.textPrimary : colors.textOnNeon}
          style={styles.iconLeft}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.neonRed : colors.textOnNeon} />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { fontSize: dims.fontSize },
            isGhost ? styles.labelGhost : styles.labelSolid,
          ]}
        >
          {label}
        </Text>
      )}
      {icon && iconPosition === "right" ? (
        <MaterialCommunityIcons
          name={icon}
          size={dims.fontSize + 4}
          color={isGhost ? colors.textPrimary : colors.textOnNeon}
          style={styles.iconRight}
        />
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        fullWidth && styles.fullWidth,
        { opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        style,
      ]}
    >
      {isGhost ? (
        <View
          style={[
            styles.ghostBase,
            { paddingVertical: dims.paddingVertical, paddingHorizontal: dims.paddingHorizontal },
          ]}
        >
          {content}
        </View>
      ) : (
        <LinearGradient
          colors={gradient ?? gradientByVariant[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.solidBase,
            { paddingVertical: dims.paddingVertical, paddingHorizontal: dims.paddingHorizontal },
          ]}
        >
          {content}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: "100%" },
  inner: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  solidBase: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.neonRed,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ghostBase: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  label: { fontWeight: "700", letterSpacing: 0.3 },
  labelSolid: { color: colors.textOnNeon },
  labelGhost: { color: colors.textPrimary },
  iconLeft: { marginRight: spacing.xs },
  iconRight: { marginLeft: spacing.xs },
});
